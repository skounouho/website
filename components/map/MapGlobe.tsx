"use client";

import { useEffect, useRef, useState } from "react";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { MapPin } from "@/lib/content";
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

  const { countryPaths, statePaths, projectedPins } = useGlobeProjection({
    worldTopo,
    statesTopo,
    pins,
    rotation,
    scale,
    initialRotation,
    initialScale,
    initialCountryPaths,
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenPinId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const openPin = projectedPins.find((p) => p.pin.id === openPinId) ?? null;

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
    setOpenPinId,
    cancelFly,
    cancelDrift,
    startDrift,
    scheduleRotation,
    scheduleScale,
  });

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
