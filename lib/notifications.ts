/**
 * Notification helper for 444Radio
 * Centralized notification creation for all app events
 */

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type NotificationType = 
  | 'like' 
  | 'follow' 
  | 'purchase' 
  | 'download'
  | 'wallet_deposit' 
  | 'wallet_conversion'
  | 'credit_purchase' 
  | 'credit_award'
  | 'credit_deduct'
  | 'generation_complete' 
  | 'generation_failed'
  | 'revenue_earned'
  | 'subscription'
  | 'billing'
  | 'quest_complete'
  | 'achievement'
  | 'system';

interface NotificationData {
  userId: string;
  type: NotificationType;
  data: Record<string, any>;
}

async function supabaseRest(path: string, options?: RequestInit) {
  if (!SB_URL || !SB_KEY) {
    console.error('[Notifications] Missing Supabase credentials');
    return null;
  }

  try {
    const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
      ...options,
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...(options?.headers || {}),
      },
    });
    return res;
  } catch (error) {
    console.error('[Notifications] Supabase request failed:', error);
    return null;
  }
}

/**
 * Create a notification for a user
 * Non-blocking - logs errors but doesn't throw
 */
export async function createNotification({ userId, type, data }: NotificationData): Promise<boolean> {
  try {
    const res = await supabaseRest('notifications', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        type,
        data
      })
    });

    if (!res || !res.ok) {
      const error = res ? await res.text() : 'No response';
      console.error(`[Notifications] Failed to create ${type} notification for ${userId}:`, error);
      return false;
    }

    console.log(`[Notifications] ✅ Created ${type} notification for ${userId}`);
    return true;
  } catch (error) {
    console.error(`[Notifications] Error creating ${type} notification:`, error);
    return false;
  }
}

/**
 * Notification helpers for common events
 */

export async function notifyLike(ownerId: string, likerId: string, mediaId: string, mediaTitle?: string) {
  return createNotification({
    userId: ownerId,
    type: 'like',
    data: { by: likerId, mediaId, mediaTitle }
  });
}

export async function notifyFollow(targetId: string, followerId: string) {
  return createNotification({
    userId: targetId,
    type: 'follow',
    data: { by: followerId }
  });
}

export async function notifyPurchase(sellerId: string, buyerId: string, trackId: string, amount: number, trackTitle?: string) {
  return createNotification({
    userId: sellerId,
    type: 'purchase',
    data: { by: buyerId, trackId, amount, trackTitle, message: `Your track was purchased for ${amount} credits!` }
  });
}

export async function notifyDownload(ownerId: string, downloaderId: string, trackId: string, trackTitle?: string) {
  return createNotification({
    userId: ownerId,
    type: 'download',
    data: { by: downloaderId, trackId, trackTitle }
  });
}

export async function notifyWalletDeposit(userId: string, amount: number, currency: string, transactionId?: string) {
  return createNotification({
    userId,
    type: 'wallet_deposit',
    data: { amount, currency, transactionId, message: `₹${amount} added to your wallet` }
  });
}

export async function notifyWalletConversion(userId: string, creditsGained: number, amountSpent: number) {
  return createNotification({
    userId,
    type: 'wallet_conversion',
    data: { creditsGained, amountSpent, message: `Converted ₹${amountSpent} to ${creditsGained} credits` }
  });
}

export async function notifyCreditPurchase(userId: string, credits: number, amount: number, currency: string) {
  return createNotification({
    userId,
    type: 'credit_purchase',
    data: { credits, amount, currency, message: `Purchased ${credits} credits for ${currency}${amount}` }
  });
}

export async function notifyCreditAward(userId: string, credits: number, reason: string) {
  return createNotification({
    userId,
    type: 'credit_award',
    data: { credits, reason, message: `Awarded ${credits} credits: ${reason}` }
  });
}

export async function notifyCreditDeduct(userId: string, credits: number, reason: string) {
  return createNotification({
    userId,
    type: 'credit_deduct',
    data: { credits, reason, message: `${credits} credits used: ${reason}` }
  });
}

export async function notifyGenerationComplete(userId: string, mediaId: string, mediaType: string, title?: string) {
  return createNotification({
    userId,
    type: 'generation_complete',
    data: { mediaId, mediaType, title, message: `Your ${mediaType} generation is ready!` }
  });
}

export async function notifyGenerationFailed(userId: string, mediaType: string, error: string) {
  return createNotification({
    userId,
    type: 'generation_failed',
    data: { mediaType, error, message: `${mediaType} generation failed. Credits have been refunded.` }
  });
}

export async function notifyRevenueEarned(userId: string, amount: number, source: string, details?: Record<string, any>) {
  return createNotification({
    userId,
    type: 'revenue_earned',
    data: { amount, source, details, message: `You earned ${amount} credits from ${source}` }
  });
}

export async function notifySubscription(userId: string, status: 'active' | 'cancelled' | 'expired', planName?: string) {
  return createNotification({
    userId,
    type: 'subscription',
    data: { status, planName, message: `Subscription ${status}${planName ? `: ${planName}` : ''}` }
  });
}

export async function notifyBilling(userId: string, amount: number, description: string, success: boolean) {
  return createNotification({
    userId,
    type: 'billing',
    data: { amount, description, success, message: success ? `Payment successful: ${description}` : `Payment failed: ${description}` }
  });
}

export async function notifyQuestComplete(userId: string, questId: string, reward: number, questName?: string) {
  return createNotification({
    userId,
    type: 'quest_complete',
    data: { questId, reward, questName, message: `Quest completed! Earned ${reward} credits.` }
  });
}

export async function notifyAchievement(userId: string, achievement: string, reward?: number) {
  return createNotification({
    userId,
    type: 'achievement',
    data: { achievement, reward, message: `Achievement unlocked: ${achievement}${reward ? ` (+${reward} credits)` : ''}` }
  });
}

export async function notifySystem(userId: string, message: string, data?: Record<string, any>) {
  return createNotification({
    userId,
    type: 'system',
    data: { message, ...data }
  });
}
