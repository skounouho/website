import fs from "node:fs";
import matter from "gray-matter";
import { ContentParseError } from "./parse-yaml";

export interface ParsedMdx {
  data: Record<string, unknown>;
  body: string;
}

function coerceDates(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const key of ["date", "updated"]) {
    const v = out[key];
    if (v instanceof Date) {
      const y = v.getUTCFullYear();
      const m = String(v.getUTCMonth() + 1).padStart(2, "0");
      const d = String(v.getUTCDate()).padStart(2, "0");
      out[key] = `${y}-${m}-${d}`;
    }
  }
  return out;
}

export function parseMdx(filePath: string): ParsedMdx {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    throw new ContentParseError(filePath, "failed to read file", err);
  }

  if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) {
    throw new ContentParseError(filePath, "missing YAML frontmatter block");
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (err) {
    throw new ContentParseError(filePath, "frontmatter parse error", err);
  }

  return {
    data: coerceDates(parsed.data as Record<string, unknown>),
    body: parsed.content,
  };
}
