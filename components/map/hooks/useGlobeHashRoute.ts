import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { PinCluster } from "@/lib/cluster";
import { flyToTarget } from "@/lib/projection";
import type { GlobeMode } from "./useAutoRotate";
import type { FlyTarget } from "./useFlyTo";

/**
 * Subscribes to `hashchange` and the initial hash. When the hash matches a
 * pin id inside any cluster, flies to that cluster (or hard-sets
 * rotation/scale on reduced-motion) and opens the cluster's popover.
 */
export function useGlobeHashRoute(opts: {
  clusters: PinCluster[];
  prefersReducedMotion: boolean;
  setRotation: Dispatch<SetStateAction<[number, number]>>;
  setScale: Dispatch<SetStateAction<number>>;
  setMode: Dispatch<SetStateAction<GlobeMode>>;
  setOpenClusterId: Dispatch<SetStateAction<string | null>>;
  cancelDrift: () => void;
  startFlyTo: (target: FlyTarget, onComplete?: () => void) => void;
}): void {
  const {
    clusters,
    prefersReducedMotion,
    setRotation,
    setScale,
    setMode,
    setOpenClusterId,
    cancelDrift,
    startFlyTo,
  } = opts;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const route = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const cluster = clusters.find((c) =>
        c.pins.some((p) => p.id === hash),
      );
      if (!cluster) return;
      if (prefersReducedMotion) {
        cancelDrift();
        const target = flyToTarget(cluster);
        setRotation(target.rotation);
        setScale(target.scale);
        setMode("user");
        setOpenClusterId(cluster.id);
      } else {
        setOpenClusterId(null);
        startFlyTo(cluster, () => setOpenClusterId(cluster.id));
      }
    };
    route();
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
    // startFlyTo closes over live refs; a fresh closure per hash event is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusters, prefersReducedMotion]);
}
