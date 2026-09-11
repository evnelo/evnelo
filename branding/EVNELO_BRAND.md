# Evnelo Brand System

> **Brand idea:** Make gathering flow.  
> **Primary tagline:** Events, in motion.  
> **Positioning:** Open event infrastructure for people who want control.

This file is the source of truth for the Evnelo visual and verbal identity. Apply it consistently across the public website, organizer dashboard, attendee experience, emails, wallet assets, documentation, SDK/API surfaces, check-in UI, social graphics, and future product extensions.

---

## 1. Brand Foundation

### What Evnelo is

Evnelo is modern event infrastructure for publishing events, registering attendees, selling or issuing tickets, messaging attendees, handling waitlists, issuing wallet passes, checking people in, and integrating through APIs and SDKs.

The brand should feel broader than “ticketing software.” It should represent the infrastructure that helps events move smoothly from interest to attendance.

### Core idea

**Make gathering flow.**

Evnelo is the invisible system behind a smooth event experience:

1. Discover
2. Register
3. Pay
4. Receive access
5. Arrive
6. Check in
7. Participate

The visual identity should communicate movement, access, flow, and human gathering without relying on literal ticket, QR-code, calendar, or stage imagery.

### Personality

Evnelo should feel:

- Precise
- Welcoming
- Modern
- Capable
- Human
- Open
- Calm
- Slightly playful
- Technical without feeling developer-only

### Avoid

Do **not** make Evnelo look like:

- nightclub ticketing software
- crypto/web3
- generic purple-gradient SaaS
- corporate conference software
- a QR-code utility
- a hacker/terminal-first open-source project
- a legacy box-office system

Avoid excessive gradients, glassmorphism, neon colors, oversized shadows, decorative 3D shapes, or generic startup illustration packs.

---

# 2. Logo System

## Primary concept

The Evnelo logo consists of:

1. A compact geometric symbol
2. The lowercase wordmark `evnelo`

The symbol is made from two soft rectangular forms arranged to suggest:

- a lowercase `e`
- an entry gate
- two event passes crossing
- movement through a checkpoint

The mark should be recognizable as a geometric symbol first. The event/access meaning should be secondary.

## Wordmark

Use lowercase:

**evnelo**

The wordmark should feel confident and friendly.

Preferred visual characteristics:

- bold but not heavy
- rounded geometry
- tight but readable spacing
- clean lowercase forms
- no custom futuristic cuts
- no excessive letter manipulation

If recreating the wordmark with type rather than a custom vector, begin with **Instrument Sans SemiBold/Bold** and adjust tracking optically.

## Logo lockups

Supported lockups:

### Horizontal

`[symbol] evnelo`

This is the default logo.

Use for:

- website navigation
- documentation
- dashboard
- emails
- footer
- social headers

### Stacked

```text
[symbol]
evnelo
```

Use when horizontal space is constrained or compositionally preferable.

### Symbol only

Use the symbol alone for:

- favicon
- app icon
- social avatar
- small badges
- loading states
- mobile launcher icon

## Logo color

Preferred combinations:

### Light background

- Symbol: Pulse
- Wordmark: Ink

### Dark background

- Symbol: Pulse
- Wordmark: Paper or White

### Monochrome

Allowed when necessary:

- all Ink
- all White
- all Paper

Do not recolor the logo using Lime or Sky as the primary logo color.

## Clear space

Maintain clear space equal to approximately **50% of the symbol height** on every side of the logo.

Do not crowd the logo with:

- navigation links
- card edges
- photos
- text
- other logos

## Minimum size

Suggested minimum sizes:

- full logo: 100 px wide
- symbol: 20 px
- favicon: create dedicated simplified variants for 16 px and 32 px if needed

## Logo misuse

Never:

- stretch or distort
- rotate
- outline the logo
- add drop shadows
- put the logo inside arbitrary shapes
- apply gradients to the wordmark
- change letter spacing dramatically
- recreate the symbol differently on different screens
- use QR-code motifs inside the logo

---

# 3. Color System

## Core palette

| Token | Name | Hex | Usage |
|---|---|---|---|
| `--ink` | Ink | `#14151A` | Primary text, dark surfaces |
| `--paper` | Paper | `#F7F7F2` | Primary page background |
| `--pulse` | Pulse | `#FF5A3C` | Primary brand color, CTA |
| `--lime` | Lime | `#C9F269` | Success, live, positive accent |
| `--sky` | Sky | `#A8D8FF` | Informational accent |
| `--mist` | Mist | `#E9EAE4` | Borders, dividers, muted surfaces |
| `--white` | White | `#FFFFFF` | High-contrast surface |

## Primary brand relationship

The core Evnelo look is:

**Paper + Ink + Pulse**

Lime and Sky are secondary accents.

Pulse should visually own the brand.

## CSS variables

```css
:root {
  --evnelo-ink: #14151A;
  --evnelo-paper: #F7F7F2;
  --evnelo-pulse: #FF5A3C;
  --evnelo-lime: #C9F269;
  --evnelo-sky: #A8D8FF;
  --evnelo-mist: #E9EAE4;
  --evnelo-white: #FFFFFF;

  --background: var(--evnelo-paper);
  --foreground: var(--evnelo-ink);

  --primary: var(--evnelo-pulse);
  --primary-foreground: #FFFFFF;

  --border: var(--evnelo-mist);
  --muted: #F0F1EC;
  --muted-foreground: #6C6E73;

  --success: var(--evnelo-lime);
  --info: var(--evnelo-sky);
}
```

## Dark mode

```css
.dark {
  --background: #111216;
  --foreground: #F7F7F2;

  --card: #1A1C21;
  --card-foreground: #F7F7F2;

  --border: #2A2D32;
  --muted: #202227;
  --muted-foreground: #A8AAB0;

  --primary: #FF5A3C;
  --primary-foreground: #FFFFFF;
}
```

### Dark-mode guidance

- Keep Pulse close to `#FF5A3C`
- Use Lime for success/live states
- Use Sky for information and subtle highlighting
- Do not turn the entire product into saturated neon accents

---

# 4. Typography

## Primary typeface

**Instrument Sans**

Google Fonts / open source.

Use across:

- marketing website
- dashboard
- attendee pages
- emails
- event pages
- UI controls
- printed collateral

### Weight usage

- 700: hero headlines
- 600: headings, buttons, important UI
- 500: labels, navigation, emphasized body
- 400: body copy

Avoid very light typography.

## Monospace

**IBM Plex Mono**

Use for:

- API documentation
- code
- tokens
- IDs
- developer examples
- CLI snippets

Do not use monospace decoratively throughout the marketing site.

## CSS

```css
font-family: "Instrument Sans", system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif;
```

Monospace:

```css
font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco,
  Consolas, monospace;
```

## Suggested type scale

| Role | Size | Line height | Weight |
|---|---:|---:|---:|
| Hero | 64px | 68px | 700 |
| H1 | 48px | 52px | 700 |
| H2 | 36px | 42px | 650–700 |
| H3 | 28px | 34px | 600 |
| Lead | 20px | 28px | 400 |
| Body | 16px | 24px | 400 |
| UI | 14px | 20px | 500 |
| Meta | 12px | 16px | 500 |

Responsive marketing headings may use `clamp()`.

Example:

```css
.hero-title {
  font-size: clamp(3rem, 7vw, 4rem);
  line-height: 1.02;
  letter-spacing: -0.04em;
}
```

## Typography style

Prefer:

- sentence case
- short lines
- high contrast
- generous whitespace
- slightly tight display tracking

Avoid:

- excessive uppercase
- excessive letter spacing
- centered body paragraphs
- long walls of text
- tiny gray copy

---

# 5. Layout and Spacing

## Overall feeling

Layouts should feel spacious, editorial, and structured.

Evnelo should not feel crowded even when presenting dense data.

Use:

- strong alignment
- clean grids
- large whitespace
- compact UI where operationally necessary
- visually distinct sections

## Base spacing

Use a 4px spacing system.

Preferred rhythm:

```text
4
8
12
16
20
24
32
40
48
64
80
96
128
```

## Content width

Marketing:

- max-width: approximately `1200px–1280px`

Readable text:

- max-width: `640px–720px`

Dashboard:

- optimize for information density
- preserve at least 16–24px card padding

---

# 6. Shape Language

## Border radius

Recommended:

```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 24px;
```

Use:

- 12px for controls and small cards
- 16px for primary cards
- 24px for major marketing surfaces

Do not make every element a pill.

Pills are reserved for:

- statuses
- tags
- small filters
- compact metadata

## Borders

Use subtle borders before shadows.

Default:

```css
border: 1px solid #E9EAE4;
```

Dark:

```css
border: 1px solid #2A2D32;
```

## Shadows

Shadows should be subtle.

Example:

```css
box-shadow:
  0 1px 2px rgba(20, 21, 26, 0.04),
  0 8px 24px rgba(20, 21, 26, 0.06);
```

Avoid dramatic floating-card shadows.

---

# 7. Graphic Language

## The Flow Line

The primary graphic motif is a rounded line moving through checkpoints.

Conceptually:

```text
Register ─────╮
              ╰──●──╮
                  Access ╰────●── Belong
```

The motif represents:

- discovery
- registration
- payment
- access
- check-in
- attendance
- movement through the event lifecycle

### Style

- rounded endpoints
- 2px stroke
- minimal nodes
- Pulse as primary path color
- Lime / Sky may appear at checkpoints
- lots of surrounding whitespace

Do not overuse it.

It should function as a recurring visual signature rather than decoration on every screen.

---

# 8. UI Style

## Buttons

### Primary

```css
background: #FF5A3C;
color: #FFFFFF;
border-radius: 12px;
font-weight: 600;
```

Use for one clear primary action per context.

Examples:

- Create event
- Publish event
- Register
- Get tickets
- Continue

### Secondary

```css
background: transparent;
color: #14151A;
border: 1px solid #DADBD5;
```

### Dark button

Use Ink for strong secondary actions:

```css
background: #14151A;
color: #FFFFFF;
```

## Inputs

Inputs should feel calm and operational.

```css
min-height: 44px;
border-radius: 10px;
border: 1px solid #DADBD5;
background: #FFFFFF;
```

Focus:

```css
border-color: #FF5A3C;
box-shadow: 0 0 0 3px rgba(255, 90, 60, 0.14);
```

## Cards

Default card:

```css
background: #FFFFFF;
border: 1px solid #E9EAE4;
border-radius: 16px;
```

Use shadow only where hierarchy requires it.

## Status colors

Recommended mapping:

- Success / checked in / live: Lime
- Information: Sky
- Action / active / brand: Pulse
- Neutral: Mist
- Error: use a deeper accessible red distinct from Pulse

Do not use Pulse as the error color by default.

---

# 9. Product-Specific Patterns

## Event cards

Event cards should prioritize:

1. Event image
2. Event title
3. Date/time
4. Location or online status
5. Price/free status
6. Tags only when useful

Avoid excessive badge clutter.

## Dashboard

The organizer dashboard should feel:

- calm
- data-rich
- operational
- trustworthy

Do not turn the dashboard into a colorful marketing canvas.

Keep most dashboard UI neutral and reserve Pulse for:

- primary actions
- selected states
- critical progress indicators
- intentional highlights

## Check-in interface

The check-in interface should prioritize speed and certainty.

Use:

- large names
- clear status
- strong success feedback
- oversized tap targets
- Lime for successful check-in
- minimal decoration

## Attendee ticket page

Ticket pages should feel more expressive than the dashboard.

They may use:

- larger event photography
- stronger Pulse accents
- Flow Line motif
- wallet buttons
- event-specific brand colors in constrained areas

Evnelo branding should still remain visible.

---

# 10. Iconography

Use simple rounded-outline icons.

Preferred characteristics:

- 20px / 24px grid
- approximately 1.75–2px stroke
- rounded line caps
- geometric simplicity

Good references:

- Lucide
- Phosphor, regular weight

Do not mix multiple icon systems.

Avoid filled cartoon icons.

---

# 11. Photography

## Direction

Photography should show real gatherings and movement.

Prefer:

- candid attendees
- people arriving
- queues moving
- badges or passes in use
- venue entrances
- stage anticipation
- people interacting
- architectural spaces
- subtle motion blur
- natural light

## Composition

Favor:

- wider framing
- negative space
- strong geometry
- motion
- asymmetry

Avoid:

- posed stock-photo business handshakes
- fake conference smiles
- sterile conference rooms
- generic microphones as the primary event metaphor

---

# 12. Voice and Writing

## Voice attributes

Evnelo copy should be:

- short
- specific
- human
- practical
- confident
- understated

### Good

> Publish your event.

> Doors open in 2 hours.

> 38 people checked in.

> Your event is live.

> Registration closes Friday.

> Build events for a more open world.

### Avoid

> Unlock seamless next-generation event experiences.

> Revolutionize your attendee journey.

> Supercharge your events with powerful engagement solutions.

Avoid empty SaaS language.

---

# 13. Messaging

## Primary tagline

**Events, in motion.**

Use prominently on brand-level marketing.

## Brand idea

**Make gathering flow.**

Use as an internal creative principle and selectively as campaign copy.

## Supporting lines

Approved directions:

- Open infrastructure for real-world events.
- A smoother path from interest to attendance.
- Publish. Register. Attend.
- Open for more together.
- Built for people who bring people together.
- Event infrastructure without the lock-in.
- Your events. Your data. Your stack.

Avoid making “open source” the only value proposition.

---

# 14. Developer Brand

Evnelo has a strong developer/API component.

Developer-facing surfaces should feel like the same brand, not a separate dark hacker theme.

Use:

- Instrument Sans for navigation/text
- IBM Plex Mono for code
- Ink dark surfaces
- Pulse highlights
- neutral syntax-friendly code panels

Example code panel:

```css
background: #14151A;
color: #F7F7F2;
border-radius: 12px;
```

Terminal/API examples should be clean and editorial.

---

# 15. Social and Marketing

## Social avatar

Use the Evnelo symbol only.

Preferred:

- Pulse symbol
- Ink background

or

- Pulse symbol
- Paper background

## Open Graph images

Use:

- large Instrument Sans headline
- Paper or Ink background
- Pulse accent
- Flow Line motif
- restrained event imagery

Example layout:

```text
[evnelo]

Events,
in motion.

Open event infrastructure.
```

## Marketing pages

Marketing design may be more expressive than the app.

Allowed:

- oversized typography
- cropped event photography
- Flow Line graphics
- large Pulse panels
- Lime/Sky accent blocks
- asymmetric editorial layouts

Still avoid generic gradient-heavy SaaS design.

---

# 16. Accessibility

Brand expression must never override usability.

Requirements:

- WCAG AA minimum for body text
- visible keyboard focus
- do not communicate status using color alone
- large touch targets
- readable text on Pulse/Lime/Sky backgrounds
- test both light and dark modes

Be especially cautious with Lime because it is a light color.

Use dark Ink text on Lime.

---

# 17. Implementation Tokens

Suggested design-token object:

```ts
export const evneloBrand = {
  colors: {
    ink: "#14151A",
    paper: "#F7F7F2",
    pulse: "#FF5A3C",
    lime: "#C9F269",
    sky: "#A8D8FF",
    mist: "#E9EAE4",
    white: "#FFFFFF",

    darkBackground: "#111216",
    darkSurface: "#1A1C21",
    darkBorder: "#2A2D32",
  },

  typography: {
    sans: '"Instrument Sans", system-ui, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, monospace',
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
};
```

---

# 18. Tailwind Guidance

Example theme mapping:

```css
@theme {
  --color-ink: #14151A;
  --color-paper: #F7F7F2;
  --color-pulse: #FF5A3C;
  --color-lime: #C9F269;
  --color-sky: #A8D8FF;
  --color-mist: #E9EAE4;

  --font-sans: "Instrument Sans", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;

  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
}
```

Preferred classes:

```html
<body class="bg-paper text-ink font-sans">
```

Primary CTA:

```html
<button class="rounded-md bg-pulse px-5 py-3 font-semibold text-white">
  Create event
</button>
```

Card:

```html
<div class="rounded-lg border border-mist bg-white p-6">
  ...
</div>
```

---

# 19. Agent Instructions

When applying this brand to the Evnelo codebase:

1. **Audit before changing.**
   - Find global styles.
   - Find font configuration.
   - Find color tokens.
   - Find reusable buttons, inputs, cards, badges, navigation, and layout primitives.
   - Find all current logo and product-name references.

2. **Implement tokens centrally.**
   - Do not scatter raw hex values through components.
   - Create or update global design tokens.
   - Use semantic tokens where possible.

3. **Install/load fonts properly.**
   - Instrument Sans for UI and marketing.
   - IBM Plex Mono for code/developer surfaces.
   - Prefer framework-native font loading.

4. **Replace existing branding systematically.**
   - product name
   - wordmark
   - favicon
   - metadata
   - Open Graph assets
   - app icons
   - email branding
   - login screens
   - empty states
   - documentation headers

5. **Keep the dashboard restrained.**
   - Most product UI should remain neutral.
   - Pulse is an accent, not a wallpaper.

6. **Use the visual identity more strongly on public surfaces.**
   - homepage
   - event pages
   - discovery
   - attendee ticket pages
   - marketing pages

7. **Do not invent new brand colors.**
   If additional semantic colors are required for warnings/errors, create accessible functional colors that clearly remain outside the core brand palette.

8. **Do not generate multiple competing logo variants.**
   The logo system should remain stable.

9. **Preserve usability.**
   Do not sacrifice information density, accessibility, or mobile behavior for branding.

10. **Keep the codebase coherent.**
    Prefer updating shared primitives over one-off page styling.

---

# 20. Brand Lock

The following are locked unless explicitly changed by the project owner:

### Brand name
**Evnelo**

### Domain
**evnelo.com**

### Primary tagline
**Events, in motion.**

### Brand idea
**Make gathering flow.**

### Primary font
**Instrument Sans**

### Monospace font
**IBM Plex Mono**

### Core colors
- Ink `#14151A`
- Paper `#F7F7F2`
- Pulse `#FF5A3C`
- Lime `#C9F269`
- Sky `#A8D8FF`
- Mist `#E9EAE4`
- White `#FFFFFF`

### Primary visual motif
**Flow Line**

### Brand personality
**Precise, welcoming, capable, human, open, modern.**

Future design work may vary photography, layouts, illustrations, campaign ideas, and event-specific visuals, but should preserve the locked elements above.

---

# 21. Final Design Principle

When in doubt:

> **Evnelo should feel like excellent infrastructure that happens to be beautiful.**

Not decoration first.  
Not ticket clichés.  
Not enterprise blandness.

The brand should make event creation and attendance feel effortless, open, and in motion.
