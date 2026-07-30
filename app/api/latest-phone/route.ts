import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// players.phone is not selectable by the anon/authenticated client (locked down
// to prevent any client from reading other players' phone numbers), so
// autofilling a returning user's own phone number requires the service-role
// client, scoped server-side to their own user id.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ phone: null })

  const serviceClient = createServiceClient()
  const { data } = await serviceClient
    .from('players')
    .select('phone')
    .eq('user_id', user.id)
    .not('phone', 'is', null)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ phone: data?.phone ?? null })
}
