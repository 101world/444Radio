-- ============================================================================
-- DIAGNOSTIC: Get function definitions to preserve logic
-- Run this to see current function implementations
-- ============================================================================

SELECT 
    n.nspname as schema,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
LEFT JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'update_updated_at_column',
    'increment_plays',
    'update_follower_counts',
    'deduct_generation_credit',
    'add_signup_credits',
    'update_listener_count',
    'cleanup_old_messages',
    'update_combined_media_likes_count',
    'sync_username_to_songs'
)
ORDER BY p.proname;
