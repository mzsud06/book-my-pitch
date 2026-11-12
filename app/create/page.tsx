import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrganiserStatus } from '@/lib/organiser'
import Nav from '@/components/Nav'
import CreateGameForm from './CreateGameForm'

export const dynamic = 'force-dynamic'

export default async function CreatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?redirect=/create')

  const status = await getOrganiserStatus(user.id)
  const defaultName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''

  return (
    <>
      <Nav />
      <CreateGameForm payoutsReady={status.ready} hasAccount={!!status.stripeAccountId} defaultName={defaultName} />
    </>
  )
}
