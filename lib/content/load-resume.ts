import fs from "node:fs";
import { z } from "zod";
import { readYamlList, ContentParseError } from "./parse-yaml";
import {
  workEntrySchema,
  educationEntrySchema,
  publicationSchema,
  type WorkEntry,
  type EducationEntry,
  type Publication,
} from "./schemas";

function loadCollection<T extends { id: string }>(
  filePath: string,
  schema: z.ZodType<T>,
  label: string,
): T[] {
  if (!fs.existsSync(filePath)) return [];
  const items = readYamlList(filePath);

  const seen = new Map<string, number>();
  return items.map((item, i) => {
    const parsed = schema.safeParse(item);
    if (!parsed.success) {
      throw new ContentParseError(
        filePath,
        `${label}[${i}] failed validation: ${parsed.error.message}`,
      );
    }
    const value = parsed.data;
    if (seen.has(value.id)) {
      throw new ContentParseError(
        filePath,
        `duplicate ${label} id "${value.id}" at indexes ${seen.get(value.id)} and ${i}`,
      );
    }
    seen.set(value.id, i);
    return value;
  });
}

export function loadWork(filePath: string): WorkEntry[] {
  return loadCollection(filePath, workEntrySchema, "work");
}

export function loadEducation(filePath: string): EducationEntry[] {
  return loadCollection(filePath, educationEntrySchema, "education");
}

export function loadPublications(filePath: string): Publication[] {
  return loadCollection(filePath, publicationSchema, "publication");
}
