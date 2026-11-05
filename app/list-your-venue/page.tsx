import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { FaqAccordion, FaqItemData } from '@/components/FaqAccordion'
import { Footer } from '@/components/Footer'
import { VenueCard, type VenueCardData } from '@/components/VenueCard'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'List your venue on BookMyPitch — fill empty pitch hours, get paid automatically',
  description: 'Turn spare pitch hours into confirmed, paid bookings. No monthly fees, you keep 100% of your price, payouts land via Stripe the moment a game fills.',
  openGraph: {
    title: 'List your venue on BookMyPitch',
    description: 'Turn spare pitch hours into confirmed, paid bookings — no monthly fees, you keep 100% of your price.',
    url: 'https://bookmypitch.uk/list-your-venue',
    type: 'website',
    images: [
      {
        url: 'https://bookmypitch.uk/og-image.png',
        width: 1200,
        height: 630,
      },
    ],
  },
}

const BENEFITS = [
  { title: 'More bookings', body: 'Let individual players join existing games to help fill quieter sessions.' },
  { title: 'Less admin', body: 'No WhatsApp groups, bank transfers or chasing organisers.' },
  { title: 'Paid when the game fills', body: 'Players are charged together only when the game is confirmed, and your payout follows through Stripe.' },
]

const STEPS = [
  {
    n: '01',
    title: 'List your venue',
    body: 'Tell us your venue name, address, pitch format and your pricing. Takes a few minutes, no paperwork.',
  },
  {
    n: '02',
    title: 'Connect payouts',
    body: 'Verify your details with Stripe (our payments partner) so bookings can pay out straight to your bank account.',
  },
  {
    n: '03',
    title: 'Quick review',
    body: "We do a quick manual check on every new venue before it goes live, just making sure it's a real, bookable pitch. Usually done within a day.",
  },
  {
    n: '04',
    title: 'Your slots go live',
    body: 'The next two weeks of bookable hourly slots are generated automatically from your pricing and schedule.',
  },
  {
    n: '05',
    title: 'Get paid when the game fills',
    body: 'Groups reserve a slot and save a card, but nobody is charged until enough players join. The moment a game fills, everyone is charged at once and your payout is on its way. No chasing for payment.',
  },
]

const OWNER_FAQS: FaqItemData[] = [
  {
    q: 'What does BookMyPitch cost me?',
    a: "Nothing upfront. You set your own hourly pricing, and you receive the full amount via Stripe Connect, automatically, the moment a game confirms. Players pay a small platform fee (50p) and Stripe's processing fee on top of your price, neither comes out of your payout.",
  },
  {
    q: 'Is there a contract?',
    a: 'No. There is no contract and you can leave any time. Email us and we will take your listing down.',
  },
  {
    q: 'How do I actually get paid?',
    a: "Through Stripe Connect. When you list your venue, you'll verify your business/bank details directly with Stripe (identity check + bank account), the same process used by thousands of UK marketplaces. Once verified, payouts land in your account automatically whenever a game confirms.",
  },
  {
    q: "What if a group's payment fails?",
    a: "Cards are only authorised, not charged, until every player in the group has a valid payment method confirmed. If any card fails, nobody is charged, so you're never left chasing a partial payment or a no-show on money.",
  },
  {
    q: 'Do I need to manually confirm each booking?',
    a: "No. Once a group fills their slot, payment is captured and the booking is confirmed automatically. You'll see it appear on your dashboard in real time.",
  },
  {
    q: 'Can I list more than one pitch?',
    a: "Yes, add as many as you need during signup, each with its own format, surface and pricing. If you need changes after you're live, get in touch and we'll sort it out directly.",
  },
  {
    q: 'What happens to slots that never fill?',
    a: "Nothing is charged and the slot simply expires. It drops off the public listing automatically once its time passes, so your dashboard always reflects what's actually still bookable.",
  },
  {
    q: 'Can I still take bookings outside BookMyPitch?',
    a: "To avoid double-bookings, bookable slots listed on BookMyPitch should be reserved exclusively for the platform. You can choose which days or time slots to list, so you're always in control of what availability you offer.",
  },
]

// Content only the owner can supply. While null, the page shows a clearly
// marked placeholder instead of inventing anything.
const OWNER_PHONE: string | null = '+447536394896' // call or WhatsApp
const DASHBOARD_SCREENSHOT: string | null = null // e.g. '/owner-dashboard.png'
const GLOBE_VENUE_ID = 'c5d1422b-8c1e-4497-b8a4-13cd96677bdc'

async function loadGlobe(): Promise<VenueCardData | null> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('venues')
      .select('id, name, address, photo_url, pitches(format, surface, offpeak_price, max_players)')
      .eq('id', GLOBE_VENUE_ID)
      .eq('stripe_onboarding_complete', true)
      .eq('admin_approved', true)
      .maybeSingle()
    return (data as unknown as VenueCardData) ?? null
  } catch {
    return null
  }
}

const sectionPad = { paddingBottom: 'clamp(2.5rem, 7vh, 4.5rem)' }

export default async function ListYourVenuePage() {
  const globe = await loadGlobe()
  const contactHref = OWNER_PHONE
    ? `https://wa.me/${OWNER_PHONE.replace(/\D/g, '')}`
    : 'mailto:masud@bookmypitch.uk?subject=Talk to me first about listing my venue'

  return (
    <>
      <Nav />
      <main>
        <Container>
          <div style={{ paddingTop: 'clamp(2.5rem, 8vh, 4.5rem)', paddingBottom: 'clamp(2.5rem, 6vh, 3.5rem)', maxWidth: '720px' }}>
            <SectionHeading
              eyebrow="For venues"
              heading={<>Fill your empty slots. <span style={{ color: 'var(--green)' }}>Get paid automatically.</span></>}
              sub="List your pitch, connect payouts, and let BookMyPitch handle group coordination, payment collection and no-shows. You just show up to a booked pitch."
            />
            <div style={{ marginTop: '1.75rem', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link href="/owner/signup" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="lg" arrow>List your venue</Button>
              </Link>
              <a href={contactHref} style={{ textDecoration: 'none' }} {...(OWNER_PHONE ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                <Button variant="secondary" size="lg">Talk to me first</Button>
              </a>
            </div>
            <p style={{ margin: '1rem 0 0', fontSize: '1rem', color: 'var(--text-secondary)' }}>
              No contract. Leave any time. <Link href="/owner/login" style={{ color: 'var(--green)', fontWeight: 600 }}>Already listed? Sign in</Link>
            </p>
          </div>
        </Container>

        {/* Who you'd be talking to */}
        <section style={sectionPad}>
          <Container>
            <div className="home-trust">
              <div>
                <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.6rem' }}>Talk to me first</h2>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  I&apos;m Masud Rahman, the admin at BookMyPitch. Ring or WhatsApp me before you set anything up and I&apos;ll talk you through it. You can also email{' '}
                  <a href="mailto:masud@bookmypitch.uk" style={{ color: 'var(--green)', fontWeight: 600 }}>masud@bookmypitch.uk</a>.
                </p>
                {OWNER_PHONE ? (
                  <p style={{ margin: '0.75rem 0 0', fontWeight: 600 }}>
                    <a href={`tel:${OWNER_PHONE}`} style={{ color: 'var(--green)' }}>{OWNER_PHONE}</a> (call or WhatsApp)
                  </p>
                ) : (
                  <div className="needs-content" style={{ marginTop: '1rem' }}>
                    <strong>Placeholder:</strong> add Masud&apos;s phone or WhatsApp number (OWNER_PHONE in app/list-your-venue/page.tsx). Until then the button above opens an email.
                  </div>
                )}
              </div>
              <div>
                <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.6rem' }}>No contract</h2>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                  There is nothing to sign and no monthly fee. If it isn&apos;t working for you, email us and we&apos;ll take your listing down.
                </p>
              </div>
            </div>
          </Container>
        </section>

        {/* Benefits: plain text, no icon cards */}
        <section style={sectionPad}>
          <Container>
            <div className="home-steps" style={{ gridTemplateColumns: undefined }}>
              {BENEFITS.map(b => (
                <div key={b.title} style={{ borderTop: '2px solid var(--text)', paddingTop: '1rem' }}>
                  <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.4rem' }}>{b.title}</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{b.body}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* Live example + dashboard */}
        <section style={sectionPad}>
          <Container>
            <SectionHeading heading="What your listing looks like" sub="Globe Football Pitch in Bethnal Green is live now. Players see this and book from it." />
            <div className="owner-example" style={{ marginTop: '1.75rem' }}>
              <div>
                {globe ? (
                  <VenueCard venue={globe} />
                ) : (
                  <Card style={{ padding: '1.25rem' }}>
                    <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.4rem' }}>Globe Football Pitch, Bethnal Green</h3>
                    <Link href={`/slots/${GLOBE_VENUE_ID}`} style={{ color: 'var(--green)', fontWeight: 600 }}>See the live listing</Link>
                  </Card>
                )}
                <p style={{ margin: '0.75rem 0 0' }}>
                  <Link href={`/slots/${GLOBE_VENUE_ID}`} style={{ color: 'var(--green)', fontWeight: 600 }}>Open the full listing</Link>
                </p>
              </div>
              <div>
                {DASHBOARD_SCREENSHOT ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={DASHBOARD_SCREENSHOT} alt="The BookMyPitch owner dashboard showing a confirmed booking" style={{ width: '100%', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }} />
                ) : (
                  <div className="needs-content">
                    <strong>Placeholder:</strong> add a real screenshot of the owner dashboard or a confirmed booking (DASHBOARD_SCREENSHOT in app/list-your-venue/page.tsx). Blur any player names first.
                  </div>
                )}
              </div>
            </div>
          </Container>
        </section>

        {/* How it works */}
        <section style={sectionPad}>
          <Container>
            <SectionHeading heading="Five steps to your first booking" />
            <ol style={{ listStyle: 'none', padding: 0, margin: '1.75rem 0 0', display: 'grid', gap: '1.5rem', maxWidth: '720px' }}>
              {STEPS.map((step, i) => (
                <li key={step.n} style={{ display: 'grid', gridTemplateColumns: '2.25rem 1fr', gap: '0.75rem', alignItems: 'start' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--green)', lineHeight: 1.1 }}>{i + 1}</span>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.25rem' }}>{step.title}</h3>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        {/* One worked example */}
        <section style={sectionPad}>
          <Container>
            <Card style={{ padding: 'clamp(1.5rem, 4vw, 2.25rem)', maxWidth: '720px' }}>
              <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.75rem' }}>You set the price. You keep the price.</h2>
              <p style={{ margin: '0 0 1.25rem', color: 'var(--text-secondary)' }}>
                Players pay your pitch price, plus a 50p booking fee and a 30p payment fee on top. Neither comes out of your payout.
              </p>
              <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-lg)', padding: '1.1rem 1.25rem', fontVariantNumeric: 'tabular-nums' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.6rem' }}>Example: you charge £30 for an hour, 10 players</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}><span>Each player pays your share</span><span>£3.00</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}><span>Booking fee and payment fee</span><span>£0.80</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontWeight: 600, borderTop: '1px solid var(--border)', marginTop: '0.5rem', paddingTop: '0.5rem' }}><span>Each player is charged</span><span>£3.80</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontWeight: 700, color: 'var(--green)', marginTop: '0.5rem' }}><span>You receive</span><span>£30.00</span></div>
              </div>
            </Card>
          </Container>
        </section>

        <FaqAccordion id="owner-faq" heading="Questions venue owners ask" items={OWNER_FAQS} />

        <section style={sectionPad}>
          <Container>
            <Card style={{ textAlign: 'center', padding: 'clamp(2rem, 6vw, 3rem) 1.5rem' }}>
              <h2 style={{ fontSize: 'var(--text-h3)', margin: '0 0 0.5rem' }}>Ready to list your pitch?</h2>
              <p style={{ margin: '0 0 1.5rem', color: 'var(--text-secondary)' }}>It takes a few minutes. No contract.</p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/owner/signup" style={{ textDecoration: 'none' }}><Button size="lg" arrow>List your venue</Button></Link>
                <a href={contactHref} style={{ textDecoration: 'none' }}><Button variant="secondary" size="lg">Talk to me first</Button></a>
              </div>
            </Card>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  )
}
