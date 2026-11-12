# BookMyPitch Design Tokens

Palette: midnight navy and cloud white as the foundation, electric lime as the single accent. CSS variable names `--black` and `--green` are kept for compatibility (they now hold navy and lime).

Design system reference for all visual parts. Later parts of the redesign should read this file and use only these values.

---

## Colours

| Token | CSS Variable | Value | Usage |
|---|---|---|---|
| Electric lime | `--green` | `#E4FF3A` | THE single action colour. CTAs, prices, live states, selected states. One colour only. |
| Green dim | `--green-dim` | `#CDE62F` | Hover state of electric lime. |
| Green faint | `--green-faint` | `rgba(228,255,58,0.08)` | Subtle green-tinted fills. |
| Background | `--black` | `#0B1A2E` | Base page background. Midnight navy. |
| Surface | `--surface` | `#10223B` | Card background. |
| Surface 2 | `--surface2` | `#14294A` | Elevated cards, dropdown backgrounds. |
| Surface 3 | `--surface3` | `#1A3156` | Hover state of surface 2, inputs. |
| Surface 4 | `--surface4` | `#203A62` | Deeply elevated elements. |
| Navy tint | `--pitch-green` | `#173257` | Off-peak badge background, surface tints. |
| PEAK/urgency | `--amber` | `#FFB800` | Peak time urgency colour. Warm amber. |
| Error/danger | `--red` | `#FF4444` | Destructive actions, error states. |

### Text hierarchy

| Token | CSS Variable | Value | Notes |
|---|---|---|---|
| Primary text | `--text` | `#F4F7FB` | Body copy, headings |
| Secondary text | `--text-secondary` | `#A7B4C8` | Supporting copy, muted labels |
| Tertiary text | `--text-tertiary` | `#6A7B95` | Timestamps, helper text, placeholder labels |
| Muted | `--muted` | `#686868` | Legacy alias; prefer `--text-secondary` |

### Borders

| Token | CSS Variable | Value |
|---|---|---|
| Hairline | `--border` | `rgba(255,255,255,0.07)` |
| Subtle | `--border-subtle` | `rgba(255,255,255,0.04)` |
| Strong | `--border-strong` | `rgba(255,255,255,0.12)` |
| Active/selected | `--border-active` | `rgba(228,255,58,0.35)` |

---

## Typography

### Fonts

| Role | CSS Variable | Font |
|---|---|---|
| Display / headlines | `--font-display` | Clash Display (Fontshare) |
| Body / UI | `--font-sans` | Geist Sans (via `geist` npm package) |

### Fluid scale

| Name | CSS Variable | Value | Weight | Line height | Tracking |
|---|---|---|---|---|---|
| Hero / display | `--text-hero` | `clamp(2.5rem, 9vw, 4.5rem)` | 700 | 0.95 | `-0.015em` |
| H2 | `--text-h2` | `clamp(1.75rem, 5vw, 2.5rem)` | 700 | 1.1 | `-0.015em` |
| H3 | `--text-h3` | `clamp(1.25rem, 3vw, 1.5rem)` | 600 | 1.2 | `-0.01em` |
| Body | `--text-body` | `1rem` | 400-500 | 1.6 | 0 |
| Label / eyebrow | `--text-label` | `0.75rem` | 600 | 1.4 | `0.12em` (uppercase) |

All prices and times use `font-variant-numeric: tabular-nums` (utility class: `.tabular`).

---

## Spacing / Layout

| Token | Value | Usage |
|---|---|---|
| Container max-width | `1180px` | `<Container>` component |
| Container gutter | `clamp(1.25rem, 4vw, 2rem)` | Horizontal padding |
| Nav height | `60px` | Sticky nav |

---

## Border Radii

| Token | CSS Variable | Value | Usage |
|---|---|---|---|
| Card | `--radius-xl` | `20px` | Cards |
| Button / input | `--radius-lg` | `14px` | Buttons, inputs |
| Small | `--radius-md` | `12px` | Small cards, tooltips |
| Tiny | `--radius-sm` | `8px` | Tags, minor elements |
| Full / pill | `--radius-full` | `9999px` | Badges, pills, avatars |

---

## Shadows

| Token | CSS Variable | Value |
|---|---|---|
| Card (rest) | `--shadow-card` | `0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px var(--border)` |
| Card (hover) | `--shadow-card-hover` | `0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(228,255,58,0.18)` |
| Green glow | `--shadow-glow` | `0 0 0 1px rgba(228,255,58,0.30), 0 0 24px -4px rgba(228,255,58,0.25)` |
| Green glow SM | `--green-glow-sm` | `0 0 20px rgba(228,255,58,0.18)` |
| Green glow MD | `--green-glow-md` | `0 0 40px rgba(228,255,58,0.22)` |

---

## Motion

| Token | CSS Variable | Value |
|---|---|---|
| Ease out | `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` |
| Ease in-out | `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` |
| Spring | `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| Expo | `--ease-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` |

Standard transition duration: **160ms** on colour/border/shadow/transform.

All animations respect `prefers-reduced-motion` (disabled globally via CSS `@media (prefers-reduced-motion: reduce)`).

---

## Primitives (components/ui/)

| Component | File | Description |
|---|---|---|
| `<Container>` | `Container.tsx` | 1180px max-width, fluid gutters |
| `<Button>` | `Button.tsx` | Variants: `primary` / `secondary` / `ghost`. Sizes: `sm` / `md` / `lg`. Prop `arrow` adds trailing arrow. |
| `<Card>` | `Card.tsx` | Surface + hairline border + shadow. Prop `hover` enables green glow on hover. |
| `<Badge>` | `Badge.tsx` | Variants: `peak` (amber) / `offpeak` (pitch-green) / `neutral` |
| `<Eyebrow>` | `Eyebrow.tsx` | Uppercase tracked label. Props: `color` = `green` (default) or `secondary`. |
| `<SectionHeading>` | `SectionHeading.tsx` | Optional eyebrow + fluid H2 + optional sub-paragraph. Prop `align` = `left` or `center`. |

---

## Navigation

- Height: 60px
- Background: `rgba(8,8,8,0.96)` + `backdrop-filter: blur(32px)`
- Top accent: `2px solid var(--green)` (border-top on nav element)
- Bottom hairline: `1px solid var(--border)`
- Wordmark: Clash Display 700, `clamp(15px, 3.5vw, 18px)`, tracking `-0.02em`
- Wordmark mark: pitch-corner arc SVG, 18px, `color: var(--green)`
- `.uk` suffix: inline, `0.72em`, `var(--green)` at 75% opacity, weight 600
- Log in: Geist 500, 14px, `--text-secondary`, min-height 44px
- Find a slot button: Clash Display 600, green bg, border-radius `--radius-lg` (14px), min-height 44px
