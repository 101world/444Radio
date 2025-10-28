import { redirect } from 'next/navigation'

// Redirect to the full 444Studio with complete AudioMass integration
export default function StudioRedirect() {
  redirect('/studio/full')
}
