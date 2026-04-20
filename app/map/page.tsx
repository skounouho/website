import type { Metadata } from "next";
import { feature } from "topojson-client";
import type { ExtendedFeatureCollection } from "d3-geo";
import worldTopo from "world-atlas/countries-110m.json";
import statesTopo from "us-atlas/states-10m.json";
import { getPins } from "@/lib/content";
import {
  createGlobeProjection,
  pathsFromGeojson,
  GLOBE_WIDTH,
  GLOBE_HEIGHT,
} from "@/lib/projection";
import {
  MapGlobe,
  type StatesTopology,
  type WorldTopology,
} from "@/components/map/MapGlobe";

export const metadata: Metadata = {
  title: "Map",
  description: "Places I've lived, worked, and visited.",
};

// Mid-Atlantic view: rotation [30, 0] puts lon=-30 at screen center,
// roughly splitting the Americas and Europe/Africa.
const INITIAL_ROTATION: [number, number] = [30, 0];
const INITIAL_SCALE = 1;

export default function MapPage() {
  const pins = getPins();

  const world = worldTopo as unknown as WorldTopology;
  const states = statesTopo as unknown as StatesTopology;

  const initialProjection = createGlobeProjection({
    width: GLOBE_WIDTH,
    height: GLOBE_HEIGHT,
    scale: INITIAL_SCALE,
    rotation: INITIAL_ROTATION,
  });
  const initialCountryPaths = pathsFromGeojson(
    feature(
      world,
      world.objects.countries,
    ) as unknown as ExtendedFeatureCollection,
    initialProjection,
  );

  return (
    <MapGlobe
      pins={pins}
      worldTopo={world}
      statesTopo={states}
      initialRotation={INITIAL_ROTATION}
      initialScale={INITIAL_SCALE}
      initialCountryPaths={initialCountryPaths}
    />
  );
}
