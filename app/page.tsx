import Link from 'next/link'
import Image from 'next/image'
import Nav from '@/components/Nav'
import PageReveal from '@/components/PageReveal'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { FaqAccordion, FaqItemData } from '@/components/FaqAccordion'
import { Footer } from '@/components/Footer'

const STEPS = [
  {
    n: '1',
    title: 'Set up your game',
    body: 'Enter the pitch, the time, the total cost and how many players. We work out each person\'s share.',
  },
  {
    n: '2',
    title: 'Share one link',
    body: 'Drop it in the group chat. Players put their card on hold. Nobody is charged yet and nobody needs an account.',
  },
  {
    n: '3',
    title: 'Book the pitch, tap confirm',
    body: 'When every spot is paid for, we email you. Book the pitch, tap confirm, and everyone is charged and the money goes to you.',
  },
]

const FAQS: FaqItemData[] = [
  {
    q: 'Do I pay anything as the organiser?',
    a: "No. Players pay their share of the pitch plus a 79p fee each. You receive the full pitch cost.",
  },
  {
    q: 'When are players charged?',
    a: "Only when you tap confirm after booking the pitch. Until then their card is held, which reserves the money without taking it. If the game doesn't go ahead, the holds are released.",
  },
  {
    q: 'What if the pitch slot has gone by the time we fill up?',
    a: "Tap \"Slot's gone\" and the game is cancelled. Nobody is charged. If you do nothing for 24 hours, it cancels itself.",
  },
  {
    q: 'When does the money reach me?',
    a: "It lands in your Stripe balance when you confirm, then pays out to your bank. Your first payout can take longer, after that it is usually a few business days. You will still have paid the pitch yourself first.",
  },
  {
    q: 'Why can I only create a game up to 6 days ahead?',
    a: "Card holds expire after about 7 days, so we keep games inside that window to make sure the money is still there when you confirm.",
  },
  {
    q: 'Why does each player pay a 79p fee?',
    a: "It covers card processing and keeps BookMyPitch running. Players see their total before they join.",
  },
]

export default function HomePage() {
  return (
    <>
      <Nav />
      <PageReveal>
      <main>
        <section style={{ position: 'relative', overflow: 'hidden', minHeight: 'min(88vh, 820px)', display: 'flex', alignItems: 'flex-end', paddingTop: 'clamp(6rem, 16vh, 10rem)', paddingBottom: 'clamp(3rem, 8vh, 5rem)' }}>
          <Image src="/hero-pitch-web.jpg" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover', objectPosition: 'center 40%', zIndex: 0 }} />
          {/* Navy fade: keeps the floodlit sky at the top, sinks into the page colour at the bottom so white type stays readable */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(180deg, rgba(11,26,46,0.15) 0%, rgba(11,26,46,0.45) 45%, rgba(11,26,46,0.92) 80%, var(--black) 100%)' }} />
          <div style={{ position: 'relative', zIndex: 2, width: '100%' }}>
          <Container>
            <div>
            <h1 style={{ fontSize: 'var(--text-hero)', letterSpacing: '-0.04em', lineHeight: 0.98, maxWidth: '15ch', marginBottom: '1.5rem', fontWeight: 600 }}>
              Stop chasing people for <span style={{ color: 'var(--green)' }}>football money.</span>
            </h1>
            <p style={{ fontSize: '1.2rem', color: 'var(--text)', opacity: 0.85, lineHeight: 1.6, maxWidth: '36rem', marginBottom: '2rem' }}>
              Share one link. Players put their card on hold, you book the pitch once it&apos;s full, and everyone pays automatically. No bank transfers, no screenshots, no reminders.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link href="/create" style={{ textDecoration: 'none' }}>
                <Button size="lg" arrow>Create a game</Button>
              </Link>
              <Link href="#how" style={{ textDecoration: 'none' }}>
                <Button size="lg" variant="secondary">How it works</Button>
              </Link>
            </div>
            </div>
          </Container>
          </div>
        </section>

        <section id="how" style={{ paddingTop: 'clamp(3rem, 6vh, 5rem)', paddingBottom: 'clamp(3rem, 6vh, 5rem)' }}>
          <Container>
            <SectionHeading eyebrow="How it works" heading={<>Three steps.<br /><span style={{ color: 'var(--green)' }}>No chasing.</span></>} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '2.5rem' }}>
              {STEPS.map(s => (
                <Card key={s.n} style={{ padding: '1.5rem' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--green)', marginBottom: '0.75rem' }}>{s.n}</div>
                  <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '0.5rem' }}>{s.title}</div>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, fontSize: '15px' }}>{s.body}</p>
                </Card>
              ))}
            </div>
          </Container>
        </section>

        <section style={{ paddingTop: 'clamp(2rem, 4vh, 3rem)', paddingBottom: 'clamp(2rem, 4vh, 3rem)' }}>
          <Container>
            <Card style={{ padding: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
              <h2 style={{ fontSize: 'var(--text-h3)', marginBottom: '0.75rem' }}>Free for organisers</h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: '40rem' }}>
                Each player pays their share of the pitch plus a 79p fee, and sees the total before they join. You get the full pitch cost, paid to your bank through Stripe.
              </p>
            </Card>
          </Container>
        </section>

        <FaqAccordion items={FAQS} />
      </main>
      </PageReveal>
      <Footer />
    </>
  )
}
