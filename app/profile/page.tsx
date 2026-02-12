import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

/**
 * /profile → server-side redirect to /profile/[currentUserId]
 * Handles both browser navigation AND RSC prefetch requests (_rsc param)
 */
export default async function ProfileRedirect() {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  redirect(`/profile/${userId}`)
}
