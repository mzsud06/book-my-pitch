'use client'

import Link from 'next/link'
import Nav from '@/components/Nav'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { StateMessage } from '@/components/ui/StateMessage'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <Nav />
      <main>
        <Container>
          <div style={{ paddingTop: 'clamp(2.5rem, 8vh, 4.5rem)', maxWidth: '640px', margin: '0 auto' }}>
            <StateMessage
              tone="error"
              title="Something went wrong"
              body="That's on our side. Nothing has been charged. Try again, and if it keeps happening email masud@bookmypitch.uk."
              action={
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button onClick={reset}>Try again</Button>
                  <Link href="/" style={{ textDecoration: 'none' }}><Button variant="secondary">Back to the homepage</Button></Link>
                </div>
              }
            />
          </div>
        </Container>
      </main>
    </>
  )
}
