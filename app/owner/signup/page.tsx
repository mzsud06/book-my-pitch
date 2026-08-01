'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'
import { readOwnerSignupDraft, writeOwnerSignupDraft, clearOwnerSignupDraft } from '@/lib/clientStorage'

const FORMATS = [
  { value: '5-a-side', label: '5-a-side' },
  { value: '7-a-side', label: '7-a-side' },
  { value: '11-a-side', label: '11-a-side' },
]
const SURFACES = ['2G', '3G', '4G', '5G', 'Astro', 'Indoor', 'Grass']

const AMENITIES: { key: string; label: string }[] = [
  { key: 'floodlights', label: 'Floodlights' },
  { key: 'parking', label: 'Parking' },
  { key: 'changing_rooms', label: 'Changing rooms' },
  { key: 'toilets', label: 'Toilets' },
  { key: 'showers', label: 'Showers' },
  { key: 'cafe', label: 'Café' },
  { key: 'water_fountain', label: 'Water fountain' },
]

const NOTICE_OPTIONS = [
  { value: 0, label: 'No minimum' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
  { value: 1440, label: '1 day' },
]

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
type DayKey = typeof DAY_KEYS[number]
interface DayHours { opening: string; closing: string }

interface PitchDraft {
  id: number
  name: string
  format: string
  surface: string
  samePrice: boolean
  flatPrice: string
  offpeakPrice: string
  peakPrice: string
  weekendPrice: string
}

let nextPitchId = 1
function newPitchDraft(): PitchDraft {
  return {
    id: nextPitchId++,
    name: '',
    format: '5-a-side',
    surface: '4G',
    samePrice: true,
    flatPrice: '',
    offpeakPrice: '',
    peakPrice: '',
    weekendPrice: '',
  }
}

interface FormDraft {
  email: string
  venueName: string
  addressLine: string
  postcode: string
  contactPhone: string
  openingTime: string
  closingTime: string
  weekendOpeningTime: string
  weekendClosingTime: string
  peakStartTime: string
  hoursDifferByDay: boolean
  dayHours: Record<DayKey, DayHours>
  amenities: string[]
  minBookingNoticeMinutes: number
  pitches: Omit<PitchDraft, 'id'>[]
}

export default function OwnerSignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [venueName, setVenueName] = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [postcode, setPostcode] = useState('')
  const [postcodeStatus, setPostcodeStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [postcodeArea, setPostcodeArea] = useState('')
  const [contactPhone, setContactPhone] = useState('')

  const [openingTime, setOpeningTime] = useState('15:30')
  const [closingTime, setClosingTime] = useState('21:30')
  const [weekendOpeningTime, setWeekendOpeningTime] = useState('09:30')
  const [weekendClosingTime, setWeekendClosingTime] = useState('21:30')
  const [peakStartTime, setPeakStartTime] = useState('18:30')
  const [hoursDifferByDay, setHoursDifferByDay] = useState(false)
  const [dayHours, setDayHours] = useState<Record<DayKey, DayHours>>({
    monday: { opening: '15:30', closing: '21:30' },
    tuesday: { opening: '15:30', closing: '21:30' },
    wednesday: { opening: '15:30', closing: '21:30' },
    thursday: { opening: '15:30', closing: '21:30' },
    friday: { opening: '15:30', closing: '21:30' },
    saturday: { opening: '09:30', closing: '21:30' },
    sunday: { opening: '09:30', closing: '21:30' },
  })

  const [amenities, setAmenities] = useState<string[]>([])
  const [minBookingNoticeMinutes, setMinBookingNoticeMinutes] = useState(0)
  const [pitchDrafts, setPitchDrafts] = useState<PitchDraft[]>([newPitchDraft()])

  // Not persisted to the draft (base64 photos are large — would blow past
  // localStorage's ~5-10MB quota easily). Resized/compressed client-side
  // before it ever touches the network.
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [stripeSetupPending, setStripeSetupPending] = useState(false)

  // Already logged in (player or a previous owner signup) — skip the account
  // section entirely rather than force a second, colliding signup.
  const [checkingSession, setCheckingSession] = useState(true)
  const [existingUserEmail, setExistingUserEmail] = useState<string | null>(null)

  // Restore an in-progress draft (never the password) so a closed tab or dead
  // connection mid-fill doesn't mean starting over — form is long enough that
  // losing it is real friction.
  const restoredDraft = useRef(false)
  useEffect(() => {
    if (restoredDraft.current) return
    restoredDraft.current = true
    const draft = readOwnerSignupDraft<FormDraft>()
    if (!draft) return
    // localStorage is only reachable client-side, so this has to run in an
    // effect — restoring several fields from one persisted object on mount
    // (not on every external-state change) is the standard shape for this,
    // and React 18 batches the calls below into a single render regardless.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmail(draft.email ?? '')
    setVenueName(draft.venueName ?? '')
    setAddressLine(draft.addressLine ?? '')
    setPostcode(draft.postcode ?? '')
    setContactPhone(draft.contactPhone ?? '')
    if (draft.openingTime) setOpeningTime(draft.openingTime)
    if (draft.closingTime) setClosingTime(draft.closingTime)
    if (draft.weekendOpeningTime) setWeekendOpeningTime(draft.weekendOpeningTime)
    if (draft.weekendClosingTime) setWeekendClosingTime(draft.weekendClosingTime)
    if (draft.peakStartTime) setPeakStartTime(draft.peakStartTime)
    if (draft.hoursDifferByDay) setHoursDifferByDay(true)
    if (draft.dayHours) setDayHours(prev => ({ ...prev, ...draft.dayHours }))
    if (draft.amenities) setAmenities(draft.amenities)
    if (typeof draft.minBookingNoticeMinutes === 'number') setMinBookingNoticeMinutes(draft.minBookingNoticeMinutes)
    if (draft.pitches?.length) {
      setPitchDrafts(draft.pitches.map(p => ({ ...p, id: nextPitchId++ })))
    }
  }, [])

  // Persist on every change (excluding password) — cheap localStorage write,
  // no debounce needed at this form size.
  useEffect(() => {
    if (!restoredDraft.current) return
    writeOwnerSignupDraft<FormDraft>({
      email, venueName, addressLine, postcode, contactPhone,
      openingTime, closingTime, weekendOpeningTime, weekendClosingTime, peakStartTime,
      hoursDifferByDay, dayHours, amenities, minBookingNoticeMinutes,
      pitches: pitchDrafts.map(({ id, ...rest }) => rest),
    })
  }, [email, venueName, addressLine, postcode, contactPhone, openingTime, closingTime, weekendOpeningTime, weekendClosingTime, peakStartTime, hoursDifferByDay, dayHours, amenities, minBookingNoticeMinutes, pitchDrafts])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setExistingUserEmail(data.user?.email ?? null)
      setCheckingSession(false)
    })
  }, [])

  async function handleSignOut() {
    await createClient().auth.signOut()
    setExistingUserEmail(null)
  }

  // Postcodes.io is free and needs no API key, but only resolves the general
  // area (borough/district), not a full street address — UK has no free
  // full-address lookup. This still saves a typo-prone step: confirms the
  // postcode is real and shows the area back for reassurance.
  async function checkPostcode(value: string) {
    const cleaned = value.trim()
    if (!cleaned) {
      setPostcodeStatus('idle')
      setPostcodeArea('')
      return
    }
    setPostcodeStatus('checking')
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}`)
      const data = await res.json()
      if (res.ok && data.result) {
        setPostcodeStatus('valid')
        setPostcodeArea(data.result.admin_district ?? data.result.parish ?? '')
      } else {
        setPostcodeStatus('invalid')
        setPostcodeArea('')
      }
    } catch {
      // Network hiccup — don't block signup over a postcode-lookup outage.
      setPostcodeStatus('idle')
      setPostcodeArea('')
    }
  }

  // Downscales + re-encodes as JPEG client-side so a phone photo (often
  // 4-8MB) never inflates into a multi-megabyte JSON body — keeps the
  // request comfortably under serverless body-size limits.
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError('')
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const maxDim = 1600
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          setPhotoError('Could not process that image')
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = () => setPhotoError('Could not read that image')
      img.src = reader.result as string
    }
    reader.onerror = () => setPhotoError('Could not read that file')
    reader.readAsDataURL(file)
  }

  function updatePitch(id: number, patch: Partial<PitchDraft>) {
    setPitchDrafts(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  function addPitch() {
    setPitchDrafts(prev => [...prev, newPitchDraft()])
  }

  function removePitch(id: number) {
    setPitchDrafts(prev => prev.length > 1 ? prev.filter(p => p.id !== id) : prev)
  }

  function updateDayHours(day: DayKey, patch: Partial<DayHours>) {
    setDayHours(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }))
  }

  function toggleAmenity(key: string) {
    setAmenities(prev => prev.includes(key) ? prev.filter(a => a !== key) : [...prev, key])
  }

  const needsPeakPricing = pitchDrafts.some(p => !p.samePrice)

  function validate(): string | null {
    if (!existingUserEmail) {
      const atIdx = email.indexOf('@')
      if (atIdx < 0 || !email.slice(atIdx + 1).includes('.')) return 'Please enter a valid email address'
      if (password.length < 8) return 'Password must be at least 8 characters'
      if (password !== confirmPassword) return 'Passwords do not match'
    }
    if (!venueName.trim()) return 'Please enter your venue name'
    if (!addressLine.trim()) return 'Please enter your street address'
    if (!postcode.trim()) return 'Please enter your postcode'
    if (!contactPhone.trim() || !/^[0-9+()\s-]{7,20}$/.test(contactPhone.trim())) return 'Please enter a valid contact phone number'

    if (hoursDifferByDay) {
      for (const day of DAY_KEYS) {
        const h = dayHours[day]
        if (h.closing <= h.opening) return `${day.charAt(0).toUpperCase() + day.slice(1)}: closing time must be later than opening time`
      }
    } else {
      if (closingTime <= openingTime) return 'Weekday closing time must be later than opening time (hours past midnight aren\'t supported yet)'
      if (weekendClosingTime <= weekendOpeningTime) return 'Weekend closing time must be later than opening time (hours past midnight aren\'t supported yet)'
    }

    if (needsPeakPricing && peakStartTime >= closingTime && peakStartTime >= weekendClosingTime) {
      return 'Peak pricing must start before your venue closes'
    }

    for (let i = 0; i < pitchDrafts.length; i++) {
      const p = pitchDrafts[i]
      const label = pitchDrafts.length > 1 ? `Pitch ${i + 1}` : 'Pitch'
      const prices = p.samePrice
        ? [['price', p.flatPrice]] as const
        : [['Off-peak', p.offpeakPrice], ['Peak', p.peakPrice], ['Weekend', p.weekendPrice]] as const
      for (const [name, val] of prices) {
        const n = Number(val)
        if (!val || !Number.isInteger(n) || n < 1 || n > 500) {
          return `${label}: ${name} price must be a whole number between £1 and £500`
        }
      }
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError('')

    try {
      const pitches = pitchDrafts.map(p => ({
        name: p.name.trim() || null,
        format: p.format,
        surface: p.surface,
        offpeakPrice: Number(p.samePrice ? p.flatPrice : p.offpeakPrice),
        peakPrice: Number(p.samePrice ? p.flatPrice : p.peakPrice),
        weekendPrice: Number(p.samePrice ? p.flatPrice : p.weekendPrice),
      }))

      const res = await fetch('/api/owner/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          venueName,
          address: `${addressLine.trim()}, ${postcode.trim()}`,
          contactPhone: contactPhone.trim(),
          openingTime,
          closingTime,
          weekendOpeningTime,
          weekendClosingTime,
          peakStartTime,
          dailyHours: hoursDifferByDay ? dayHours : null,
          amenities,
          minBookingNoticeMinutes,
          photoDataUrl,
          pitches,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to create account')
        setLoading(false)
        return
      }

      if (!data.sessionCreated) {
        // Email confirmation required — venue/pitches already exist server-side,
        // Stripe setup just waits until they log in.
        clearOwnerSignupDraft()
        setEmailSent(true)
        setLoading(false)
        return
      }

      const linkRes = await fetch('/api/owner/stripe-onboarding-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId: data.venueId }),
      })
      const linkData = await linkRes.json()

      if (!linkRes.ok) {
        // Venue + pitches already exist at this point (only the Stripe step
        // failed) — leaving the form open would let them resubmit and hit
        // an "email already registered" error, since the account is already
        // made. Switch to a dedicated recovery screen instead.
        clearOwnerSignupDraft()
        setStripeSetupPending(true)
        setLoading(false)
        return
      }

      clearOwnerSignupDraft()
      window.location.href = linkData.url
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '0.85rem 1rem',
    color: 'var(--text)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--muted)',
    marginBottom: '7px',
    display: 'block',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  }

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--green)',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    marginBottom: '0.9rem',
    marginTop: '0.5rem',
  }

  const fieldWrap = (label: string, children: React.ReactNode) => (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )

  const STEPS = ['Venue details', 'Stripe payouts', 'Review & approval']

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--black)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: '-10vh',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '400px',
          background: 'radial-gradient(ellipse at center, rgba(198,241,53,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div style={{ width: '100%', maxWidth: '540px', position: 'relative', zIndex: 1 }}>
        <div className="anim-fade-up" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '-0.04em', color: 'var(--text)', lineHeight: 1 }}>
              Book<span style={{ color: 'var(--green)' }}>My</span>Pitch
              <span style={{ color: 'var(--green)', fontSize: '13px', verticalAlign: 'super', marginLeft: '1px' }}>.uk</span>
            </span>
          </Link>
        </div>

        <Card
          className="anim-fade-up d-80"
          style={{
            border: '1px solid rgba(255,255,255,0.09)',
            borderTop: '2px solid var(--green)',
            padding: '2rem',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {stripeSetupPending ? (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div
                style={{
                  width: '64px', height: '64px', background: 'rgba(22,48,31,0.7)',
                  border: '1px solid rgba(198,241,53,0.25)', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '26px', margin: '0 auto 1.5rem', color: 'var(--green)',
                }}
              >
                ✓
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', letterSpacing: '-0.03em', marginBottom: '0.75rem', color: 'var(--text)' }}>
                Your venue is set up
              </div>
              <div style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.65, marginBottom: '2rem' }}>
                We couldn&apos;t start Stripe payouts setup just now, that&apos;s the only thing that didn&apos;t finish.
                {' '}Log in and we&apos;ll pick up right where you left off.
              </div>
              <Link href="/owner/login" style={{ color: 'var(--green)', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
                Go to owner login →
              </Link>
            </div>
          ) : emailSent ? (
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div
                style={{
                  width: '64px', height: '64px', background: 'rgba(22,48,31,0.7)',
                  border: '1px solid rgba(198,241,53,0.25)', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '26px', margin: '0 auto 1.5rem', color: 'var(--green)',
                }}
              >
                ✉
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', letterSpacing: '-0.03em', marginBottom: '0.75rem', color: 'var(--text)' }}>
                Check your email
              </div>
              <div style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.65, marginBottom: '2rem' }}>
                We&apos;ve sent a confirmation link to <strong style={{ color: 'var(--text)' }}>{email}</strong>.
                {' '}Your venue is already set up, click the link, then log in to finish connecting your payouts.
              </div>
              <Link href="/owner/login" style={{ color: 'var(--green)', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>
                Go to owner login →
              </Link>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '1.75rem' }}>
                <div
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    background: 'rgba(198,241,53,0.08)', border: '1px solid rgba(198,241,53,0.16)',
                    borderRadius: '6px', padding: '3px 10px', marginBottom: '1rem',
                  }}
                >
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                  <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--green)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    List your venue
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', letterSpacing: '-0.04em', lineHeight: 0.95, marginBottom: '0.9rem' }}>
                  Set up your pitch
                </div>

                {/* Progress stepper — sets expectations for how much is left */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.9rem' }}>
                  {STEPS.map((step, i) => (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : undefined }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div
                          style={{
                            width: '22px', height: '22px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: 800,
                            background: i === 0 ? 'var(--green)' : 'var(--surface2)',
                            color: i === 0 ? 'var(--black)' : 'var(--muted)',
                            border: i === 0 ? 'none' : '1px solid var(--border)',
                          }}
                        >
                          {i + 1}
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: i === 0 ? 'var(--text)' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                          {step}
                        </span>
                      </div>
                      {i < STEPS.length - 1 && <div style={{ flex: 1, height: '1px', background: 'var(--border)', margin: '0 6px 16px' }} />}
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: '14px', color: 'var(--muted)', fontWeight: 500 }}>
                  After Stripe verification, we&apos;ll review your venue (usually within one business day) before it goes live.
                </div>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {!checkingSession && existingUserEmail ? (
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                      background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px',
                      padding: '0.85rem 1rem',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600 }}>
                      Signed in as {existingUserEmail}
                    </span>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      style={{ background: 'none', border: 'none', color: 'var(--green)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}
                    >
                      Not you?
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={sectionLabelStyle}>Your account</div>
                    {fieldWrap('Email', (
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="owner@yourpitch.co.uk" style={inputStyle} />
                    ))}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {fieldWrap('Password', (
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Min 8 characters" style={inputStyle} />
                      ))}
                      {fieldWrap('Confirm password', (
                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} placeholder="Repeat password" style={inputStyle} />
                      ))}
                    </div>
                  </>
                )}

                <div style={sectionLabelStyle}>Your venue</div>
                {fieldWrap('Venue name', (
                  <input type="text" value={venueName} onChange={e => setVenueName(e.target.value)} required maxLength={120} placeholder="e.g. Globe Football Pitch" style={inputStyle} />
                ))}
                {fieldWrap('Postcode', (
                  <input
                    type="text" value={postcode}
                    onChange={e => { setPostcode(e.target.value); setPostcodeStatus('idle') }}
                    onBlur={e => checkPostcode(e.target.value)}
                    required maxLength={10} placeholder="e.g. E2 0DY" style={inputStyle}
                  />
                ))}
                {postcodeStatus === 'checking' && (
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '-6px' }}>Checking postcode…</div>
                )}
                {postcodeStatus === 'valid' && (
                  <div style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 600, marginTop: '-6px' }}>✓ {postcodeArea}</div>
                )}
                {postcodeStatus === 'invalid' && (
                  <div style={{ fontSize: '12px', color: 'var(--red)', fontWeight: 600, marginTop: '-6px' }}>Postcode not recognised — double check it</div>
                )}
                {fieldWrap('Street address', (
                  <input type="text" value={addressLine} onChange={e => setAddressLine(e.target.value)} required maxLength={250} placeholder="Street and area" style={inputStyle} />
                ))}
                {fieldWrap('Contact phone number', (
                  <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} required maxLength={20} placeholder="e.g. 07123 456789" style={inputStyle} />
                ))}
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '-6px', fontWeight: 500 }}>
                  Used if there&apos;s an issue with a booking — never shown to players.
                </div>

                {fieldWrap('Venue photo (optional for now)', (
                  <div>
                    {photoDataUrl ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photoDataUrl} alt="Venue preview" style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--border)' }} />
                        <button
                          type="button"
                          onClick={() => setPhotoDataUrl(null)}
                          style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                        >
                          Remove photo
                        </button>
                      </div>
                    ) : (
                      <label
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1px dashed var(--border)', borderRadius: '10px',
                          padding: '0.85rem', cursor: 'pointer', color: 'var(--muted)', fontSize: '13px', fontWeight: 600,
                        }}
                      >
                        Upload a photo of your venue
                        <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                      </label>
                    )}
                    {photoError && <div style={{ color: 'var(--red)', fontSize: '12px', fontWeight: 600, marginTop: '6px' }}>{photoError}</div>}
                  </div>
                ))}
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '-6px', fontWeight: 500 }}>
                  You can add more later — this just helps players see what they&apos;re booking.
                </div>

                <div style={sectionLabelStyle}>Opening hours</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)', fontWeight: 500, cursor: 'pointer', marginBottom: '2px' }}>
                  <input
                    type="checkbox"
                    checked={hoursDifferByDay}
                    onChange={e => setHoursDifferByDay(e.target.checked)}
                    style={{ width: '15px', height: '15px', accentColor: 'var(--green)' }}
                  />
                  My hours differ by day
                </label>

                {hoursDifferByDay ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {DAY_KEYS.map(day => (
                      <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: '82px', fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'capitalize', flexShrink: 0 }}>
                          {day}
                        </span>
                        <input type="time" value={dayHours[day].opening} onChange={e => updateDayHours(day, { opening: e.target.value })} required style={{ ...inputStyle, padding: '0.6rem 0.75rem' }} />
                        <span style={{ color: 'var(--muted)', fontSize: '13px' }}>–</span>
                        <input type="time" value={dayHours[day].closing} onChange={e => updateDayHours(day, { closing: e.target.value })} required style={{ ...inputStyle, padding: '0.6rem 0.75rem' }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {fieldWrap('Weekday opening time', (
                        <input type="time" value={openingTime} onChange={e => setOpeningTime(e.target.value)} required style={inputStyle} />
                      ))}
                      {fieldWrap('Weekday closing time', (
                        <input type="time" value={closingTime} onChange={e => setClosingTime(e.target.value)} required style={inputStyle} />
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {fieldWrap('Weekend opening time', (
                        <input type="time" value={weekendOpeningTime} onChange={e => setWeekendOpeningTime(e.target.value)} required style={inputStyle} />
                      ))}
                      {fieldWrap('Weekend closing time', (
                        <input type="time" value={weekendClosingTime} onChange={e => setWeekendClosingTime(e.target.value)} required style={inputStyle} />
                      ))}
                    </div>
                  </>
                )}

                {fieldWrap('Minimum booking notice', (
                  <select value={minBookingNoticeMinutes} onChange={e => setMinBookingNoticeMinutes(Number(e.target.value))} style={inputStyle}>
                    {NOTICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ))}
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '-6px', fontWeight: 500 }}>
                  How close to kickoff a game can still be booked.
                </div>

                {needsPeakPricing && (
                  <>
                    {fieldWrap('Peak pricing starts at', (
                      <input type="time" value={peakStartTime} onChange={e => setPeakStartTime(e.target.value)} required style={inputStyle} />
                    ))}
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '-6px', fontWeight: 500 }}>
                      Every day, bookings from this time use the peak price set below.
                    </div>
                  </>
                )}

                <div style={sectionLabelStyle}>Amenities</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '-4px' }}>
                  {AMENITIES.map(a => {
                    const active = amenities.includes(a.key)
                    return (
                      <button
                        type="button"
                        key={a.key}
                        onClick={() => toggleAmenity(a.key)}
                        style={{
                          fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                          padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-full)',
                          border: active ? '1px solid var(--green)' : '1px solid var(--border)',
                          background: active ? 'rgba(198,241,53,0.1)' : 'var(--surface2)',
                          color: active ? 'var(--green)' : 'var(--muted)',
                        }}
                      >
                        {active ? '✓ ' : ''}{a.label}
                      </button>
                    )
                  })}
                </div>

                <div style={sectionLabelStyle}>Your pitches</div>
                {pitchDrafts.map((p, i) => (
                  <div
                    key={p.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                        {pitchDrafts.length > 1 ? `Pitch ${i + 1}` : 'Pitch details'}
                      </div>
                      {pitchDrafts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePitch(p.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {fieldWrap('Pitch name (optional)', (
                      <input
                        type="text" value={p.name} onChange={e => updatePitch(p.id, { name: e.target.value })}
                        maxLength={60} placeholder="e.g. Main Pitch, The Cage, Court A" style={inputStyle}
                      />
                    ))}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      {fieldWrap('Format', (
                        <select value={p.format} onChange={e => updatePitch(p.id, { format: e.target.value })} style={inputStyle}>
                          {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      ))}
                      {fieldWrap('Surface', (
                        <select value={p.surface} onChange={e => updatePitch(p.id, { surface: e.target.value })} style={inputStyle}>
                          {SURFACES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ))}
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)', fontWeight: 500, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={p.samePrice}
                        onChange={e => updatePitch(p.id, { samePrice: e.target.checked })}
                        style={{ width: '15px', height: '15px', accentColor: 'var(--green)' }}
                      />
                      Same price at all times
                    </label>

                    {p.samePrice ? (
                      fieldWrap('Hourly price (£)', (
                        <input
                          type="number" min={1} max={500}
                          value={p.flatPrice}
                          onChange={e => updatePitch(p.id, { flatPrice: e.target.value })}
                          placeholder="e.g. 30"
                          style={inputStyle}
                        />
                      ))
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                        {fieldWrap('Off-peak (£)', (
                          <input type="number" min={1} max={500} value={p.offpeakPrice} onChange={e => updatePitch(p.id, { offpeakPrice: e.target.value })} placeholder="e.g. 30" style={inputStyle} />
                        ))}
                        {fieldWrap('Peak (£)', (
                          <input type="number" min={1} max={500} value={p.peakPrice} onChange={e => updatePitch(p.id, { peakPrice: e.target.value })} placeholder="e.g. 50" style={inputStyle} />
                        ))}
                        {fieldWrap('Weekend (£)', (
                          <input type="number" min={1} max={500} value={p.weekendPrice} onChange={e => updatePitch(p.id, { weekendPrice: e.target.value })} placeholder="e.g. 40" style={inputStyle} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addPitch}
                  style={{
                    background: 'none', border: '1px dashed var(--border)', borderRadius: '10px',
                    padding: '0.7rem', color: 'var(--green)', fontSize: '13px', fontWeight: 700,
                    cursor: 'pointer', letterSpacing: '-0.01em',
                  }}
                >
                  + Add another pitch
                </button>

                {error && (
                  <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: '10px', padding: '0.85rem 1rem', fontSize: '13px', color: 'var(--red)', fontWeight: 600, lineHeight: 1.5 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={!loading ? 'btn-g' : ''}
                  style={{
                    width: '100%', padding: '1rem', fontSize: '16px', borderRadius: '12px', border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    background: loading ? 'var(--surface2)' : 'var(--green)',
                    color: loading ? 'var(--muted)' : 'var(--black)',
                    fontFamily: 'var(--font-display)', fontWeight: 900, letterSpacing: '-0.025em',
                    marginTop: '4px', lineHeight: 1,
                  }}
                >
                  {loading ? 'Setting up…' : 'Continue to Stripe →'}
                </button>

                <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>
                  By continuing you agree to our{' '}
                  <Link href="/terms" style={{ color: 'var(--green)', textDecoration: 'none' }}>terms</Link>{' '}
                  and{' '}
                  <Link href="/privacy" style={{ color: 'var(--green)', textDecoration: 'none' }}>privacy policy</Link>.
                </div>
              </form>
            </>
          )}
        </Card>

        <div className="anim-fade-up d-100" style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '18px' }}>
          <Link href="/owner/login" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none', fontWeight: 500 }}>
            Already listed? Sign in
          </Link>
          <a href="mailto:masud@bookmypitch.uk?subject=Stuck on venue signup" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none', fontWeight: 500 }}>
            Stuck? Get help
          </a>
          <Link href="/" style={{ fontSize: '13px', color: 'var(--muted)', textDecoration: 'none', fontWeight: 500 }}>
            ← Back to site
          </Link>
        </div>
      </div>
    </div>
  )
}
