"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ExtendedFeatureCollection } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { MapPin } from "@/lib/content";
import { clusterPins, type PinCluster } from "@/lib/cluster";
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

export type WorldTopology = Topology<{ countries: GeometryCollection }>;
export type StatesTopology = Topology<{ states: GeometryCollection }>;

const GLOBE_DURATION_MS = 750;
const GLOBE_EASE = cubicBezierEase(0.2, 0, 0, 1);

// Drag inertia. DRIFT_DECAY is the per-frame velocity multiplier —
// 0.95 lands on ~50% after 14 frames (~230ms) and decays to the stop
// threshold in roughly half a second. DRIFT_STOP is deg/frame.
// DRIFT_SAMPLE_WINDOW is the span (ms) we look back over to compute
// release velocity, which damps single-event jitter at pointer-up.
const DRIFT_DECAY = 0.95;
const DRIFT_STOP = 0.02;
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
  const [mode, setMode] = useState<"auto" | "user" | "flying">(
    prefersReducedMotion ? "user" : "auto",
  );
  const [openClusterId, setOpenClusterId] = useState<string | null>(null);

  const clusters = useMemo(() => clusterPins(pins), [pins]);

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

  const { countryPaths, statePaths, projectedClusters } = useMemo(() => {
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
    const projectedClusters = clusters
      .map((cluster) => {
        const xy = projection([cluster.lon, cluster.lat]);
        if (!xy) return null;
        if (!isPinVisible(cluster, rotation)) return null;
        return { cluster, x: xy[0], y: xy[1] };
      })
      .filter(
        (p): p is { cluster: PinCluster; x: number; y: number } => p !== null,
      );
    return { countryPaths, statePaths, projectedClusters };
  }, [
    rotation,
    scale,
    worldFeatures,
    stateFeatures,
    clusters,
    initialCountryPaths,
    initialRotation,
    initialScale,
  ]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenClusterId(null);
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
      const cluster = clusters.find((c) =>
        c.pins.some((p) => p.id === hash),
      );
      if (!cluster) return;
      if (prefersReducedMotion) {
        cancelDrift();
        const target = flyToTarget(cluster);
        setRotation(target.rotation);
        setScale(target.scale);
        setMode("user");
        setOpenClusterId(cluster.id);
      } else {
        setOpenClusterId(null);
        startFlyTo(cluster, () => setOpenClusterId(cluster.id));
      }
    };

    route();
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
    // `startFlyTo` reads current rotation/scale via the closure each call,
    // which is what we want — it should tween from wherever the globe is
    // when the hash fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters, prefersReducedMotion]);

  const openCluster =
    projectedClusters.find((p) => p.cluster.id === openClusterId) ?? null;

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startRotation: [number, number];
    samples: Array<{ x: number; y: number; t: number }>;
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
  const driftRafRef = useRef<number | null>(null);
  const globeCircleRef = useRef<SVGCircleElement | null>(null);
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

  function cancelFly() {
    if (flyRafRef.current !== null) {
      cancelAnimationFrame(flyRafRef.current);
      flyRafRef.current = null;
    }
  }

  function cancelDrift() {
    if (driftRafRef.current !== null) {
      cancelAnimationFrame(driftRafRef.current);
      driftRafRef.current = null;
    }
  }

  function startDrift(initialVLon: number, initialVLat: number) {
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
  }

  function startFlyTo(
    target_: { lat: number; lon: number },
    onComplete?: () => void,
  ) {
    cancelFly();
    cancelDrift();
    const target = flyToTarget(target_);
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
      if (driftRafRef.current !== null) cancelAnimationFrame(driftRafRef.current);
    };
  }, []);

  return (
    <div
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
      // React 17+ attaches onWheel as a passive listener, so preventDefault() is
      // silently ignored. Benign here because /map is a full-viewport page with
      // no scrollable ancestor. If a future layout introduces one, switch to a
      // non-passive listener via ref.addEventListener("wheel", ..., { passive: false }).
      onWheel={(e) => {
        if (!isPointerOnGlobe(e.clientX, e.clientY)) return;
        e.preventDefault();
        cancelFly();
        cancelDrift();
        setMode("user");
        const factor = Math.exp(-e.deltaY * 0.001);
        scheduleScale(scale * factor);
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-pin]")) return;
        setOpenClusterId(null);
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
          {projectedClusters.map(({ cluster, x, y }) => {
            const isPark = cluster.pins.every((p) => p.kind === "park");
            const handlePinClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              if (openClusterId === cluster.id) {
                setOpenClusterId(null);
                return;
              }
              if (prefersReducedMotion) {
                cancelDrift();
                const target = flyToTarget(cluster);
                setRotation(target.rotation);
                setScale(target.scale);
                setMode("user");
                setOpenClusterId(cluster.id);
                return;
              }
              setOpenClusterId(null);
              startFlyTo(cluster, () => setOpenClusterId(cluster.id));
            };
            return (
              <g
                key={cluster.id}
                tabIndex={0}
                role="button"
                aria-label={cluster.name}
                className="group outline-none"
                style={{ cursor: "pointer" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    (document.querySelector(
                      `[data-pin="${cluster.id}"]`,
                    ) as SVGElement | null)?.dispatchEvent(
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
                {isPark ? (
                  <polygon
                    data-pin={cluster.id}
                    points={`${x},${y - 5.8} ${x - 5},${y + 2.9} ${x + 5},${y + 2.9}`}
                    fill="var(--accent-park)"
                    stroke="var(--bg)"
                    strokeWidth={1.6}
                    strokeLinejoin="round"
                    onClick={handlePinClick}
                  />
                ) : (
                  <circle
                    data-pin={cluster.id}
                    cx={x}
                    cy={y}
                    r={4.8}
                    fill="var(--accent)"
                    stroke="var(--bg)"
                    strokeWidth={1.6}
                    onClick={handlePinClick}
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <PinPopover
        cluster={openCluster?.cluster ?? null}
        onClose={() => setOpenClusterId(null)}
      />
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
