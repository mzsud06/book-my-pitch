# Redesign plan v2 (Champz-style riff)

Branch: `redesign/light-theme`. Work one step at a time. Commit and push after each step, then tick it here.
Rules: visual, layout and copy only. Do not touch app/api, lib (except display helpers), supabase or tests. Run `npx tsc --noEmit` and `npm test` before each commit. No invented numbers, venues, reviews or claims ("#1", "guaranteed", tournaments, transfer market).

## Palette: Cobalt and chartreuse (60-30-10)
- Base 60%: ice white #F5F7FF, cards #FFFFFF
- Main 30%: cobalt #1F3BFF (hero panel, links, selected states, progress bars). Text on it is white.
- Accent 10%: chartreuse #D7FF3D (main buttons, ticker, one headline word). Text on it is ink #0B1130.
- Pop: coral #FF5C47 only for "Filling fast" and full games
- Text: ink #0B1130, secondary #4A5070

## Type
Headings: wide heavy all-caps (Archivo Expanded Black via @fontsource-variable/archivo, wdth axis). Body: Figtree (already installed). Body 16px, min 14px, tap targets 44px.

## Style
White page, big rounded cards (20px), soft shadows, photo-top cards, pill nav links, pill badges. Real photos only; neutral placeholder when a venue has none.

## Steps
- [x] 1. Tokens in app/globals.css (keep legacy var names, remap values), fonts, Button (chartreuse primary, cobalt secondary), Badge, Card radius/shadow
- [x] 2. New logo: chartreuse ball mark on cobalt rounded square + "BOOKMYPITCH" wordmark (SVG in components/Logo.tsx, also favicon). Nav: logo left, pill links centre (Home, Games, Book a pitch, For venues), Sign in + Sign up pill right
- [x] 3. Homepage: cobalt hero panel with contour lines, pill badge, "READY TO PLAY?" with chartreuse word, one chartreuse button. Ticker strip (true lines only: Nobody pays till it's full, Share one link, Split the cost automatically, Floodlit pitches). Four feature cards (Book a pitch filled cobalt, Start a game, Join a game, For venues). Open games row (game cards, empty state card if none). Book a pitch row (venue cards, "From £X an hour"). For venues block, FAQ, footer. Screenshot at 375 and 1280 and send to Masud for OK before step 4 (SENT, waiting for OK)
- [x] 4. GameCard component (photo top + price overlay + players pill, badges, title, date/time, venue, spots-remaining bar, Join button / greyed "Game full") used on homepage and /public-games (rename label to "Games")
- [ ] 5. Session (game) page: big progress bar, player list with initials avatars, WhatsApp share, sticky Join on mobile. Restyle only
- [x] 6. Venue page + booking panel restyle (keep first-available-day, fee breakdown, terms line)
- [ ] 7. Auth screens as split card with photo panel ("SHOW UP, PLAY. WE SORT THE MONEY."), owner page restyle
- [ ] 8. Check every page at 375 and 1280, tsc, tests, push, summary for Masud

## Already done on this branch (v1, keep)
Fee display helper lib/feeDisplay.ts, StateMessage, Photo, loading/error/not-found pages, compact cookie notice, venue first-available-day + no-availability state, owner WhatsApp +447536394896, "Masud Rahman, Admin", refund line removed.

## Content still needed from Masud
Photos of Globe and Mulberry, a photo of people playing (auth panel), owner dashboard screenshot. Name mismatch: terms/privacy say "Mohammed Rahman Masud".
