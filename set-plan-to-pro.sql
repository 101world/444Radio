-- Manually set Rayhaan's plan to PRO
UPDATE users
SET subscription_plan = 'pro'
WHERE email = 'rayhaanpatni@gmail.com'
AND subscription_status = 'active';

-- Verify the change
SELECT email, subscription_plan, subscription_status, credits
FROM users
WHERE email = 'rayhaanpatni@gmail.com';
