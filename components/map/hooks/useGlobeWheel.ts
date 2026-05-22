import { useEffect } from "react";
import type { Dispatch, SetStateAction, RefObject } from "react";
import { zoomScale } from "@/lib/projection";
import type { GlobeMode } from "./useAutoRotate";

/**
 * Non-passive wheel listener for zoom. React's JSX `onWheel` is attached as
 * a passive listener, so `preventDefault()` is silently ignored — we bind
 * imperatively with `{ passive: false }` so it actually suppresses outer
 * scroll. Each event schedules a scale *updater*, not an absolute value, so
 * the new zoom is always derived from the live scale; deriving it from a
 * lagged snapshot made continuous zoom jitter back and forth.
 */
export function useGlobeWheel(opts: {
  containerRef: RefObject<HTMLElement | null>;
  isPointerOnGlobe: (clientX: number, clientY: number) => boolean;
  cancelFly: () => void;
  cancelDrift: () => void;
  setMode: Dispatch<SetStateAction<GlobeMode>>;
  scheduleScale: (update: number | ((prev: number) => number)) => void;
}): void {
  const {
    containerRef,
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
      scheduleScale((prev) => zoomScale(prev, e.deltaY));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // Handler uses stable setters, so subscribe once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
