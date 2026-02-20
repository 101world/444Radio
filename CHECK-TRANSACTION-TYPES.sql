-- Check what transaction types are allowed
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'credit_transactions'::regclass
  AND conname LIKE '%type%';

-- Also check what types currently exist in the table
SELECT DISTINCT type, COUNT(*) as count
FROM credit_transactions
GROUP BY type
ORDER BY count DESC;
