// ── 444Radio Global Constants ──

/**
 * The Clerk user ID of the 444Radio admin account.
 * Used for admin-only route guards and credit fee collection.
 */
export const ADMIN_CLERK_ID =
  process.env.ADMIN_CLERK_ID || 'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB'

/**
 * Check if a given Clerk user ID belongs to an admin.
 */
export function isAdmin(userId: string | null | undefined): boolean {
  return !!userId && userId === ADMIN_CLERK_ID
}
