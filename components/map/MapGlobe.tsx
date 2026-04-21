"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { MapPin } from "@/lib/content";
import { clusterPins, type PinCluster } from "@/lib/cluster";
import {
  shouldShowStateBorders,
  flyToTarget,
  GLOBE_WIDTH,
  GLOBE_HEIGHT,
  GLOBE_BASE_RADIUS,
} from "@/lib/projection";
import { GlobePin } from "./GlobePin";
import { PinPopover } from "./PinPopover";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import { useRafBatch } from "./hooks/useRafBatch";
import { useAutoRotate, type GlobeMode } from "./hooks/useAutoRotate";
import { useFlyTo } from "./hooks/useFlyTo";
import { useDrift } from "./hooks/useDrift";
import { useGlobeWheel } from "./hooks/useGlobeWheel";
import { useGlobeHashRoute } from "./hooks/useGlobeHashRoute";
import { useGlobeKeyboard } from "./hooks/useGlobeKeyboard";
import { usePointerInteraction } from "./hooks/usePointerInteraction";
import { useGlobeProjection } from "./hooks/useGlobeProjection";

export type WorldTopology = Topology<{ countries: GeometryCollection }>;
export type StatesTopology = Topology<{ states: GeometryCollection }>;

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
  const [openClusterId, setOpenClusterId] = useState<string | null>(null);
  const [hoveredClusterId, setHoveredClusterId] = useState<string | null>(null);

  const clusters = useMemo(() => clusterPins(pins), [pins]);

  const { scheduleRotation, scheduleScale } = useRafBatch(setRotation, setScale);

  useAutoRotate(mode, setRotation);

  // Latest-value refs consumed by useFlyTo / useGlobeWheel. Synced after
  // commit so the React Compiler's "no refs during render" rule is honored;
  // handlers run post-commit, so the one-effect-cycle lag is invisible.
  const rotationRef = useRef(rotation);
  const scaleRef = useRef(scale);
  useEffect(() => {
    rotationRef.current = rotation;
    scaleRef.current = scale;
  });

  const { startDrift, cancelDrift } = useDrift(setRotation);

  const { startFlyTo, cancelFly } = useFlyTo({
    rotationRef,
    scaleRef,
    setRotation,
    setScale,
    setMode,
    cancelDrift,
  });

  const { countryPaths, statePaths, projectedClusters } = useGlobeProjection({
    worldTopo,
    statesTopo,
    clusters,
    rotation,
    scale,
    initialRotation,
    initialScale,
    initialCountryPaths,
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenClusterId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useGlobeHashRoute({
    clusters,
    prefersReducedMotion,
    setRotation,
    setScale,
    setMode,
    setOpenClusterId,
    cancelDrift,
    startFlyTo,
  });

  const openCluster =
    projectedClusters.find((p) => p.cluster.id === openClusterId) ?? null;

  const globeCircleRef = useRef<SVGCircleElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  const onKeyDown = useGlobeKeyboard({
    cancelFly,
    cancelDrift,
    setMode,
    setRotation,
    setScale,
  });

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
    setOpenClusterId,
    cancelFly,
    cancelDrift,
    startDrift,
    scheduleRotation,
    scheduleScale,
  });

  const onClusterActivate = (cluster: PinCluster) => {
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
    setOpenClusterId(null); // close existing popover before flying
    startFlyTo(cluster, () => setOpenClusterId(cluster.id));
  };

  return (
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
          {[...projectedClusters]
            .sort((a, b) => {
              const aHover = a.cluster.id === hoveredClusterId ? 1 : 0;
              const bHover = b.cluster.id === hoveredClusterId ? 1 : 0;
              return aHover - bHover;
            })
            .map(({ cluster, x, y }) => (
              <GlobePin
                key={cluster.id}
                cluster={cluster}
                x={x}
                y={y}
                onActivate={onClusterActivate}
                onHoverChange={setHoveredClusterId}
              />
            ))}
        </g>
      </svg>

      <PinPopover
        cluster={openCluster?.cluster ?? null}
        onClose={() => setOpenClusterId(null)}
      />
    </div>
  );
}
