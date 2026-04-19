import type { MetadataRoute } from "next";
import { getBlogPosts } from "@/lib/content";
import { SITE_URL } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getBlogPosts().filter((p) => !p.draft);
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: new Date() },
    { url: `${SITE_URL}/blog`, lastModified: new Date() },
    { url: `${SITE_URL}/resume`, lastModified: new Date() },
    { url: `${SITE_URL}/map`, lastModified: new Date() },
  ];
  const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: p.updated ?? p.date,
  }));
  return [...staticEntries, ...postEntries];
}
