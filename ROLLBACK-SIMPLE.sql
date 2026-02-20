-- SIMPLE ROLLBACK: Just fix the free_credits column and delete duplicates
-- No transaction logging (we'll let the system track it naturally)

DO $$
DECLARE
    v_user_record RECORD;
    v_excess_credits INTEGER;
    v_deleted_count INTEGER;
    v_total_users INTEGER := 0;
BEGIN
    RAISE NOTICE '=== Starting Simple Credit Rollback ===';
    
    -- Find all users who received more than 24 credits from Free the Music campaign
    FOR v_user_record IN
        SELECT 
            ct.user_id,
            u.clerk_user_id,
            u.free_credits as current_free_credits,
            SUM(ct.amount) as total_received,
            COUNT(*) as times_awarded
        FROM credit_transactions ct
        JOIN users u ON ct.user_id = u.clerk_user_id
        WHERE ct.description LIKE '%Free the Music%'
          AND ct.metadata->>'campaign' = 'free_the_music'
          AND ct.amount > 0
        GROUP BY ct.user_id, u.clerk_user_id, u.free_credits
        HAVING SUM(ct.amount) > 24
    LOOP
        v_total_users := v_total_users + 1;
        
        -- Calculate excess credits
        v_excess_credits := v_user_record.total_received - 24;
        
        RAISE NOTICE 'Processing user %: currently has % free credits, received % total, removing % excess', 
            v_user_record.clerk_user_id, 
            v_user_record.current_free_credits,
            v_user_record.total_received, 
            v_excess_credits;
        
        -- Update free_credits column (deduct excess)
        UPDATE users
        SET free_credits = GREATEST(0, free_credits - v_excess_credits)
        WHERE clerk_user_id = v_user_record.user_id;
        
        -- Delete duplicate transaction records (keep the first one, delete the rest)
        WITH ranked_transactions AS (
            SELECT 
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY user_id 
                    ORDER BY created_at ASC
                ) as rn
            FROM credit_transactions
            WHERE user_id = v_user_record.user_id
              AND description LIKE '%Free the Music%'
              AND metadata->>'campaign' = 'free_the_music'
              AND amount > 0
        )
        DELETE FROM credit_transactions
        WHERE id IN (
            SELECT id 
            FROM ranked_transactions 
            WHERE rn > 1
        );
        
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        
        RAISE NOTICE '  ✓ Corrected: removed % excess credits, deleted % duplicate transactions',
            v_excess_credits,
            v_deleted_count;
    END LOOP;
    
    RAISE NOTICE '=== Rollback Complete: Fixed % users ===', v_total_users;
END $$;

-- Verification query
SELECT 
    clerk_user_id,
    credits as paid,
    free_credits as free,
    (credits + COALESCE(free_credits, 0)) as total,
    (SELECT COUNT(*) 
     FROM credit_transactions 
     WHERE user_id = users.clerk_user_id 
       AND description LIKE '%Free the Music%'
       AND amount > 0) as free_music_transactions
FROM users
WHERE free_credits > 0
ORDER BY total DESC
LIMIT 25;
