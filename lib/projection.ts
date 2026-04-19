import { geoEqualEarth, geoPath } from "d3-geo";
import type { ExtendedFeatureCollection } from "d3-geo";

export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 500;

/*
 * Shared Equal Earth projection, centered and scaled to fit
 * MAP_WIDTH × MAP_HEIGHT. Used for both country paths and pin positions
 * so pins land exactly on the map.
 */
const projection = geoEqualEarth()
  .scale(175)
  .translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]);

export function projectPoint(lon: number, lat: number): [number, number] {
  const xy = projection([lon, lat]);
  if (!xy) throw new Error(`Projection failed for (${lon}, ${lat})`);
  return [xy[0], xy[1]];
}

export function countryPathsFromGeojson(
  fc: ExtendedFeatureCollection,
): string[] {
  const path = geoPath(projection);
  const out: string[] = [];
  for (const feature of fc.features) {
    const d = path(feature);
    if (d) out.push(d);
  }
  return out;
}
