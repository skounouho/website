# Personal Website — Design Aesthetic & Philosophy

## Core Philosophy

This site prioritizes **focus over completeness**. At any given moment, the user should feel drawn into a single piece of content rather than overwhelmed by options. Whitespace is a design element, not empty space. Every UI decision should ask: *does this help the reader focus, or does it compete for attention?*

The aesthetic is **minimalist and editorial** — closer to a well-designed print publication than a typical personal website.

---

## Color

- **Mode:** Off-white base (light mode default), with a system-respecting dark mode toggle.
- **Palette:** Monochromatic. Use as few colors as possible.
- **Light mode:**
  - Background: `#F5F2EE` (warm off-white, not pure white)
  - Text: `#1A1A1A` (near-black, not pure black)
  - Subtle accents: warm grays for borders, dividers, muted UI elements
- **Dark mode:**
  - Background: dark charcoal (not pure black, e.g. `#1C1C1C`)
  - Text: warm off-white (mirror of light mode background)
  - Accents: same warm gray family, adjusted for dark context
- **Accent color:** One muted tone (warm gray or dusty mid-tone) used sparingly for hover states, active nav items, and interactive affordances. No bright or saturated colors.

---

## Typography

- **Body / Content:** [Alegreya](https://fonts.google.com/specimen/Alegreya) — a humanist serif for long-form reading. Use for blog post body text, resume descriptions, and any paragraph-length content.
- **UI / Interface:** [Lato](https://fonts.google.com/specimen/Lato) — a clean, neutral sans-serif. Use for navigation labels, metadata, captions, tags, buttons, and any interface chrome.
- **Hierarchy:** Establish clear typographic scale. Headings should feel deliberate and weighted; body text should feel comfortable at reading size (18–20px base recommended).
- **No decorative or display fonts.** Let weight and size carry hierarchy.

---

## Navigation

- **Pattern:** Floating side icon bar, vertically centered, fixed to one side of the viewport.
- **At rest:** Displays only small icons — one per section (e.g. resume, blog, map, home).
- **On hover:** Expands horizontally to reveal a text label alongside the icon. Animation should be smooth and purposeful — a gentle fade and slide, nothing abrupt or bouncy.
- **Visual treatment:** Semi-transparent or no background — the nav floats over content without enclosing itself in a box. It should feel like it's barely there.
- **Sections:** Home / About, Resume, Blog, Map.
- **No traditional top navigation bar.**

---

## Interactive Elements & Animation

Animation should serve a clear purpose — it is not decorative. The appropriate feel for each element depends on its function:

- **Nav expand (hover):** Gentle fade + horizontal slide. Feels calm and unhurried.
- **Page transitions:** Subtle — a soft fade or minimal movement. Never jarring.
- **Links:** Underlined by default. On hover: color shifts to accent tone, font weight increases slightly. Transition should be fast (100–150ms) and crisp.
- **Buttons and UI controls:** Fast, snappy feedback. No lingering animations on user-initiated actions.
- **Guiding principle:** Slower animations for ambient/contextual UI (nav, transitions), faster animations for direct interactions (clicks, hovers on actionable elements).

---

## Links & Hover States

Two modes, depending on context:

**Prose links** — inline links inside long-form reading (blog posts, the about page, MDX bodies wrapped in `.prose-site`):
- Default state: underlined, body color
- Hover state: underline retained, color shifts to muted accent
- Transition: `100–150ms ease`
- The always-visible underline keeps dense inline link runs legible and accessible.

**UI-chrome links** — standalone or structural links outside prose (nav labels, resume metadata, blog list rows, map popovers, footers, cards):
- Default state: no underline, inherits surrounding text color (often `--fg-muted` when the link sits in metadata-style text)
- Hover state: color shifts to muted accent, no underline added
- Transition: `100–150ms ease`
- Matches the side-nav label pattern — a quiet color shift does the work, keeping the chrome uncluttered.

---

## Borders, Cards & Shapes

- **Border radius:** `2–4px` on all UI elements with rounded corners. Slightly soft, not clinical (0px) and not bubbly (8px+).
- **Cards:** Use sparingly. If used, keep borders subtle (1px, low-contrast) or use shadow instead — but prefer whitespace and layout to create separation over decorative containers.
- **Dividers:** Thin, low-contrast lines (`1px`). Use only where structure genuinely aids comprehension.

---

## Layout & Spacing

- Generous whitespace throughout. Content should breathe.
- Single-column reading layout for blog posts and resume — no sidebars.
- The map page: map is the hero, nothing competes with it.
- Consistent spacing scale (e.g. 4px base unit). Avoid arbitrary spacing values.

---

## Mobile

Mobile behavior has not yet been defined. When designing for mobile:
- The floating side nav likely needs an alternative pattern (e.g. bottom bar or hamburger) — do not assume the desktop nav scales down gracefully.
- Flag mobile layout decisions for review before implementing.

---

## What to Avoid

- Top navigation bars
- Bright or saturated accent colors
- Decorative animations with no functional purpose
- Sidebars or competing content columns
- Pure black (`#000`) or pure white (`#FFF`) backgrounds
- More than one accent color
- Heavy drop shadows or glossy UI treatments
- Cluttered layouts that show all content simultaneously
