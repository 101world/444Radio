/**
 * Format username for display
 * - Returns actual username if available and not a default Clerk ID
 * - Falls back to a friendly display format for Clerk IDs
 */
export function formatUsername(username: string | null | undefined): string {
  if (!username) return 'User'
  
  // If username starts with 'user_' (Clerk default ID), make it friendly
  if (username.startsWith('user_')) {
    return username.replace('user_', 'User')
  }
  
  return username
}

/**
 * Get display username from multiple possible sources
 */
export function getDisplayUsername(
  username?: string | null,
  clerkUsername?: string | null,
  firstName?: string | null,
  email?: string | null
): string {
  // Priority order: custom username > clerk username > first name > email username > default
  if (username && !username.startsWith('user_')) {
    return username
  }
  
  if (clerkUsername && !clerkUsername.startsWith('user_')) {
    return clerkUsername
  }
  
  if (firstName) {
    return firstName
  }
  
  if (email) {
    return email.split('@')[0]
  }
  
  if (username) {
    return formatUsername(username)
  }
  
  if (clerkUsername) {
    return formatUsername(clerkUsername)
  }
  
  return 'User'
}
