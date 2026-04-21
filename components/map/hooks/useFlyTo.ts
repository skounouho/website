import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction, RefObject } from "react";
import { cubicBezierEase, lerpRotation, lerpScale } from "@/lib/tween";
import { flyToTarget } from "@/lib/projection";
import type { GlobeMode } from "./useAutoRotate";

const GLOBE_DURATION_MS = 750;
const GLOBE_EASE = cubicBezierEase(0.2, 0, 0, 1);

/** Anything with lat/lon — matches both MapPin and PinCluster structurally. */
export interface FlyTarget {
  lat: number;
  lon: number;
}

export interface FlyTo {
  startFlyTo: (target: FlyTarget, onComplete?: () => void) => void;
  cancelFly: () => void;
}

export function useFlyTo(opts: {
  rotationRef: RefObject<[number, number]>;
  scaleRef: RefObject<number>;
  setRotation: Dispatch<SetStateAction<[number, number]>>;
  setScale: Dispatch<SetStateAction<number>>;
  setMode: Dispatch<SetStateAction<GlobeMode>>;
  cancelDrift: () => void;
}): FlyTo {
  const { rotationRef, scaleRef, setRotation, setScale, setMode, cancelDrift } = opts;
  const flyRafRef = useRef<number | null>(null);

  const cancelFly = () => {
    if (flyRafRef.current !== null) {
      cancelAnimationFrame(flyRafRef.current);
      flyRafRef.current = null;
    }
  };

  const startFlyTo = (target_: FlyTarget, onComplete?: () => void) => {
    cancelFly();
    cancelDrift();
    const target = flyToTarget(target_);
    const startRotation = rotationRef.current!;
    const startScale = scaleRef.current!;
    const startTime = performance.now();

    const step = (now: number) => {
      const raw = Math.min(1, (now - startTime) / GLOBE_DURATION_MS);
      const eased = GLOBE_EASE(raw);
      setRotation(lerpRotation(startRotation, target.rotation, eased));
      setScale(lerpScale(startScale, target.scale, eased));
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
  };

  useEffect(() => cancelFly, []);

  return { startFlyTo, cancelFly };
}
