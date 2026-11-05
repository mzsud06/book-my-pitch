import Link from 'next/link'
import Nav from '@/components/Nav'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { StateMessage } from '@/components/ui/StateMessage'
import { Footer } from '@/components/Footer'

export default function NotFound() {
  return (
    <>
      <Nav />
      <main>
        <Container>
          <div style={{ paddingTop: 'clamp(2.5rem, 8vh, 4.5rem)', maxWidth: '640px', margin: '0 auto' }}>
            <StateMessage
              title="We can't find that page"
              body="The link may be old or mistyped. If a mate sent you a game link, ask them to send it again."
              action={<Link href="/slots" style={{ textDecoration: 'none' }}><Button size="lg">Book a pitch</Button></Link>}
            />
          </div>
        </Container>
      </main>
      <Footer />
    </>
  )
}
