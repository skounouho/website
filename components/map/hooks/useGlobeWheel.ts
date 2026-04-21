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
