import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

const DRIFT_DECAY = 0.95;
const DRIFT_STOP = 0.02;

export interface Drift {
  startDrift: (vLon: number, vLat: number) => void;
  cancelDrift: () => void;
}

/**
 * Release-inertia for pointer drags. `DRIFT_DECAY=0.95` lands on ~50% after
 * 14 frames (~230ms). Runs until velocity drops below `DRIFT_STOP` deg/frame.
 */
export function useDrift(
  setRotation: Dispatch<SetStateAction<[number, number]>>,
): Drift {
  const driftRafRef = useRef<number | null>(null);

  const cancelDrift = () => {
    if (driftRafRef.current !== null) {
      cancelAnimationFrame(driftRafRef.current);
      driftRafRef.current = null;
    }
  };

  const startDrift = (initialVLon: number, initialVLat: number) => {
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
  };

  useEffect(() => cancelDrift, []);

  return { startDrift, cancelDrift };
}
