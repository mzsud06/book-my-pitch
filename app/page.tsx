import Link from 'next/link'
import Nav from '@/components/Nav'

export default function HomePage() {
  return (
    <>
      <Nav />
      <main style={{ position: 'relative', zIndex: 1 }}>

        {/* ============================================================
            HERO
            ============================================================ */}
        <section
          className="hero-grid"
          style={{
            maxWidth: '1140px',
            margin: '0 auto',
            padding: '6rem 2rem 4rem',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '5rem',
            alignItems: 'center',
          }}
        >
          {/* LEFT */}
          <div>
            {/* Eyebrow */}
            <div
              className="anim-fade-up d-60"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '1.75rem',
              }}
            >
              <span
                style={{
                  width: '28px',
                  height: '2px',
                  background: 'var(--green)',
                  display: 'block',
                  borderRadius: '2px',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--green)',
                }}
              >
                Globe Pitch · Bethnal Green
              </span>
            </div>

            {/* Headline */}
            <h1
              className="anim-fade-up d-100"
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: 'clamp(58px, 7.5vw, 112px)',
                lineHeight: 0.88,
                letterSpacing: '-0.04em',
                margin: '0 0 0.1em',
              }}
            >
              Fill the team.
            </h1>
            <h1
              className="anim-fade-up d-160"
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: 'clamp(58px, 7.5vw, 112px)',
                lineHeight: 0.88,
                letterSpacing: '-0.04em',
                color: 'var(--green)',
                marginBottom: '1.75rem',
              }}
            >
              Book the pitch.
            </h1>

            <p
              className="anim-fade-up d-240"
              style={{
                fontSize: '17px',
                color: 'var(--muted)',
                lineHeight: 1.75,
                maxWidth: '360px',
                marginBottom: '2.25rem',
                fontWeight: 500,
              }}
            >
              Share a link with your mates. Once 10 players join, everyone pays their share. The pitch is yours.
            </p>

            {/* CTA */}
            <div className="anim-fade-up d-320" style={{ marginBottom: '3.5rem' }}>
              <Link href="/slots" style={{ textDecoration: 'none' }}>
                <button
                  className="btn-g"
                  style={{
                    fontFamily: "'Archivo Black', sans-serif",
                    fontSize: '16px',
                    letterSpacing: '-0.025em',
                    padding: '1rem 2.5rem',
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    background: 'var(--green)',
                    color: 'var(--black)',
                    transition: 'background 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                    lineHeight: 1,
                  }}
                >
                  Find a slot →
                </button>
              </Link>
            </div>

            {/* Stats */}
            <div
              className="anim-fade-up d-420"
              style={{
                display: 'flex',
                gap: '0',
                paddingTop: '2rem',
                borderTop: '1px solid var(--border)',
              }}
            >
              {[
                { n: '10', l: 'players needed' },
                { n: '£0', l: 'charged until full' },
                { n: '4G', l: 'all-weather pitch' },
              ].map((item, idx) => (
                <div
                  key={item.l}
                  className="anim-fade-up"
                  style={{
                    animationDelay: `${460 + idx * 55}ms`,
                    flex: 1,
                    paddingRight: idx < 2 ? '2rem' : 0,
                    borderRight: idx < 2 ? '1px solid var(--border)' : 'none',
                    marginRight: idx < 2 ? '2rem' : 0,
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'Archivo Black', sans-serif",
                      fontSize: 'clamp(32px, 4vw, 48px)',
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
                      marginTop: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
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
            className="anim-fade-up d-200"
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            {[
              {
                label: 'Peak · Every day',
                labelColor: '#FF6B6B',
                labelBg: 'rgba(255,68,68,0.12)',
                time: '18:30 – 19:30',
                pp: '£5.00',
                players: 8,
                rival: true,
                segClass: 'lit-amber',
              },
              {
                label: 'Off-peak · Mon–Fri',
                labelColor: 'var(--green)',
                labelBg: 'rgba(198,241,53,0.09)',
                time: '16:30 – 17:30',
                pp: '£3.00',
                players: 4,
                rival: false,
                segClass: 'lit-green',
              },
              {
                label: 'Weekend',
                labelColor: '#00B4FF',
                labelBg: 'rgba(0,180,255,0.09)',
                time: '09:30 – 10:30',
                pp: '£4.00',
                players: 2,
                rival: false,
                segClass: 'lit-green',
              },
            ].map((card, idx) => (
              <Link
                key={card.time}
                href="/slots"
                className="slot-card-link anim-scale-in"
                style={{ animationDelay: `${300 + idx * 90}ms` }}
              >
                <div
                  className="slot-card"
                  style={{
                    background: 'linear-gradient(145deg, #131313 0%, #0f0f0f 100%)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '18px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
                  }}
                >
                  <div style={{ padding: '1.5rem 1.75rem 1.4rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '1.1rem',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontFamily: "'Archivo Black', sans-serif",
                            fontSize: '26px',
                            letterSpacing: '-0.04em',
                            lineHeight: 1,
                            marginBottom: '10px',
                          }}
                        >
                          {card.time}
                        </div>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            padding: '3px 9px',
                            borderRadius: '5px',
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
                            fontSize: '32px',
                            color: 'var(--green)',
                            letterSpacing: '-0.04em',
                            lineHeight: 1,
                          }}
                        >
                          {card.pp}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px', fontWeight: 500 }}>
                          per player
                        </div>
                      </div>
                    </div>

                    {/* Segmented bar */}
                    <div className="seg-bar" style={{ marginBottom: '8px' }}>
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
                        marginTop: '2px',
                      }}
                    >
                      {card.rival ? (
                        <span style={{ color: 'var(--amber)', fontWeight: 700, letterSpacing: '0.01em' }}>
                          ⚡ Another group racing for this
                        </span>
                      ) : (
                        <span style={{ fontWeight: 600 }}>
                          {card.players}/10 players joined
                        </span>
                      )}
                      {!card.rival && (
                        <span style={{ color: 'var(--green)', fontWeight: 700 }}>
                          {10 - card.players} spots left
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
        <section style={{ maxWidth: '1140px', margin: '0 auto', padding: '6rem 2rem' }}>
          {/* Section header */}
          <div
            className="reveal-scroll"
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginBottom: '3rem',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--green)',
                  marginBottom: '0.75rem',
                }}
              >
                How it works
              </div>
              <h2
                style={{
                  fontFamily: "'Archivo Black', sans-serif",
                  fontSize: 'clamp(32px, 4vw, 54px)',
                  letterSpacing: '-0.04em',
                  lineHeight: 0.92,
                  margin: 0,
                }}
              >
                Four steps<br />
                <span style={{ color: 'var(--green)' }}>to kickoff.</span>
              </h2>
            </div>
            <Link href="/slots" style={{ textDecoration: 'none', flexShrink: 0 }}>
              <button
                className="btn-ghost"
                style={{
                  fontFamily: "'Archivo Black', sans-serif",
                  fontSize: '14px',
                  letterSpacing: '-0.02em',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: 'var(--muted)',
                  transition: 'all 0.18s var(--ease-out)',
                  whiteSpace: 'nowrap',
                }}
              >
                Browse slots →
              </button>
            </Link>
          </div>

          <div
            className="steps-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}
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
                  background: 'linear-gradient(145deg, #131313 0%, #0f0f0f 100%)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '18px',
                  padding: '2rem 1.75rem 1.75rem',
                  position: 'relative',
                  overflow: 'hidden',
                  animationDelay: `${idx * 55}ms`,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
              >
                {/* Watermark number */}
                <div
                  style={{
                    position: 'absolute',
                    right: '-4px',
                    bottom: '-20px',
                    fontFamily: "'Archivo Black', sans-serif",
                    fontSize: '160px',
                    color: 'var(--green)',
                    opacity: 0.055,
                    lineHeight: 1,
                    letterSpacing: '-6px',
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}
                >
                  {step.n}
                </div>

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div
                    style={{
                      fontFamily: "'Archivo Black', sans-serif",
                      fontSize: '15px',
                      marginBottom: '0.7rem',
                      letterSpacing: '-0.025em',
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
            PITCH OWNER — lime break
            ============================================================ */}
        <section
          style={{
            background: 'var(--green)',
            padding: '6rem 2rem',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative concentric rings */}
          {[640, 440, 260].map((size, i) => (
            <div
              key={size}
              aria-hidden
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: `${size}px`,
                height: `${size}px`,
                border: `1px solid rgba(0,0,0,${0.13 + i * 0.06})`,
                borderRadius: '50%',
                pointerEvents: 'none',
              }}
            />
          ))}

          <div className="reveal-scroll" style={{ maxWidth: '560px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'rgba(0,0,0,0.42)',
                marginBottom: '1.25rem',
              }}
            >
              For pitch owners
            </div>
            <h2
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: 'clamp(32px, 4vw, 56px)',
                letterSpacing: '-0.04em',
                lineHeight: 0.92,
                marginBottom: '1.5rem',
                color: 'var(--black)',
              }}
            >
              Want to list your pitch?
            </h2>
            <p
              style={{
                fontSize: '17px',
                color: 'rgba(0,0,0,0.56)',
                lineHeight: 1.75,
                fontWeight: 500,
                marginBottom: '2.5rem',
              }}
            >
              We handle bookings, payments and player coordination automatically. No more WhatsApp messages, no more chasing bank transfers. Money lands in your account the moment a game confirms.
            </p>
            <a href="mailto:masud.bookmypitch@gmail.com" style={{ textDecoration: 'none' }}>
              <button
                className="btn-dark-on-lime"
                style={{
                  fontFamily: "'Archivo Black', sans-serif",
                  fontSize: '16px',
                  letterSpacing: '-0.025em',
                  padding: '1rem 2.5rem',
                  borderRadius: '10px',
                  border: '2px solid var(--black)',
                  cursor: 'pointer',
                  background: 'var(--black)',
                  color: 'var(--green)',
                  transition: 'background 0.15s ease, transform 0.18s var(--ease-out), box-shadow 0.18s ease',
                  lineHeight: 1,
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
            padding: '2.5rem 2rem',
          }}
        >
          <div
            style={{
              maxWidth: '1140px',
              margin: '0 auto',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
              <strong
                style={{
                  color: 'var(--green)',
                  fontFamily: "'Archivo Black', sans-serif",
                  fontSize: '15px',
                  letterSpacing: '-0.03em',
                  marginRight: '12px',
                }}
              >
                BookMyPitch.uk
              </strong>
              Globe Football Pitch · 110 Globe Rd, Bethnal Green E1 4DZ
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(104,104,104,0.5)', fontWeight: 500 }}>
              © 2025 BookMyPitch.uk
            </div>
          </div>
        </footer>
      </main>
    </>
  )
}
