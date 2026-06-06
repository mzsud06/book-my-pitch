import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/my-bookings'

  // Prevent open-redirect: only allow relative paths that start with a single /
  // Reject //evil.com (protocol-relative) and anything containing ://
  const safePath =
    typeof next === 'string' &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.includes('://')
      ? next
      : '/my-bookings'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${safePath}`)
    }
  }

  return NextResponse.redirect(
    `${origin}/auth/login?message=Could+not+authenticate.+Please+try+again.`
  )
}
