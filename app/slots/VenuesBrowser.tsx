'use client'

import { useMemo, useState } from 'react'
import { Container } from '@/components/ui/Container'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Button } from '@/components/ui/Button'
import { VenueCard, type VenueCardData } from '@/components/VenueCard'

type SortKey = 'recommended' | 'price-asc' | 'price-desc' | 'name-asc'

const SORT_LABELS: Record<SortKey, string> = {
  recommended: 'Recommended',
  'price-asc': 'Price: Low to high',
  'price-desc': 'Price: High to low',
  'name-asc': 'Name: A–Z',
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 11L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 3.5h12M4.5 8h7M6.75 12.5h2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function cheapestPerPlayer(venue: VenueCardData): number | null {
  if (!venue.pitches.length) return null
  return Math.min(...venue.pitches.map(p => p.offpeak_price / p.max_players))
}

function labelize(value: string): string {
  return value.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="filter-chip"
      aria-pressed={active}
      style={{
        padding: '7px 14px',
        borderRadius: 'var(--radius-full)',
        fontSize: '13px',
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        cursor: 'pointer',
        border: active ? '1px solid rgba(198,241,53,0.4)' : '1px solid var(--border)',
        background: active ? 'rgba(198,241,53,0.1)' : 'var(--surface2)',
        color: active ? 'var(--green)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  )
}

const priceInputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '0.55rem 0.65rem',
  color: 'var(--text)',
  fontFamily: 'var(--font-sans)',
  fontWeight: 600,
  fontSize: '13px',
}

export function VenuesBrowser({ venues }: { venues: VenueCardData[] }) {
  const [query, setQuery] = useState('')
  const [selectedFormats, setSelectedFormats] = useState<string[]>([])
  const [selectedSurfaces, setSelectedSurfaces] = useState<string[]>([])
  const [maxPrice, setMaxPrice] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('recommended')
  const [filterOpen, setFilterOpen] = useState(false)

  const allFormats = useMemo(
    () => Array.from(new Set(venues.flatMap(v => v.pitches.map(p => p.format)))).sort(),
    [venues]
  )
  const allSurfaces = useMemo(
    () => Array.from(new Set(venues.flatMap(v => v.pitches.map(p => p.surface)))).sort(),
    [venues]
  )

  const hasActiveFilters = selectedFormats.length > 0 || selectedSurfaces.length > 0 || maxPrice !== ''

  function toggle(list: string[], value: string, setList: (v: string[]) => void) {
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value])
  }

  function clearFilters() {
    setSelectedFormats([])
    setSelectedSurfaces([])
    setMaxPrice('')
  }

  function clearAll() {
    clearFilters()
    setQuery('')
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const max = maxPrice.trim() === '' ? null : Number(maxPrice)

    const filtered = venues.filter(venue => {
      if (q && !venue.name.toLowerCase().includes(q) && !venue.address.toLowerCase().includes(q)) return false
      if (selectedFormats.length) {
        const formats = venue.pitches.map(p => p.format)
        if (!formats.some(f => selectedFormats.includes(f))) return false
      }
      if (selectedSurfaces.length) {
        const surfaces = venue.pitches.map(p => p.surface)
        if (!surfaces.some(s => selectedSurfaces.includes(s))) return false
      }
      const price = cheapestPerPlayer(venue)
      if (max !== null && !Number.isNaN(max) && (price === null || price > max)) return false
      return true
    })

    const sorted = [...filtered]
    if (sortBy === 'price-asc' || sortBy === 'price-desc') {
      sorted.sort((a, b) => {
        const pa = cheapestPerPlayer(a) ?? Infinity
        const pb = cheapestPerPlayer(b) ?? Infinity
        return sortBy === 'price-asc' ? pa - pb : pb - pa
      })
    } else if (sortBy === 'name-asc') {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    }
    return sorted
  }, [venues, query, selectedFormats, selectedSurfaces, maxPrice, sortBy])

  return (
    <div style={{ paddingBottom: '5rem' }}>
      <Container>
        <div style={{ paddingTop: 'clamp(2rem, 5vh, 3rem)', paddingBottom: 'clamp(2.5rem, 5vh, 3.5rem)' }}>

          {/* Hero banner */}
          <div
            className="anim-fade-up"
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 'var(--radius-2xl)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              boxShadow: 'var(--shadow-card)',
              padding: 'clamp(1.75rem, 5vw, 3rem)',
              marginBottom: '2rem',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '-60%',
                right: '-10%',
                width: '520px',
                height: '520px',
                background: 'radial-gradient(circle, rgba(198,241,53,0.16) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'relative', maxWidth: '640px' }}>
              <Eyebrow>Venues</Eyebrow>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(2rem, 5vw, 2.75rem)',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: 'var(--text)',
                  margin: '0.6rem 0 0.65rem',
                }}
              >
                Book a pitch
              </h1>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                Find and reserve the perfect pitch for your next match. Filter by format, surface and price.
              </p>
            </div>
          </div>

          {/* Toolbar: search + count + sort */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '200px' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', display: 'flex' }}>
                <SearchIcon />
              </span>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search venues or postcode…"
                className="field-input"
                style={{
                  width: '100%',
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.7rem 1rem 0.7rem 2.5rem',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  fontSize: '14px',
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => setFilterOpen(o => !o)}
              aria-expanded={filterOpen}
              className="filter-toggle-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.6rem 1rem',
                borderRadius: 'var(--radius-full)',
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                border: filterOpen || hasActiveFilters ? '1px solid rgba(198,241,53,0.4)' : '1px solid var(--border)',
                background: filterOpen || hasActiveFilters ? 'rgba(198,241,53,0.1)' : 'var(--surface2)',
                color: filterOpen || hasActiveFilters ? 'var(--green)' : 'var(--text)',
              }}
            >
              <FilterIcon />
              Filter
            </button>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                <strong style={{ color: 'var(--text)' }}>{results.length}</strong> {results.length === 1 ? 'venue' : 'venues'}
              </span>

              <div style={{ position: 'relative' }}>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortKey)}
                  className="sort-select"
                  aria-label="Sort venues"
                  style={{
                    appearance: 'none',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-full)',
                    padding: '0.6rem 2rem 0.6rem 1rem',
                    color: 'var(--text)',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
                    <option key={key} value={key}>{SORT_LABELS[key]}</option>
                  ))}
                </select>
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }}>
                  <ChevronIcon />
                </span>
              </div>
            </div>
          </div>

          {/* Sidebar + grid */}
          <div className="venues-body">
            <aside className={`filter-sidebar${filterOpen ? ' is-open' : ''}`}>
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xl)',
                  background: 'var(--surface)',
                  padding: '1.5rem',
                  position: 'sticky',
                  top: '84px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <h2
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '14px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: 'var(--text)',
                      margin: 0,
                    }}
                  >
                    Filter
                  </h2>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--green)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Price */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
                    Max price per player
                  </div>
                  <input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    placeholder="Any"
                    value={maxPrice}
                    onChange={e => setMaxPrice(e.target.value)}
                    style={priceInputStyle}
                  />
                </div>

                {/* Format */}
                {allFormats.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
                      Format
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {allFormats.map(format => (
                        <Chip
                          key={format}
                          active={selectedFormats.includes(format)}
                          onClick={() => toggle(selectedFormats, format, setSelectedFormats)}
                        >
                          {format}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}

                {/* Surface */}
                {allSurfaces.length > 0 && (
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
                      Surface
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {allSurfaces.map(surface => (
                        <Chip
                          key={surface}
                          active={selectedSurfaces.includes(surface)}
                          onClick={() => toggle(selectedSurfaces, surface, setSelectedSurfaces)}
                        >
                          {labelize(surface)}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>

            <div>
              {results.length > 0 ? (
                <div className="venue-grid">
                  {results.map((venue, idx) => (
                    <VenueCard key={venue.id} venue={venue} index={idx} />
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    border: '1px dashed var(--border)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '3rem 1.5rem',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: '0 0 1rem' }}>
                    No venues match your filters.
                  </p>
                  <Button variant="secondary" size="sm" onClick={clearAll}>
                    Clear filters
                  </Button>
                </div>
              )}
            </div>
          </div>

        </div>
      </Container>
    </div>
  )
}
