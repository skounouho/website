import { geoDistance } from "d3-geo";
import type { MapPin } from "@/lib/content";

const EARTH_RADIUS_MILES = 3958.8;
const DEFAULT_THRESHOLD_MILES = 50;

export interface PinCluster {
  id: string;
  lat: number;
  lon: number;
  name: string;
  pins: MapPin[];
}

/**
 * Group pins whose great-circle distance is within `thresholdMiles`.
 * Greedy single pass anchored on each cluster's first pin (in input order),
 * so output is deterministic for a given pin ordering in YAML.
 */
export function clusterPins(
  pins: MapPin[],
  thresholdMiles: number = DEFAULT_THRESHOLD_MILES,
): PinCluster[] {
  const thresholdRadians = thresholdMiles / EARTH_RADIUS_MILES;
  const buckets: MapPin[][] = [];

  for (const pin of pins) {
    let joined = false;
    for (const bucket of buckets) {
      const anchor = bucket[0];
      const d = geoDistance([pin.lon, pin.lat], [anchor.lon, anchor.lat]);
      if (d <= thresholdRadians) {
        bucket.push(pin);
        joined = true;
        break;
      }
    }
    if (!joined) buckets.push([pin]);
  }

  return buckets.map((bucket) => ({
    id: bucket[0].id,
    lat: bucket.reduce((s, p) => s + p.lat, 0) / bucket.length,
    lon: bucket.reduce((s, p) => s + p.lon, 0) / bucket.length,
    name: clusterName(bucket),
    pins: bucket,
  }));
}

/**
 * Build a display label for a cluster. If every pin name ends in the
 * same ", Suffix" segment, collapse the leading parts ("Durham / Raleigh, NC").
 * Otherwise join distinct names with " / ".
 */
export function clusterName(pins: MapPin[]): string {
  const unique: string[] = [];
  for (const p of pins) {
    if (!unique.includes(p.name)) unique.push(p.name);
  }
  if (unique.length === 1) return unique[0];

  const split = unique.map((n) => {
    const idx = n.lastIndexOf(",");
    if (idx === -1) return { leading: n, suffix: "" };
    return {
      leading: n.slice(0, idx).trim(),
      suffix: n.slice(idx + 1).trim(),
    };
  });
  const firstSuffix = split[0].suffix;
  const shared =
    firstSuffix !== "" && split.every((s) => s.suffix === firstSuffix);
  if (shared) {
    return `${split.map((s) => s.leading).join(" / ")}, ${firstSuffix}`;
  }
  return unique.join(" / ");
}
