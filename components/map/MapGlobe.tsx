"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ExtendedFeatureCollection } from "d3-geo";
import type { MapPin } from "@/lib/content";
import {
  createGlobeProjection,
  pathsFromGeojson,
  isPinVisible,
  shouldShowStateBorders,
  flyToTarget,
  GLOBE_WIDTH,
  GLOBE_HEIGHT,
  GLOBE_BASE_RADIUS,
  SCALE_MIN,
  SCALE_MAX,
} from "@/lib/projection";
import { cubicBezierEase, lerpRotation, lerpScale } from "@/lib/tween";
import { PinPopover } from "./PinPopover";

const GLOBE_DURATION_MS = 750;
const GLOBE_EASE = cubicBezierEase(0.2, 0, 0, 1);

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
  const prefersReducedMotion = usePrefersReducedMotion();
  const [rotation, setRotation] = useState<[number, number]>(initialRotation);
  const [scale, setScale] = useState<number>(initialScale);
  const [mode, setMode] = useState<"auto" | "user" | "flying">(
    prefersReducedMotion ? "user" : "auto",
  );
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

  const openPin = projectedPins.find((p) => p.pin.id === openPinId) ?? null;

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startRotation: [number, number];
  } | null>(null);
  const pendingRotationRef = useRef<[number, number] | null>(null);
  const pendingScaleRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pinchRef = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    startDistance: number | null;
    startScale: number;
  }>({ pointers: new Map(), startDistance: null, startScale: 1 });
  const flyRafRef = useRef<number | null>(null);

  function cancelFly() {
    if (flyRafRef.current !== null) {
      cancelAnimationFrame(flyRafRef.current);
      flyRafRef.current = null;
    }
  }

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

  function scheduleRotation(next: [number, number]) {
    pendingRotationRef.current = next;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushPendingRotation);
    }
  }

  function scheduleScale(next: number) {
    const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, next));
    pendingScaleRef.current = clamped;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flushPendingRotation);
    }
  }

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (flyRafRef.current !== null) cancelAnimationFrame(flyRafRef.current);
    };
  }, []);

  return (
    <div
      tabIndex={0}
      className="relative h-[calc(100vh-56px)] md:h-screen w-full overflow-hidden touch-none outline-none focus-visible:ring-1 focus-visible:ring-[var(--fg-muted)] focus-visible:ring-inset"
      style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
      onKeyDown={(e) => {
        if (e.metaKey || e.ctrlKey) return;
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
      onPointerDown={(e) => {
        // Ignore clicks on pins — those open popovers.
        if ((e.target as HTMLElement).closest("[data-pin]")) return;
        cancelFly();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        dragRef.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          startRotation: rotation,
        };
        setMode("user");
        pinchRef.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinchRef.current.pointers.size === 2) {
          const [a, b] = Array.from(pinchRef.current.pointers.values());
          pinchRef.current.startDistance = Math.hypot(a.x - b.x, a.y - b.y);
          pinchRef.current.startScale = scale;
          // Cancel any in-flight drag — pinch takes over.
          dragRef.current = null;
        }
      }}
      onPointerMove={(e) => {
        const drag = dragRef.current;
        if (drag && drag.pointerId === e.pointerId) {
          const dx = e.clientX - drag.startX;
          const dy = e.clientY - drag.startY;
          const dLon = dx * (180 / (scale * GLOBE_BASE_RADIUS));
          const dLat = -dy * (180 / (scale * GLOBE_BASE_RADIUS));
          const nextLon = drag.startRotation[0] + dLon;
          const nextLat = Math.max(-90, Math.min(90, drag.startRotation[1] + dLat));
          scheduleRotation([nextLon, nextLat]);
        }
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
      }}
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
      // React 17+ attaches onWheel as a passive listener, so preventDefault() is
      // silently ignored. Benign here because /map is a full-viewport page with
      // no scrollable ancestor. If a future layout introduces one, switch to a
      // non-passive listener via ref.addEventListener("wheel", ..., { passive: false }).
      onWheel={(e) => {
        e.preventDefault();
        cancelFly();
        setMode("user");
        const factor = Math.exp(-e.deltaY * 0.001);
        scheduleScale(scale * factor);
      }}
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
              key={`c-${i}-${d.length}`}
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
              key={`s-${i}-${d.length}`}
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
            <g
              key={pin.id}
              tabIndex={0}
              role="button"
              aria-label={pin.name}
              className="group outline-none"
              style={{ cursor: "pointer" }}
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
                cx={x}
                cy={y}
                r={10}
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
                  // Close any existing popover before flying.
                  setOpenPinId(null);
                  startFlyTo(pin, () => setOpenPinId(pin.id));
                }}
              />
            </g>
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

function usePrefersReducedMotion(): boolean {
  // Read on mount. Not reactive to changes — matches the site's
  // other motion-gated features (MapSwitcher used the same pattern).
  const [reduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  return reduced;
}
