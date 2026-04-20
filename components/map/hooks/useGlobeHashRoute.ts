import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { MapPin } from "@/lib/content";
import { flyToTarget } from "@/lib/projection";
import type { GlobeMode } from "./useAutoRotate";

/**
 * Subscribes to `hashchange` and the initial hash. When the hash matches a
 * pin id, flies to that pin (or hard-sets rotation/scale on reduced-motion).
 */
export function useGlobeHashRoute(opts: {
  pins: MapPin[];
  prefersReducedMotion: boolean;
  setRotation: Dispatch<SetStateAction<[number, number]>>;
  setScale: Dispatch<SetStateAction<number>>;
  setMode: Dispatch<SetStateAction<GlobeMode>>;
  setOpenPinId: Dispatch<SetStateAction<string | null>>;
  cancelDrift: () => void;
  startFlyTo: (pin: MapPin, onComplete?: () => void) => void;
}): void {
  const {
    pins,
    prefersReducedMotion,
    setRotation,
    setScale,
    setMode,
    setOpenPinId,
    cancelDrift,
    startFlyTo,
  } = opts;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const route = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const pin = pins.find((p) => p.id === hash);
      if (!pin) return;
      if (prefersReducedMotion) {
        cancelDrift();
        const target = flyToTarget(pin);
        setRotation(target.rotation);
        setScale(target.scale);
        setMode("user");
        setOpenPinId(pin.id);
      } else {
        setOpenPinId(null);
        startFlyTo(pin, () => setOpenPinId(pin.id));
      }
    };
    route();
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
    // startFlyTo closes over live refs; a fresh closure per hash event is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, prefersReducedMotion]);
}
