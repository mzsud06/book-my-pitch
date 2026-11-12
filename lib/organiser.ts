import Stripe from 'stripe'
import type { User } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe'

export interface OrganiserStatus {
  stripeAccountId: string | null
  ready: boolean // Stripe says this account can receive transfers and be paid out
}

function accountReady(account: Stripe.Account): boolean {
  return (
    account.details_submitted === true &&
    account.payouts_enabled === true &&
    account.capabilities?.transfers === 'active'
  )
}

// Reads the organiser's row and, if onboarding isn't marked complete yet,
// asks Stripe whether it has finished (self-healing, so coming back from the
// Stripe form needs no webhook).
export async function getOrganiserStatus(userId: string): Promise<OrganiserStatus> {
  const svc = createServiceClient()
  const { data: row } = await svc
    .from('organisers')
    .select('stripe_account_id, stripe_onboarding_complete')
    .eq('user_id', userId)
    .maybeSingle()

  const accountId = (row?.stripe_account_id as string | null) ?? null
  if (!accountId) return { stripeAccountId: null, ready: false }
  if (row?.stripe_onboarding_complete) return { stripeAccountId: accountId, ready: true }

  try {
    const account = await stripe.accounts.retrieve(accountId)
    if (accountReady(account)) {
      await svc.from('organisers').update({ stripe_onboarding_complete: true }).eq('user_id', userId)
      return { stripeAccountId: accountId, ready: true }
    }
  } catch (err) {
    console.error('getOrganiserStatus: Stripe retrieve failed', err)
  }
  return { stripeAccountId: accountId, ready: false }
}

// Creates the organiser's Stripe Express account if they don't have one yet.
export async function ensureOrganiserAccount(user: User): Promise<string> {
  const svc = createServiceClient()
  const { data: row } = await svc
    .from('organisers')
    .select('stripe_account_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (row?.stripe_account_id) return row.stripe_account_id as string

  const account = await stripe.accounts.create({
    type: 'express',
    country: 'GB',
    email: user.email,
    business_type: 'individual',
    business_profile: {
      // 7941 = sports promoters / athletic fields. Supplying mcc and url up front
      // means Stripe doesn't ask organisers for an industry or website.
      mcc: '7941',
      url: 'https://bookmypitch.uk',
      product_description: 'Collecting football pitch costs from players via BookMyPitch',
    },
    capabilities: { transfers: { requested: true } },
    metadata: { user_id: user.id },
  })

  const { error } = await svc
    .from('organisers')
    .upsert({ user_id: user.id, stripe_account_id: account.id }, { onConflict: 'user_id' })
  if (error) throw new Error(`Failed to save organiser account: ${error.message}`)
  return account.id
}
