import Nav from '@/components/Nav'
import { Container } from '@/components/ui/Container'
import { Footer } from '@/components/Footer'

interface Props {
  title: string
  updated: string
  intro?: string
  children: React.ReactNode
}

// Shared shell for /terms and /privacy — consistent heading/paragraph
// styling for text-heavy legal content, since the rest of the app has no
// existing prose/typography system to reuse (everything else is
// component-driven cards/sections, not long-form text).
export function LegalPage({ title, updated, intro, children }: Props) {
  return (
    <>
      <Nav />
      <main style={{ position: 'relative', zIndex: 1 }}>
        <Container>
          <div
            className="anim-fade-up legal-prose"
            style={{
              maxWidth: '760px',
              margin: '0 auto',
              paddingTop: 'clamp(3rem, 7vh, 4.5rem)',
              paddingBottom: 'clamp(4rem, 8vh, 6rem)',
            }}
          >
            <h1
              style={{
                fontSize: 'clamp(28px, 4vw, 38px)',
                letterSpacing: '-0.03em',
                color: 'var(--text)',
                marginBottom: '0.5rem',
              }}
            >
              {title}
            </h1>
            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '2rem' }}>
              Last updated {updated}
            </div>

            {intro && (
              <p style={{ fontSize: '15px', lineHeight: 1.75, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '2rem' }}>
                {intro}
              </p>
            )}

            {children}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  )
}
