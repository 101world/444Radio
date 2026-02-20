-- ROLLBACK DUPLICATE FREE CREDITS
-- This script removes excess credits from users who received multiple awards
-- Uses 'award' type (which is valid) with negative amount for rollback

DO $$
DECLARE
    v_user_record RECORD;
    v_excess_credits INTEGER;
    v_deleted_count INTEGER;
BEGIN
    RAISE NOTICE '=== Starting Credit Rollback ===';
    
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
        -- Calculate excess credits
        v_excess_credits := v_user_record.total_received - 24;
        
        RAISE NOTICE 'Processing user %: received %, removing % excess credits', 
            v_user_record.clerk_user_id, 
            v_user_record.total_received, 
            v_excess_credits;
        
        -- Update free_credits column (deduct excess)
        UPDATE users
        SET free_credits = GREATEST(0, free_credits - v_excess_credits)
        WHERE clerk_user_id = v_user_record.user_id;
        
        -- Log the correction as a negative 'award' transaction (rollback)
        INSERT INTO credit_transactions (
            user_id,
            amount,
            balance_after,
            type,
            status,
            description,
            metadata
        )
        SELECT 
            v_user_record.user_id,
            -v_excess_credits,  -- Negative amount
            (SELECT credits + COALESCE(free_credits, 0) 
             FROM users 
             WHERE clerk_user_id = v_user_record.user_id),
            'award',  -- Using 'award' type with negative amount
            'success',
            'Rollback: Removed duplicate Free the Music credits',
            jsonb_build_object(
                'reason', 'duplicate_award',
                'original_amount', v_user_record.total_received,
                'corrected_amount', 24,
                'excess_removed', v_excess_credits,
                'correction_date', NOW(),
                'campaign', 'free_the_music_rollback'
            );
        
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
        
        RAISE NOTICE 'Corrected user %: removed % excess credits, deleted % duplicate transactions',
            v_user_record.clerk_user_id,
            v_excess_credits,
            v_deleted_count;
    END LOOP;
    
    RAISE NOTICE '=== Rollback Complete ===';
END $$;

-- Verification query
SELECT 
    clerk_user_id,
    credits as paid,
    free_credits as free,
    (credits + COALESCE(free_credits, 0)) as total
FROM users
WHERE clerk_user_id IN (
    SELECT DISTINCT user_id 
    FROM credit_transactions 
    WHERE metadata->>'campaign' IN ('free_the_music', 'free_the_music_rollback')
)
ORDER BY total DESC;
