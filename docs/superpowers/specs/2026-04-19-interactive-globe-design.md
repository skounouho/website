---
date: 2026-04-19
status: proposed
---

# Interactive 3D Globe for `/map`

## Context

The `/map` page currently renders two flat SVG maps (US + world) behind an inset-button FLIP-zoom toggle (`components/map/MapSwitcher.tsx`, shipped in #10). This spec replaces both views with a single interactive globe: drag to rotate, wheel/pinch to zoom, click a pin to fly to it. The US/world split and the inset toggle are retired.

The implementation stays in SVG using `d3-geo`'s orthographic projection, rather than introducing three.js/WebGL. Every dependency needed is already installed (`d3-geo`, `topojson-client`, `world-atlas`, `us-atlas`), and the "flat-shaded line globe" aesthetic — thin country strokes on a warm-gray sphere — is native to that rendering mode and consistent with the editorial style defined in `design-aesthetic.md`.

## Goals

- One globe replaces both the US and world flat views; no toggle, no inset.
- Default load: slow auto-rotation, centered over the Atlantic, until the user first touches the globe.
- Drag rotates; wheel or two-finger pinch zooms; clicking a pin flies to it and opens the existing popover.
- State borders fade in only when the user has zoomed close enough for them to be legible.
- Deep links (`/map#<pin-id>`) fly to the pin and open it on mount, matching the current deep-link behavior.
- Pins on the far hemisphere are hidden entirely (not ghosted) and excluded from the tab order.
- `prefers-reduced-motion` disables auto-rotate and collapses fly-to into an instantaneous snap.
- Zero new runtime dependencies.

## Non-goals

- No realistic Earth texture, atmosphere glow, shading, or day/night cycle.
- No labels (country or state names). Pins and visual recognition carry identity; popovers name the location.
- No drag-inertia physics simulation. A simple decaying-velocity drift on pointer release is acceptable (added post-initial-spec).
- No separate mobile layout. Touch is the pointer-equivalent of mouse; flagged below for review.
- No WebGL/three.js. Rejected in favor of SVG for bundle size, SSR parity, and aesthetic fit.
- No `react-globe.gl` or other opinionated wrappers. Theming them to match the site fights their defaults.
- No state-level fly-to for US pins (they fly to the same globe rotation as world pins; state borders appear because zoom crosses threshold, not because the pin is US-coded).

## Architecture

### File changes

**Delete:**
- `components/map/MapSwitcher.tsx`
- `components/map/MapInsetButton.tsx`
- `components/map/MapCanvas.tsx`

**New:**
- `components/map/MapGlobe.tsx` — client component, owner of rotation/zoom/mode state and the SVG render tree.

**Rewrite:**
- `lib/projection.ts` — strip the two fixed projections (`geoEqualEarth`, `geoAlbersUsa`) and the `isUsPin` / `projectUsPoint` helpers. Replace with:
  - `createGlobeProjection({ width, height, scale, rotation })` — factory returning a configured `geoOrthographic` projection.
  - `pathsFromGeojson(fc, projection)` — unchanged in shape; now parameterized by the per-frame projection.
  - `isPinVisible(pin, rotation)` — true when `d3.geoDistance([pin.lon, pin.lat], viewCenter) < π/2`.
  - `flyToTarget(pin)` — returns `{ rotation: [-pin.lon, -pin.lat], scale: 2.2 }`.
  - `shouldShowStateBorders(scale)` — true when `scale >= 2.5`.
- `app/map/page.tsx` — simplified server shell. Loads pins, loads and caches world/state GeoJSON feature collections, pre-projects country paths at the initial rotation and scale for SSR, passes `{ pins, worldFeatures, stateFeatures, initialCountryPaths }` to `MapGlobe`.

**Keep unchanged:**
- `components/map/PinPopover.tsx`
- `lib/content/load-map.ts` and schemas
- `content/map.yaml`

### Component boundary

`app/map/page.tsx` is a server component. It hands `MapGlobe` a serializable payload:

```ts
interface MapGlobeProps {
  pins: MapPin[];                                   // raw pin data
  worldFeatures: ExtendedFeatureCollection;         // cached world-atlas features
  stateFeatures: ExtendedFeatureCollection;         // cached us-atlas features
  initialRotation: [number, number];                // e.g. [-20, 0] — Atlantic center
  initialScale: number;                             // 1
  initialCountryPaths: string[];                    // SSR-rendered at [-20, 0]
}
```

`MapGlobe` hydrates with `initialCountryPaths` so the first paint matches the server render, then starts its rAF auto-rotate loop on mount.

### State model inside `MapGlobe`

```ts
const [rotation, setRotation] = useState<[number, number]>(initialRotation);
const [scale, setScale] = useState<number>(initialScale);
const [mode, setMode] = useState<"auto" | "user" | "flying">(
  prefersReducedMotion ? "user" : "auto",
);
const [openPinId, setOpenPinId] = useState<string | null>(null);
```

`prefersReducedMotion` is read once via `window.matchMedia("(prefers-reduced-motion: reduce)").matches` (inside a `useState` initializer or a one-shot `useLayoutEffect`, so the initial mode is correct on first paint).

Derived every render: `countryPaths`, optionally `statePaths` (only computed when `shouldShowStateBorders(scale)`), projected pin positions + visibility flags. Computation happens in a `useMemo` keyed on `[rotation, scale]`.

### Per-frame render pipeline (during animation)

1. Clamp φ to `[-90, 90]` (no upside-down globe).
2. Build projection via `createGlobeProjection({ width, height, scale, rotation })`.
3. Re-derive country path strings from cached `worldFeatures` via `geoPath(projection)`.
4. If `shouldShowStateBorders(scale)`, re-derive state path strings from cached `stateFeatures`.
5. For each pin: `projection([lon, lat])` → `[x, y]`; `isPinVisible` → boolean.
6. Emit SVG:
   - Viewport: fixed viewBox `0 0 960 540` (preserves the current canvas aspect ratio for the container class `h-[calc(100vh-56px)] md:h-screen w-full`). The projection's base radius is `240` (the sphere fits with padding); `scale = 1` corresponds to that radius, and `scale = 4` expands the projected geometry accordingly. `vectorEffect="non-scaling-stroke"` keeps strokes crisp at any zoom.
   - Sphere outline: `<circle>` at `[480, 270]` with radius `240 * scale`, stroke `var(--fg-muted)`, fill `var(--border)` (same colors the current map uses).
   - Country paths: `<path>` with `stroke="var(--fg-muted)"`, `fill="none"`, `strokeWidth={0.5}`, `vectorEffect="non-scaling-stroke"`.
   - State paths (conditional, fade in via CSS opacity transition over 150ms): `stroke="var(--fg-muted)"`, `strokeWidth={0.4}`, `opacity={0.6}`, `fill="none"`.
   - Visible pins: `<circle r={6} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2}>` at projected coords, with `data-pin={pin.id}`.

Far-side pins are omitted from the DOM entirely (not hidden via CSS). That keeps tab order clean and matches the "hidden entirely" product decision.

## Interactions

### Drag to rotate

Pointer down on the globe container:
- Flip `mode` to `user` (stays `user` for the rest of the session — no reverting to auto-rotate).
- Cancel any in-flight fly-to animation.
- Capture the pointer; store starting `[clientX, clientY]` and the rotation at drag start.

Pointer move while dragging:
- Compute `dx`, `dy` since drag start.
- Δλ = `dx * (180 / (scale * 240))`. Δφ = `-dy * (180 / (scale * 240))`. (240 is the sphere's base radius from the rendering pipeline.)
- New rotation = `[startλ + Δλ, clamp(startφ + Δφ, -90, 90)]`.
- `setRotation` is called inside a rAF throttle — no more than one update per animation frame, to avoid React re-render storms during fast drags.

Pointer up: release capture. If the pointer was moving at release, apply drag inertia — continue rotating with the release velocity, decaying exponentially (multiplier ~0.95 per frame) until below a small threshold. Release velocity is computed from the rolling ~80ms sample window of pointer positions. Any subsequent pointer/wheel/keyboard interaction cancels the drift. Disabled under `prefers-reduced-motion`.

### Wheel / pinch to zoom

- Wheel: `deltaY > 0` → zoom out, else zoom in. Multiplicative step (e.g., `scale *= e^(-deltaY * 0.001)`), clamped `[1, 4]`. Single rAF-throttled state update per wheel event.
- Pinch: attach a minimal two-pointer handler inside the container. Track distance between two active pointers; scale by ratio of current distance to distance at pinch start. Clamped the same way.

### Fly-to pin

Triggered by click on a visible pin (not matching the currently open pin), or by deep-link mount.

- Target: `rotation → flyToTarget(pin).rotation`, `scale → flyToTarget(pin).scale`.
- Easing: `cubic-bezier(0.2, 0, 0, 1)` over 750ms (both constants already live in `MapSwitcher`; preserve in `MapGlobe` as `GLOBE_EASING` / `GLOBE_DURATION_MS`).
- Implementation: rAF interpolation. Compute `t ∈ [0, 1]` each frame with the easing applied; set `rotation` via linear interpolation on `[λ, φ]` with short-arc handling (if `|Δλ| > 180`, wrap so the globe rotates the shorter way). Scale interpolates linearly.
- `mode` is set to `flying` during the animation; pointer and wheel events cancel it (set `mode = "user"`, stop rAF at current state).
- On completion, open the popover (`setOpenPinId(pin.id)`).

Clicking the already-open pin closes the popover but does not fly away.

### Auto-rotate

rAF loop while `mode === "auto"`:
- Each frame: `λ += 0.05` (yaw drift; ~2 minutes per rotation at 60fps). φ stays at `initialRotation[1]`.
- First pointer/wheel/touch flips `mode` to `user` and the loop exits.
- Disabled entirely when `window.matchMedia("(prefers-reduced-motion: reduce)").matches` — initial state is `user`, no rAF started.

### Deep links

On mount and on `hashchange`:
- `hash = window.location.hash.slice(1)`.
- If `hash` matches a pin id: trigger fly-to. Under reduced-motion, snap immediately (set rotation + scale atomically, then open popover).
- If `hash` is empty or doesn't match: no-op (don't clear the hash).

This matches the current `MapCanvas` behavior semantically but without the per-map ownership dance (there's only one map now).

## Accessibility

- SVG root: `role="img"` + `aria-label="Interactive globe showing places I've lived, worked, and visited."`
- Visible pins: rendered as focusable buttons (or `<g role="button" tabIndex={0}>` — whichever fits the existing popover wiring best). Hidden (far-side) pins are not in the DOM, so they're automatically out of tab order.
- Keyboard:
  - Arrow keys while the globe container has focus: rotate in 5° steps (Left/Right → λ, Up/Down → φ).
  - `+` (or `=`) / `-`: zoom in / out one step (multiplies/divides scale by 1.2, clamped to `[1, 4]`).
  - Tab cycles visible pins in render order.
  - Enter / Space on a focused pin opens the popover (same as click).
  - Escape closes an open popover.
- `prefers-reduced-motion`: no auto-rotate, fly-to becomes an instantaneous state write, drag is unaffected.

## Testing

Vitest already runs unit + component tests (74 tests passing as the baseline). Add:

**Unit (`lib/projection.test.ts`):**
- `isPinVisible`: pin at the view center → true; pin at the antipode → false; pin at exactly 90° → false (closed boundary, since the limb is a visual edge).
- `flyToTarget`: returns `[-lon, -lat]` and scale 2.2.
- `shouldShowStateBorders`: false below 2.5, true at and above.

**Component (`components/map/MapGlobe.test.tsx`):**
- Renders with the initial SSR country paths without crashing.
- `prefers-reduced-motion`: matchMedia mocked true → no rAF started, auto-rotate disabled.
- Clicking a pin opens the popover; clicking it again closes it.
- Escape closes an open popover.
- Deep-link: hash set to a pin id before mount → popover opens after mount.

rAF interactions themselves are not tested directly; the tween logic is tested as a pure function (given `t` and start/end, does it produce the expected rotation/scale?).

## Design system alignment

Colors come from CSS variables already defined:
- Sphere fill: `var(--border)` (warm gray).
- Sphere outline + country strokes: `var(--fg-muted)`.
- State strokes: `var(--fg-muted)` with reduced opacity (~0.6) to stay quieter than country borders.
- Pins: `var(--accent)` fill, `var(--bg)` stroke — same as today.

All strokes use `vectorEffect="non-scaling-stroke"` so zooming doesn't thicken lines. Motion durations reuse `var(--duration-medium)` / `var(--duration-fast)` where applicable.

## Mobile

Touch behavior is the pointer-event equivalent of desktop:
- Single-finger drag = rotate.
- Two-finger pinch = zoom.
- Tap on a pin = click (fly-to + open popover).
- Tap outside a popover = close.

The globe container height continues to use the existing `h-[calc(100vh-56px)] md:h-screen` constraint. No separate mobile layout. The `design-aesthetic.md` doc asks for mobile flags; this is the flag.

## Performance

Re-projecting ~180 country features per rAF frame during drag is well within `d3-geo`'s known throughput at 110m resolution. If telemetry or manual testing shows judder on low-end mobile:

1. First mitigation: drop state paths during drag (they're only visible at high zoom anyway) and restore them on pointer-up.
2. Second mitigation: swap in simplified geometry (`d3.geoPath` with a `pointRadius` reduction, or path-simplification via `@turf/simplify`) during active motion, sharp geometry at rest.

Neither is implemented upfront. Ship the straightforward version; measure if there's a problem.

## Rollout

Single PR. The feature is self-contained: all three current map components are replaced by `MapGlobe`, the page route is unchanged, the content file is unchanged. There's no gating or feature flag — the globe is the map.

CI (lint, typecheck, test, build) runs on the PR per the existing workflow (#8). Vercel preview deploys exercise the runtime, including reduced-motion and touch paths, before merge.
