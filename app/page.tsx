import Link from 'next/link'
import Nav from '@/components/Nav'

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        {/* HERO */}
        <section
          className="hero-grid"
          style={{
            maxWidth: '1100px', margin: '0 auto', padding: '5rem 1.5rem 3rem',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center',
          }}
        >
          <div>
            <div
              className="anim-fade-up d-100"
              style={{
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: 'var(--green)', marginBottom: '1.25rem',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              <span style={{ width: '20px', height: '1px', background: 'var(--green)', display: 'block' }} />
              Globe Pitch · Bethnal Green
            </div>

            <h1
              className="anim-fade-up d-200"
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: 'clamp(42px, 5vw, 68px)', lineHeight: 0.93,
                letterSpacing: '-2px', marginBottom: '1.25rem',
              }}
            >
              Fill the team.<br />
              <em style={{ fontStyle: 'normal', color: 'var(--green)', display: 'block' }}>Book the pitch.</em>
            </h1>

            <p
              className="anim-fade-up d-300"
              style={{
                fontSize: '16px', color: 'var(--muted)', lineHeight: 1.75,
                maxWidth: '400px', marginBottom: '2rem', fontWeight: 500,
              }}
            >
              Pick a slot, share the link with your mates, and when 10 players join — everyone pays automatically and the pitch is yours. No bank transfers. No chasing.
            </p>

            <div className="anim-fade-up d-400" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
              <Link href="/slots">
                <button
                  className="btn-g"
                  style={{
                    fontFamily: "'Archivo', sans-serif", fontWeight: 600, fontSize: '15px',
                    padding: '0.75rem 1.75rem', borderRadius: '6px', border: 'none',
                    cursor: 'pointer', background: 'var(--green)', color: 'var(--black)',
                    transition: 'all 0.18s',
                  }}
                >
                  Find a slot →
                </button>
              </Link>
            </div>

            <div
              className="anim-fade-up d-500"
              style={{ display: 'flex', gap: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border)' }}
            >
              {[
                { n: '10', l: 'players needed' },
                { n: '£0', l: 'charged until full' },
                { n: '4G', l: 'all-weather' },
              ].map(item => (
                <div key={item.l}>
                  <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '28px', color: 'var(--green)', lineHeight: 1 }}>{item.n}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Live slot cards preview */}
          <div className="anim-fade-up d-250" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: 'Peak · Every day', labelColor: '#FF6B6B', labelBg: 'rgba(255,68,68,0.15)', time: '18:30 – 19:30', pp: '£5.30', fill: 80, players: 8, rival: true, barColor: 'var(--amber)' },
              { label: 'Off-peak · Mon–Fri', labelColor: 'var(--green)', labelBg: 'rgba(200,244,0,0.12)', time: '16:30 – 17:30', pp: '£3.30', fill: 40, players: 4, rival: false, barColor: 'var(--green)' },
              { label: 'Weekend', labelColor: '#00B4FF', labelBg: 'rgba(0,180,255,0.12)', time: '11:00 – 12:00', pp: '£4.30', fill: 20, players: 2, rival: false, barColor: 'var(--green)' },
            ].map((card, idx) => (
              <Link
                key={card.time}
                href="/slots"
                className="slot-card-link anim-scale-in"
                style={{ animationDelay: `${350 + idx * 110}ms` }}
              >
                <div
                  className="slot-card"
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '14px', overflow: 'hidden', cursor: 'pointer',
                  }}
                >
                  <div style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{
                        fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em',
                        textTransform: 'uppercase', padding: '3px 8px', borderRadius: '4px',
                        marginBottom: '6px', display: 'inline-block',
                        background: card.labelBg, color: card.labelColor,
                      }}>
                        {card.label}
                      </div>
                      <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '20px', letterSpacing: '-0.5px' }}>
                        {card.time}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '22px', color: 'var(--green)', letterSpacing: '-0.5px' }}>
                        {card.pp}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '1px', textAlign: 'right' }}>
                        per player
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '0 1.25rem 1rem' }}>
                    <div style={{ background: 'var(--surface2)', borderRadius: '100px', height: '6px', overflow: 'hidden', marginBottom: '6px' }}>
                      <div style={{ height: '100%', borderRadius: '100px', background: card.barColor, width: `${card.fill}%` }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)' }}>
                      {card.rival
                        ? <span style={{ color: 'var(--amber)', fontWeight: 700 }}>⚡ Another group racing for this</span>
                        : <span>{card.players}/10 players joined</span>
                      }
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '4rem 1.5rem' }}>
          <div className="reveal-scroll" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: '0.75rem' }}>
            How it works
          </div>
          <div className="reveal-scroll" style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'clamp(28px, 3.5vw, 42px)', letterSpacing: '-1px', marginBottom: '2.5rem' }}>
            Four steps to kickoff
          </div>

          <div
            className="steps-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}
          >
            {[
              { n: '01', t: 'Find an open slot', d: 'Browse available times at Globe Pitch and pick one that works for you and your mates.' },
              { n: '02', t: 'Share the link', d: "You get a unique link for your session. Drop it in the group chat — takes 5 seconds." },
              { n: '03', t: 'Mates join', d: "Friends click the link, add their card details. Nobody gets charged yet — zero commitment until you're full." },
              { n: '04', t: '10 players = booked', d: 'The moment the 10th player joins, everyone pays their share automatically and the pitch is confirmed.' },
            ].map((step, idx) => (
              <div
                key={step.n}
                className="reveal-scroll"
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '10px', padding: '1.5rem',
                  animationDelay: `${idx * 80}ms`,
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: '36px', color: '#C6F135', lineHeight: 1, marginBottom: '0.75rem' }}>{step.n}</div>
                <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '0.4rem' }}>{step.t}</div>
                <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.65, fontWeight: 500 }}>{step.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* PITCH OWNER ENQUIRY */}
        <section style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '4rem 1.5rem', textAlign: 'center' }}>
          <div className="reveal-scroll" style={{ maxWidth: '520px', margin: '0 auto' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: '0.75rem' }}>
              For pitch owners
            </div>
            <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'clamp(28px, 3.5vw, 42px)', letterSpacing: '-1px', marginBottom: '1rem' }}>
              Want to list your pitch?
            </div>
            <p style={{ fontSize: '16px', color: 'var(--muted)', lineHeight: 1.75, fontWeight: 500, marginBottom: '2rem' }}>
              We handle bookings, payments and player coordination automatically. No more WhatsApp messages, no more chasing bank transfers. Money lands in your account the moment a game confirms.
            </p>
            <a href="mailto:hello@bookmypitch.uk" style={{ textDecoration: 'none' }}>
              <button
                className="btn-g"
                style={{
                  fontFamily: "'Archivo', sans-serif", fontWeight: 600, fontSize: '15px',
                  padding: '0.75rem 1.75rem', borderRadius: '6px', border: 'none',
                  cursor: 'pointer', background: 'var(--green)', color: 'var(--black)',
                  transition: 'all 0.18s',
                }}
              >
                Get in touch →
              </button>
            </a>
          </div>
        </section>

        <footer style={{ textAlign: 'center', padding: '3rem 1.5rem', borderTop: '1px solid var(--border)', fontSize: '13px', color: 'var(--muted)' }}>
          <strong style={{ color: 'var(--green)' }}>BookMyPitch.uk</strong> · Globe Football Pitch · 110 Globe Rd, Bethnal Green E1 4DZ
        </footer>
      </main>
    </>
  )
}
