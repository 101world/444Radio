import { redirect } from 'next/navigation'

// Temporary redirect to AudioMass-based studio while we integrate native DAW
export default function StudioRedirect() {
  redirect('/studio/audiomass')
}
