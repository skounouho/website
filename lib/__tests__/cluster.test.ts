import { describe, it, expect } from "vitest";
import { clusterPins, clusterName } from "@/lib/cluster";
import type { MapPin } from "@/lib/content";

function pin(partial: Partial<MapPin> & { id: string; name: string; lat: number; lon: number }): MapPin {
  return {
    kind: "visited",
    blog_slugs: [],
    links: [],
    ...partial,
  } as MapPin;
}

describe("clusterPins", () => {
  it("groups pins within the threshold", () => {
    const pins = [
      pin({ id: "durham", name: "Durham, NC", lat: 35.994, lon: -78.8986 }),
      pin({ id: "raleigh", name: "Raleigh, NC", lat: 35.7796, lon: -78.6382 }),
    ];
    const clusters = clusterPins(pins, 50);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].pins.map((p) => p.id)).toEqual(["durham", "raleigh"]);
  });

  it("keeps pins farther than the threshold apart", () => {
    const pins = [
      pin({ id: "nyc", name: "New York City", lat: 40.7128, lon: -74.006 }),
      pin({ id: "durham", name: "Durham, NC", lat: 35.994, lon: -78.8986 }),
    ];
    const clusters = clusterPins(pins, 50);
    expect(clusters).toHaveLength(2);
  });

  it("preserves input order of pins within a cluster", () => {
    const pins = [
      pin({ id: "chicago", name: "Chicago, IL", lat: 41.8781, lon: -87.6298 }),
      pin({ id: "lemont", name: "Lemont, IL", lat: 41.6731, lon: -87.9798 }),
    ];
    const clusters = clusterPins(pins, 50);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].pins[0].id).toBe("chicago");
    expect(clusters[0].id).toBe("chicago");
  });

  it("uses the centroid of cluster members for coordinates", () => {
    const pins = [
      pin({ id: "a", name: "A, X", lat: 40, lon: -80 }),
      pin({ id: "b", name: "B, X", lat: 40.2, lon: -80.2 }),
    ];
    const [c] = clusterPins(pins, 50);
    expect(c.lat).toBeCloseTo(40.1, 5);
    expect(c.lon).toBeCloseTo(-80.1, 5);
  });

  it("returns single-pin clusters when no neighbors are within the threshold", () => {
    const pins = [
      pin({ id: "rome", name: "Rome, Italy", lat: 41.8967, lon: 12.4822 }),
    ];
    const clusters = clusterPins(pins, 50);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].pins).toHaveLength(1);
  });
});

describe("clusterName", () => {
  it("returns the single name when all pins share it", () => {
    const pins = [
      pin({ id: "dc1", name: "Washington, D.C.", lat: 38.9, lon: -77 }),
      pin({ id: "dc2", name: "Washington, D.C.", lat: 38.9, lon: -77 }),
    ];
    expect(clusterName(pins)).toBe("Washington, D.C.");
  });

  it("collapses shared suffix", () => {
    const pins = [
      pin({ id: "durham", name: "Durham, NC", lat: 0, lon: 0 }),
      pin({ id: "raleigh", name: "Raleigh, NC", lat: 0, lon: 0 }),
    ];
    expect(clusterName(pins)).toBe("Durham / Raleigh, NC");
  });

  it("joins full names when suffixes differ", () => {
    const pins = [
      pin({ id: "dc", name: "Washington, D.C.", lat: 0, lon: 0 }),
      pin({ id: "cp", name: "College Park, MD", lat: 0, lon: 0 }),
    ];
    expect(clusterName(pins)).toBe("Washington, D.C. / College Park, MD");
  });

  it("dedupes repeated names", () => {
    const pins = [
      pin({ id: "a", name: "Washington, D.C.", lat: 0, lon: 0 }),
      pin({ id: "b", name: "College Park, MD", lat: 0, lon: 0 }),
      pin({ id: "c", name: "Washington, D.C.", lat: 0, lon: 0 }),
    ];
    expect(clusterName(pins)).toBe("Washington, D.C. / College Park, MD");
  });

  it("handles names without commas", () => {
    const pins = [
      pin({ id: "nyc", name: "New York City", lat: 0, lon: 0 }),
      pin({ id: "newark", name: "Newark", lat: 0, lon: 0 }),
    ];
    expect(clusterName(pins)).toBe("New York City / Newark");
  });
});
