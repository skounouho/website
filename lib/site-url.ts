/*
 * Canonical site URL used by metadata, sitemap, and robots routes.
 *
 * Hard-fails a production build if NEXT_PUBLIC_SITE_URL is missing so the
 * placeholder doesn't leak into the deployed sitemap. Development falls back
 * to localhost.
 */
const envUrl = process.env.NEXT_PUBLIC_SITE_URL;

if (!envUrl && process.env.NODE_ENV === "production") {
  throw new Error(
    "NEXT_PUBLIC_SITE_URL must be set for production builds (used by sitemap, robots, and metadata).",
  );
}

export const SITE_URL = envUrl ?? "http://localhost:3000";
