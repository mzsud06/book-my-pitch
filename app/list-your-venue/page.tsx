import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { FaqAccordion, FaqItemData } from '@/components/FaqAccordion'
import { Footer } from '@/components/Footer'

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
  {
    title: 'More bookings',
    body: 'Let individual players join existing games to help fill quieter sessions.',
    icon: (
      <path d="M3 17l5-5 4 4 7-8M19 8h-4M19 8v4" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  {
    title: 'Less admin',
    body: 'No WhatsApp groups, bank transfers or chasing organisers.',
    icon: (
      <>
        <path d="M4 5h16v10H8l-4 4V5Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 4l16 16" strokeLinecap="round" />
      </>
    ),
  },
  {
    title: 'Guaranteed payment',
    body: 'Players are charged together only when the game is confirmed.',
    icon: (
      <path d="M12 3l7 3v6c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6l7-3Z M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
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
    title: 'Get paid automatically',
    body: 'Groups reserve a slot and save a card, but nobody is charged until enough players join. The moment a game fills, everyone is charged at once and your payout is on its way. No chasing, no no-shows on payment.',
  },
]

const OWNER_FAQS: FaqItemData[] = [
  {
    q: 'What does BookMyPitch cost me?',
    a: "Nothing upfront. You set your own hourly pricing, and you receive the full amount via Stripe Connect, automatically, the moment a game confirms. Players pay a small platform fee (50p) and Stripe's processing fee on top of your price, neither comes out of your payout.",
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
]

export default function ListYourVenuePage() {
  return (
    <>
      <Nav />
      <main style={{ position: 'relative', zIndex: 1 }}>
        <Container>
          {/* Hero */}
          <div
            className="anim-fade-up"
            style={{
              paddingTop: 'clamp(3rem, 8vh, 5rem)',
              paddingBottom: 'clamp(2.5rem, 6vh, 3.5rem)',
              maxWidth: '680px',
            }}
          >
            <SectionHeading
              eyebrow="For venue owners"
              heading={
                <>
                  Fill your empty slots.<br />
                  <span style={{ color: 'var(--green)' }}>Get paid automatically.</span>
                </>
              }
              sub="List your pitch, connect payouts, and let BookMyPitch handle group coordination, payment collection and no-shows. You just show up to a booked pitch."
            />
            <div style={{ marginTop: '1.75rem', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link href="/owner/signup" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="lg" arrow>List your venue</Button>
              </Link>
              <Link href="/owner/login" style={{ textDecoration: 'none' }}>
                <Button variant="secondary" size="lg">Already listed? Sign in</Button>
              </Link>
            </div>
            <div style={{ marginTop: '1.25rem', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Already live: Globe Football Pitch, Bethnal Green —{' '}
              <Link href="/slots/c5d1422b-8c1e-4497-b8a4-13cd96677bdc" style={{ color: 'var(--green)', fontWeight: 700, textDecoration: 'none' }}>
                see the listing →
              </Link>
            </div>
          </div>
        </Container>

        {/* Why it matters — the outcomes, not just the mechanics */}
        <section style={{ paddingBottom: 'clamp(3rem, 7vh, 4.5rem)' }}>
          <Container>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {BENEFITS.map((b, i) => (
                <Card key={b.title} className="anim-fade-up" style={{ padding: '1.5rem', animationDelay: `${i * 60}ms` }}>
                  <div
                    style={{
                      width: '38px', height: '38px', borderRadius: '10px',
                      background: 'rgba(198,241,53,0.1)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', marginBottom: '0.9rem',
                    }}
                  >
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
                      {b.icon}
                    </svg>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.5rem', color: 'var(--text)' }}>
                    {b.title}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, fontWeight: 500 }}>
                    {b.body}
                  </div>
                </Card>
              ))}
            </div>
          </Container>
        </section>

        {/* How it works */}
        <section style={{ paddingBottom: 'clamp(3rem, 7vh, 4.5rem)' }}>
          <Container>
            <div className="anim-fade-up d-80" style={{ marginBottom: '2rem', maxWidth: '640px' }}>
              <SectionHeading eyebrow="How it works" heading="Five steps to your first booking." />
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {STEPS.map((step, i) => (
                <Card key={step.n} className="anim-fade-up" style={{ padding: '1.5rem', animationDelay: `${i * 60}ms` }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '13px',
                      fontWeight: 800,
                      color: 'var(--green)',
                      letterSpacing: '0.05em',
                      marginBottom: '0.75rem',
                    }}
                  >
                    {step.n}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.5rem', color: 'var(--text)' }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, fontWeight: 500 }}>
                    {step.body}
                  </div>
                </Card>
              ))}
            </div>
          </Container>
        </section>

        {/* Fee breakdown */}
        <section style={{ paddingBottom: 'clamp(3rem, 7vh, 4.5rem)' }}>
          <Container>
            <Card
              className="anim-fade-up"
              style={{
                padding: 'clamp(1.75rem, 4vw, 2.5rem)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '2rem',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.6rem', color: 'var(--text)' }}>
                  You set the price. You keep the price.
                </div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65, fontWeight: 500 }}>
                  Players pay your pitch price plus a small platform fee (50p/player) and Stripe&apos;s processing fee, both on top of what you set, never deducted from your payout. You receive your full pitch price automatically via Stripe Connect the moment a game confirms.
                </div>
              </div>
              <div
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '1.25rem 1.5rem',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
                  Example: £30 off-peak, 10 players
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                  <span>Your payout</span><span style={{ color: 'var(--green)' }}>£30.00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 500, color: 'var(--text-tertiary)' }}>
                  <span>Platform + processing (per player)</span><span>~£0.80</span>
                </div>
              </div>
            </Card>
          </Container>
        </section>

        <FaqAccordion
          id="owner-faq"
          eyebrow="Owner FAQ"
          heading={
            <>
              Questions venue owners<br />
              <span style={{ color: 'var(--green)' }}>usually ask.</span>
            </>
          }
          items={OWNER_FAQS}
        />

        {/* Final CTA */}
        <section style={{ paddingBottom: 'clamp(4rem, 8vh, 6rem)' }}>
          <Container>
            <Card
              className="anim-fade-up"
              style={{
                textAlign: 'center',
                padding: 'clamp(2.5rem, 6vw, 3.5rem) 1.5rem',
                border: '1px solid rgba(198,241,53,0.14)',
              }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(20px, 3vw, 26px)', letterSpacing: '-0.03em', marginBottom: '0.75rem', color: 'var(--text)' }}>
                Ready to fill your empty slots?
              </div>
              <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '1.75rem', fontWeight: 500 }}>
                Set up your venue in a few minutes.
              </div>
              <Link href="/owner/signup" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="lg" arrow>List your venue</Button>
              </Link>
              <div style={{ marginTop: '1.25rem', fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                Have questions first? Email{' '}
                <a href="mailto:masud@bookmypitch.uk?subject=Question about listing my venue" style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 700 }}>
                  masud@bookmypitch.uk
                </a>{' '}and we&apos;ll talk it through before you set anything up.
              </div>
            </Card>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  )
}
