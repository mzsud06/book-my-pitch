// Neutral stand-in when a venue has no photo yet: plain pitch markings,
// never another venue's image.
export function PitchArt({ tone = 'light', label }: { tone?: 'light' | 'cobalt'; label?: string }) {
  const bg = tone === 'cobalt' ? '#1F3BFF' : '#E3E8F7'
  const line = tone === 'cobalt' ? 'rgba(255,255,255,0.28)' : 'rgba(31,59,255,0.22)'
  return (
    <div role="img" aria-label={label ?? 'Venue photo coming soon'} style={{ position: 'absolute', inset: 0, background: bg }}>
      <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true">
        <g fill="none" stroke={line} strokeWidth="3">
          <rect x="20" y="20" width="360" height="200" rx="6" />
          <line x1="200" y1="20" x2="200" y2="220" />
          <circle cx="200" cy="120" r="34" />
          <rect x="20" y="75" width="44" height="90" />
          <rect x="336" y="75" width="44" height="90" />
        </g>
      </svg>
    </div>
  )
}
