import { loadAll, type AllContent } from "./load";

export type {
  BlogPost,
  WorkEntry,
  EducationEntry,
  Publication,
  MapPin,
} from "./schemas";

interface Config {
  contentRoot?: string;
  includeDrafts: boolean;
}

const defaultConfig = (): Config => ({
  contentRoot: undefined,
  includeDrafts: process.env.NODE_ENV !== "production",
});

let config: Config = defaultConfig();
let cached: AllContent | null = null;

export function configureContent(next: Partial<Config>): void {
  config = { ...config, ...next };
  cached = null;
}

export function _resetContentForTests(): void {
  config = defaultConfig();
  cached = null;
}

function all(): AllContent {
  if (!cached) cached = loadAll(config);
  return cached;
}

export function getBlogPosts() {
  return all().posts;
}

export function getBlogPost(slug: string) {
  return all().posts.find((p) => p.slug === slug) ?? null;
}

export function getWork() {
  return all().work;
}

export function getEducation() {
  return all().education;
}

export function getPublications() {
  return all().publications;
}

export function getPins() {
  return all().pins;
}

export function getPin(id: string) {
  return all().pins.find((p) => p.id === id) ?? null;
}
