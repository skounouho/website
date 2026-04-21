import { useMemo } from "react";
import type { ExtendedFeatureCollection } from "d3-geo";
import { feature } from "topojson-client";
import type { PinCluster } from "@/lib/cluster";
import {
  createGlobeProjection,
  pathsFromGeojson,
  isPinVisible,
  shouldShowStateBorders,
  GLOBE_WIDTH,
  GLOBE_HEIGHT,
} from "@/lib/projection";
import type { WorldTopology, StatesTopology } from "../MapGlobe";

export interface ProjectedCluster {
  cluster: PinCluster;
  x: number;
  y: number;
}

export interface GlobeProjectionResult {
  countryPaths: string[];
  statePaths: string[];
  projectedClusters: ProjectedCluster[];
}

/**
 * Materializes topology features and re-projects them every time rotation
 * or scale changes. The first render uses the server-projected country
 * paths (`initialCountryPaths`) to avoid a visible paint delay.
 */
export function useGlobeProjection(opts: {
  worldTopo: WorldTopology;
  statesTopo: StatesTopology;
  clusters: PinCluster[];
  rotation: [number, number];
  scale: number;
  initialRotation: [number, number];
  initialScale: number;
  initialCountryPaths: string[];
}): GlobeProjectionResult {
  const {
    worldTopo,
    statesTopo,
    clusters,
    rotation,
    scale,
    initialRotation,
    initialScale,
    initialCountryPaths,
  } = opts;

  // Materialize features from topology once on the client. Shipping the raw
  // TopoJSON (arc-encoded, shared boundaries) rather than the expanded
  // FeatureCollection roughly halves the /map RSC payload.
  const worldFeatures = useMemo(
    () =>
      feature(
        worldTopo,
        worldTopo.objects.countries,
      ) as unknown as ExtendedFeatureCollection,
    [worldTopo],
  );
  const stateFeatures = useMemo(
    () =>
      feature(
        statesTopo,
        statesTopo.objects.states,
      ) as unknown as ExtendedFeatureCollection,
    [statesTopo],
  );

  return useMemo(() => {
    const projection = createGlobeProjection({
      width: GLOBE_WIDTH,
      height: GLOBE_HEIGHT,
      scale,
      rotation,
    });
    const isInitial =
      rotation[0] === initialRotation[0] &&
      rotation[1] === initialRotation[1] &&
      scale === initialScale;
    const countryPaths = isInitial
      ? initialCountryPaths
      : pathsFromGeojson(worldFeatures, projection);
    const statePaths = shouldShowStateBorders(scale)
      ? pathsFromGeojson(stateFeatures, projection)
      : [];
    const projectedClusters: ProjectedCluster[] = clusters
      .map((cluster) => {
        const xy = projection([cluster.lon, cluster.lat]);
        if (!xy) return null;
        if (!isPinVisible(cluster, rotation)) return null;
        return { cluster, x: xy[0], y: xy[1] };
      })
      .filter((p): p is ProjectedCluster => p !== null);
    return { countryPaths, statePaths, projectedClusters };
  }, [
    rotation,
    scale,
    worldFeatures,
    stateFeatures,
    clusters,
    initialCountryPaths,
    initialRotation,
    initialScale,
  ]);
}
