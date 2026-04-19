/*
 * Canonical site URL used by metadata, sitemap, and robots routes.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL — explicit override (custom domains, non-Vercel).
 *   2. VERCEL_PROJECT_PRODUCTION_URL — stable production domain on Vercel.
 *   3. VERCEL_URL — per-deployment ephemeral URL (fine for previews).
 *   4. localhost — development fallback.
 *
 * Production builds that resolve to none of the above hard-fail, so a
 * placeholder never leaks into the deployed sitemap.
 */
const explicit = process.env.NEXT_PUBLIC_SITE_URL;
const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const vercelDeploy = process.env.VERCEL_URL;

function resolveSiteUrl(): string {
  if (explicit) return explicit;
  if (process.env.VERCEL_ENV === "production" && vercelProd) {
    return `https://${vercelProd}`;
  }
  if (vercelDeploy) return `https://${vercelDeploy}`;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SITE_URL could not be resolved: set NEXT_PUBLIC_SITE_URL, or deploy on Vercel so VERCEL_URL is available.",
    );
  }
  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();
