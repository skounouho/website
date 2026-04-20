"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ExtendedFeatureCollection } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
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
import { PinPopover } from "./PinPopover";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import { useRafBatch } from "./hooks/useRafBatch";
import { useAutoRotate, type GlobeMode } from "./hooks/useAutoRotate";
import { useFlyTo } from "./hooks/useFlyTo";
import { useDrift } from "./hooks/useDrift";
import { useGlobeWheel } from "./hooks/useGlobeWheel";

export type WorldTopology = Topology<{ countries: GeometryCollection }>;
export type StatesTopology = Topology<{ states: GeometryCollection }>;

// Drag inertia sampling. DRIFT_SAMPLE_WINDOW_MS is the span (ms) we look
// back over to compute release velocity, which damps single-event jitter
// at pointer-up. DRIFT_MIN_RELEASE_SPEED is the minimum speed threshold
// (deg/frame) below which we skip launching drift at all.
const DRIFT_SAMPLE_WINDOW_MS = 80;
const DRIFT_MIN_RELEASE_SPEED = 0.15;

export interface MapGlobeProps {
  pins: MapPin[];
  worldTopo: WorldTopology;
  statesTopo: StatesTopology;
  initialRotation: [number, number];
  initialScale: number;
  initialCountryPaths: string[];
}

export function MapGlobe({
  pins,
  worldTopo,
  statesTopo,
  initialRotation,
  initialScale,
  initialCountryPaths,
}: MapGlobeProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [rotation, setRotation] = useState<[number, number]>(initialRotation);
  const [scale, setScale] = useState<number>(initialScale);
  const [mode, setMode] = useState<GlobeMode>(
    prefersReducedMotion ? "user" : "auto",
  );
  const [openPinId, setOpenPinId] = useState<string | null>(null);

  const { scheduleRotation, scheduleScale } = useRafBatch(setRotation, setScale);

  useAutoRotate(mode, setRotation);

  // Latest-value refs consumed by useFlyTo / useGlobeWheel. Both read the
  // current rotation/scale without needing to rebind on every render.
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const { startDrift, cancelDrift } = useDrift(setRotation);

  const { startFlyTo, cancelFly } = useFlyTo({
    rotationRef,
    scaleRef,
    setRotation,
    setScale,
    setMode,
    cancelDrift,
  });

  // Materialize features from topology once on the client. Shipping the raw
  // TopoJSON (arc-encoded, shared boundaries) rather than the expanded
  // FeatureCollection roughly halves the /map RSC payload.
  const worldFeatures = useMemo(
    () =>
      feature(
        worldTopo,
        worldTopo.objects.countries,
      ) as unknown as ExtendedFeatureCollection,
    [worldTopo],
  );
  const stateFeatures = useMemo(
    () =>
      feature(
        statesTopo,
        statesTopo.objects.states,
      ) as unknown as ExtendedFeatureCollection,
    [statesTopo],
  );

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
    samples: Array<{ x: number; y: number; t: number }>;
  } | null>(null);
  const pinchRef = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    startDistance: number | null;
    startScale: number;
  }>({ pointers: new Map(), startDistance: null, startScale: 1 });
  const globeCircleRef = useRef<SVGCircleElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Tracks whether the most recent pointerdown landed on the globe, so that
  // the synthesized click at pointerup doesn't trigger "resume auto" when
  // the user was dragging the globe (especially drag-release off-sphere).
  const pointerDownOnGlobeRef = useRef<boolean>(false);

  function isPointerOnGlobe(clientX: number, clientY: number): boolean {
    const el = globeCircleRef.current;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const r = rect.width / 2;
    return Math.hypot(clientX - cx, clientY - cy) <= r;
  }

  useGlobeWheel({
    containerRef,
    scaleRef,
    isPointerOnGlobe,
    cancelFly,
    cancelDrift,
    setMode,
    scheduleScale,
  });

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative h-[calc(100vh-56px)] md:h-screen w-full overflow-hidden touch-none outline-none focus-visible:ring-1 focus-visible:ring-[var(--fg-muted)] focus-visible:ring-inset"
      onKeyDown={(e) => {
        if (e.metaKey || e.ctrlKey) return;
        const STEP = 5;           // degrees per arrow key
        const ZOOM_FACTOR = 1.2;  // multiplicative per +/-
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          cancelFly();
          cancelDrift();
          setMode("user");
          setRotation(([lon, lat]) => [lon - STEP, lat]);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          cancelFly();
          cancelDrift();
          setMode("user");
          setRotation(([lon, lat]) => [lon + STEP, lat]);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          cancelFly();
          cancelDrift();
          setMode("user");
          setRotation(([lon, lat]) => [
            lon,
            Math.max(-90, Math.min(90, lat + STEP)),
          ]);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          cancelFly();
          cancelDrift();
          setMode("user");
          setRotation(([lon, lat]) => [
            lon,
            Math.max(-90, Math.min(90, lat - STEP)),
          ]);
        } else if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          cancelFly();
          cancelDrift();
          setMode("user");
          setScale((s) => Math.max(SCALE_MIN, Math.min(SCALE_MAX, s * ZOOM_FACTOR)));
        } else if (e.key === "-") {
          e.preventDefault();
          cancelFly();
          cancelDrift();
          setMode("user");
          setScale((s) => Math.max(SCALE_MIN, Math.min(SCALE_MAX, s / ZOOM_FACTOR)));
        }
      }}
      onPointerDown={(e) => {
        // Ignore clicks on pins — those open popovers.
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
          // Track pointer samples in a rolling window for release-velocity calc.
          drag.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
          while (
            drag.samples.length > 2 &&
            e.timeStamp - drag.samples[0].t > DRIFT_SAMPLE_WINDOW_MS
          ) {
            drag.samples.shift();
          }
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
        if (drag && drag.pointerId === e.pointerId) {
          // Release velocity = (newest - oldest) / Δt across the rolling window,
          // converted to degrees per ~16ms frame. Pinch suppresses drift (two
          // fingers rarely mean "throw me").
          if (drag.samples.length >= 2 && pinchRef.current.pointers.size < 2) {
            const first = drag.samples[0];
            const last = drag.samples[drag.samples.length - 1];
            const dt = last.t - first.t;
            if (dt > 0 && dt < 150) {
              const pxPerMsToDegPerFrame =
                16.67 * (180 / (scale * GLOBE_BASE_RADIUS));
              const vLon = ((last.x - first.x) / dt) * pxPerMsToDegPerFrame;
              const vLat = (-(last.y - first.y) / dt) * pxPerMsToDegPerFrame;
              if (
                !prefersReducedMotion &&
                Math.hypot(vLon, vLat) > DRIFT_MIN_RELEASE_SPEED
              ) {
                startDrift(vLon, vLat);
              }
            }
          }
          dragRef.current = null;
        }
        pinchRef.current.pointers.delete(e.pointerId);
        if (pinchRef.current.pointers.size < 2) {
          pinchRef.current.startDistance = null;
        }
      }}
      onPointerCancel={(e) => {
        dragRef.current = null;
        cancelDrift();
        pinchRef.current.pointers.delete(e.pointerId);
        if (pinchRef.current.pointers.size < 2) {
          pinchRef.current.startDistance = null;
        }
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-pin]")) return;
        setOpenPinId(null);
        // If pointerdown started on the globe, this click terminates a drag
        // (possibly released off-sphere); don't treat it as "click outside".
        const startedOnGlobe = pointerDownOnGlobeRef.current;
        pointerDownOnGlobeRef.current = false;
        if (startedOnGlobe) return;
        if (!isPointerOnGlobe(e.clientX, e.clientY)) {
          cancelFly();
          cancelDrift();
          setMode("auto");
        }
      }}
    >
      <svg
        viewBox={`0 0 ${GLOBE_WIDTH} ${GLOBE_HEIGHT}`}
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Interactive globe showing places I've lived, worked, and visited."
      >
        <circle
          ref={globeCircleRef}
          cx={GLOBE_WIDTH / 2}
          cy={GLOBE_HEIGHT / 2}
          r={GLOBE_BASE_RADIUS * scale}
          fill="var(--border)"
          stroke="var(--fg-muted)"
          strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
          className="cursor-grab active:cursor-grabbing"
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
                onClick={(e) => {
                  e.stopPropagation();
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
