import { contentPaths } from "./paths";
import { loadBlogPosts } from "./load-blog";
import { loadPins } from "./load-map";
import {
  loadWork,
  loadEducation,
  loadPublications,
  loadService,
} from "./load-resume";
import { ContentParseError } from "./parse-yaml";
import type {
  BlogPost,
  WorkEntry,
  EducationEntry,
  Publication,
  ServiceEntry,
  MapPin,
} from "./schemas";

export interface LoadAllOptions {
  contentRoot?: string;
  includeDrafts: boolean;
}

export interface AllContent {
  posts: BlogPost[];
  work: WorkEntry[];
  education: EducationEntry[];
  publications: Publication[];
  service: ServiceEntry[];
  pins: MapPin[];
}

export function loadAll({
  contentRoot,
  includeDrafts,
}: LoadAllOptions): AllContent {
  const p = contentPaths(contentRoot);

  const pins = loadPins(p.map);
  const allPosts = loadBlogPosts(p.blog, { includeDrafts: true });
  const work = loadWork(p.resume.work);
  const education = loadEducation(p.resume.education);
  const publications = loadPublications(p.resume.publications);
  const service = loadService(p.resume.service);

  const pinIds = new Set(pins.map((x) => x.id));
  const publicSlugs = new Set(
    allPosts.filter((x) => !x.draft).map((x) => x.slug),
  );

  const checkPinRefs = (where: string, ownerId: string, ids: string[]) => {
    for (const id of ids) {
      if (!pinIds.has(id)) {
        throw new ContentParseError(
          where,
          `${ownerId}: unknown pin id "${id}" — not found in map.yaml`,
        );
      }
    }
  };

  const checkBlogRefs = (where: string, ownerId: string, s: string[]) => {
    for (const slug of s) {
      if (!publicSlugs.has(slug)) {
        throw new ContentParseError(
          where,
          `${ownerId}: unknown blog slug "${slug}" — not found in content/blog/ (drafts are not referenceable)`,
        );
      }
    }
  };

  for (const post of allPosts) {
    checkPinRefs(post.filePath, post.slug, post.places);
  }
  for (const w of work) {
    checkPinRefs(p.resume.work, w.id, w.map_pin_ids);
    checkBlogRefs(p.resume.work, w.id, w.blog_slugs);
  }
  for (const e of education) {
    checkPinRefs(p.resume.education, e.id, e.map_pin_ids);
  }
  for (const pub of publications) {
    checkBlogRefs(p.resume.publications, pub.id, pub.blog_slugs);
  }
  for (const s of service) {
    checkPinRefs(p.resume.service, s.id, s.map_pin_ids);
    checkBlogRefs(p.resume.service, s.id, s.blog_slugs);
  }
  for (const pin of pins) {
    checkBlogRefs(p.map, pin.id, pin.blog_slugs);
  }

  const posts = includeDrafts ? allPosts : allPosts.filter((x) => !x.draft);
  return { posts, work, education, publications, service, pins };
}
