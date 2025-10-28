import { redirect } from 'next/navigation'

// Redirect to the main 444Studio DAW
export default function StudioRedirect() {
  redirect('/studio/daw')
}
