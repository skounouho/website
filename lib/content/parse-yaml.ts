import fs from "node:fs";
import YAML from "yaml";

export class ContentParseError extends Error {
  constructor(
    public filePath: string,
    public reason: string,
    public cause?: unknown,
  ) {
    super(`${filePath}: ${reason}`);
    this.name = "ContentParseError";
  }
}

export function readYamlList(filePath: string): unknown[] {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    throw new ContentParseError(filePath, "failed to read file", err);
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(raw);
  } catch (err) {
    throw new ContentParseError(filePath, "YAML parse error", err);
  }

  if (parsed === null || parsed === undefined) return [];
  if (!Array.isArray(parsed)) {
    throw new ContentParseError(filePath, "expected top-level YAML list");
  }
  return parsed;
}
