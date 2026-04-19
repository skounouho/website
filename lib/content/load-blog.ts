import fs from "node:fs";
import path from "node:path";
import { blogFrontmatterSchema, type BlogPost } from "./schemas";
import { parseMdx } from "./parse-mdx";
import { ContentParseError } from "./parse-yaml";

const FILENAME_RE = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.mdx$/;

export interface LoadBlogOptions {
  includeDrafts: boolean;
}

export function loadBlogPosts(
  dir: string,
  { includeDrafts }: LoadBlogOptions,
): BlogPost[] {
  if (!fs.existsSync(dir)) return [];

  const entries = fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".mdx"))
    .sort();

  const posts: BlogPost[] = [];
  const seen = new Map<string, string>();

  for (const name of entries) {
    const abs = path.join(dir, name);
    const match = FILENAME_RE.exec(name);
    if (!match) {
      throw new ContentParseError(
        abs,
        "blog filename must match YYYY-MM-DD-<slug>.mdx",
      );
    }
    const [, filenameDate, slug] = match;

    const { data, body } = parseMdx(abs);
    const fm = blogFrontmatterSchema.parse(data);

    if (fm.date !== filenameDate) {
      throw new ContentParseError(
        abs,
        `frontmatter date ${fm.date} does not match filename date ${filenameDate}`,
      );
    }

    if (seen.has(slug)) {
      throw new ContentParseError(
        abs,
        `duplicate blog slug "${slug}" (also defined in ${seen.get(slug)})`,
      );
    }
    seen.set(slug, abs);

    if (fm.draft && !includeDrafts) continue;

    posts.push({ ...fm, slug, body, filePath: abs });
  }

  posts.sort((a, b) => b.date.localeCompare(a.date));
  return posts;
}
