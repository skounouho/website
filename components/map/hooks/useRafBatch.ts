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
