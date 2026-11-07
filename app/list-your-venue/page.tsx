import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import { Container } from '@/components/ui/Container'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { FaqAccordion, FaqItemData } from '@/components/FaqAccordion'
import { Footer } from '@/components/Footer'
import { SquadStrip, ConfirmedStamp, LockIcon } from '@/components/SquadStrip'

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
  {
    q: 'Can I still take bookings outside BookMyPitch?',
    a: "To avoid double-bookings, bookable slots listed on BookMyPitch should be reserved exclusively for the platform. You can choose which days or time slots to list, so you're always in control of what availability you offer.",
  },
]

export default function ListYourVenuePage() {
  return (
    <>
      <Nav />
      <main style={{ position: 'relative', zIndex: 1 }}>
        {/* Hero */}
        <section style={{ paddingTop: 'clamp(2.5rem, 7vh, 4.5rem)', paddingBottom: 'clamp(2rem, 5vh, 3rem)' }}>
          <Container>
            <div className="anim-fade-up" style={{ maxWidth: 760 }}>
              <SectionHeading
                eyebrow="For venues"
                heading={
                  <>
                    Full payment<br />
                    before <span style={{ color: 'var(--brand)' }}>kick-off.</span>
                  </>
                }
                sub="Take bookings without WhatsApp threads, cash on the night or chasing anyone. Players pay when they join. You get paid when the game confirms."
              />
              <div style={{ marginTop: '1.75rem', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Link href="/owner/signup" style={{ textDecoration: 'none' }}>
                  <Button variant="primary" size="lg" arrow>List your venue</Button>
                </Link>
                <Link href="/owner/login" style={{ textDecoration: 'none' }}>
                  <Button variant="secondary" size="lg">Already listed? Sign in</Button>
                </Link>
              </div>
              <div style={{ marginTop: '1.25rem', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Already live: Globe Football Pitch, Bethnal Green.{' '}
                <Link href="/slots/c5d1422b-8c1e-4497-b8a4-13cd96677bdc" style={{ color: 'var(--text)', fontWeight: 700, borderBottom: '2px solid var(--brand)', textDecoration: 'none' }}>
                  See the listing
                </Link>
              </div>
            </div>
          </Container>
        </section>

        {/* Before / after: the same Thursday game */}
        <section style={{ background: 'var(--surface2)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: 'clamp(3rem, 7vh, 5rem) 0' }}>
          <Container>
            <div style={{ marginBottom: '2rem', maxWidth: 680 }}>
              <SectionHeading
                eyebrow="Same Thursday game, two ways"
                heading={<>Your inbox,<br /><span style={{ color: 'var(--brand)' }}>before and after.</span></>}
              />
            </div>

            <div className="vs-grid">
              {/* BEFORE */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>
                  Before: bookings by group chat
                </div>
                <div className="wa-chat" role="img" aria-label="A group chat where players say they are in, one drops out and another still owes money">
                  <div className="wa-head"><span>Thursday 7pm 5s</span><span style={{ fontWeight: 500, color: '#667781' }}>14 members</span></div>
                  <div className="wa-msg"><b>Dan</b>who&apos;s in for thurs?<div className="wa-time">17:02</div></div>
                  <div className="wa-msg"><b>Sam</b>in<div className="wa-time">17:04</div></div>
                  <div className="wa-msg"><b>Omar</b>in, will send the £6 tonight<div className="wa-time">17:09</div></div>
                  <div className="wa-msg me">Pitch is booked, need 10 by tomorrow<div className="wa-time">17:30</div></div>
                  <div className="wa-msg"><b>Kev</b>sorry bro can&apos;t make it now<div className="wa-time">Wed 21:15</div></div>
                  <div className="wa-msg me">@Jay you still owe me £6 from last week<div className="wa-time">Wed 21:40</div></div>
                  <div className="wa-msg"><b>Jay</b>will do it later<div className="wa-time">Wed 21:41</div></div>
                </div>
                <div style={{ background: 'var(--surface)', border: '1.5px dashed var(--border-strong)', borderRadius: 14, padding: '14px 16px', marginTop: 12 }}>
                  <SquadStrip filled={6} total={10} status="expired" size="md" />
                  <div className="tabular" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 10, fontWeight: 700, fontSize: 14 }}>
                    <span>Pitch paid: £36 of £60</span>
                    <span style={{ color: '#B83208' }}>4 spots empty</span>
                  </div>
                </div>
                <ul className="vs-list vs-list--bad">
                  <li>Bookings arrive by DM, phone call and cash, then get copied into a notebook.</li>
                  <li>People say they&apos;re in, then drop out the night before. You carry the empty spots.</li>
                  <li>Payments are bank transfers you have to match to a name, or cash on the night.</li>
                </ul>
              </div>

              {/* AFTER */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text)', marginBottom: 10 }}>
                  After: BookMyPitch
                </div>
                <div style={{ background: 'var(--volt-faint)', border: '1.5px solid var(--volt)', borderRadius: 18, padding: '16px 16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontStretch: '75%', fontWeight: 800, fontSize: 18 }}>Thu 19:00 · 5-a-side</span>
                    <ConfirmedStamp />
                  </div>
                  <SquadStrip filled={10} total={10} status="confirmed" size="lg" />
                  <div className="tabular" style={{ fontFamily: 'var(--font-display)', fontStretch: '75%', fontWeight: 900, fontSize: 44, lineHeight: 1, marginTop: 16 }}>
                    £60 <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.02em' }}>secured before kick-off</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><LockIcon size={13} /></span>
                    Every player paid when they joined. Your payout goes out when the game confirms.
                  </div>
                </div>
                <ul className="vs-list vs-list--good">
                  <li>Every player pays when they join, so there are no promises to chase.</li>
                  <li>A game that doesn&apos;t fill releases every hold and drops off the listing. Nobody pays, nothing to refund.</li>
                  <li>Payout lands in your bank through Stripe the moment the game confirms.</li>
                </ul>
              </div>
            </div>

            <div className="vs-numbers">
              <div><div className="vs-n">£60 / £60</div><div className="vs-l">paid before kick-off</div></div>
              <div><div className="vs-n">0</div><div className="vs-l">chasing messages</div></div>
              <div><div className="vs-n">£0</div><div className="vs-l">monthly fee, you keep your price</div></div>
            </div>
          </Container>
        </section>

        {/* How it works */}
        <section style={{ paddingTop: 'clamp(3rem, 7vh, 4.5rem)', paddingBottom: 'clamp(3rem, 7vh, 4.5rem)' }}>
          <Container>
            <div className="anim-fade-up d-80" style={{ marginBottom: '2rem', maxWidth: '640px' }}>
              <SectionHeading eyebrow="How it works" heading="Five steps to your first booking." />
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(196px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {STEPS.map((step, i) => (
                <Card key={step.n} className="anim-fade-up" style={{ padding: '1.5rem', animationDelay: `${i * 60}ms` }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)', fontStretch: '75%',
                      fontSize: '13px',
                      fontWeight: 800,
                      color: 'var(--green)',
                      letterSpacing: '0.05em',
                      marginBottom: '0.75rem',
                    }}
                  >
                    {step.n}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontStretch: '75%', fontSize: '17px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.5rem', color: 'var(--text)' }}>
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
                <div style={{ fontFamily: 'var(--font-display)', fontStretch: '75%', fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.6rem', color: 'var(--text)' }}>
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
                border: '1px solid rgba(255,79,26,0.14)',
              }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontStretch: '75%', fontSize: 'clamp(20px, 3vw, 26px)', letterSpacing: '-0.03em', marginBottom: '0.75rem', color: 'var(--text)' }}>
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
