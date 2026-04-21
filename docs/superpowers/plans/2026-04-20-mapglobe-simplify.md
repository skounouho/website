# MapGlobe Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `components/map/MapGlobe.tsx` from 620 lines to ≤250 by extracting cohesive behavior into focused hooks/components, and flatten JSX event-handler nesting (currently 4 levels deep in `onPointerUp`, 6-way if-chain in `onKeyDown`) to ≤2 levels with early returns and dispatch tables.

**Architecture:** Pure refactor — zero behavior changes. Extract each self-contained concern (rAF batching, fly-to tween, drift inertia, wheel handler, auto-spin, hash routing, keyboard, pointer interaction, pin rendering) into a dedicated hook in `components/map/hooks/` or sub-component in `components/map/`. MapGlobe becomes an orchestrator that composes hooks + lays out SVG structure. The 92 existing tests and the Chrome warning fix (commit `be40912`) must remain intact throughout.

**Tech Stack:** React 19 hooks, TypeScript, Next.js App Router client components, Vitest + jsdom for unit tests on isolatable hooks.

---

## Scoping Context (read before executing)

**Why this file:** `MapGlobe.tsx` is 620 LOC. The second-largest source file is `lib/content/schemas.ts` at 163. No other file is close.

**Nesting hotspots (measured manually from current `main` HEAD of this branch):**

| Location | Current nesting | Lines | Why it's tangled |
|---|---|---|---|
| `onKeyDown` (L335-382) | 2 (big if/else chain) | 48 | 6 branches, each repeating `preventDefault / cancelFly / cancelDrift / setMode("user") / <one-line update>` |
| `onPointerUp` (L441-470) | **4** (if → if → if → if) | 30 | Drag-release + velocity calc + drift-threshold all stacked |
| `onPointerMove` (L409-440) | 3 | 32 | Drag + rolling-window trim + pinch all in one handler |
| Pin SVG (L536-596) | 3 | 60 | Inline `onKeyDown` + `onClick` on every pin |

**Extraction targets (after plan runs):**

| Module | File | ~LOC | Kind |
|---|---|---|---|
| `usePrefersReducedMotion` | `components/map/hooks/usePrefersReducedMotion.ts` | 12 | Move existing |
| `useRafBatch` | `components/map/hooks/useRafBatch.ts` | 45 | New (extracts rafRef + pendingRotation/ScaleRef) |
| `useAutoRotate` | `components/map/hooks/useAutoRotate.ts` | 20 | New |
| `useFlyTo` | `components/map/hooks/useFlyTo.ts` | 55 | New |
| `useDrift` | `components/map/hooks/useDrift.ts` | 40 | New |
| `useGlobeWheel` | `components/map/hooks/useGlobeWheel.ts` | 30 | New (wraps the Chrome-warning fix) |
| `useGlobeHashRoute` | `components/map/hooks/useGlobeHashRoute.ts` | 35 | New |
| `useGlobeKeyboard` | `components/map/hooks/useGlobeKeyboard.ts` | 55 | New + dispatch table to flatten if-chain |
| `usePointerInteraction` | `components/map/hooks/usePointerInteraction.ts` | 150 | New + early-return flattening of `onPointerUp` |
| `GlobePin` | `components/map/GlobePin.tsx` | 70 | New component |

**Verification contract per task:**
- `npm run typecheck` → clean
- `npm test` → 92/92 passing (or higher, if the task adds tests)
- `git diff` matches what the task describes
- No behavior drift: `/map` still renders, drag/pinch/wheel/keyboard/click all work, pin popover opens on hash navigation

**Ordering principle:** Cheapest-and-safest first; hooks with no runtime dependencies on other extractions go before hooks that compose them. `usePointerInteraction` is last of the hooks (biggest lift, pulls the most refs) so every earlier task benefits from already-extracted primitives.

---

## Task 1: Move `usePrefersReducedMotion` to its own file

**Files:**
- Create: `components/map/hooks/usePrefersReducedMotion.ts`
- Modify: `components/map/MapGlobe.tsx` (remove local hook, add import)

- [ ] **Step 1: Create the hook file**

Create `components/map/hooks/usePrefersReducedMotion.ts`:

```ts
import { useState } from "react";

/**
 * Reads `prefers-reduced-motion` once on mount. Not reactive to changes —
 * matches the site's other motion-gated features.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  return reduced;
}
```

- [ ] **Step 2: Update MapGlobe to import it and delete the local definition**

In `components/map/MapGlobe.tsx`:

1. Add to the import block near the top (after the existing `import { PinPopover } from "./PinPopover";`):

```tsx
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
```

2. Delete the `function usePrefersReducedMotion(): boolean { ... }` definition at the bottom of the file (currently lines 612-620).

- [ ] **Step 3: Verify**

Run:
```bash
npm run typecheck
npm test
```
Expected: typecheck clean, 92/92 tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/map/hooks/usePrefersReducedMotion.ts components/map/MapGlobe.tsx
git commit -m "Extract usePrefersReducedMotion into its own hook file"
```

---

## Task 2: Extract `useRafBatch`

**Files:**
- Create: `components/map/hooks/useRafBatch.ts`
- Create: `components/map/hooks/__tests__/useRafBatch.test.ts`
- Modify: `components/map/MapGlobe.tsx`

**What this extracts:** `pendingRotationRef`, `pendingScaleRef`, `rafRef`, `flushPendingRotation`, `scheduleRotation`, `scheduleScale`, and the unmount-cleanup that cancels `rafRef.current`.

- [ ] **Step 1: Write the failing test**

Create `components/map/hooks/__tests__/useRafBatch.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRafBatch } from "../useRafBatch";

describe("useRafBatch", () => {
  let rafCallbacks: Array<(t: number) => void>;
  let rafId: number;

  beforeEach(() => {
    rafCallbacks = [];
    rafId = 0;
    vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => {
      rafId += 1;
      rafCallbacks.push(cb);
      return rafId;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      rafCallbacks = [];
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function flushRaf() {
    const pending = rafCallbacks;
    rafCallbacks = [];
    pending.forEach((cb) => cb(0));
  }

  it("batches rotation and scale updates into a single rAF flush", () => {
    const setRotation = vi.fn();
    const setScale = vi.fn();
    const { result } = renderHook(() => useRafBatch(setRotation, setScale));

    act(() => {
      result.current.scheduleRotation([10, 20]);
      result.current.scheduleRotation([30, 40]);
      result.current.scheduleScale(2);
      result.current.scheduleScale(3);
    });

    expect(setRotation).not.toHaveBeenCalled();
    expect(setScale).not.toHaveBeenCalled();

    act(() => flushRaf());

    expect(setRotation).toHaveBeenCalledTimes(1);
    expect(setRotation).toHaveBeenCalledWith([30, 40]);
    expect(setScale).toHaveBeenCalledTimes(1);
    expect(setScale).toHaveBeenCalledWith(3);
  });

  it("clamps scale to [SCALE_MIN, SCALE_MAX]", () => {
    const setRotation = vi.fn();
    const setScale = vi.fn();
    const { result } = renderHook(() => useRafBatch(setRotation, setScale));

    act(() => {
      result.current.scheduleScale(999);
    });
    act(() => flushRaf());
    expect(setScale).toHaveBeenCalledWith(4);

    act(() => {
      result.current.scheduleScale(-5);
    });
    act(() => flushRaf());
    expect(setScale).toHaveBeenCalledWith(1);
  });

  it("cancels pending frame on unmount", () => {
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const { result, unmount } = renderHook(() =>
      useRafBatch(vi.fn(), vi.fn()),
    );
    act(() => {
      result.current.scheduleRotation([0, 0]);
    });
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useRafBatch`
Expected: FAIL with "Cannot find module '../useRafBatch'"

- [ ] **Step 3: Create the hook**

Create `components/map/hooks/useRafBatch.ts`:

```ts
import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { SCALE_MIN, SCALE_MAX } from "@/lib/projection";

export interface RafBatch {
  scheduleRotation: (next: [number, number]) => void;
  scheduleScale: (next: number) => void;
  cancel: () => void;
}

/**
 * Batches rotation+scale state updates into a single requestAnimationFrame.
 * Multiple schedule calls within a frame collapse to one setState each — the
 * last value wins. Cancels any pending frame on unmount.
 */
export function useRafBatch(
  setRotation: Dispatch<SetStateAction<[number, number]>>,
  setScale: Dispatch<SetStateAction<number>>,
): RafBatch {
  const pendingRotationRef = useRef<[number, number] | null>(null);
  const pendingScaleRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const flush = () => {
    if (pendingRotationRef.current) {
      setRotation(pendingRotationRef.current);
      pendingRotationRef.current = null;
    }
    if (pendingScaleRef.current !== null) {
      setScale(pendingScaleRef.current);
      pendingScaleRef.current = null;
    }
    rafRef.current = null;
  };

  const scheduleRotation = (next: [number, number]) => {
    pendingRotationRef.current = next;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flush);
    }
  };

  const scheduleScale = (next: number) => {
    pendingScaleRef.current = Math.max(SCALE_MIN, Math.min(SCALE_MAX, next));
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flush);
    }
  };

  const cancel = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  useEffect(() => cancel, []);

  return { scheduleRotation, scheduleScale, cancel };
}
```

- [ ] **Step 4: Run the unit tests to confirm they pass**

Run: `npm test -- useRafBatch`
Expected: 3 tests pass.

- [ ] **Step 5: Wire the hook into MapGlobe**

In `components/map/MapGlobe.tsx`:

1. Add to imports near the top:
```tsx
import { useRafBatch } from "./hooks/useRafBatch";
```

2. Replace the entire block — the three refs (`pendingRotationRef`, `pendingScaleRef`, `rafRef`) and the three functions (`flushPendingRotation`, `scheduleRotation`, `scheduleScale`) — with a single call placed near the top of the component body, right after the `useState` declarations:

```tsx
const { scheduleRotation, scheduleScale } = useRafBatch(setRotation, setScale);
```

3. Delete the unmount-cleanup that cancels `rafRef.current` from the `useEffect(() => { return () => { ... } }, [])` at L301-307 (lines in current file). The `useRafBatch` hook now owns that cleanup. Leave the `flyRafRef` and `driftRafRef` cleanups in place for now — later tasks move those.

- [ ] **Step 6: Run full test suite + typecheck**

```bash
npm run typecheck
npm test
```
Expected: typecheck clean, 95/95 (92 existing + 3 new) tests pass.

- [ ] **Step 7: Commit**

```bash
git add components/map/hooks/useRafBatch.ts components/map/hooks/__tests__/useRafBatch.test.ts components/map/MapGlobe.tsx
git commit -m "Extract rAF-batched scheduling into useRafBatch hook"
```

---

## Task 3: Extract `useAutoRotate`

**Files:**
- Create: `components/map/hooks/useAutoRotate.ts`
- Modify: `components/map/MapGlobe.tsx`

- [ ] **Step 1: Create the hook**

Create `components/map/hooks/useAutoRotate.ts`:

```ts
import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

export type GlobeMode = "auto" | "user" | "flying";

/**
 * Spins the globe slowly on the longitude axis while `mode === "auto"`.
 * Cancels the rAF loop when mode changes or the component unmounts.
 */
export function useAutoRotate(
  mode: GlobeMode,
  setRotation: Dispatch<SetStateAction<[number, number]>>,
): void {
  useEffect(() => {
    if (mode !== "auto") return;
    let rafId = 0;
    const tick = () => {
      setRotation(([lon, lat]) => [(lon + 0.05) % 360, lat]);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [mode, setRotation]);
}
```

- [ ] **Step 2: Wire into MapGlobe**

In `components/map/MapGlobe.tsx`:

1. Add import:
```tsx
import { useAutoRotate, type GlobeMode } from "./hooks/useAutoRotate";
```

2. Replace the `useState<"auto" | "user" | "flying">` inline union with `useState<GlobeMode>`.

3. Delete the `useEffect` at L129-138 (the auto-rotate effect).

4. After the state declarations, add:
```tsx
useAutoRotate(mode, setRotation);
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck
npm test
```
Expected: clean + 95/95 passing.

- [ ] **Step 4: Commit**

```bash
git add components/map/hooks/useAutoRotate.ts components/map/MapGlobe.tsx
git commit -m "Extract auto-rotate loop into useAutoRotate hook"
```

---

## Task 4: Extract `useFlyTo`

**Files:**
- Create: `components/map/hooks/useFlyTo.ts`
- Modify: `components/map/MapGlobe.tsx`

**What this extracts:** `flyRafRef`, `cancelFly`, `startFlyTo`. Reads live rotation/scale through refs so the tween always starts from the globe's current state.

- [ ] **Step 1: Create the hook**

Create `components/map/hooks/useFlyTo.ts`:

```ts
import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction, RefObject } from "react";
import type { MapPin } from "@/lib/content";
import { cubicBezierEase, lerpRotation, lerpScale } from "@/lib/tween";
import { flyToTarget } from "@/lib/projection";
import type { GlobeMode } from "./useAutoRotate";

const GLOBE_DURATION_MS = 750;
const GLOBE_EASE = cubicBezierEase(0.2, 0, 0, 1);

export interface FlyTo {
  startFlyTo: (pin: MapPin, onComplete?: () => void) => void;
  cancelFly: () => void;
}

export function useFlyTo(opts: {
  rotationRef: RefObject<[number, number]>;
  scaleRef: RefObject<number>;
  setRotation: Dispatch<SetStateAction<[number, number]>>;
  setScale: Dispatch<SetStateAction<number>>;
  setMode: Dispatch<SetStateAction<GlobeMode>>;
}): FlyTo {
  const { rotationRef, scaleRef, setRotation, setScale, setMode } = opts;
  const flyRafRef = useRef<number | null>(null);

  const cancelFly = () => {
    if (flyRafRef.current !== null) {
      cancelAnimationFrame(flyRafRef.current);
      flyRafRef.current = null;
    }
  };

  const startFlyTo = (pin: MapPin, onComplete?: () => void) => {
    cancelFly();
    const target = flyToTarget(pin);
    const startRotation = rotationRef.current!;
    const startScale = scaleRef.current!;
    const startTime = performance.now();

    const step = (now: number) => {
      const raw = Math.min(1, (now - startTime) / GLOBE_DURATION_MS);
      const eased = GLOBE_EASE(raw);
      setRotation(lerpRotation(startRotation, target.rotation, eased));
      setScale(lerpScale(startScale, target.scale, eased));
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
  };

  useEffect(() => cancelFly, []);

  return { startFlyTo, cancelFly };
}
```

- [ ] **Step 2: Wire into MapGlobe**

In `components/map/MapGlobe.tsx`:

1. Add import:
```tsx
import { useFlyTo } from "./hooks/useFlyTo";
```

2. Add a `rotationRef` alongside the existing `scaleRef` (both use the same latest-value pattern):

```tsx
const rotationRef = useRef(rotation);
rotationRef.current = rotation;
const scaleRef = useRef(scale);
scaleRef.current = scale;
```

(Keep the existing `scaleRef` block and its comment; add `rotationRef` right above.)

3. Remove the `startFlyTo` function definition (L246-272 in the current file) and the `flyRafRef` declaration (L187).

4. Remove `cancelFly` (L212-217).

5. Remove the `GLOBE_DURATION_MS` and `GLOBE_EASE` constants at L26-27 — they're now inside `useFlyTo`.

6. Remove the now-unused `cubicBezierEase`, `lerpRotation`, `lerpScale` imports at the top.

7. Add the hook call after `useRafBatch`:

```tsx
const { startFlyTo, cancelFly } = useFlyTo({
  rotationRef,
  scaleRef,
  setRotation,
  setScale,
  setMode,
});
```

8. Remove the `flyRafRef.current` cleanup from the unmount effect at L301-307. (The remaining cleanup in that effect is for `driftRafRef`; we'll remove that in the next task.)

- [ ] **Step 3: Verify**

```bash
npm run typecheck
npm test
```
Expected: clean + 95/95 passing.

- [ ] **Step 4: Manual smoke test**

Run `npm run dev` in a separate terminal, open `http://localhost:3000/map`, and confirm: (a) auto-spin still runs on first load; (b) clicking a pin flies to it; (c) navigating to `/map#<pin-id>` flies to that pin. Kill the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add components/map/hooks/useFlyTo.ts components/map/MapGlobe.tsx
git commit -m "Extract fly-to tween into useFlyTo hook"
```

---

## Task 5: Extract `useDrift`

**Files:**
- Create: `components/map/hooks/useDrift.ts`
- Modify: `components/map/MapGlobe.tsx`

- [ ] **Step 1: Create the hook**

Create `components/map/hooks/useDrift.ts`:

```ts
import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

const DRIFT_DECAY = 0.95;
const DRIFT_STOP = 0.02;

export interface Drift {
  startDrift: (vLon: number, vLat: number) => void;
  cancelDrift: () => void;
}

/**
 * Release-inertia for pointer drags. `DRIFT_DECAY=0.95` lands on ~50% after
 * 14 frames (~230ms). Runs until velocity drops below `DRIFT_STOP` deg/frame.
 */
export function useDrift(
  setRotation: Dispatch<SetStateAction<[number, number]>>,
): Drift {
  const driftRafRef = useRef<number | null>(null);

  const cancelDrift = () => {
    if (driftRafRef.current !== null) {
      cancelAnimationFrame(driftRafRef.current);
      driftRafRef.current = null;
    }
  };

  const startDrift = (initialVLon: number, initialVLat: number) => {
    cancelDrift();
    let vLon = initialVLon;
    let vLat = initialVLat;
    const tick = () => {
      vLon *= DRIFT_DECAY;
      vLat *= DRIFT_DECAY;
      if (Math.abs(vLon) < DRIFT_STOP && Math.abs(vLat) < DRIFT_STOP) {
        driftRafRef.current = null;
        return;
      }
      setRotation(([lon, lat]) => [
        lon + vLon,
        Math.max(-90, Math.min(90, lat + vLat)),
      ]);
      driftRafRef.current = requestAnimationFrame(tick);
    };
    driftRafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => cancelDrift, []);

  return { startDrift, cancelDrift };
}
```

- [ ] **Step 2: Wire into MapGlobe**

In `components/map/MapGlobe.tsx`:

1. Add import:
```tsx
import { useDrift } from "./hooks/useDrift";
```

2. Remove the `DRIFT_DECAY` and `DRIFT_STOP` module constants at L34-35. (Keep `DRIFT_SAMPLE_WINDOW_MS` and `DRIFT_MIN_RELEASE_SPEED` — those are used inside pointer handlers, which haven't moved yet.)

3. Remove the `driftRafRef` declaration at L188.

4. Remove the `cancelDrift` function (L219-224) and the `startDrift` function (L226-244).

5. Add the hook call after `useFlyTo`:

```tsx
const { startDrift, cancelDrift } = useDrift(setRotation);
```

6. Delete the unmount-cleanup `useEffect` at L301-307 entirely — all three rAF refs (`rafRef`, `flyRafRef`, `driftRafRef`) are now owned by their respective hooks, each with its own unmount cleanup.

- [ ] **Step 3: Verify**

```bash
npm run typecheck
npm test
```
Expected: clean + 95/95 passing.

- [ ] **Step 4: Commit**

```bash
git add components/map/hooks/useDrift.ts components/map/MapGlobe.tsx
git commit -m "Extract drift inertia into useDrift hook"
```

---

## Task 6: Extract `useGlobeWheel`

**Files:**
- Create: `components/map/hooks/useGlobeWheel.ts`
- Modify: `components/map/MapGlobe.tsx`

**What this extracts:** The non-passive wheel listener added in commit `be40912` — keep the fix intact, just move it behind a hook boundary.

- [ ] **Step 1: Create the hook**

Create `components/map/hooks/useGlobeWheel.ts`:

```ts
import { useEffect } from "react";
import type { Dispatch, SetStateAction, RefObject } from "react";
import type { GlobeMode } from "./useAutoRotate";

/**
 * Non-passive wheel listener for zoom. React's JSX `onWheel` is attached as
 * a passive listener, so `preventDefault()` is silently ignored — we bind
 * imperatively with `{ passive: false }` so it actually suppresses outer
 * scroll. Handler reads the latest committed scale via `scaleRef` so it can
 * subscribe once and never rebind.
 */
export function useGlobeWheel(opts: {
  containerRef: RefObject<HTMLElement | null>;
  scaleRef: RefObject<number>;
  isPointerOnGlobe: (clientX: number, clientY: number) => boolean;
  cancelFly: () => void;
  cancelDrift: () => void;
  setMode: Dispatch<SetStateAction<GlobeMode>>;
  scheduleScale: (next: number) => void;
}): void {
  const {
    containerRef,
    scaleRef,
    isPointerOnGlobe,
    cancelFly,
    cancelDrift,
    setMode,
    scheduleScale,
  } = opts;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!isPointerOnGlobe(e.clientX, e.clientY)) return;
      e.preventDefault();
      cancelFly();
      cancelDrift();
      setMode("user");
      const factor = Math.exp(-e.deltaY * 0.001);
      scheduleScale(scaleRef.current! * factor);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // Handler reads refs + stable setters, so subscribe once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
```

- [ ] **Step 2: Wire into MapGlobe**

In `components/map/MapGlobe.tsx`:

1. Add import:
```tsx
import { useGlobeWheel } from "./hooks/useGlobeWheel";
```

2. Delete the entire wheel `useEffect` block (L309-328 in the current file), including the three-line comment above it.

3. Add the hook call (placement: after `useFlyTo`/`useDrift`, before the `return (...)`):

```tsx
useGlobeWheel({
  containerRef,
  scaleRef,
  isPointerOnGlobe,
  cancelFly,
  cancelDrift,
  setMode,
  scheduleScale,
});
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck
npm test
```
Expected: clean + 95/95 passing.

- [ ] **Step 4: Manual smoke test**

`npm run dev`, open `/map`, open DevTools console, scroll with the wheel/trackpad over the globe. Confirm: (a) globe zooms; (b) **no `Unable to preventDefault inside passive event listener invocation.` warnings in the console.**

- [ ] **Step 5: Commit**

```bash
git add components/map/hooks/useGlobeWheel.ts components/map/MapGlobe.tsx
git commit -m "Extract wheel-zoom listener into useGlobeWheel hook"
```

---

## Task 7: Extract `useGlobeHashRoute`

**Files:**
- Create: `components/map/hooks/useGlobeHashRoute.ts`
- Modify: `components/map/MapGlobe.tsx`

**What this extracts:** The effect at L140-168 that responds to `hashchange` by flying to the referenced pin (or hard-setting rotation/scale when reduced-motion is on).

- [ ] **Step 1: Create the hook**

Create `components/map/hooks/useGlobeHashRoute.ts`:

```ts
import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { MapPin } from "@/lib/content";
import { flyToTarget } from "@/lib/projection";
import type { GlobeMode } from "./useAutoRotate";

/**
 * Subscribes to `hashchange` and the initial hash. When the hash matches a
 * pin id, flies to that pin (or hard-sets rotation/scale on reduced-motion).
 */
export function useGlobeHashRoute(opts: {
  pins: MapPin[];
  prefersReducedMotion: boolean;
  setRotation: Dispatch<SetStateAction<[number, number]>>;
  setScale: Dispatch<SetStateAction<number>>;
  setMode: Dispatch<SetStateAction<GlobeMode>>;
  setOpenPinId: Dispatch<SetStateAction<string | null>>;
  cancelDrift: () => void;
  startFlyTo: (pin: MapPin, onComplete?: () => void) => void;
}): void {
  const {
    pins,
    prefersReducedMotion,
    setRotation,
    setScale,
    setMode,
    setOpenPinId,
    cancelDrift,
    startFlyTo,
  } = opts;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const route = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const pin = pins.find((p) => p.id === hash);
      if (!pin) return;
      if (prefersReducedMotion) {
        cancelDrift();
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
    // startFlyTo closes over live refs; we want a fresh closure on every
    // hash event, not just on pins/prefersReducedMotion change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, prefersReducedMotion]);
}
```

- [ ] **Step 2: Wire into MapGlobe**

In `components/map/MapGlobe.tsx`:

1. Add import:
```tsx
import { useGlobeHashRoute } from "./hooks/useGlobeHashRoute";
```

2. Delete the hash-routing `useEffect` (L140-168).

3. Remove the `flyToTarget` import from the top if no other site of use remains in the file (search `flyToTarget` — it's also used in the `projectedPins` memo at L101ff? No — `flyToTarget` is only used in the hash effect and the pin-click handler. The pin-click still uses it; keep the import).

4. Add the hook call:
```tsx
useGlobeHashRoute({
  pins,
  prefersReducedMotion,
  setRotation,
  setScale,
  setMode,
  setOpenPinId,
  cancelDrift,
  startFlyTo,
});
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck
npm test
```
Expected: clean + 95/95 passing.

- [ ] **Step 4: Commit**

```bash
git add components/map/hooks/useGlobeHashRoute.ts components/map/MapGlobe.tsx
git commit -m "Extract hash→pin routing into useGlobeHashRoute hook"
```

---

## Task 8: Extract `useGlobeKeyboard` — flatten 6-way if/else via dispatch table

**Files:**
- Create: `components/map/hooks/useGlobeKeyboard.ts`
- Modify: `components/map/MapGlobe.tsx`

**Nesting reduction:** replaces the 48-line `onKeyDown` (6 if/else branches, each repeating `preventDefault / cancelFly / cancelDrift / setMode("user") / <one-line mutation>`) with a single map lookup + shared prelude. After this task, `onKeyDown` in the JSX is one line: the returned handler.

- [ ] **Step 1: Create the hook**

Create `components/map/hooks/useGlobeKeyboard.ts`:

```ts
import { useCallback } from "react";
import type { Dispatch, SetStateAction, KeyboardEvent } from "react";
import { SCALE_MIN, SCALE_MAX } from "@/lib/projection";
import type { GlobeMode } from "./useAutoRotate";

const ARROW_STEP_DEG = 5;
const ZOOM_STEP_FACTOR = 1.2;

const clampLat = (lat: number) => Math.max(-90, Math.min(90, lat));
const clampScale = (s: number) => Math.max(SCALE_MIN, Math.min(SCALE_MAX, s));

/**
 * Returns a keyboard handler for the globe container. Arrow keys pan by
 * `ARROW_STEP_DEG` per press; `+`/`=` and `-` zoom by `ZOOM_STEP_FACTOR`.
 * Meta/ctrl combos are passed through so browser shortcuts still work.
 */
export function useGlobeKeyboard(opts: {
  cancelFly: () => void;
  cancelDrift: () => void;
  setMode: Dispatch<SetStateAction<GlobeMode>>;
  setRotation: Dispatch<SetStateAction<[number, number]>>;
  setScale: Dispatch<SetStateAction<number>>;
}): (e: KeyboardEvent<HTMLDivElement>) => void {
  const { cancelFly, cancelDrift, setMode, setRotation, setScale } = opts;

  return useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.metaKey || e.ctrlKey) return;

      const actions: Record<string, () => void> = {
        ArrowLeft: () =>
          setRotation(([lon, lat]) => [lon - ARROW_STEP_DEG, lat]),
        ArrowRight: () =>
          setRotation(([lon, lat]) => [lon + ARROW_STEP_DEG, lat]),
        ArrowUp: () =>
          setRotation(([lon, lat]) => [lon, clampLat(lat + ARROW_STEP_DEG)]),
        ArrowDown: () =>
          setRotation(([lon, lat]) => [lon, clampLat(lat - ARROW_STEP_DEG)]),
        "+": () => setScale((s) => clampScale(s * ZOOM_STEP_FACTOR)),
        "=": () => setScale((s) => clampScale(s * ZOOM_STEP_FACTOR)),
        "-": () => setScale((s) => clampScale(s / ZOOM_STEP_FACTOR)),
      };

      const action = actions[e.key];
      if (!action) return;

      e.preventDefault();
      cancelFly();
      cancelDrift();
      setMode("user");
      action();
    },
    [cancelFly, cancelDrift, setMode, setRotation, setScale],
  );
}
```

- [ ] **Step 2: Wire into MapGlobe**

In `components/map/MapGlobe.tsx`:

1. Add import:
```tsx
import { useGlobeKeyboard } from "./hooks/useGlobeKeyboard";
```

2. Above the `return (...)`, add:
```tsx
const onKeyDown = useGlobeKeyboard({
  cancelFly,
  cancelDrift,
  setMode,
  setRotation,
  setScale,
});
```

3. In the JSX, replace the inline `onKeyDown={(e) => { ... }}` (L335-382) with:
```tsx
onKeyDown={onKeyDown}
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck
npm test
```
Expected: clean + 95/95 passing.

- [ ] **Step 4: Manual smoke test**

`npm run dev`, open `/map`, focus the globe container (Tab key), and confirm arrow keys pan, `+`/`-` zoom, and Cmd/Ctrl+key is still passed through to the browser.

- [ ] **Step 5: Commit**

```bash
git add components/map/hooks/useGlobeKeyboard.ts components/map/MapGlobe.tsx
git commit -m "Extract keyboard nav into useGlobeKeyboard with dispatch table"
```

---

## Task 9: Extract `usePointerInteraction` — flatten 4-level nesting in `onPointerUp`

**Files:**
- Create: `components/map/hooks/usePointerInteraction.ts`
- Modify: `components/map/MapGlobe.tsx`

**This is the biggest task. It extracts all four pointer handlers plus the click handler and owns `dragRef`, `pinchRef`, and `pointerDownOnGlobeRef`.**

**Nesting reduction:** `onPointerUp` goes from 4 levels deep (if → if → if → if) to 2 levels via early returns. The release-velocity calculation moves into a small helper (`computeReleaseVelocity`) at the top of the hook file.

- [ ] **Step 1: Create the hook**

Create `components/map/hooks/usePointerInteraction.ts`:

```ts
import { useRef } from "react";
import type {
  Dispatch,
  MouseEventHandler,
  PointerEventHandler,
  SetStateAction,
} from "react";
import { GLOBE_BASE_RADIUS } from "@/lib/projection";
import type { GlobeMode } from "./useAutoRotate";

const DRIFT_SAMPLE_WINDOW_MS = 80;
const DRIFT_MIN_RELEASE_SPEED = 0.15;
const DRIFT_MAX_RELEASE_AGE_MS = 150;

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startRotation: [number, number];
  samples: Array<{ x: number; y: number; t: number }>;
}

interface PinchState {
  pointers: Map<number, { x: number; y: number }>;
  startDistance: number | null;
  startScale: number;
}

/**
 * Pure helper: compute release velocity from a rolling pointer-sample window.
 * Returns null when the release is too slow to warrant drift or the window
 * is too old to be trustworthy.
 */
function computeReleaseVelocity(
  drag: DragState,
  scale: number,
): { vLon: number; vLat: number } | null {
  if (drag.samples.length < 2) return null;
  const first = drag.samples[0];
  const last = drag.samples[drag.samples.length - 1];
  const dt = last.t - first.t;
  if (dt <= 0 || dt >= DRIFT_MAX_RELEASE_AGE_MS) return null;

  const pxPerMsToDegPerFrame = 16.67 * (180 / (scale * GLOBE_BASE_RADIUS));
  const vLon = ((last.x - first.x) / dt) * pxPerMsToDegPerFrame;
  const vLat = (-(last.y - first.y) / dt) * pxPerMsToDegPerFrame;
  if (Math.hypot(vLon, vLat) <= DRIFT_MIN_RELEASE_SPEED) return null;
  return { vLon, vLat };
}

export interface PointerHandlers {
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onPointerCancel: PointerEventHandler<HTMLDivElement>;
  onClick: MouseEventHandler<HTMLDivElement>;
}

export function usePointerInteraction(opts: {
  scale: number;
  rotation: [number, number];
  prefersReducedMotion: boolean;
  isPointerOnGlobe: (clientX: number, clientY: number) => boolean;
  setMode: Dispatch<SetStateAction<GlobeMode>>;
  setOpenPinId: Dispatch<SetStateAction<string | null>>;
  cancelFly: () => void;
  cancelDrift: () => void;
  startDrift: (vLon: number, vLat: number) => void;
  scheduleRotation: (next: [number, number]) => void;
  scheduleScale: (next: number) => void;
}): PointerHandlers {
  const {
    scale,
    rotation,
    prefersReducedMotion,
    isPointerOnGlobe,
    setMode,
    setOpenPinId,
    cancelFly,
    cancelDrift,
    startDrift,
    scheduleRotation,
    scheduleScale,
  } = opts;

  const dragRef = useRef<DragState | null>(null);
  const pinchRef = useRef<PinchState>({
    pointers: new Map(),
    startDistance: null,
    startScale: 1,
  });
  const pointerDownOnGlobeRef = useRef<boolean>(false);

  const clearPinchIfSinglePointer = () => {
    if (pinchRef.current.pointers.size < 2) {
      pinchRef.current.startDistance = null;
    }
  };

  const onPointerDown: PointerEventHandler<HTMLDivElement> = (e) => {
    if ((e.target as HTMLElement).closest("[data-pin]")) return;
    const onGlobe = isPointerOnGlobe(e.clientX, e.clientY);
    pointerDownOnGlobeRef.current = onGlobe;
    if (!onGlobe) return;

    cancelFly();
    cancelDrift();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startRotation: rotation,
      samples: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }],
    };
    setMode("user");
    pinchRef.current.pointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
    });
    if (pinchRef.current.pointers.size === 2) {
      const [a, b] = Array.from(pinchRef.current.pointers.values());
      pinchRef.current.startDistance = Math.hypot(a.x - b.x, a.y - b.y);
      pinchRef.current.startScale = scale;
      dragRef.current = null; // pinch takes over
    }
  };

  const onPointerMove: PointerEventHandler<HTMLDivElement> = (e) => {
    const drag = dragRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const degPerPx = 180 / (scale * GLOBE_BASE_RADIUS);
      const nextLon = drag.startRotation[0] + dx * degPerPx;
      const nextLat = Math.max(
        -90,
        Math.min(90, drag.startRotation[1] + -dy * degPerPx),
      );
      scheduleRotation([nextLon, nextLat]);
      drag.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      while (
        drag.samples.length > 2 &&
        e.timeStamp - drag.samples[0].t > DRIFT_SAMPLE_WINDOW_MS
      ) {
        drag.samples.shift();
      }
    }
    if (pinchRef.current.pointers.has(e.pointerId)) {
      pinchRef.current.pointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
      });
    }
    if (
      pinchRef.current.pointers.size === 2 &&
      pinchRef.current.startDistance !== null
    ) {
      const [a, b] = Array.from(pinchRef.current.pointers.values());
      const ratio = Math.hypot(a.x - b.x, a.y - b.y) /
        pinchRef.current.startDistance;
      scheduleScale(pinchRef.current.startScale * ratio);
    }
  };

  const onPointerUp: PointerEventHandler<HTMLDivElement> = (e) => {
    const drag = dragRef.current;
    const shouldCheckDrift =
      drag !== null &&
      drag.pointerId === e.pointerId &&
      pinchRef.current.pointers.size < 2 &&
      !prefersReducedMotion;

    if (shouldCheckDrift) {
      const v = computeReleaseVelocity(drag, scale);
      if (v) startDrift(v.vLon, v.vLat);
    }
    if (drag && drag.pointerId === e.pointerId) {
      dragRef.current = null;
    }

    pinchRef.current.pointers.delete(e.pointerId);
    clearPinchIfSinglePointer();
  };

  const onPointerCancel: PointerEventHandler<HTMLDivElement> = (e) => {
    dragRef.current = null;
    cancelDrift();
    pinchRef.current.pointers.delete(e.pointerId);
    clearPinchIfSinglePointer();
  };

  const onClick: MouseEventHandler<HTMLDivElement> = (e) => {
    if ((e.target as HTMLElement).closest("[data-pin]")) return;
    setOpenPinId(null);
    // If pointerdown started on the globe, this click terminates a drag
    // (possibly released off-sphere); don't treat it as "click outside".
    const startedOnGlobe = pointerDownOnGlobeRef.current;
    pointerDownOnGlobeRef.current = false;
    if (startedOnGlobe) return;
    if (isPointerOnGlobe(e.clientX, e.clientY)) return;
    cancelFly();
    cancelDrift();
    setMode("auto");
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onClick,
  };
}
```

**Note the flattening in `onPointerUp`:** the original was `if (drag) { if (samples>=2 && pinch<2) { if (dt>0 && dt<150) { if (!prefersReducedMotion && speed>threshold) { startDrift(); } } } }` (4 levels). It's now one boolean guard + `computeReleaseVelocity` helper that does the math-and-threshold check in one place (2 levels).

- [ ] **Step 2: Wire into MapGlobe**

In `components/map/MapGlobe.tsx`:

1. Add import:
```tsx
import { usePointerInteraction } from "./hooks/usePointerInteraction";
```

2. Remove the `DRIFT_SAMPLE_WINDOW_MS` and `DRIFT_MIN_RELEASE_SPEED` module constants at L36-37 (they've moved inside the hook).

3. Remove the three refs that moved: `dragRef` (L172-178), `pinchRef` (L182-186), `pointerDownOnGlobeRef` (L200).

4. Add the hook call above the `return (...)`:

```tsx
const {
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onClick,
} = usePointerInteraction({
  scale,
  rotation,
  prefersReducedMotion,
  isPointerOnGlobe,
  setMode,
  setOpenPinId,
  cancelFly,
  cancelDrift,
  startDrift,
  scheduleRotation,
  scheduleScale,
});
```

5. In the JSX, replace each inline `on*={(e) => { ... }}` with the named handler. The outer `<div>` attribute list becomes:

```tsx
<div
  ref={containerRef}
  tabIndex={0}
  className="relative h-[calc(100vh-56px)] md:h-screen w-full overflow-hidden touch-none outline-none focus-visible:ring-1 focus-visible:ring-[var(--fg-muted)] focus-visible:ring-inset"
  onKeyDown={onKeyDown}
  onPointerDown={onPointerDown}
  onPointerMove={onPointerMove}
  onPointerUp={onPointerUp}
  onPointerCancel={onPointerCancel}
  onClick={onClick}
>
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck
npm test
```
Expected: clean + 95/95 passing.

- [ ] **Step 4: Manual smoke test**

`npm run dev`, open `/map`. Verify: (a) drag to rotate; (b) fling the globe and it drifts with inertia; (c) two-finger pinch on trackpad/touchscreen zooms; (d) clicking off-globe returns the globe to auto-spin; (e) clicking a pin still opens the popover.

- [ ] **Step 5: Commit**

```bash
git add components/map/hooks/usePointerInteraction.ts components/map/MapGlobe.tsx
git commit -m "Extract pointer handlers into usePointerInteraction and flatten onPointerUp"
```

---

## Task 10: Extract `GlobePin` component

**Files:**
- Create: `components/map/GlobePin.tsx`
- Modify: `components/map/MapGlobe.tsx`

**What this extracts:** Lines 536-596 of the current file — the 60-line per-pin render including focus ring, the interactive circle, and the inline `onKeyDown` + `onClick` handlers.

- [ ] **Step 1: Create the component**

Create `components/map/GlobePin.tsx`:

```tsx
"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import type { MapPin } from "@/lib/content";

interface Props {
  pin: MapPin;
  x: number;
  y: number;
  onActivate: (pin: MapPin, e: MouseEvent | KeyboardEvent) => void;
}

/**
 * One pin on the globe: a focus ring (visible only on keyboard focus) and
 * the interactive accent-colored circle. Activation (click or Enter/Space)
 * delegates to `onActivate`, which MapGlobe routes into its flyTo/popover
 * logic.
 */
export function GlobePin({ pin, x, y, onActivate }: Props) {
  const handleKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    onActivate(pin, e);
  };

  const handleClick = (e: MouseEvent<SVGCircleElement>) => {
    e.stopPropagation();
    onActivate(pin, e);
  };

  return (
    <g
      tabIndex={0}
      role="button"
      aria-label={pin.name}
      className="group outline-none"
      style={{ cursor: "pointer" }}
      onKeyDown={handleKeyDown}
    >
      <circle
        cx={x}
        cy={y}
        r={8}
        fill="none"
        stroke="var(--fg-muted)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        className="opacity-0 group-focus-visible:opacity-100 transition-opacity duration-[var(--duration-fast)]"
        aria-hidden="true"
      />
      <circle
        data-pin={pin.id}
        cx={x}
        cy={y}
        r={4.8}
        fill="var(--accent)"
        stroke="var(--bg)"
        strokeWidth={1.6}
        onClick={handleClick}
      />
    </g>
  );
}
```

- [ ] **Step 2: Wire into MapGlobe**

In `components/map/MapGlobe.tsx`:

1. Add import:
```tsx
import { GlobePin } from "./GlobePin";
```

2. Above the `return (...)`, add the activation handler (this is the logic that was inline on the pin `onClick` at L575-593):

```tsx
const onPinActivate = (pin: MapPin) => {
  if (openPinId === pin.id) {
    setOpenPinId(null);
    return;
  }
  if (prefersReducedMotion) {
    cancelDrift();
    const target = flyToTarget(pin);
    setRotation(target.rotation);
    setScale(target.scale);
    setMode("user");
    setOpenPinId(pin.id);
    return;
  }
  setOpenPinId(null); // close existing popover before flying
  startFlyTo(pin, () => setOpenPinId(pin.id));
};
```

3. Replace the entire `{projectedPins.map(...)}` block (L536-596) inside the pins `<g>` with:

```tsx
<g>
  {projectedPins.map(({ pin, x, y }) => (
    <GlobePin
      key={pin.id}
      pin={pin}
      x={x}
      y={y}
      onActivate={onPinActivate}
    />
  ))}
</g>
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck
npm test
```
Expected: clean + 95/95 passing.

- [ ] **Step 4: Manual smoke test**

`npm run dev`, open `/map`. Verify: (a) pins render; (b) click a pin → flies + popover opens; (c) click same pin again → popover closes (no fly); (d) tab to a pin, press Enter → same as click; (e) the focus ring appears only on keyboard focus, not hover.

- [ ] **Step 5: Commit**

```bash
git add components/map/GlobePin.tsx components/map/MapGlobe.tsx
git commit -m "Extract pin rendering into GlobePin component"
```

---

## Task 11: Final cleanup pass

**Files:**
- Modify: `components/map/MapGlobe.tsx`

- [ ] **Step 1: Verify line count target**

Run: `wc -l components/map/MapGlobe.tsx`
Expected: ≤ 260 lines (down from 620).

If the file is still >260 lines, identify the next-largest remaining block and either extract it or flatten nesting. Common culprits remaining after Tasks 1-10:
- Large `useMemo` that computes `countryPaths` / `statePaths` / `projectedPins` (currently L84-119). Consider extracting into a `useGlobeProjection(rotation, scale, pins, ...)` hook *only if* it measurably helps; otherwise leave as-is.

- [ ] **Step 2: Audit remaining nesting**

Visually scan `components/map/MapGlobe.tsx`. Confirm: no JSX event handler is inline (all are named handlers from hooks); no `if` statement is nested more than 2 levels; the return-tree is readable top-to-bottom.

Where you do find nesting >2 levels, flatten with early returns inline.

- [ ] **Step 3: Remove stale comments**

Scan for references to things that moved. Likely stale:
- The `scaleRef` comment block still describes why it's needed — keep, the wheel hook still uses it.
- The comment about "Drag inertia. DRIFT_DECAY is the per-frame..." at the top of the file — now redundant because `DRIFT_DECAY` lives in `useDrift.ts`. Delete.
- The L190-199 block — `rotationRef` and `scaleRef` live in MapGlobe as the backing store for `useFlyTo` and `useGlobeWheel`. Keep but tighten the comment to "latest-value refs consumed by useFlyTo / useGlobeWheel."

- [ ] **Step 4: Verify**

```bash
npm run typecheck
npm test
wc -l components/map/MapGlobe.tsx
```
Expected: clean, 95/95, ≤260 lines.

- [ ] **Step 5: Commit**

```bash
git add components/map/MapGlobe.tsx
git commit -m "Clean up stale comments and verify MapGlobe simplification targets"
```

---

## Task 12: Final verification

- [ ] **Step 1: Run the full verification gauntlet**

```bash
npm run typecheck
npm run lint
npm test
```
Expected: all green.

- [ ] **Step 2: Manual regression test**

`npm run dev`, open `/map` with DevTools console open. Run through the full feature set:

- [ ] Page loads, globe visible
- [ ] Auto-rotate runs (unless reduced-motion is set in OS)
- [ ] Drag rotates; release with velocity drifts
- [ ] Wheel/trackpad zooms; **no passive-listener warnings in console**
- [ ] Arrow keys pan (after focusing with Tab)
- [ ] `+`/`=` and `-` zoom
- [ ] Pinch-zoom on trackpad or touchscreen
- [ ] Pin click: flies to pin, popover opens
- [ ] Pin click again: popover closes, no fly
- [ ] Click off-globe: returns to auto-rotate
- [ ] `/map#<pin-id>` deep-links fly + open popover
- [ ] `prefers-reduced-motion` on: all motion is instantaneous, no jarring jumps

- [ ] **Step 3: Check line counts**

```bash
wc -l components/map/MapGlobe.tsx components/map/GlobePin.tsx components/map/hooks/*.ts
```

Expected: MapGlobe ≤ 260; each hook file 20-170 LOC; GlobePin ~65 LOC. Total (MapGlobe + hooks + GlobePin) may actually exceed the original 620 LOC slightly — that's fine; the goal was **reducing per-file length and nesting**, not aggregate LOC.

- [ ] **Step 4: Close the branch**

Use `superpowers:finishing-a-development-branch` to decide merge/PR/cleanup strategy.

---

## Self-Review Checklist (performed at plan-writing time)

- **Spec coverage:** The "spec" here is "reduce nesting and file length in MapGlobe.tsx." Tasks 8, 9, 11 reduce nesting. Tasks 1-10 reduce file length. All covered.
- **Placeholder scan:** No TBDs, TODOs, "add error handling," or vague instructions. Every step has either exact code or exact commands with expected output.
- **Type consistency:** `GlobeMode` type is defined in `useAutoRotate.ts` (Task 3) and re-imported by every hook that needs it (Tasks 4, 6, 7, 8, 9). `MapPin` is imported from `@/lib/content` everywhere. `RafBatch`, `Drift`, `FlyTo`, `PointerHandlers` are exported by their respective hooks and could be re-exported if the caller ever needs to type them — not needed in this plan.
- **Ordering:** Each task depends only on types/values defined earlier. E.g., Task 6 uses `scheduleScale` from Task 2's hook; Task 7 uses `cancelDrift`+`startFlyTo` from Tasks 5 and 4; Task 9 uses `cancelFly`+`cancelDrift`+`startDrift` from 4+5.
- **Behavior preservation:** Tasks 4, 6, 7 include manual smoke tests because their behavior (fly-to, wheel-zoom, hash routing) isn't unit-tested. Tasks 8, 9, 10 also include manual smoke tests for the same reason. The Chrome `preventDefault` fix is explicitly verified in Task 6.
- **Commit cadence:** Every task ends with a commit. Eleven commits total (Tasks 1-11 each commit; Task 12 verifies without committing).
