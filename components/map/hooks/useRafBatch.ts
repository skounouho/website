import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { SCALE_MIN, SCALE_MAX } from "@/lib/projection";

type ScaleUpdate = number | ((prev: number) => number);

export interface RafBatch {
  scheduleRotation: (next: [number, number]) => void;
  scheduleScale: (update: ScaleUpdate) => void;
  cancel: () => void;
}

/**
 * Batches rotation+scale state updates into a single requestAnimationFrame.
 * Multiple schedule calls within a frame collapse to one setState each — the
 * last rotation wins; scale updaters compose. Scale accepts an updater
 * function applied against the live scale at flush time, so a zoom is never
 * derived from a stale snapshot. Cancels any pending frame on unmount.
 */
export function useRafBatch(
  setRotation: Dispatch<SetStateAction<[number, number]>>,
  setScale: Dispatch<SetStateAction<number>>,
): RafBatch {
  const pendingRotationRef = useRef<[number, number] | null>(null);
  const pendingScaleRef = useRef<((prev: number) => number) | null>(null);
  const rafRef = useRef<number | null>(null);

  const flush = () => {
    if (pendingRotationRef.current) {
      setRotation(pendingRotationRef.current);
      pendingRotationRef.current = null;
    }
    if (pendingScaleRef.current) {
      const update = pendingScaleRef.current;
      pendingScaleRef.current = null;
      setScale((prev) =>
        Math.max(SCALE_MIN, Math.min(SCALE_MAX, update(prev))),
      );
    }
    rafRef.current = null;
  };

  const scheduleRotation = (next: [number, number]) => {
    pendingRotationRef.current = next;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(flush);
    }
  };

  const scheduleScale = (update: ScaleUpdate) => {
    const fn = typeof update === "function" ? update : () => update;
    const queued = pendingScaleRef.current;
    // Compose so several schedules within one frame all apply.
    pendingScaleRef.current = queued ? (s) => fn(queued(s)) : fn;
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
