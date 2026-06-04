import Link from 'next/link'
import Nav from '@/components/Nav'

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        {/* ============================================================
            HERO
            ============================================================ */}
        <section
          className="hero-grid"
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            padding: '5rem 1.5rem 3.5rem',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4rem',
            alignItems: 'center',
          }}
        >
          {/* LEFT — headline + CTA */}
          <div>
            <div
              className="anim-fade-up d-100"
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--green)',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span style={{ width: '24px', height: '2px', background: 'var(--green)', display: 'block', borderRadius: '2px' }} />
              Globe Pitch · Bethnal Green
            </div>

            <h1
              className="anim-fade-up d-150"
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: 'clamp(56px, 6.8vw, 100px)',
                lineHeight: 0.9,
                letterSpacing: '-0.035em',
                marginBottom: '1.5rem',
                margin: '0 0 0.25rem',
              }}
            >
              Fill the team.
            </h1>
            <h1
              className="anim-fade-up d-200"
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: 'clamp(56px, 6.8vw, 100px)',
                lineHeight: 0.9,
                letterSpacing: '-0.035em',
                color: 'var(--green)',
                marginBottom: '1.75rem',
              }}
            >
              Book the pitch.
            </h1>

            <p
              className="anim-fade-up d-300"
              style={{
                fontSize: '17px',
                color: 'var(--muted)',
                lineHeight: 1.7,
                maxWidth: '380px',
                marginBottom: '2.25rem',
                fontWeight: 500,
              }}
            >
              Share a link with your mates. Once 10 players join, everyone pays their share. The pitch is yours.
            </p>

            <div className="anim-fade-up d-400" style={{ marginBottom: '3rem' }}>
              <Link href="/slots" style={{ textDecoration: 'none' }}>
                <button
                  className="btn-g"
                  style={{
                    fontFamily: "'Archivo Black', sans-serif",
                    fontSize: '16px',
                    padding: '0.9rem 2.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    background: 'var(--green)',
                    color: 'var(--black)',
                    letterSpacing: '-0.02em',
                    transition: 'background 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                  }}
                >
                  Find a slot →
                </button>
              </Link>
            </div>

            {/* Stats */}
            <div
              className="anim-fade-up d-500"
              style={{
                display: 'flex',
                gap: '2.5rem',
                paddingTop: '2rem',
                borderTop: '1px solid var(--border)',
              }}
            >
              {[
                { n: '10', l: 'players needed', delay: 500 },
                { n: '£0', l: 'charged until full', delay: 560 },
                { n: '4G', l: 'all-weather', delay: 620 },
              ].map(item => (
                <div key={item.l} className="anim-fade-up" style={{ animationDelay: `${item.delay}ms` }}>
                  <div
                    style={{
                      fontFamily: "'Archivo Black', sans-serif",
                      fontSize: '42px',
                      color: 'var(--green)',
                      lineHeight: 1,
                      letterSpacing: '-0.04em',
                    }}
                  >
                    {item.n}
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: 'var(--muted)',
                      marginTop: '5px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      fontWeight: 700,
                    }}
                  >
                    {item.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — live slot preview cards */}
          <div
            className="anim-fade-up d-250"
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            {[
              {
                label: 'Peak · Every day',
                labelColor: '#FF6B6B',
                labelBg: 'rgba(255,68,68,0.14)',
                time: '18:30 – 19:30',
                pp: '£5.30',
                players: 8,
                rival: true,
                barColor: 'var(--amber)',
                segClass: 'lit-amber',
              },
              {
                label: 'Off-peak · Mon-Fri',
                labelColor: 'var(--green)',
                labelBg: 'rgba(198,241,53,0.1)',
                time: '16:30 – 17:30',
                pp: '£3.30',
                players: 4,
                rival: false,
                barColor: 'var(--green)',
                segClass: 'lit-green',
              },
              {
                label: 'Weekend',
                labelColor: '#00B4FF',
                labelBg: 'rgba(0,180,255,0.1)',
                time: '11:00 – 12:00',
                pp: '£4.30',
                players: 2,
                rival: false,
                barColor: 'var(--green)',
                segClass: 'lit-green',
              },
            ].map((card, idx) => (
              <Link
                key={card.time}
                href="/slots"
                className="slot-card-link anim-scale-in"
                style={{ animationDelay: `${340 + idx * 100}ms` }}
              >
                <div
                  className="slot-card"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                >
                  {/* Card header */}
                  <div style={{ padding: '1.1rem 1.35rem 0.85rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '0.85rem',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontFamily: "'Archivo Black', sans-serif",
                            fontSize: '22px',
                            letterSpacing: '-0.04em',
                            lineHeight: 1,
                            marginBottom: '8px',
                          }}
                        >
                          {card.time}
                        </div>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: card.labelBg,
                            color: card.labelColor,
                          }}
                        >
                          {card.label}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            fontFamily: "'Archivo Black', sans-serif",
                            fontSize: '26px',
                            color: 'var(--green)',
                            letterSpacing: '-0.04em',
                            lineHeight: 1,
                          }}
                        >
                          {card.pp}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '3px' }}>
                          per player
                        </div>
                      </div>
                    </div>

                    {/* Segmented bar — 10 discrete slots */}
                    <div className="seg-bar" style={{ marginBottom: '7px' }}>
                      {Array.from({ length: 10 }, (_, i) => (
                        <div
                          key={i}
                          className={`seg-bar-seg ${i < card.players ? card.segClass : 'unlit'}`}
                          style={{ transitionDelay: `${i * 28}ms` }}
                        />
                      ))}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: 'var(--muted)',
                      }}
                    >
                      {card.rival ? (
                        <span style={{ color: 'var(--amber)', fontWeight: 700 }}>
                          ⚡ Another group racing for this
                        </span>
                      ) : (
                        <span style={{ fontWeight: 600 }}>
                          {card.players}/10 players joined
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ============================================================
            HOW IT WORKS
            ============================================================ */}
        <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '5rem 1.5rem' }}>
          <div
            className="reveal-scroll"
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: 'clamp(30px, 3.8vw, 50px)',
              letterSpacing: '-0.035em',
              lineHeight: 0.95,
              marginBottom: '3rem',
            }}
          >
            Four steps<br />
            <span style={{ color: 'var(--green)' }}>to kickoff.</span>
          </div>

          <div
            className="steps-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}
          >
            {[
              { n: '01', t: 'Find an open slot', d: 'Browse available times at Globe Pitch and pick one that works for you.' },
              { n: '02', t: 'Share the link', d: 'You get a unique link for your session. Drop it in the group chat in seconds.' },
              { n: '03', t: 'Mates join', d: "Friends click the link and add their card. Nobody is charged yet. Zero commitment." },
              { n: '04', t: '10 players = booked', d: 'The moment the 10th player joins, everyone pays their share. Pitch confirmed.' },
            ].map((step, idx) => (
              <div
                key={step.n}
                className="step-card reveal-scroll"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '1.75rem 1.5rem',
                  position: 'relative',
                  overflow: 'hidden',
                  animationDelay: `${idx * 60}ms`,
                }}
              >
                {/* Huge watermark number */}
                <div
                  style={{
                    position: 'absolute',
                    right: '-6px',
                    bottom: '-16px',
                    fontFamily: "'Archivo Black', sans-serif",
                    fontSize: '120px',
                    color: 'var(--green)',
                    opacity: 0.055,
                    lineHeight: 1,
                    letterSpacing: '-4px',
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}
                >
                  {step.n}
                </div>

                {/* Content */}
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div
                    style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      color: 'var(--green)',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      marginBottom: '1.25rem',
                    }}
                  >
                    Step {step.n}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Archivo Black', sans-serif",
                      fontSize: '15px',
                      marginBottom: '0.6rem',
                      letterSpacing: '-0.02em',
                      lineHeight: 1.2,
                    }}
                  >
                    {step.t}
                  </div>
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--muted)',
                      lineHeight: 1.75,
                      fontWeight: 500,
                    }}
                  >
                    {step.d}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
            PITCH OWNER — full lime break
            ============================================================ */}
        <section
          style={{
            background: 'var(--green)',
            padding: '5.5rem 1.5rem',
            textAlign: 'center',
          }}
        >
          <div className="reveal-scroll" style={{ maxWidth: '540px', margin: '0 auto' }}>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'rgba(0,0,0,0.45)',
                marginBottom: '1rem',
              }}
            >
              For pitch owners
            </div>
            <div
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: 'clamp(30px, 3.8vw, 50px)',
                letterSpacing: '-0.035em',
                lineHeight: 0.95,
                marginBottom: '1.25rem',
                color: 'var(--black)',
              }}
            >
              Want to list your pitch?
            </div>
            <p
              style={{
                fontSize: '16px',
                color: 'rgba(0,0,0,0.58)',
                lineHeight: 1.75,
                fontWeight: 500,
                marginBottom: '2.25rem',
              }}
            >
              We handle bookings, payments and player coordination automatically. No more WhatsApp messages, no more chasing bank transfers. Money lands in your account the moment a game confirms.
            </p>
            <a href="mailto:hello@bookmypitch.uk" style={{ textDecoration: 'none' }}>
              <button
                className="btn-dark-on-lime"
                style={{
                  fontFamily: "'Archivo Black', sans-serif",
                  fontSize: '15px',
                  letterSpacing: '-0.02em',
                  padding: '0.9rem 2.25rem',
                  borderRadius: '8px',
                  border: '2px solid var(--black)',
                  cursor: 'pointer',
                  background: 'var(--black)',
                  color: 'var(--green)',
                  transition: 'background 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                }}
              >
                Get in touch →
              </button>
            </a>
          </div>
        </section>

        {/* ============================================================
            FOOTER
            ============================================================ */}
        <footer
          style={{
            borderTop: '1px solid var(--border)',
            padding: '2.5rem 1.5rem',
          }}
        >
          <div
            style={{
              maxWidth: '1100px',
              margin: '0 auto',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              <strong
                style={{
                  color: 'var(--green)',
                  fontFamily: "'Archivo Black', sans-serif",
                  fontSize: '15px',
                  letterSpacing: '-0.3px',
                  marginRight: '10px',
                }}
              >
                BookMyPitch.uk
              </strong>
              Globe Football Pitch · 110 Globe Rd, Bethnal Green E1 4DZ
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(90,90,90,0.6)' }}>
              © 2025 BookMyPitch.uk
            </div>
          </div>
        </footer>
      </main>
    </>
  )
}
