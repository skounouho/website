import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getBlogPost, getBlogPosts } from "@/lib/content";
import { formatPostDate } from "@/lib/format";

export const alt = "Blog post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return getBlogPosts()
    .filter((p) => !p.draft)
    .map((p) => ({ slug: p.slug }));
}

export default async function OG(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const post = getBlogPost(slug);
  const title = post?.title ?? "Senou Kounouho";
  const date = post ? formatPostDate(post.date) : "";

  // Satori accepts TTF, OTF, and WOFF — NOT woff2. Load the static-weight
  // .woff from @fontsource/alegreya (the variable package only ships woff2).
  const alegreya = await readFile(
    join(
      process.cwd(),
      "node_modules/@fontsource/alegreya/files/alegreya-latin-700-normal.woff",
    ),
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#F5F2EE",
          color: "#1A1A1A",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          fontFamily: "Alegreya",
        }}
      >
        <div style={{ fontSize: 28, color: "#6B6660" }}>{date}</div>
        <div style={{ fontSize: 72, lineHeight: 1.15, fontWeight: 700 }}>
          {title}
        </div>
        <div style={{ fontSize: 24, color: "#6B6660" }}>Senou Kounouho</div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Alegreya",
          data: alegreya,
          style: "normal",
          weight: 700,
        },
      ],
    },
  );
}
