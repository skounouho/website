import fs from "node:fs";
import { readYamlList, ContentParseError } from "./parse-yaml";
import { mapPinSchema, type MapPin } from "./schemas";

export function loadPins(filePath: string): MapPin[] {
  if (!fs.existsSync(filePath)) return [];
  const items = readYamlList(filePath);
  const seen = new Map<string, number>();
  return items.map((item, i) => {
    const parsed = mapPinSchema.safeParse(item);
    if (!parsed.success) {
      throw new ContentParseError(
        filePath,
        `pin[${i}] failed validation: ${parsed.error.message}`,
      );
    }
    const pin = parsed.data;
    if (seen.has(pin.id)) {
      throw new ContentParseError(
        filePath,
        `duplicate pin id "${pin.id}" at indexes ${seen.get(pin.id)} and ${i}`,
      );
    }
    seen.set(pin.id, i);
    return pin;
  });
}
