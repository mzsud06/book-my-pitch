import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdminEmail } from '@/lib/adminAuth'
import Nav from '@/components/Nav'
import AdminVenuesClient, { AdminVenue } from './AdminVenuesClient'

export default async function AdminVenuesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 404 rather than redirect — a non-admin hitting this URL shouldn't be able
  // to tell the page exists at all, let alone that it's an access issue.
  if (!user || !isAdminEmail(user.email)) notFound()

  const svc = createServiceClient()
  const { data: venues } = await svc
    .from('venues')
    .select('id, name, address, owner_id, admin_approved, stripe_account_id, stripe_onboarding_complete, created_at')
    .order('created_at', { ascending: false })

  const rows = (venues ?? []) as AdminVenue[]

  // Service-role client only queries the public schema over REST — owner
  // emails live in auth.users, so resolve them individually via the admin API.
  const ownerEmails: Record<string, string | null> = {}
  await Promise.all(
    Array.from(new Set(rows.map(v => v.owner_id))).map(async (ownerId) => {
      if (!ownerId) return
      const { data } = await svc.auth.admin.getUserById(ownerId)
      ownerEmails[ownerId] = data.user?.email ?? null
    })
  )

  return (
    <>
      <Nav />
      <AdminVenuesClient venues={rows} ownerEmails={ownerEmails} />
    </>
  )
}
