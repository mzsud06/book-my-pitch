import Link from 'next/link'
import Nav from '@/components/Nav'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { FaqAccordion, FaqItemData } from '@/components/FaqAccordion'
import { Footer } from '@/components/Footer'

const STEPS = [
  {
    n: '01',
    title: 'List your venue',
    body: 'Tell us your venue name, address, pitch format and your pricing. Takes a few minutes — no paperwork.',
  },
  {
    n: '02',
    title: 'Connect payouts',
    body: 'Verify your details with Stripe (our payments partner) so bookings can pay out straight to your bank account.',
  },
  {
    n: '03',
    title: 'Quick review',
    body: "We do a quick manual check on every new venue before it goes live — just making sure it's a real, bookable pitch. Usually done within a day.",
  },
  {
    n: '04',
    title: 'Your slots go live',
    body: 'The next two weeks of bookable hourly slots are generated automatically from your pricing and schedule.',
  },
  {
    n: '05',
    title: 'Get paid automatically',
    body: 'Groups reserve a slot and save a card, but nobody is charged until enough players join. The moment a game fills, everyone is charged at once and your payout is on its way — no chasing, no no-shows on payment.',
  },
]

const OWNER_FAQS: FaqItemData[] = [
  {
    q: 'What does BookMyPitch cost me?',
    a: "Nothing upfront. You set your own hourly pricing, and you receive the full amount via Stripe Connect, automatically, the moment a game confirms. Players pay a small platform fee (50p) and Stripe's processing fee on top of your price — neither comes out of your payout.",
  },
  {
    q: 'How do I actually get paid?',
    a: "Through Stripe Connect. When you list your venue, you'll verify your business/bank details directly with Stripe (identity check + bank account) — the same process used by thousands of UK marketplaces. Once verified, payouts land in your account automatically whenever a game confirms.",
  },
  {
    q: "What if a group's payment fails?",
    a: "Cards are only authorised, not charged, until every player in the group has a valid payment method confirmed. If any card fails, nobody is charged — you're never left chasing a partial payment or a no-show on money.",
  },
  {
    q: 'Do I need to manually confirm each booking?',
    a: "No. Once a group fills their slot, payment is captured and the booking is confirmed automatically — you'll see it appear on your dashboard in real time.",
  },
  {
    q: 'Can I list more than one pitch?',
    a: "Signup currently sets up one pitch per venue. If you run multiple pitches or need changes to pricing/schedule after you're live, get in touch and we'll sort it out directly.",
  },
  {
    q: 'What happens to slots that never fill?',
    a: "Nothing is charged and the slot simply expires — it drops off the public listing automatically once its time passes, so your dashboard always reflects what's actually still bookable.",
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
              sub="List your pitch, connect payouts, and let BookMyPitch handle group coordination, payment collection and no-shows — you just show up to a booked pitch."
            />
            <div style={{ marginTop: '1.75rem', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link href="/owner/signup" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="lg" arrow>List your venue</Button>
              </Link>
              <Link href="/owner/login" style={{ textDecoration: 'none' }}>
                <Button variant="secondary" size="lg">Already listed? Sign in</Button>
              </Link>
            </div>
          </div>
        </Container>

        {/* How it works */}
        <section style={{ paddingBottom: 'clamp(3rem, 7vh, 4.5rem)' }}>
          <Container>
            <div className="anim-fade-up d-80" style={{ marginBottom: '2rem', maxWidth: '640px' }}>
              <SectionHeading eyebrow="How it works" heading="Four steps to your first booking." />
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
                  Players pay your pitch price plus a small platform fee (50p/player) and Stripe&apos;s processing fee — both on top of what you set, never deducted from your payout. You receive your full pitch price automatically via Stripe Connect the moment a game confirms.
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
                  Example — £30 off-peak, 10 players
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
            </Card>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  )
}
