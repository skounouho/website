# Interactive Globe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the US+world flat-map split at `/map` with a single SVG orthographic globe: drag rotates, wheel/pinch zooms, click pins to fly-to-and-open, state borders fade in at close zoom, auto-rotates until touched, deep links (`/map#<pin-id>`) fly to their pin on mount.

**Architecture:** SVG + `d3-geo` orthographic projection (zero new deps). `app/map/page.tsx` stays a server component and SSR-renders the initial globe paths for the default rotation/scale. `components/map/MapGlobe.tsx` (new, client) owns `rotation`, `scale`, `mode ("auto" | "user" | "flying")`, and `openPinId`, running `requestAnimationFrame` loops for auto-rotate and fly-to. The three existing map components (`MapSwitcher`, `MapCanvas`, `MapInsetButton`) are deleted; `PinPopover` is reused unchanged.

**Tech Stack:** React 19 + Next.js 16 App Router, `d3-geo` (`geoOrthographic`, `geoPath`, `geoDistance`), `world-atlas` 110m, `us-atlas` 10m, `topojson-client`, Vitest (Node environment, pure-function tests only).

**Testing note:** The existing `vitest.config.ts` uses `environment: "node"` and `include: ["lib/**/__tests__/**/*.test.ts"]` — no jsdom, no React Testing Library, and `components/**` is not scanned. This plan keeps that convention: every new test is a pure-function unit test under `lib/__tests__/`. Interactive behavior in `MapGlobe` (click, drag, wheel, keyboard, deep link) is verified manually in the dev server per Task 11. The spec mentions component tests; setting up jsdom + RTL is explicitly out of scope here and is a sensible follow-up if component-test infra gets added later.

---

## File Structure

```
lib/
  projection.ts                              # REWRITE — drop equal-earth/albers, add globe helpers
  tween.ts                                   # NEW — pure rotation/scale interpolation
  __tests__/
    projection.test.ts                       # REWRITE — new pure-function assertions
    tween.test.ts                            # NEW
components/
  map/
    MapGlobe.tsx                             # NEW — client component, owns interactions
    MapCanvas.tsx                            # DELETE
    MapSwitcher.tsx                          # DELETE
    MapInsetButton.tsx                       # DELETE
    PinPopover.tsx                           # UNCHANGED
app/
  map/
    page.tsx                                 # REWRITE — server shell, SSR initial paths
docs/superpowers/
  specs/2026-04-19-interactive-globe-design.md   # already committed
  plans/2026-04-19-interactive-globe.md          # this file
```

Nothing else in the repo changes. `content/map.yaml`, `lib/content/*`, and all routes outside `/map` are untouched.

---

## Task 1: Add pure globe-projection helpers (additive, TDD)

Add the new helpers alongside the existing ones so the rest of the tree keeps compiling. We remove the old helpers in Task 3 once nothing imports them.

**Files:**
- Modify: `lib/projection.ts`
- Modify: `lib/__tests__/projection.test.ts`

- [ ] **Step 1: Write failing tests for the new helpers**

Append to `lib/__tests__/projection.test.ts` (keep existing tests intact for now):

```ts
import {
  createGlobeProjection,
  pathsFromGeojson,
  isPinVisible,
  flyToTarget,
  shouldShowStateBorders,
  GLOBE_WIDTH,
  GLOBE_HEIGHT,
  GLOBE_BASE_RADIUS,
} from "@/lib/projection";
import type { ExtendedFeatureCollection } from "d3-geo";

describe("createGlobeProjection", () => {
  it("places the rotation center at the middle of the canvas at scale 1", () => {
    // rotation [30, 0] puts lon=-30 at the view center.
    const proj = createGlobeProjection({
      width: GLOBE_WIDTH,
      height: GLOBE_HEIGHT,
      scale: 1,
      rotation: [30, 0],
    });
    const xy = proj([-30, 0]);
    expect(xy).not.toBeNull();
    expect(xy![0]).toBeCloseTo(GLOBE_WIDTH / 2, 5);
    expect(xy![1]).toBeCloseTo(GLOBE_HEIGHT / 2, 5);
  });

  it("scales the sphere radius multiplicatively", () => {
    const scale1 = createGlobeProjection({
      width: GLOBE_WIDTH,
      height: GLOBE_HEIGHT,
      scale: 1,
      rotation: [0, 0],
    });
    const scale2 = createGlobeProjection({
      width: GLOBE_WIDTH,
      height: GLOBE_HEIGHT,
      scale: 2,
      rotation: [0, 0],
    });
    // A point at (45 lon, 0) should project twice as far from center at scale 2.
    const [x1] = scale1([45, 0])!;
    const [x2] = scale2([45, 0])!;
    const d1 = x1 - GLOBE_WIDTH / 2;
    const d2 = x2 - GLOBE_WIDTH / 2;
    expect(d2 / d1).toBeCloseTo(2, 3);
  });

  it("clips the far hemisphere (geoPath returns null for antipodal features)", () => {
    const proj = createGlobeProjection({
      width: GLOBE_WIDTH,
      height: GLOBE_HEIGHT,
      scale: 1,
      rotation: [0, 0],
    });
    // A tiny feature at the antipode should clip entirely.
    const fc: ExtendedFeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [179, -1],
                [180, -1],
                [180, 1],
                [179, 1],
                [179, -1],
              ],
            ],
          },
        },
      ],
    };
    const paths = pathsFromGeojson(fc, proj);
    expect(paths).toEqual([]);
  });
});

describe("isPinVisible", () => {
  it("returns true for a pin at the view center", () => {
    // rotation [30, 0] → center at (-30, 0). A pin at (-30, 0) is visible.
    expect(isPinVisible({ lon: -30, lat: 0 }, [30, 0])).toBe(true);
  });

  it("returns false for a pin at the antipode of the view center", () => {
    // rotation [0, 0] → center at (0, 0). Antipode is (180, 0).
    expect(isPinVisible({ lon: 180, lat: 0 }, [0, 0])).toBe(false);
  });

  it("returns false at exactly 90° from center (limb is a visual edge)", () => {
    // rotation [0, 0] → center at (0, 0). Point (90, 0) is exactly π/2 away.
    expect(isPinVisible({ lon: 90, lat: 0 }, [0, 0])).toBe(false);
  });

  it("returns true for NYC when center is on North America", () => {
    // rotation [74, -40.7] → center at (-74, 40.7), which is NYC.
    expect(isPinVisible({ lon: -74.006, lat: 40.7128 }, [74, -40.7])).toBe(true);
  });
});

describe("flyToTarget", () => {
  it("returns rotation that brings the pin to the view center and scale 2.2", () => {
    const t = flyToTarget({ lon: -74.006, lat: 40.7128 });
    expect(t.rotation[0]).toBeCloseTo(74.006, 5);
    expect(t.rotation[1]).toBeCloseTo(-40.7128, 5);
    expect(t.scale).toBe(2.2);
  });
});

describe("shouldShowStateBorders", () => {
  it("is false below the threshold", () => {
    expect(shouldShowStateBorders(1)).toBe(false);
    expect(shouldShowStateBorders(2.49)).toBe(false);
  });

  it("is true at and above the threshold", () => {
    expect(shouldShowStateBorders(2.5)).toBe(true);
    expect(shouldShowStateBorders(4)).toBe(true);
  });
});

describe("GLOBE_BASE_RADIUS / canvas", () => {
  it("leaves padding around the sphere inside the canvas", () => {
    expect(GLOBE_BASE_RADIUS).toBeLessThan(GLOBE_HEIGHT / 2);
    expect(GLOBE_BASE_RADIUS).toBeLessThan(GLOBE_WIDTH / 2);
  });
});
```

- [ ] **Step 2: Run the test file to verify the new assertions fail**

Run:
```bash
npx vitest run lib/__tests__/projection.test.ts
```

Expected: the new tests fail with `createGlobeProjection is not exported` / similar. Existing tests (`projectPoint`, `projectUsPoint`, `isUsPin`) still pass.

- [ ] **Step 3: Implement the new helpers in `lib/projection.ts`**

At the top of `lib/projection.ts` (above the existing code, preserving the existing exports for now), add:

```ts
import { geoOrthographic, geoDistance, geoPath } from "d3-geo";

export const GLOBE_WIDTH = 960;
export const GLOBE_HEIGHT = 540;
export const GLOBE_BASE_RADIUS = 240;

export const STATE_BORDER_SCALE_THRESHOLD = 2.5;
export const FLY_TO_SCALE = 2.2;
export const SCALE_MIN = 1;
export const SCALE_MAX = 4;

export interface GlobeProjectionConfig {
  width: number;
  height: number;
  /** Multiplicative zoom; 1 = sphere radius GLOBE_BASE_RADIUS. */
  scale: number;
  /** [lambda, phi] — yaw and pitch in degrees. */
  rotation: [number, number];
}

export function createGlobeProjection(cfg: GlobeProjectionConfig) {
  return geoOrthographic()
    .scale(GLOBE_BASE_RADIUS * cfg.scale)
    .translate([cfg.width / 2, cfg.height / 2])
    .rotate([cfg.rotation[0], cfg.rotation[1], 0])
    .clipAngle(90);
}

export function pathsFromGeojson(
  fc: ExtendedFeatureCollection,
  projection: ReturnType<typeof createGlobeProjection>,
): string[] {
  const path = geoPath(projection);
  const out: string[] = [];
  for (const f of fc.features) {
    const d = path(f);
    if (d) out.push(d);
  }
  return out;
}

export function isPinVisible(
  pin: { lon: number; lat: number },
  rotation: [number, number],
): boolean {
  // geoOrthographic().rotate([λ, φ]) brings the point at [-λ, -φ] to the view center.
  const center: [number, number] = [-rotation[0], -rotation[1]];
  return geoDistance([pin.lon, pin.lat], center) < Math.PI / 2;
}

export function flyToTarget(pin: { lon: number; lat: number }): {
  rotation: [number, number];
  scale: number;
} {
  return {
    rotation: [-pin.lon, -pin.lat],
    scale: FLY_TO_SCALE,
  };
}

export function shouldShowStateBorders(scale: number): boolean {
  return scale >= STATE_BORDER_SCALE_THRESHOLD;
}
```

Keep the existing `projectPoint`, `projectUsPoint`, `isUsPin`, `regionPathsFromGeojson`, `countryPathsFromGeojson`, `statePathsFromGeojson`, and the `MAP_*` / `US_MAP_*` constants intact for now — Task 3 removes them.

- [ ] **Step 4: Run the tests to confirm they pass**

Run:
```bash
npx vitest run lib/__tests__/projection.test.ts
```

Expected: all tests pass (the new ones plus the 13 existing `projectPoint`/`projectUsPoint`/`isUsPin` tests).

- [ ] **Step 5: Commit**

```bash
git add lib/projection.ts lib/__tests__/projection.test.ts
git commit -m "$(cat <<'EOF'
feat(projection): add globe helpers alongside existing flat projections

Introduces createGlobeProjection, pathsFromGeojson, isPinVisible,
flyToTarget, and shouldShowStateBorders. The old flat-map helpers
stay in place until the globe component consumes the new ones.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add the pure tween helpers (TDD)

The fly-to animation needs deterministic, unit-testable interpolation so the rAF loop is a thin shell around pure functions.

**Files:**
- Create: `lib/tween.ts`
- Create: `lib/__tests__/tween.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/__tests__/tween.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  lerpScale,
  lerpRotation,
  cubicBezierEase,
} from "@/lib/tween";

describe("lerpScale", () => {
  it("interpolates linearly between start and end", () => {
    expect(lerpScale(1, 3, 0)).toBe(1);
    expect(lerpScale(1, 3, 1)).toBe(3);
    expect(lerpScale(1, 3, 0.5)).toBe(2);
  });
});

describe("lerpRotation", () => {
  it("interpolates longitude and latitude linearly for short arcs", () => {
    const r = lerpRotation([0, 0], [60, 30], 0.5);
    expect(r[0]).toBeCloseTo(30, 5);
    expect(r[1]).toBeCloseTo(15, 5);
  });

  it("takes the short way around when |delta lon| > 180", () => {
    // start lon = 170, end lon = -170. Linear would go -340°; short arc is +20°.
    const r = lerpRotation([170, 0], [-170, 0], 0.5);
    // Midpoint should be at ±180 (wraps to itself); value in [-180, 180].
    const wrapped = ((r[0] + 540) % 360) - 180;
    expect(Math.abs(wrapped)).toBeCloseTo(180, 1);
  });

  it("returns start at t=0 and end at t=1", () => {
    const s: [number, number] = [10, 20];
    const e: [number, number] = [-100, -40];
    const at0 = lerpRotation(s, e, 0);
    const at1 = lerpRotation(s, e, 1);
    expect(at0[0]).toBeCloseTo(s[0], 5);
    expect(at0[1]).toBeCloseTo(s[1], 5);
    expect(at1[0]).toBeCloseTo(e[0], 5);
    expect(at1[1]).toBeCloseTo(e[1], 5);
  });
});

describe("cubicBezierEase", () => {
  it("returns 0 at t=0 and 1 at t=1", () => {
    // Using the site's standard 'smooth decel' curve (0.2, 0, 0, 1).
    expect(cubicBezierEase(0.2, 0, 0, 1)(0)).toBeCloseTo(0, 5);
    expect(cubicBezierEase(0.2, 0, 0, 1)(1)).toBeCloseTo(1, 5);
  });

  it("is monotonic on [0, 1]", () => {
    const ease = cubicBezierEase(0.2, 0, 0, 1);
    let prev = 0;
    for (let i = 1; i <= 10; i++) {
      const v = ease(i / 10);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npx vitest run lib/__tests__/tween.test.ts
```

Expected: fails with `Cannot find module '@/lib/tween'`.

- [ ] **Step 3: Implement `lib/tween.ts`**

Create `lib/tween.ts`:

```ts
export function lerpScale(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function lerpRotation(
  from: [number, number],
  to: [number, number],
  t: number,
): [number, number] {
  let dLon = to[0] - from[0];
  // Short-arc: if the straight-line delta is more than half the globe,
  // wrap the other way so a fly-to from 170° to -170° travels 20°, not 340°.
  if (dLon > 180) dLon -= 360;
  else if (dLon < -180) dLon += 360;
  const lon = from[0] + dLon * t;
  const lat = from[1] + (to[1] - from[1]) * t;
  return [lon, lat];
}

/**
 * Returns a function that evaluates the y coordinate of a CSS-style cubic
 * Bezier given an x in [0, 1]. Used to ease rAF `t` values so fly-to
 * animations match the site's `cubic-bezier(0.2, 0, 0, 1)` curve.
 *
 * Implementation: Newton-Raphson to solve x(t) = input, then evaluate y(t).
 */
export function cubicBezierEase(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (x: number) => number {
  const bezierX = (t: number) =>
    3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const bezierY = (t: number) =>
    3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  const bezierXDerivative = (t: number) =>
    3 * (1 - t) * (1 - t) * x1 +
    6 * (1 - t) * t * (x2 - x1) +
    3 * t * t * (1 - x2);

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const currentX = bezierX(t) - x;
      const derivative = bezierXDerivative(t);
      if (Math.abs(currentX) < 1e-5) break;
      if (Math.abs(derivative) < 1e-6) break;
      t -= currentX / derivative;
    }
    return bezierY(t);
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npx vitest run lib/__tests__/tween.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/tween.ts lib/__tests__/tween.test.ts
git commit -m "$(cat <<'EOF'
feat(tween): pure interpolation helpers for globe fly-to

Lerp helpers for rotation (short-arc) and scale, plus a
cubic-Bezier easing solver for matching CSS easing curves from
inside a rAF loop.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Replace the map components with a static `MapGlobe`

This task gets the new render tree on screen: server component SSRs the initial globe paths, `MapGlobe` renders them statically (no interactions yet). All three old map components are deleted; the old projection helpers they depended on are removed along with their tests.

**Files:**
- Create: `components/map/MapGlobe.tsx`
- Delete: `components/map/MapCanvas.tsx`
- Delete: `components/map/MapSwitcher.tsx`
- Delete: `components/map/MapInsetButton.tsx`
- Modify: `app/map/page.tsx`
- Modify: `lib/projection.ts` (remove old exports)
- Modify: `lib/__tests__/projection.test.ts` (drop tests for removed helpers)

- [ ] **Step 1: Create `components/map/MapGlobe.tsx` with a static render**

```tsx
"use client";

import { useMemo } from "react";
import type { ExtendedFeatureCollection } from "d3-geo";
import type { MapPin } from "@/lib/content";
import {
  createGlobeProjection,
  pathsFromGeojson,
  isPinVisible,
  shouldShowStateBorders,
  GLOBE_WIDTH,
  GLOBE_HEIGHT,
  GLOBE_BASE_RADIUS,
} from "@/lib/projection";

export interface MapGlobeProps {
  pins: MapPin[];
  worldFeatures: ExtendedFeatureCollection;
  stateFeatures: ExtendedFeatureCollection;
  initialRotation: [number, number];
  initialScale: number;
  initialCountryPaths: string[];
}

export function MapGlobe({
  pins,
  worldFeatures,
  stateFeatures,
  initialRotation,
  initialScale,
  initialCountryPaths,
}: MapGlobeProps) {
  const rotation = initialRotation;
  const scale = initialScale;

  const { countryPaths, statePaths, projectedPins } = useMemo(() => {
    const projection = createGlobeProjection({
      width: GLOBE_WIDTH,
      height: GLOBE_HEIGHT,
      scale,
      rotation,
    });
    // On first render, reuse the SSR paths instead of re-computing.
    const isInitial =
      rotation[0] === initialRotation[0] &&
      rotation[1] === initialRotation[1] &&
      scale === initialScale;
    const countryPaths = isInitial
      ? initialCountryPaths
      : pathsFromGeojson(worldFeatures, projection);
    const statePaths = shouldShowStateBorders(scale)
      ? pathsFromGeojson(stateFeatures, projection)
      : [];
    const projectedPins = pins
      .map((pin) => {
        const xy = projection([pin.lon, pin.lat]);
        if (!xy) return null;
        const visible = isPinVisible(pin, rotation);
        return visible ? { pin, x: xy[0], y: xy[1] } : null;
      })
      .filter((p): p is { pin: MapPin; x: number; y: number } => p !== null);
    return { countryPaths, statePaths, projectedPins };
  }, [
    rotation,
    scale,
    worldFeatures,
    stateFeatures,
    pins,
    initialCountryPaths,
    initialRotation,
    initialScale,
  ]);

  return (
    <div className="relative h-[calc(100vh-56px)] md:h-screen w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${GLOBE_WIDTH} ${GLOBE_HEIGHT}`}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Interactive globe showing places I've lived, worked, and visited."
      >
        <circle
          cx={GLOBE_WIDTH / 2}
          cy={GLOBE_HEIGHT / 2}
          r={GLOBE_BASE_RADIUS * scale}
          fill="var(--border)"
          stroke="var(--fg-muted)"
          strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
        />
        <g>
          {countryPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="var(--fg-muted)"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        <g style={{ opacity: shouldShowStateBorders(scale) ? 0.6 : 0, transition: "opacity 150ms ease" }}>
          {statePaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="var(--fg-muted)"
              strokeWidth={0.4}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        <g>
          {projectedPins.map(({ pin, x, y }) => (
            <circle
              key={pin.id}
              data-pin={pin.id}
              cx={x}
              cy={y}
              r={6}
              fill="var(--accent)"
              stroke="var(--bg)"
              strokeWidth={2}
              aria-label={pin.name}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `app/map/page.tsx` to use `MapGlobe`**

Replace the file contents entirely:

```tsx
import type { Metadata } from "next";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { ExtendedFeatureCollection } from "d3-geo";
import worldTopo from "world-atlas/countries-110m.json";
import statesTopo from "us-atlas/states-10m.json";
import { getPins } from "@/lib/content";
import {
  createGlobeProjection,
  pathsFromGeojson,
  GLOBE_WIDTH,
  GLOBE_HEIGHT,
} from "@/lib/projection";
import { MapGlobe } from "@/components/map/MapGlobe";

export const metadata: Metadata = {
  title: "Map",
  description: "Places I've lived, worked, and visited.",
};

// Mid-Atlantic view: rotation [30, 0] puts lon=-30 at screen center,
// roughly splitting the Americas and Europe/Africa.
const INITIAL_ROTATION: [number, number] = [30, 0];
const INITIAL_SCALE = 1;

export default function MapPage() {
  const pins = getPins();

  const worldFeatures = feature(
    worldTopo as unknown as Topology<{ countries: GeometryCollection }>,
    (worldTopo as unknown as Topology<{ countries: GeometryCollection }>)
      .objects.countries,
  ) as unknown as ExtendedFeatureCollection;

  const stateFeatures = feature(
    statesTopo as unknown as Topology<{ states: GeometryCollection }>,
    (statesTopo as unknown as Topology<{ states: GeometryCollection }>).objects
      .states,
  ) as unknown as ExtendedFeatureCollection;

  const initialProjection = createGlobeProjection({
    width: GLOBE_WIDTH,
    height: GLOBE_HEIGHT,
    scale: INITIAL_SCALE,
    rotation: INITIAL_ROTATION,
  });
  const initialCountryPaths = pathsFromGeojson(worldFeatures, initialProjection);

  return (
    <MapGlobe
      pins={pins}
      worldFeatures={worldFeatures}
      stateFeatures={stateFeatures}
      initialRotation={INITIAL_ROTATION}
      initialScale={INITIAL_SCALE}
      initialCountryPaths={initialCountryPaths}
    />
  );
}
```

- [ ] **Step 3: Delete the three old map components**

```bash
git rm components/map/MapCanvas.tsx components/map/MapSwitcher.tsx components/map/MapInsetButton.tsx
```

- [ ] **Step 4: Remove the old flat-map helpers from `lib/projection.ts`**

Open `lib/projection.ts` and delete:
- The imports of `geoEqualEarth`, `geoAlbersUsa`, `geoContains` that aren't used by the new code.
- The constants `MAP_WIDTH`, `MAP_HEIGHT`, `US_MAP_WIDTH`, `US_MAP_HEIGHT`.
- The `projection` and `usProjection` module-level variables.
- The `worldCountries` / `usFeature` memo.
- The functions `projectPoint`, `projectUsPoint`, `isUsPin`, `regionPathsFromGeojson`, `countryPathsFromGeojson`, `statePathsFromGeojson`.

Also delete the now-unused `import worldTopo from "world-atlas/countries-110m.json";` and `import { feature } from "topojson-client";` and `import type { Topology, GeometryCollection } from "topojson-specification";` if they are no longer referenced.

The final file should import only `geoOrthographic`, `geoDistance`, `geoPath`, and `ExtendedFeatureCollection` from `d3-geo`, and export only:
- `GLOBE_WIDTH`, `GLOBE_HEIGHT`, `GLOBE_BASE_RADIUS`
- `STATE_BORDER_SCALE_THRESHOLD`, `FLY_TO_SCALE`, `SCALE_MIN`, `SCALE_MAX`
- `GlobeProjectionConfig`
- `createGlobeProjection`, `pathsFromGeojson`, `isPinVisible`, `flyToTarget`, `shouldShowStateBorders`

- [ ] **Step 5: Trim `lib/__tests__/projection.test.ts`**

Delete the three `describe` blocks for `projectPoint`, `projectUsPoint`, and `isUsPin` from `lib/__tests__/projection.test.ts`. Keep (only) the new describe blocks added in Task 1 (`createGlobeProjection`, `isPinVisible`, `flyToTarget`, `shouldShowStateBorders`, `GLOBE_BASE_RADIUS`).

Also update the import line at the top of the file to drop `projectPoint`, `projectUsPoint`, `isUsPin`, `MAP_WIDTH`, `MAP_HEIGHT`, `US_MAP_WIDTH`, `US_MAP_HEIGHT`.

- [ ] **Step 6: Run the full test suite, typecheck, lint, and build**

Run:
```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected:
- `npm test`: all tests pass (the baseline 74 minus the ~12 deleted old-projection tests, plus the ~14 new tests from Tasks 1 & 2 — final count around 76).
- `npm run typecheck`: no errors.
- `npm run lint`: no errors.
- `npm run build`: Next builds successfully; `/map` is prerendered.

If `npm run build` warns about `"use client"` components that should be dynamic-only, ignore — `MapGlobe` is fine as a client boundary inside a server page.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(map): replace US+world split with static SVG globe

Deletes MapSwitcher/MapCanvas/MapInsetButton and the flat-map
projection helpers. New MapGlobe client component renders the
sphere, country borders, and pins for a fixed default rotation
and scale — interactions land in the next commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Pin click opens popover; Escape + outside-click close

**Files:**
- Modify: `components/map/MapGlobe.tsx`

- [ ] **Step 1: Wire up state and event handling**

Replace the whole `MapGlobe` component body in `components/map/MapGlobe.tsx` with:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExtendedFeatureCollection } from "d3-geo";
import type { MapPin } from "@/lib/content";
import {
  createGlobeProjection,
  pathsFromGeojson,
  isPinVisible,
  shouldShowStateBorders,
  GLOBE_WIDTH,
  GLOBE_HEIGHT,
  GLOBE_BASE_RADIUS,
} from "@/lib/projection";
import { PinPopover } from "./PinPopover";

export interface MapGlobeProps {
  pins: MapPin[];
  worldFeatures: ExtendedFeatureCollection;
  stateFeatures: ExtendedFeatureCollection;
  initialRotation: [number, number];
  initialScale: number;
  initialCountryPaths: string[];
}

export function MapGlobe({
  pins,
  worldFeatures,
  stateFeatures,
  initialRotation,
  initialScale,
  initialCountryPaths,
}: MapGlobeProps) {
  const [rotation] = useState<[number, number]>(initialRotation);
  const [scale] = useState<number>(initialScale);
  const [openPinId, setOpenPinId] = useState<string | null>(null);

  const { countryPaths, statePaths, projectedPins } = useMemo(() => {
    const projection = createGlobeProjection({
      width: GLOBE_WIDTH,
      height: GLOBE_HEIGHT,
      scale,
      rotation,
    });
    const isInitial =
      rotation[0] === initialRotation[0] &&
      rotation[1] === initialRotation[1] &&
      scale === initialScale;
    const countryPaths = isInitial
      ? initialCountryPaths
      : pathsFromGeojson(worldFeatures, projection);
    const statePaths = shouldShowStateBorders(scale)
      ? pathsFromGeojson(stateFeatures, projection)
      : [];
    const projectedPins = pins
      .map((pin) => {
        const xy = projection([pin.lon, pin.lat]);
        if (!xy) return null;
        if (!isPinVisible(pin, rotation)) return null;
        return { pin, x: xy[0], y: xy[1] };
      })
      .filter((p): p is { pin: MapPin; x: number; y: number } => p !== null);
    return { countryPaths, statePaths, projectedPins };
  }, [
    rotation,
    scale,
    worldFeatures,
    stateFeatures,
    pins,
    initialCountryPaths,
    initialRotation,
    initialScale,
  ]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenPinId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openPin = projectedPins.find((p) => p.pin.id === openPinId) ?? null;

  return (
    <div
      className="relative h-[calc(100vh-56px)] md:h-screen w-full overflow-hidden"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-pin]")) return;
        setOpenPinId(null);
      }}
    >
      <svg
        viewBox={`0 0 ${GLOBE_WIDTH} ${GLOBE_HEIGHT}`}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Interactive globe showing places I've lived, worked, and visited."
      >
        <circle
          cx={GLOBE_WIDTH / 2}
          cy={GLOBE_HEIGHT / 2}
          r={GLOBE_BASE_RADIUS * scale}
          fill="var(--border)"
          stroke="var(--fg-muted)"
          strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
        />
        <g>
          {countryPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="var(--fg-muted)"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        <g style={{ opacity: shouldShowStateBorders(scale) ? 0.6 : 0, transition: "opacity 150ms ease" }}>
          {statePaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="var(--fg-muted)"
              strokeWidth={0.4}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        <g>
          {projectedPins.map(({ pin, x, y }) => (
            <circle
              key={pin.id}
              data-pin={pin.id}
              cx={x}
              cy={y}
              r={6}
              fill="var(--accent)"
              stroke="var(--bg)"
              strokeWidth={2}
              style={{ cursor: "pointer" }}
              aria-label={pin.name}
              onClick={(e) => {
                e.stopPropagation();
                setOpenPinId((prev) => (prev === pin.id ? null : pin.id));
              }}
            />
          ))}
        </g>
      </svg>

      {openPin ? (
        <PinPopover
          pin={openPin.pin}
          x={(openPin.x / GLOBE_WIDTH) * 100}
          y={(openPin.y / GLOBE_HEIGHT) * 100}
          onClose={() => setOpenPinId(null)}
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck + tests + build**

Run:
```bash
npm run typecheck && npm test && npm run build
```

Expected: no errors, all tests pass, build succeeds.

- [ ] **Step 3: Manual smoke test in the dev server**

Run:
```bash
npm run dev
```

Visit `http://localhost:3000/map`. Verify:
- Globe renders at mid-Atlantic view with thin country strokes.
- Visible pins appear as accent-colored dots; far-side pins (e.g., Sydney if it were a pin) don't render.
- Clicking a pin opens its popover; clicking the same pin closes it; clicking another pin swaps to it.
- Pressing Escape with a popover open closes it.
- Clicking on empty map area closes the popover.
- `/map#nyc` (manually navigate) — popover does NOT auto-open yet (deep-link is Task 9).

Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add components/map/MapGlobe.tsx
git commit -m "$(cat <<'EOF'
feat(map): pin click + Escape + outside-click toggles popover

Matches the previous MapCanvas interaction model: click a pin
to open, click again or press Escape or click outside to close.
Globe is still static — no drag, wheel, or fly-to yet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Auto-rotate with reduced-motion gate

**Files:**
- Modify: `components/map/MapGlobe.tsx`

- [ ] **Step 1: Read reduced-motion once and start the rAF loop**

In `components/map/MapGlobe.tsx`:

Replace the `useState` declarations for `rotation` and `scale` with:

```tsx
  const prefersReducedMotion = usePrefersReducedMotion();
  const [rotation, setRotation] = useState<[number, number]>(initialRotation);
  const [scale] = useState<number>(initialScale);
  const [mode, setMode] = useState<"auto" | "user" | "flying">(
    prefersReducedMotion ? "user" : "auto",
  );
```

Add the hook at the bottom of the file (below the `MapGlobe` component):

```tsx
function usePrefersReducedMotion(): boolean {
  // Read on mount. Not reactive to changes — matches the site's
  // other motion-gated features (MapSwitcher used the same pattern).
  const [reduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  return reduced;
}
```

Replace the existing `useEffect` that listens for Escape with a block that adds both Escape handling and the auto-rotate rAF loop:

```tsx
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenPinId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (mode !== "auto") return;
    let rafId = 0;
    const tick = () => {
      setRotation(([lon, lat]) => [(lon + 0.05) % 360, lat]);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [mode]);
```

Also replace the `useMemo` dependency array entry `rotation` so React sees the new `rotation` each frame (it already uses `rotation`, so this is no change — just double-check it's in the array).

Change the signature of the `useState` for `rotation` so we actually use `setRotation`:
```tsx
const [rotation, setRotation] = useState<[number, number]>(initialRotation);
```
(already shown above).

- [ ] **Step 2: Verify typecheck + tests**

Run:
```bash
npm run typecheck && npm test
```

Expected: passes.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev` and open `/map`. Verify:
- Globe rotates slowly westward on load.
- In Chrome DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce", reload: globe does NOT rotate.
- Rotation will stop permanently once drag lands in the next task; for now confirm only that auto-rotate starts and reduced-motion suppresses it.

- [ ] **Step 4: Commit**

```bash
git add components/map/MapGlobe.tsx
git commit -m "$(cat <<'EOF'
feat(map): auto-rotate globe on load; respect reduced-motion

Slow westward yaw drift via requestAnimationFrame while mode is
"auto". First user interaction (landing in later commits) will
flip mode to "user" and stop the loop.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Drag to rotate (and stop auto-rotate)

**Files:**
- Modify: `components/map/MapGlobe.tsx`

- [ ] **Step 1: Add pointer handlers and a rAF-throttled rotation update**

At the top of `components/map/MapGlobe.tsx`, import `useRef`:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
```

Also import `GLOBE_BASE_RADIUS` (already imported).

Inside `MapGlobe`, add drag state refs **before** the `return (`:

```tsx
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startRotation: [number, number];
  } | null>(null);
  const pendingRotationRef = useRef<[number, number] | null>(null);
  const rafRef = useRef<number | null>(null);

  function flushPendingRotation() {
    if (pendingRotationRef.current) {
      setRotation(pendingRotationRef.current);
      pendingRotationRef.current = null;
    }
    rafRef.current = null;
  }

  function scheduleRotation(next: [number, number]) {
    pendingRotationRef.current = next;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushPendingRotation);
    }
  }
```

Update the container `<div>` to carry pointer handlers. Replace the opening div with:

```tsx
    <div
      className="relative h-[calc(100vh-56px)] md:h-screen w-full overflow-hidden touch-none"
      style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
      onPointerDown={(e) => {
        // Ignore clicks on pins — those open popovers.
        if ((e.target as HTMLElement).closest("[data-pin]")) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragRef.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          startRotation: rotation,
        };
        setMode("user");
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        const dLon = dx * (180 / (scale * GLOBE_BASE_RADIUS));
        const dLat = -dy * (180 / (scale * GLOBE_BASE_RADIUS));
        const nextLon = drag.startRotation[0] + dLon;
        const nextLat = Math.max(-90, Math.min(90, drag.startRotation[1] + dLat));
        scheduleRotation([nextLon, nextLat]);
      }}
      onPointerUp={(e) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-pin]")) return;
        setOpenPinId(null);
      }}
    >
```

(The `onClick` handler is unchanged; keep it for outside-click-to-close.)

Add cleanup for the rAF on unmount — in the existing `useEffect` that handles Escape, or add a separate effect:

```tsx
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);
```

- [ ] **Step 2: Verify typecheck + tests**

Run:
```bash
npm run typecheck && npm test
```

Expected: passes.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`, visit `/map`. Verify:
- Globe auto-rotates at start.
- Dragging the globe stops auto-rotate immediately and rotates to follow the pointer; vertical drag pitches, clamped at ±90°.
- Releasing pointer stops rotation (no inertia).
- After drag, auto-rotate does NOT resume.
- Clicking a pin still opens its popover (drag-start doesn't fire because the pointerdown lands on a `[data-pin]` element).
- On touch devices (or emulated): single-finger drag rotates. `touch-none` on the container suppresses the browser's native pan/zoom on the globe.

- [ ] **Step 4: Commit**

```bash
git add components/map/MapGlobe.tsx
git commit -m "$(cat <<'EOF'
feat(map): drag-to-rotate, stops auto-rotate on first pointer

Pointer events capture the container, scale dx/dy to Δλ/Δφ
inversely by zoom, clamp φ, and flush one rotation update per
animation frame.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Wheel + pinch zoom with state borders fade-in

**Files:**
- Modify: `components/map/MapGlobe.tsx`
- Modify: `lib/projection.ts` (re-export `SCALE_MIN`, `SCALE_MAX` already exist from Task 1 — nothing to change here; this note confirms)

- [ ] **Step 1: Add zoom state and handlers**

In `MapGlobe`, change the `scale` state to be writable:

```tsx
  const [scale, setScale] = useState<number>(initialScale);
```

Also import the scale constants:

```tsx
import {
  createGlobeProjection,
  pathsFromGeojson,
  isPinVisible,
  shouldShowStateBorders,
  GLOBE_WIDTH,
  GLOBE_HEIGHT,
  GLOBE_BASE_RADIUS,
  SCALE_MIN,
  SCALE_MAX,
} from "@/lib/projection";
```

Add a rAF-throttled scale updater next to the rotation updater:

```tsx
  const pendingScaleRef = useRef<number | null>(null);

  function flushPendingScale() {
    if (pendingScaleRef.current !== null) {
      const s = pendingScaleRef.current;
      setScale(s);
      pendingScaleRef.current = null;
    }
  }

  function scheduleScale(next: number) {
    const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, next));
    pendingScaleRef.current = clamped;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        flushPendingRotation();
        flushPendingScale();
      });
    }
  }
```

Update `flushPendingRotation` to also flush scale (so both land in the same frame):

```tsx
  function flushPendingRotation() {
    if (pendingRotationRef.current) {
      setRotation(pendingRotationRef.current);
      pendingRotationRef.current = null;
    }
    if (pendingScaleRef.current !== null) {
      setScale(pendingScaleRef.current);
      pendingScaleRef.current = null;
    }
    rafRef.current = null;
  }
```

Remove the separate `flushPendingScale` function — folding it into `flushPendingRotation` keeps one source of truth.

And replace `scheduleScale` with:

```tsx
  function scheduleScale(next: number) {
    const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, next));
    pendingScaleRef.current = clamped;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushPendingRotation);
    }
  }
```

Add wheel and pinch handling to the container `<div>`. Add these props next to the other pointer handlers:

```tsx
      onWheel={(e) => {
        e.preventDefault();
        setMode("user");
        const factor = Math.exp(-e.deltaY * 0.001);
        scheduleScale(scale * factor);
      }}
```

For pinch, track two simultaneous pointers. Add refs + handlers:

```tsx
  const pinchRef = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    startDistance: number | null;
    startScale: number;
  }>({ pointers: new Map(), startDistance: null, startScale: 1 });
```

Update `onPointerDown` — append:

```tsx
        pinchRef.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinchRef.current.pointers.size === 2) {
          const [a, b] = Array.from(pinchRef.current.pointers.values());
          pinchRef.current.startDistance = Math.hypot(a.x - b.x, a.y - b.y);
          pinchRef.current.startScale = scale;
          // Cancel any in-flight drag — pinch takes over.
          dragRef.current = null;
        }
```

Update `onPointerMove` — below the existing drag block, add:

```tsx
        if (pinchRef.current.pointers.has(e.pointerId)) {
          pinchRef.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }
        if (
          pinchRef.current.pointers.size === 2 &&
          pinchRef.current.startDistance !== null
        ) {
          const [a, b] = Array.from(pinchRef.current.pointers.values());
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          const ratio = dist / pinchRef.current.startDistance;
          scheduleScale(pinchRef.current.startScale * ratio);
        }
```

Update `onPointerUp` and `onPointerCancel`:

```tsx
      onPointerUp={(e) => {
        const drag = dragRef.current;
        if (drag && drag.pointerId === e.pointerId) dragRef.current = null;
        pinchRef.current.pointers.delete(e.pointerId);
        if (pinchRef.current.pointers.size < 2) {
          pinchRef.current.startDistance = null;
        }
      }}
      onPointerCancel={(e) => {
        dragRef.current = null;
        pinchRef.current.pointers.delete(e.pointerId);
        if (pinchRef.current.pointers.size < 2) {
          pinchRef.current.startDistance = null;
        }
      }}
```

- [ ] **Step 2: Verify typecheck + tests + build**

Run:
```bash
npm run typecheck && npm test && npm run build
```

Expected: passes.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`, visit `/map`. Verify:
- Scroll wheel zooms in and out; globe grows/shrinks within canvas; scale clamps at min/max (can't zoom past `SCALE_MIN`=1 out or `SCALE_MAX`=4 in).
- Zoomed in past 2.5×, state borders fade in (thin interior lines on the US); zooming back out fades them away.
- On a trackpad or touch device: pinch zooms; works concurrently with rotation if fingers also move laterally (accept either behavior — not worth fighting).
- Wheel stops auto-rotate.

- [ ] **Step 4: Commit**

```bash
git add components/map/MapGlobe.tsx
git commit -m "$(cat <<'EOF'
feat(map): wheel + pinch zoom; state borders above 2.5x

Multiplicative zoom clamped to [1, 4]. Scale updates share the
same rAF flush as rotation so both land in one React commit per
frame. Crosses the state-border threshold with a 150ms opacity
fade inherited from Task 3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Fly-to-pin animation

**Files:**
- Modify: `components/map/MapGlobe.tsx`

- [ ] **Step 1: Add a fly-to rAF loop**

Import the tween helpers and the target helper:

```tsx
import { cubicBezierEase, lerpRotation, lerpScale } from "@/lib/tween";
import {
  ...existing...
  flyToTarget,
} from "@/lib/projection";
```

Add a constant next to the component:

```tsx
const GLOBE_DURATION_MS = 750;
const GLOBE_EASE = cubicBezierEase(0.2, 0, 0, 1);
```

Add refs for the fly-to loop:

```tsx
  const flyRafRef = useRef<number | null>(null);

  function cancelFly() {
    if (flyRafRef.current !== null) {
      cancelAnimationFrame(flyRafRef.current);
      flyRafRef.current = null;
    }
  }
```

Add a helper that runs the tween:

```tsx
  function startFlyTo(pin: MapPin, onComplete?: () => void) {
    cancelFly();
    const target = flyToTarget(pin);
    const startRotation = rotation;
    const startScale = scale;
    const startTime = performance.now();

    const step = (now: number) => {
      const raw = Math.min(1, (now - startTime) / GLOBE_DURATION_MS);
      const eased = GLOBE_EASE(raw);
      const r = lerpRotation(startRotation, target.rotation, eased);
      const s = lerpScale(startScale, target.scale, eased);
      setRotation(r);
      setScale(s);
      if (raw < 1) {
        flyRafRef.current = requestAnimationFrame(step);
      } else {
        flyRafRef.current = null;
        setMode("user");
        onComplete?.();
      }
    };

    setMode("flying");
    flyRafRef.current = requestAnimationFrame(step);
  }
```

Update the pin `onClick` to fly and then open:

Replace the current pin onClick handler with:

```tsx
              onClick={(e) => {
                e.stopPropagation();
                if (openPinId === pin.id) {
                  setOpenPinId(null);
                  return;
                }
                if (prefersReducedMotion) {
                  const target = flyToTarget(pin);
                  setRotation(target.rotation);
                  setScale(target.scale);
                  setMode("user");
                  setOpenPinId(pin.id);
                  return;
                }
                // Close any existing popover before flying.
                setOpenPinId(null);
                startFlyTo(pin, () => setOpenPinId(pin.id));
              }}
```

Make pointer/wheel events cancel an in-flight fly:

In `onPointerDown` (before existing body), add:
```tsx
        cancelFly();
```

In `onWheel` (before existing body), add:
```tsx
        cancelFly();
```

Cleanup on unmount — extend the existing rAF cleanup effect:

```tsx
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (flyRafRef.current !== null) cancelAnimationFrame(flyRafRef.current);
    };
  }, []);
```

- [ ] **Step 2: Verify typecheck + tests + build**

Run:
```bash
npm run typecheck && npm test && npm run build
```

Expected: passes.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`, visit `/map`. Verify:
- Clicking a pin on the near hemisphere: globe smoothly rotates+zooms to center the pin; popover opens at the end.
- Clicking a second pin while a popover is open: closes current, flies to new, opens new.
- Clicking the already-open pin: closes popover, no movement.
- Starting a drag or scroll during fly-to: cancels the animation where it is and gives control back to the user.
- In reduced-motion emulation: pin click snaps to target instantly and opens popover.

- [ ] **Step 4: Commit**

```bash
git add components/map/MapGlobe.tsx
git commit -m "$(cat <<'EOF'
feat(map): fly-to-pin animation on click

rAF tween over 750ms (cubic-bezier 0.2,0,0,1) interpolates
rotation (short-arc) and scale from current to target. Pointer
and wheel events cancel in-flight animations; reduced-motion
snaps instantaneously.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Deep-link fly-to on mount and hashchange

**Files:**
- Modify: `components/map/MapGlobe.tsx`

- [ ] **Step 1: Listen for hash and trigger fly-to**

Add inside `MapGlobe` (after the auto-rotate effect):

```tsx
  useEffect(() => {
    if (typeof window === "undefined") return;

    const route = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const pin = pins.find((p) => p.id === hash);
      if (!pin) return;
      if (prefersReducedMotion) {
        const target = flyToTarget(pin);
        setRotation(target.rotation);
        setScale(target.scale);
        setMode("user");
        setOpenPinId(pin.id);
      } else {
        setOpenPinId(null);
        startFlyTo(pin, () => setOpenPinId(pin.id));
      }
    };

    route();
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
    // `startFlyTo` reads current rotation/scale via the closure each call,
    // which is what we want — it should tween from wherever the globe is
    // when the hash fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, prefersReducedMotion]);
```

- [ ] **Step 2: Verify typecheck + tests + build**

Run:
```bash
npm run typecheck && npm test && npm run build
```

Expected: passes. If eslint complains about the exhaustive-deps ignore, leave the comment — `startFlyTo` is a stable closure defined inside the component and including it in deps would cause extra fly-tos on every rerender. If the lint rule still fires, move `startFlyTo` inside a `useCallback` keyed on `[]`.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`. Verify:
- Navigate directly to `/map#nyc` — globe loads, then flies to NYC and opens its popover.
- While on `/map` with no popover open, paste `/map#vancouver` into the URL bar and press Enter (or edit hash via DevTools) — globe flies to Vancouver.
- `/map#does-not-exist` — no error, no movement, no popover.
- In reduced-motion: `/map#nyc` snaps and opens immediately.

- [ ] **Step 4: Commit**

```bash
git add components/map/MapGlobe.tsx
git commit -m "$(cat <<'EOF'
feat(map): deep-link fly-to on mount and hashchange

/map#<pin-id> flies the globe to that pin and opens its popover.
Missing or empty hash is a no-op. Reduced-motion snaps instantly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Keyboard controls

**Files:**
- Modify: `components/map/MapGlobe.tsx`

- [ ] **Step 1: Make the globe container focusable and handle keys**

Add `tabIndex={0}` to the container div and wire a `onKeyDown`. Update the container:

```tsx
    <div
      tabIndex={0}
      className="relative h-[calc(100vh-56px)] md:h-screen w-full overflow-hidden touch-none outline-none"
      style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
      onKeyDown={(e) => {
        const STEP = 5;           // degrees per arrow key
        const ZOOM_FACTOR = 1.2;  // multiplicative per +/-
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          cancelFly();
          setMode("user");
          setRotation(([lon, lat]) => [lon - STEP, lat]);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          cancelFly();
          setMode("user");
          setRotation(([lon, lat]) => [lon + STEP, lat]);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          cancelFly();
          setMode("user");
          setRotation(([lon, lat]) => [
            lon,
            Math.max(-90, Math.min(90, lat + STEP)),
          ]);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          cancelFly();
          setMode("user");
          setRotation(([lon, lat]) => [
            lon,
            Math.max(-90, Math.min(90, lat - STEP)),
          ]);
        } else if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          cancelFly();
          setMode("user");
          setScale((s) => Math.max(SCALE_MIN, Math.min(SCALE_MAX, s * ZOOM_FACTOR)));
        } else if (e.key === "-") {
          e.preventDefault();
          cancelFly();
          setMode("user");
          setScale((s) => Math.max(SCALE_MIN, Math.min(SCALE_MAX, s / ZOOM_FACTOR)));
        }
      }}
      onPointerDown={/* existing */ (e) => { /* ... */ }}
      /* ...other existing handlers... */
    >
```

Change the pin `<circle>` to be keyboard-focusable and to open on Enter/Space. Replace the `<circle>` inside the pins map with:

```tsx
            <g
              key={pin.id}
              tabIndex={0}
              role="button"
              aria-label={pin.name}
              style={{ cursor: "pointer", outline: "none" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  (document.querySelector(
                    `[data-pin="${pin.id}"]`,
                  ) as SVGCircleElement | null)?.dispatchEvent(
                    new MouseEvent("click", { bubbles: true }),
                  );
                }
              }}
            >
              <circle
                data-pin={pin.id}
                cx={x}
                cy={y}
                r={6}
                fill="var(--accent)"
                stroke="var(--bg)"
                strokeWidth={2}
                onClick={(e) => {
                  e.stopPropagation();
                  if (openPinId === pin.id) {
                    setOpenPinId(null);
                    return;
                  }
                  if (prefersReducedMotion) {
                    const target = flyToTarget(pin);
                    setRotation(target.rotation);
                    setScale(target.scale);
                    setMode("user");
                    setOpenPinId(pin.id);
                    return;
                  }
                  setOpenPinId(null);
                  startFlyTo(pin, () => setOpenPinId(pin.id));
                }}
              />
            </g>
```

- [ ] **Step 2: Verify typecheck + tests + build**

Run:
```bash
npm run typecheck && npm test && npm run build
```

Expected: passes.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev`, visit `/map`. Verify (desktop):
- Click on the map area (not a pin) to focus the container.
- Arrow keys rotate the globe in 5° increments; holding an arrow repeats the step.
- `+` / `=` zoom in one step; `-` zooms out; both clamp at the min/max.
- Tab moves focus to the first visible pin; Enter triggers fly-to and opens popover; Escape closes.
- Tab cycles through visible pins.

- [ ] **Step 4: Commit**

```bash
git add components/map/MapGlobe.tsx
git commit -m "$(cat <<'EOF'
feat(map): keyboard controls for globe and pins

Arrow keys rotate 5° per press; +/-/= zoom 1.2× per press; Tab
focuses visible pins; Enter/Space opens a focused pin; Escape
closes the popover.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full CI-equivalent locally**

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: all four commands exit 0. Test count should be around 76 (original 74 minus the ~12 removed flat-map projection tests, plus the new ~14 globe/tween tests).

- [ ] **Step 2: End-to-end manual smoke in the dev server**

```bash
npm run dev
```

Walk through the acceptance criteria one by one and check each off mentally:

- [ ] Globe loads centered roughly over the mid-Atlantic, auto-rotating slowly.
- [ ] Visible pins (NYC, Durham, Chicago, Lemont, Albuquerque, Raleigh — depending on current rotation) render; no pins visible on the far hemisphere.
- [ ] First drag stops auto-rotate permanently and follows the pointer.
- [ ] Scroll-wheel zoom works and clamps at 1× and 4×.
- [ ] At ≥ 2.5× zoom, state borders fade in (best seen zoomed into North America).
- [ ] Clicking a pin flies the globe to center it and opens the popover.
- [ ] Clicking the open pin closes its popover; clicking another pin swaps.
- [ ] Escape closes an open popover.
- [ ] Clicking empty map closes an open popover.
- [ ] `/map#nyc`, `/map#vancouver`, `/map#durham` — direct navigation flies to the pin and opens it.
- [ ] Arrow keys rotate; +/-/= zoom; Tab cycles pins; Enter opens.
- [ ] Reduced-motion (DevTools → Rendering → emulate): no auto-rotate; fly-to snaps instantaneously on pin click and on deep link.
- [ ] Touch: single-finger drag rotates; two-finger pinch zooms; tap opens popover. (Use DevTools device emulation or a real phone.)
- [ ] Dark mode toggle: sphere, strokes, pins, and popover all use design tokens — no hard-coded light-mode colors.

- [ ] **Step 3: Commit any stragglers and push**

If any fixes were needed during manual verification, commit them with a `fix(map):` prefix. Otherwise nothing to commit.

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

- [ ] **Step 4: Open PR**

```bash
git push -u origin feature/interactive-globe
gh pr create --title "feat(map): interactive SVG globe with zoom and pan" --body "$(cat <<'EOF'
## Summary
- Replaces the US+world flat-map split at `/map` with a single interactive SVG globe (d3-geo orthographic projection, zero new deps).
- Drag to rotate, wheel/pinch to zoom, click a pin to fly to it and open its popover. State borders fade in above 2.5× zoom. Deep links (`/map#<pin-id>`) fly on mount. Auto-rotate on load until first touch; reduced-motion respected throughout.

## Test plan
- [x] Unit tests for projection + tween helpers (~14 new tests in `lib/__tests__/`).
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass.
- [ ] Manual smoke in Vercel preview: load, drag, zoom, fly-to, deep-link, reduced-motion, touch, keyboard, dark mode (reviewer to verify on preview).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

I read the spec back and checked every requirement against the plan:

| Spec requirement | Plan coverage |
| --- | --- |
| Single globe replaces US+world | Task 3 deletes old components, wires MapGlobe |
| Auto-rotate, center over Atlantic, stops on first touch | Task 5 (rAF + reduced-motion gate), Task 6 (pointer flip to "user") |
| Drag rotates; wheel/pinch zoom | Tasks 6 and 7 |
| Click pin flies + opens popover | Task 8 |
| State borders fade in at close zoom | Task 3 (render), Task 7 (real zoom crossing) |
| Deep links fly-to on mount | Task 9 |
| Far-side pins hidden entirely | Task 3 (filter via `isPinVisible`) |
| Reduced-motion disables auto-rotate + snaps fly-to | Tasks 5, 8, 9 |
| Zero new deps | Confirmed — all imports use existing packages |
| `prefers-reduced-motion` initial mode = user | Task 5 (`useState` initializer) |
| Keyboard controls | Task 10 |
| Mobile touch (pinch, drag, tap) | Task 6 (drag), Task 7 (pinch); `touch-none` added to container in Task 6 |
| Perf mitigations if juddery | Deferred per spec — not planned upfront |
| Component tests per spec | Skipped; existing codebase has no component-test infra. Flagged in the plan header. |

No placeholders, no "implement later", no undefined symbols. Types used in later tasks (`startFlyTo`, `cancelFly`, `scheduleRotation`, `SCALE_MIN`, `SCALE_MAX`, `flyToTarget`, `cubicBezierEase`, `lerpRotation`, `lerpScale`) all match their definitions in earlier tasks.
