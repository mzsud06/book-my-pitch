'use client'

import { useEffect, useRef, useState } from 'react'

export interface Country {
  name: string
  iso2: string
  code: string
  flag: string
}

// Regional indicator flag emoji, derived from the ISO 3166-1 alpha-2 code —
// computed instead of hand-typed so a country can never end up with the wrong flag.
function flagEmoji(iso2: string): string {
  return iso2
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('')
}

// All UN member states plus the Holy See and the State of Palestine (~195 total),
// alphabetical by name. United Kingdom is pulled to the front below.
const RAW_COUNTRIES: Array<[string, string, string]> = [
  ['Afghanistan', 'AF', '+93'],
  ['Albania', 'AL', '+355'],
  ['Algeria', 'DZ', '+213'],
  ['Andorra', 'AD', '+376'],
  ['Angola', 'AO', '+244'],
  ['Antigua and Barbuda', 'AG', '+1268'],
  ['Argentina', 'AR', '+54'],
  ['Armenia', 'AM', '+374'],
  ['Australia', 'AU', '+61'],
  ['Austria', 'AT', '+43'],
  ['Azerbaijan', 'AZ', '+994'],
  ['Bahamas', 'BS', '+1242'],
  ['Bahrain', 'BH', '+973'],
  ['Bangladesh', 'BD', '+880'],
  ['Barbados', 'BB', '+1246'],
  ['Belarus', 'BY', '+375'],
  ['Belgium', 'BE', '+32'],
  ['Belize', 'BZ', '+501'],
  ['Benin', 'BJ', '+229'],
  ['Bhutan', 'BT', '+975'],
  ['Bolivia', 'BO', '+591'],
  ['Bosnia and Herzegovina', 'BA', '+387'],
  ['Botswana', 'BW', '+267'],
  ['Brazil', 'BR', '+55'],
  ['Brunei', 'BN', '+673'],
  ['Bulgaria', 'BG', '+359'],
  ['Burkina Faso', 'BF', '+226'],
  ['Burundi', 'BI', '+257'],
  ['Cabo Verde', 'CV', '+238'],
  ['Cambodia', 'KH', '+855'],
  ['Cameroon', 'CM', '+237'],
  ['Canada', 'CA', '+1'],
  ['Central African Republic', 'CF', '+236'],
  ['Chad', 'TD', '+235'],
  ['Chile', 'CL', '+56'],
  ['China', 'CN', '+86'],
  ['Colombia', 'CO', '+57'],
  ['Comoros', 'KM', '+269'],
  ['Congo (Republic of the)', 'CG', '+242'],
  ['Congo (DR)', 'CD', '+243'],
  ['Costa Rica', 'CR', '+506'],
  ['Croatia', 'HR', '+385'],
  ['Cuba', 'CU', '+53'],
  ['Cyprus', 'CY', '+357'],
  ['Czechia', 'CZ', '+420'],
  ['Denmark', 'DK', '+45'],
  ['Djibouti', 'DJ', '+253'],
  ['Dominica', 'DM', '+1767'],
  ['Dominican Republic', 'DO', '+1809'],
  ['Ecuador', 'EC', '+593'],
  ['Egypt', 'EG', '+20'],
  ['El Salvador', 'SV', '+503'],
  ['Equatorial Guinea', 'GQ', '+240'],
  ['Eritrea', 'ER', '+291'],
  ['Estonia', 'EE', '+372'],
  ['Eswatini', 'SZ', '+268'],
  ['Ethiopia', 'ET', '+251'],
  ['Fiji', 'FJ', '+679'],
  ['Finland', 'FI', '+358'],
  ['France', 'FR', '+33'],
  ['Gabon', 'GA', '+241'],
  ['Gambia', 'GM', '+220'],
  ['Georgia', 'GE', '+995'],
  ['Germany', 'DE', '+49'],
  ['Ghana', 'GH', '+233'],
  ['Greece', 'GR', '+30'],
  ['Grenada', 'GD', '+1473'],
  ['Guatemala', 'GT', '+502'],
  ['Guinea', 'GN', '+224'],
  ['Guinea-Bissau', 'GW', '+245'],
  ['Guyana', 'GY', '+592'],
  ['Haiti', 'HT', '+509'],
  ['Honduras', 'HN', '+504'],
  ['Hungary', 'HU', '+36'],
  ['Iceland', 'IS', '+354'],
  ['India', 'IN', '+91'],
  ['Indonesia', 'ID', '+62'],
  ['Iran', 'IR', '+98'],
  ['Iraq', 'IQ', '+964'],
  ['Ireland', 'IE', '+353'],
  ['Israel', 'IL', '+972'],
  ['Italy', 'IT', '+39'],
  ['Ivory Coast', 'CI', '+225'],
  ['Jamaica', 'JM', '+1876'],
  ['Japan', 'JP', '+81'],
  ['Jordan', 'JO', '+962'],
  ['Kazakhstan', 'KZ', '+7'],
  ['Kenya', 'KE', '+254'],
  ['Kiribati', 'KI', '+686'],
  ['Kuwait', 'KW', '+965'],
  ['Kyrgyzstan', 'KG', '+996'],
  ['Laos', 'LA', '+856'],
  ['Latvia', 'LV', '+371'],
  ['Lebanon', 'LB', '+961'],
  ['Lesotho', 'LS', '+266'],
  ['Liberia', 'LR', '+231'],
  ['Libya', 'LY', '+218'],
  ['Liechtenstein', 'LI', '+423'],
  ['Lithuania', 'LT', '+370'],
  ['Luxembourg', 'LU', '+352'],
  ['Madagascar', 'MG', '+261'],
  ['Malawi', 'MW', '+265'],
  ['Malaysia', 'MY', '+60'],
  ['Maldives', 'MV', '+960'],
  ['Mali', 'ML', '+223'],
  ['Malta', 'MT', '+356'],
  ['Marshall Islands', 'MH', '+692'],
  ['Mauritania', 'MR', '+222'],
  ['Mauritius', 'MU', '+230'],
  ['Mexico', 'MX', '+52'],
  ['Micronesia', 'FM', '+691'],
  ['Moldova', 'MD', '+373'],
  ['Monaco', 'MC', '+377'],
  ['Mongolia', 'MN', '+976'],
  ['Montenegro', 'ME', '+382'],
  ['Morocco', 'MA', '+212'],
  ['Mozambique', 'MZ', '+258'],
  ['Myanmar', 'MM', '+95'],
  ['Namibia', 'NA', '+264'],
  ['Nauru', 'NR', '+674'],
  ['Nepal', 'NP', '+977'],
  ['Netherlands', 'NL', '+31'],
  ['New Zealand', 'NZ', '+64'],
  ['Nicaragua', 'NI', '+505'],
  ['Niger', 'NE', '+227'],
  ['Nigeria', 'NG', '+234'],
  ['North Korea', 'KP', '+850'],
  ['North Macedonia', 'MK', '+389'],
  ['Norway', 'NO', '+47'],
  ['Oman', 'OM', '+968'],
  ['Pakistan', 'PK', '+92'],
  ['Palau', 'PW', '+680'],
  ['Palestine', 'PS', '+970'],
  ['Panama', 'PA', '+507'],
  ['Papua New Guinea', 'PG', '+675'],
  ['Paraguay', 'PY', '+595'],
  ['Peru', 'PE', '+51'],
  ['Philippines', 'PH', '+63'],
  ['Poland', 'PL', '+48'],
  ['Portugal', 'PT', '+351'],
  ['Qatar', 'QA', '+974'],
  ['Romania', 'RO', '+40'],
  ['Russia', 'RU', '+7'],
  ['Rwanda', 'RW', '+250'],
  ['Saint Kitts and Nevis', 'KN', '+1869'],
  ['Saint Lucia', 'LC', '+1758'],
  ['Saint Vincent and the Grenadines', 'VC', '+1784'],
  ['Samoa', 'WS', '+685'],
  ['San Marino', 'SM', '+378'],
  ['Sao Tome and Principe', 'ST', '+239'],
  ['Saudi Arabia', 'SA', '+966'],
  ['Senegal', 'SN', '+221'],
  ['Serbia', 'RS', '+381'],
  ['Seychelles', 'SC', '+248'],
  ['Sierra Leone', 'SL', '+232'],
  ['Singapore', 'SG', '+65'],
  ['Slovakia', 'SK', '+421'],
  ['Slovenia', 'SI', '+386'],
  ['Solomon Islands', 'SB', '+677'],
  ['Somalia', 'SO', '+252'],
  ['South Africa', 'ZA', '+27'],
  ['South Korea', 'KR', '+82'],
  ['South Sudan', 'SS', '+211'],
  ['Spain', 'ES', '+34'],
  ['Sri Lanka', 'LK', '+94'],
  ['Sudan', 'SD', '+249'],
  ['Suriname', 'SR', '+597'],
  ['Sweden', 'SE', '+46'],
  ['Switzerland', 'CH', '+41'],
  ['Syria', 'SY', '+963'],
  ['Tajikistan', 'TJ', '+992'],
  ['Tanzania', 'TZ', '+255'],
  ['Thailand', 'TH', '+66'],
  ['Timor-Leste', 'TL', '+670'],
  ['Togo', 'TG', '+228'],
  ['Tonga', 'TO', '+676'],
  ['Trinidad and Tobago', 'TT', '+1868'],
  ['Tunisia', 'TN', '+216'],
  ['Turkey', 'TR', '+90'],
  ['Turkmenistan', 'TM', '+993'],
  ['Tuvalu', 'TV', '+688'],
  ['Uganda', 'UG', '+256'],
  ['Ukraine', 'UA', '+380'],
  ['United Arab Emirates', 'AE', '+971'],
  ['United Kingdom', 'GB', '+44'],
  ['United States', 'US', '+1'],
  ['Uruguay', 'UY', '+598'],
  ['Uzbekistan', 'UZ', '+998'],
  ['Vanuatu', 'VU', '+678'],
  ['Vatican City', 'VA', '+379'],
  ['Venezuela', 'VE', '+58'],
  ['Vietnam', 'VN', '+84'],
  ['Yemen', 'YE', '+967'],
  ['Zambia', 'ZM', '+260'],
  ['Zimbabwe', 'ZW', '+263'],
]

const ALL_COUNTRIES: Country[] = RAW_COUNTRIES.map(([name, iso2, code]) => ({
  name,
  iso2,
  code,
  flag: flagEmoji(iso2),
}))

// UK pinned to the top as the default, rest stays alphabetical.
export const COUNTRIES: Country[] = [
  ALL_COUNTRIES.find((c) => c.iso2 === 'GB')!,
  ...ALL_COUNTRIES.filter((c) => c.iso2 !== 'GB'),
]

const BY_CODE_LENGTH_DESC = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length)

const DEFAULT_COUNTRY = COUNTRIES[0]

export function parsePhone(full: string): { countryCode: string; localNumber: string } {
  const match = BY_CODE_LENGTH_DESC.find(({ code }) => full.startsWith(code))
  if (match) return { countryCode: match.code, localNumber: full.slice(match.code.length) }
  return { countryCode: DEFAULT_COUNTRY.code, localNumber: full.replace(/[^0-9]/g, '') }
}

interface PhoneInputProps {
  /** Full phone value, e.g. "+447911123456" */
  value: string
  onChange: (value: string) => void
  placeholder?: string
  id?: string
  required?: boolean
}

export default function PhoneInput({ value, onChange, placeholder = '7911 123456', id, required }: PhoneInputProps) {
  const { countryCode, localNumber } = parsePhone(value)
  const selected = COUNTRIES.find((c) => c.code === countryCode) ?? DEFAULT_COUNTRY

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [align, setAlign] = useState<'left' | 'right'>('left')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect()
      const popoverWidth = 300
      setAlign(rect.left + popoverWidth > window.innerWidth - 16 ? 'right' : 'left')
    }
    const raf = requestAnimationFrame(() => searchRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [open])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.includes(q))
    : COUNTRIES

  function selectCountry(code: string) {
    onChange(code + localNumber)
    setOpen(false)
  }

  function handleLocalNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const cleaned = e.target.value.replace(/[^0-9]/g, '')
    onChange(countryCode + cleaned)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div
        className="field-input"
        style={{
          display: 'flex',
          width: '100%',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'var(--surface2)',
          transition: 'border-color 160ms ease, box-shadow 160ms ease',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setQuery('')
            setOpen((o) => !o)
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'var(--surface2)',
            border: 'none',
            borderRight: '1px solid var(--border)',
            padding: '0.875rem 0.6rem 0.875rem 0.75rem',
            color: 'var(--text)',
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            fontWeight: 500,
            outline: 'none',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <span aria-hidden="true">{selected.flag}</span>
          <span>{selected.code}</span>
          <span style={{ fontSize: '9px', opacity: 0.5 }}>▾</span>
        </button>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={localNumber}
          onChange={handleLocalNumberChange}
          onKeyDown={(e) => {
            if (e.ctrlKey || e.metaKey) return
            if (['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return
            if (!/^[0-9]$/.test(e.key)) e.preventDefault()
          }}
          placeholder={placeholder}
          required={required}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            padding: '0.875rem 1rem',
            color: 'var(--text)',
            fontFamily: 'var(--font-sans)',
            fontSize: '15px',
            fontWeight: 500,
            outline: 'none',
            minWidth: 0,
          }}
        />
      </div>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            ...(align === 'left' ? { left: 0 } : { right: 0 }),
            zIndex: 50,
            width: 'min(300px, calc(100vw - 2rem))',
            maxHeight: '320px',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code"
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.55rem 0.7rem',
                color: 'var(--text)',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: 500,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '0.75rem', fontSize: '13px', color: 'var(--text-secondary)' }}>No matches</div>
            ) : (
              filtered.map((c) => {
                const isSelected = c.code === countryCode
                return (
                  <button
                    key={`${c.iso2}-${c.code}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectCountry(c.code)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.55rem 0.75rem',
                      background: isSelected ? 'var(--green-faint)' : 'transparent',
                      border: 'none',
                      color: 'var(--text)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--green-faint)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isSelected ? 'var(--green-faint)' : 'transparent'
                    }}
                  >
                    <span aria-hidden="true">{c.flag}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{c.code}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
