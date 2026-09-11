# Evnelo design system (implementation notes)

The brand book is `branding/EVNELO_BRAND.md`; it is the source of truth for identity. This file records how the brand is implemented in the codebase and the product rules that sit on top of it.

The feel: excellent infrastructure that happens to be beautiful. Precise, welcoming, calm, slightly playful. Not ticket clichés, not enterprise blandness, not a dark hacker theme.

## Tokens (`apps/web/app/globals.css`)

- Brand palette as `--evnelo-*`: Ink #14151A, Paper #F7F7F2, Pulse #FF5A3C, Lime #C9F269, Sky #A8D8FF, Mist #E9EAE4, White. Tailwind utilities `bg-ink`, `text-paper`, `bg-pulse`, `bg-lime`, `bg-sky`, `border-mist`.
- Semantic tokens map onto them: `--background` Paper, `--foreground` Ink, `--primary` Pulse with white foreground, `--border` Mist, `--input` #DADBD5, `--accent` a pale Pulse tint for selected states, `--success` Lime with Ink text, `--info` Sky, `--warning` a functional amber, `--destructive` #B42318 (an accessible red; never Pulse).
- Events may override `--accent-event` for their own buttons and date leaf.
- The ticket object uses `--ticket-paper` (Ink) and `--ticket-ink` (Paper): an ink pass with a Pulse edge, not yellow paper.
- Radius: 8 / 12 / 16 / 24px (`rounded-sm/md/lg/xl`); controls 12px, primary cards 16px, marketing surfaces 24px. Pills only for statuses, tags and small filters.
- Shadows are subtle (`shadow-card`); `shadow-lift` only on hover of clickable cards.

## Type

- Instrument Sans everywhere (`@fontsource-variable/instrument-sans`, bundled). `.display` = 700, tracking −0.03em, line-height 1.04. Weights: 700 hero, 600 headings and buttons, 500 labels, 400 body. Never below 400.
- IBM Plex Mono only for code, ids, tokens and API examples (`font-mono`, `.code-panel`).
- Sentence case; short lines; `.eyebrow` for small labels is the one sanctioned uppercase.

## Logo

- `components/brand.tsx`: `Brand` (symbol + lowercase wordmark set in Instrument Sans SemiBold) and `BrandSymbol` (symbol only, Pulse, inherits `currentColor` for monochrome). The path comes from `branding/logo.svg`; do not redraw it.
- Favicon `app/icon.svg`: Pulse symbol on Ink. Clear space ≈ half the symbol height; minimum 20px symbol, 100px lockup.

## Signature elements

- **Flow Line**: a 2px Pulse line through checkpoints (Lime/Sky nodes). Used on the default share card, hero and empty states; not on every screen. `.flow-line`, `.flow-node-*`.
- Marketing hero: the reference-led ribbon is the exception to the thin Flow Line and gradient rules. `hero-scene.tsx` and `hero.css` share a 1000 × 620 canvas; cards anchor to their checkpoint coordinates, and narrow desktop layouts reserve extra space below the buttons. At ≤640px the five checkpoints stack in shared card/marker/caption rows, with avatars in a separate row. Preview cards are decorative and never intercept clicks. Concert photo: [Jay Wennington / Unsplash](https://unsplash.com/photos/people-gathering-in-a-concert-sl1-IazYY7I), saved locally under `public/marketing`; the demo QR points to evnelo.com.
- **Date leaf** (`.date-leaf`): month over day. Cards, event page, ticket, dashboard.
- **Stamp** (`Badge variant="stamp"`): sparingly, for Sold out / Free / Cancelled.

## Motion (CSS only)

- Press: buttons and clickable cards scale to 0.98 while pressed (`.press`, built into `Button`).
- Lift: `hover:-translate-y-0.5 hover:shadow-lift` over 200ms.
- Enter: lists use `.animate-rise` with `--stagger` (40ms apart, max 12).
- Dialogs: overlay fades, panel rises 8px in 180ms; bottom sheet on phones.
- Everything respects `prefers-reduced-motion`.

## Layout and product rules

- Public pages `max-w-6xl`, 24px gutters, generous whitespace; readable text ≤ 720px.
- Dashboard: neutral. Pulse only for the primary action, selected states and intentional highlights. Page header = title + one-line description + one primary action.
- Check-in: large names, oversized targets, Lime for a successful check-in (Ink text), amber for "already", deep red for refusals.
- Ticket pages may be more expressive: photography, Pulse accents, the Flow Line.
- Empty states: icon in a soft circle, one sentence, one action.
- Contrast: body text AA. White on Pulse is 3.1:1, so keep Pulse buttons at 14px semibold or larger and never use Pulse for small text on Paper; Lime always carries Ink text.

## Don't

- No new brand colours; functional colours stay clearly outside the palette.
- No gradients beyond the cover scrim, no glassmorphism beyond the sticky header, no neon, no oversized shadows.
- No competing logo variants.
