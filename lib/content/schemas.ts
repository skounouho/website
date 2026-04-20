import { z } from "zod";
import { yearMonth, yearMonthOrNull, isoDate } from "./dates";

const kebabCase = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be kebab-case");

const url = z.string().url();
const urlOrNull = url.nullable();

export const blogFrontmatterSchema = z
  .object({
    title: z.string().min(1),
    date: isoDate,
    updated: isoDate.optional(),
    description: z.string().min(1),
    tags: z.array(kebabCase).default([]),
    draft: z.boolean().default(false),
    places: z.array(kebabCase).default([]),
  })
  .strict()
  .refine((v) => v.updated === undefined || v.updated >= v.date, {
    message: "updated must be >= date",
    path: ["updated"],
  });

export type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>;

export interface BlogPost extends BlogFrontmatter {
  slug: string;
  /**
   * Raw MDX source. Server-only — pass through `renderMdx` at the page
   * boundary; do not hand the string to a client component.
   */
  body: string;
  filePath: string;
}

const yearMonthRange = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object(shape)
    .strict()
    .refine(
      (v: Record<string, unknown>) => {
        const start = v.start as string | undefined;
        const end = v.end as string | null | undefined;
        return !start || !end || end >= start;
      },
      { message: "end must be >= start", path: ["end"] },
    );

export const workEntrySchema = yearMonthRange({
  id: kebabCase,
  org: z.string().min(1),
  role: z.string().min(1),
  subtitle: z.string().min(1).optional(),
  location: z.string().min(1),
  start: yearMonth,
  end: yearMonthOrNull,
  org_url: url.optional(),
  highlights: z.array(z.string().min(1)).min(1),
  blog_slugs: z.array(kebabCase).default([]),
  map_pin_ids: z.array(kebabCase).default([]),
});

export type WorkEntry = z.infer<typeof workEntrySchema>;

export const educationEntrySchema = yearMonthRange({
  id: kebabCase,
  institution: z.string().min(1),
  degree: z.string().min(1),
  minor: z.string().optional(),
  certificate: z.string().optional(),
  gpa: z.string().optional(),
  honors: z.array(z.string().min(1)).default([]),
  start: yearMonth,
  end: yearMonthOrNull,
  map_pin_ids: z.array(kebabCase).default([]),
});

export type EducationEntry = z.infer<typeof educationEntrySchema>;

export const serviceEntrySchema = yearMonthRange({
  id: kebabCase,
  org: z.string().min(1),
  role: z.string().min(1),
  location: z.string().min(1),
  start: yearMonth,
  end: yearMonthOrNull,
  description: z.string().optional(),
  blog_slugs: z.array(kebabCase).default([]),
  map_pin_ids: z.array(kebabCase).default([]),
});

export type ServiceEntry = z.infer<typeof serviceEntrySchema>;

export const publicationKind = z.enum([
  "journal",
  "preprint",
  "presentation",
]);
export const publicationStatus = z.enum([
  "published",
  "in-review",
  "accepted",
]);

export const publicationSchema = z
  .object({
    id: kebabCase,
    title: z.string().min(1),
    authors: z.array(z.string().min(1)).min(1),
    venue: z.string().min(1),
    year: z.number().int().min(1900).max(2100).optional(),
    kind: publicationKind,
    status: publicationStatus,
    doi: z.string().optional(),
    url: urlOrNull.optional(),
    blog_slugs: z.array(kebabCase).default([]),
  })
  .strict()
  .refine((v) => v.status === "in-review" || v.year !== undefined, {
    message: "year is required when status is not in-review",
    path: ["year"],
  });

export type Publication = z.infer<typeof publicationSchema>;

export const mapPinKind = z.enum([
  "lived",
  "worked",
  "visited",
  "conference",
  "research",
]);

export const mapPinSchema = yearMonthRange({
  id: kebabCase,
  name: z.string().min(1),
  kind: mapPinKind,
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  start: yearMonth.optional(),
  end: yearMonthOrNull.optional(),
  description: z.string().optional(),
  blog_slugs: z.array(kebabCase).default([]),
  links: z
    .array(z.object({ label: z.string().min(1), url }).strict())
    .default([]),
});

export type MapPin = z.infer<typeof mapPinSchema>;
