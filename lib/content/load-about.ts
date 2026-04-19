import fs from "node:fs";
import { ContentParseError } from "./parse-yaml";

export interface AboutPage {
  body: string;
  filePath: string;
}

/*
 * About has no frontmatter — it's free-form MDX. Read the file directly
 * rather than going through parseMdx (which requires a frontmatter block).
 */
export function loadAbout(filePath: string): AboutPage {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    throw new ContentParseError(filePath, "failed to read file", err);
  }
  return { body: raw, filePath };
}
