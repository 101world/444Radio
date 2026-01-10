-- Manual credit delivery for 4th failed payment
-- Payment ID: pay_S2KfPN84pBAIIE
-- Payment Link: plink_S2KfK46urRT3dP
-- Date: Jan 11, 2026

-- First find the user from payment link reference_id or notes
-- You need to check Razorpay dashboard for the clerk_user_id in payment notes

-- Once you have the clerk_user_id, run:
UPDATE users 
SET 
  credits = credits + 100,
  subscription_status = 'active',
  subscription_plan = 'plan_S2DGVK6J270rtt'
WHERE clerk_user_id = 'USER_ID_FROM_RAZORPAY_DASHBOARD';

-- Verify:
SELECT clerk_user_id, credits, subscription_status, subscription_plan 
FROM users 
WHERE clerk_user_id = 'USER_ID_FROM_RAZORPAY_DASHBOARD';
