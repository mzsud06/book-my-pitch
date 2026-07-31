'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export interface AdminVenue {
  id: string
  name: string
  address: string
  owner_id: string | null
  admin_approved: boolean
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean
  created_at: string
}

interface Props {
  venues: AdminVenue[]
  ownerEmails: Record<string, string | null>
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AdminVenuesClient({ venues: initial, ownerEmails }: Props) {
  const [venues, setVenues] = useState(initial)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function setApproved(venueId: string, approved: boolean) {
    setLoadingId(venueId)
    setError('')
    try {
      const res = await fetch('/api/admin/approve-venue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId, approved }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to update venue')
        return
      }
      setVenues(prev => prev.map(v => v.id === venueId ? { ...v, admin_approved: approved } : v))
    } catch {
      setError('Failed to update venue')
    } finally {
      setLoadingId(null)
    }
  }

  const pending = venues.filter(v => !v.admin_approved)
  const approved = venues.filter(v => v.admin_approved)

  const row = (v: AdminVenue) => (
    <Card key={v.id} style={{ padding: '1.1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', letterSpacing: '-0.02em', marginBottom: '2px' }}>
          {v.name}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
          {v.address}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
          Owner: {ownerEmails[v.owner_id ?? ''] ?? 'unknown'} · Signed up {formatDate(v.created_at)}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <Badge variant={v.stripe_onboarding_complete ? 'public' : 'neutral'}>
            {v.stripe_onboarding_complete ? 'Payouts verified' : 'Payouts not set up'}
          </Badge>
          {!v.stripe_account_id && (
            <Badge variant="peak">No Stripe account</Badge>
          )}
        </div>
      </div>
      <div>
        {v.admin_approved ? (
          <Button variant="secondary" size="sm" disabled={loadingId === v.id} onClick={() => setApproved(v.id, false)}>
            {loadingId === v.id ? 'Working…' : 'Revoke approval'}
          </Button>
        ) : (
          <Button variant="primary" size="sm" disabled={loadingId === v.id} onClick={() => setApproved(v.id, true)}>
            {loadingId === v.id ? 'Approving…' : 'Approve'}
          </Button>
        )}
      </div>
    </Card>
  )

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', letterSpacing: '-0.03em', marginBottom: '0.4rem' }}>
        Venue approvals
      </div>
      <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        A venue can&apos;t accept real bookings until it&apos;s approved here, regardless of Stripe status.
      </div>

      {error && (
        <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '10px', padding: '0.85rem 1rem', fontSize: '13px', color: 'var(--red)', fontWeight: 600, marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: '0.75rem' }}>
        Pending ({pending.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2.5rem' }}>
        {pending.length === 0 && (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No venues waiting on approval.</div>
        )}
        {pending.map(row)}
      </div>

      <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: '0.75rem' }}>
        Approved ({approved.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {approved.map(row)}
      </div>
    </div>
  )
}
