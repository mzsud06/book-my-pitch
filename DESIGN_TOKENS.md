# BookMyPitch Design Tokens

Light, warm theme. Legacy variable names are kept so existing components re-theme at once:
`--black` is now the warm paper background, `--text` is charcoal, `--green` is the deep pitch green brand colour.

## Colour
| Variable | Value | Use |
|---|---|---|
| `--black` | #F6F1E7 | Page background (paper) |
| `--surface` | #FFFDF8 | Cards |
| `--surface2` / `--surface3` | #F0EADB / #E8E1CF | Inputs, tiles, placeholders |
| `--text` | #1F2420 | Body and headings |
| `--text-secondary` | #4A524B | Supporting copy (AA on paper) |
| `--text-tertiary` | #5F665F | Helper text (AA on paper) |
| `--green` | #14502D | Buttons, links, selected states. Text on it is white. |
| `--green-dim` | #0E3A21 | Hover |
| `--acid` | #C6F135 | Small highlight on dark green only. Never a fill on light, never text on paper. |
| `--amber` / `--red` | #8A5A00 / #B3261E | Peak, warnings / errors |
| `--border` | rgba(31,36,32,0.14) | Hairlines |

## Type
Fraunces (variable, serif) for headings via `--font-display`. Figtree (variable) for body and UI via `--font-sans`. Both self-hosted through `@fontsource-variable`.
Body 16px minimum. Smallest text 14px. Hero `clamp(2.25rem, 8vw, 3.75rem)`, H2 `clamp(1.75rem, 5vw, 2.25rem)`.

## Layout
Container 1180px, fluid gutters. Radii 12px (controls) and 16px (cards). Tap targets 44px minimum (buttons `lg` are 52px).
No glow shadows, no hover lift, no gradients.

## Primitives (components/ui)
Button, Card, Container, Badge, Eyebrow, SectionHeading, Photo (real image or neutral placeholder, never another venue's), StateMessage (empty, loading and error messages).
Fee display values live in `lib/feeDisplay.ts` and must match `lib/stripe.ts`.
