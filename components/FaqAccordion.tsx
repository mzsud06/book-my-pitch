'use client'

import { useState } from 'react'
import { Container } from '@/components/ui/Container'
import { SectionHeading } from '@/components/ui/SectionHeading'

const FAQS = [
  {
    q: "How does BookMyPitch actually work?",
    a: "Create or join a game in minutes. Players reserve their spot by saving a card, but nobody is charged unless the game fills completely. Once everyone's in, payment happens automatically and the pitch is locked in.",
  },
  {
    q: "Why not just organise games over WhatsApp?",
    a: "WhatsApp is fine for chatting, but chasing payments, tracking who's actually coming, and replacing dropouts is a headache. BookMyPitch handles confirmations, payments, and player management automatically, so you spend less time chasing people and more time playing.",
  },
  {
    q: "What happens if the game doesn't fill up?",
    a: "Nobody is charged. Your card is only ever authorised to hold your place — if the game doesn't reach the required number of players, nothing is taken and you're free to find another game.",
  },
  {
    q: "Why do I need to add my card if I'm not being charged yet?",
    a: "Adding your card upfront means the moment the game fills, everyone is charged automatically and the booking locks in instantly — no chasing people for payment afterwards, no risk of someone backing out after agreeing to come.",
  },
  {
    q: "What if someone doesn't show up after the game is confirmed?",
    a: "Once a game is confirmed, all players have already been charged, so the pitch booking and payment are secure regardless of individual attendance on the day.",
  },
  {
    q: "Can I get a refund if I can't make it anymore?",
    a: "Once a game is confirmed and charged, refunds aren't automatic through the platform. If something comes up, let your organiser know — they may be able to find a replacement player.",
  },
  {
    q: "How do I know the other players are real?",
    a: "Every player adds a name, phone number, and a saved card before they can join a game, the same as you. For public open games, players also need a verified account, so no one's joining anonymously.",
  },
  {
    q: "What if something goes wrong with my payment?",
    a: "If a payment fails or something looks wrong, you won't be charged and your spot won't be confirmed. You can simply try again or find another game.",
  },
]

function ChevronIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3 6l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false)
  const buttonId = `faq-btn-${index}`
  const panelId = `faq-panel-${index}`

  return (
    <div
      style={{
        borderBottom: index < FAQS.length - 1 ? '1px solid var(--border)' : 'none',
      }}
    >
      <button
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem',
          padding: 'clamp(1.125rem, 2.5vw, 1.375rem) 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(14px, 2vw, 16px)',
            fontWeight: 600,
            color: open ? 'var(--text)' : 'var(--text)',
            letterSpacing: '-0.01em',
            lineHeight: 1.35,
            flex: 1,
          }}
        >
          {q}
        </span>

        {/* Chevron — rotates and turns green when open */}
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: open ? 'rgba(198,241,53,0.10)' : 'rgba(255,255,255,0.04)',
            color: open ? 'var(--green)' : 'var(--text-tertiary)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 300ms var(--ease-out), color 200ms ease, background 200ms ease',
          }}
        >
          <ChevronIcon />
        </span>
      </button>

      {/* Answer — animated via CSS grid-template-rows trick, no JS height measurement needed */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 300ms var(--ease-out)',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'clamp(14px, 1.8vw, 15px)',
              lineHeight: 1.75,
              color: 'var(--text-secondary)',
              margin: '0 0 clamp(1.125rem, 2.5vw, 1.5rem)',
              fontWeight: 400,
              paddingRight: 'clamp(0px, 3vw, 2.5rem)',
              maxWidth: '62ch',
            }}
          >
            {a}
          </p>
        </div>
      </div>
    </div>
  )
}

export function FaqAccordion() {
  return (
    <section
      id="faq"
      style={{
        paddingTop: 'clamp(4rem, 8vh, 6rem)',
        paddingBottom: 'clamp(4rem, 8vh, 6rem)',
      }}
    >
      <Container>
        {/* Section header */}
        <div
          className="reveal-scroll"
          style={{ marginBottom: '2.75rem' }}
        >
          <SectionHeading
            eyebrow="FAQ"
            heading={
              <>
                Common questions<br />
                <span style={{ color: 'var(--green)' }}>answered.</span>
              </>
            }
          />
        </div>

        {/* Accordion card */}
        <div
          className="reveal-scroll"
          style={{
            maxWidth: '760px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-card)',
            padding: '0 clamp(1.25rem, 4vw, 2rem)',
          }}
        >
          {FAQS.map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} index={i} />
          ))}
        </div>
      </Container>
    </section>
  )
}
