"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MapCanvas, type ProjectedPin } from "./MapCanvas";
import { MapInsetButton } from "./MapInsetButton";

interface MapData {
  viewBox: string;
  width: number;
  height: number;
  regionPaths: string[];
  pins: ProjectedPin[];
  ariaLabel: string;
}

interface Props {
  usMap: MapData;
  worldMap: MapData;
}

type ActiveMap = "us" | "world";

const ZOOM_DURATION_MS = 750;
const ZOOM_EASING = "cubic-bezier(0.2, 0, 0, 1)";

export function MapSwitcher({ usMap, worldMap }: Props) {
  const [active, setActive] = useState<ActiveMap>("us");
  const containerRef = useRef<HTMLDivElement>(null);
  const usLayerRef = useRef<HTMLDivElement>(null);
  const worldLayerRef = useRef<HTMLDivElement>(null);
  const insetRef = useRef<HTMLButtonElement>(null);
  const didMountRef = useRef(false);

  // Route deep links to whichever map owns the pin.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const route = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const inUs = usMap.pins.some((p) => p.pin.id === hash);
      const inWorld = worldMap.pins.some((p) => p.pin.id === hash);
      if (!inUs && inWorld) setActive("world");
      else if (!inWorld && inUs) setActive("us");
    };
    route();
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, [usMap.pins, worldMap.pins]);

  // FLIP-style zoom: the newly-active layer starts at the inset's rect and
  // animates to fill the container. Runs synchronously before paint so the
  // full-size version never flashes.
  useLayoutEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const inset = insetRef.current;
    const container = containerRef.current;
    const incoming =
      active === "us" ? usLayerRef.current : worldLayerRef.current;
    const outgoing =
      active === "us" ? worldLayerRef.current : usLayerRef.current;
    if (!inset || !container || !incoming) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const insetRect = inset.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const sx = insetRect.width / containerRect.width;
    const sy = insetRect.height / containerRect.height;
    const tx = insetRect.left - containerRect.left;
    const ty = insetRect.top - containerRect.top;

    incoming.animate(
      [
        {
          transform: `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`,
          transformOrigin: "0 0",
          opacity: 0,
        },
        {
          transform: "translate(0px, 0px) scale(1, 1)",
          transformOrigin: "0 0",
          opacity: 1,
        },
      ],
      { duration: ZOOM_DURATION_MS, easing: ZOOM_EASING, fill: "backwards" },
    );

    outgoing?.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: ZOOM_DURATION_MS, easing: ZOOM_EASING },
    );
  }, [active]);

  const insetMap = active === "us" ? worldMap : usMap;
  const insetLabel =
    active === "us" ? "Switch to world map" : "Switch to United States map";

  return (
    <div
      ref={containerRef}
      className="relative h-[calc(100vh-56px)] md:h-screen overflow-hidden"
    >
      <Layer ref={usLayerRef} visible={active === "us"}>
        <MapCanvas {...usMap} />
      </Layer>
      <Layer ref={worldLayerRef} visible={active === "world"}>
        <MapCanvas {...worldMap} />
      </Layer>
      <MapInsetButton
        ref={insetRef}
        viewBox={insetMap.viewBox}
        regionPaths={insetMap.regionPaths}
        ariaLabel={insetLabel}
        onClick={() => setActive(active === "us" ? "world" : "us")}
      />
    </div>
  );
}

const Layer = function Layer({
  visible,
  children,
  ref,
}: {
  visible: boolean;
  children: React.ReactNode;
  ref: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={ref}
      aria-hidden={!visible}
      className={
        "absolute inset-0 " +
        (visible ? "opacity-100" : "pointer-events-none opacity-0")
      }
    >
      {children}
    </div>
  );
};
