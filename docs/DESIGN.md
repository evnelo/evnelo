# OpenTicket design system

The feel: a good independent ticket office. Editorial, warm, precise. Serif headlines on cream paper,
one confident green, a ticket you'd keep. Not a SaaS template.

## Tokens (`apps/web/app/globals.css`)

- Surfaces: `--background` cream (#f6f4ee), `--card` white, `--muted` warm grey. Ink is `--foreground` #17170f, never pure black.
- Brand: `--primary` gate green #16603a. Events may override `--accent-event` for their own buttons and date leaf.
- Ticket: `--ticket-paper` / `--ticket-ink` / `--ticket-perforation` are only for the ticket object and wallet-like surfaces.
- Radius: `--radius` 12px; cards `rounded-xl` (16px), buttons and inputs `rounded-lg`, chips `rounded-full`.
- Shadows: `shadow-card` (soft, warm) at rest, `shadow-lift` on hover. No hard drop shadows.

## Type

- Display: Fraunces Variable (`.display`, `font-display`). Use it for page titles, event names, prices and big numbers. Optical size follows size: `opsz 144` for hero, `48` for cards, `24` for small marks.
- UI: Geist Sans. Body 15px on public pages, 14px in the dashboard. Labels: `.eyebrow` (11px, tracking-wide, uppercase, muted).
- Never letter-space the serif. Never bold the serif beyond 500.

## Signature elements

- **Date leaf** (`.date-leaf`): month over day, like a tear-off calendar. Appears on cards, event page, ticket.
- **Ticket** (`.ticket`): paper surface, perforation, QR on the stub. Only for admission.
- **Stamp** (`Badge variant="stamp"`): rotated, inked border. Used sparingly for SOLD OUT / FREE / CANCELLED.
- **Hairline** (`.hairline`): dotted separators, not solid greys, between editorial sections.

## Motion (CSS only, no animation library)

- Press: every button and clickable card scales to 0.98 while pressed (`.press` is built into `Button`).
- Lift: cards `hover:-translate-y-0.5 hover:shadow-lift` over 200ms.
- Enter: lists use `.animate-rise` with `--stagger` per item (max 12 items staggered, 40ms apart).
- Dialogs: overlay fades, panel rises 8px and fades in 180ms, out 120ms.
- Everything respects `prefers-reduced-motion`.

## Layout rhythm

- Public pages: `max-w-6xl`, 24px gutters, sections separated by 64px on desktop, 40px on mobile.
- Dashboard: `max-w-5xl`, page header = title (`.display text-3xl`) + one-line description + primary action on the right.
- Empty states: an icon in a soft circle, one sentence, one action. Never a bare "No results".
- Touch targets at least 44px on public pages and the scanner.

## Do / don't

- Do let images breathe: covers get a 16:7 crop with a soft gradient scrim under text.
- Do use tabular numbers for money and counts.
- Don't add colour beyond green, ink, cream and the ticket paper; status badges use the muted tints already defined.
- Don't introduce new component libraries; extend the primitives in `apps/web/components/ui`.
