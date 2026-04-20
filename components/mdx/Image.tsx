import NextImage from "next/image";
import type { ImgHTMLAttributes } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement>;

export function MdxImage(props: Props) {
  const { src, alt, width, height, title } = props;
  if (!src || typeof src !== "string") {
    throw new Error("MDX <img> requires a string src");
  }
  if (!alt || alt.trim() === "") {
    throw new Error(`MDX <img src="${src}"> is missing alt text`);
  }
  if (!width || !height) {
    throw new Error(`MDX <img src="${src}"> is missing explicit width/height`);
  }
  const w = typeof width === "string" ? parseInt(width, 10) : width;
  const h = typeof height === "string" ? parseInt(height, 10) : height;
  const caption = title && title.trim() !== "" ? title : alt;

  return (
    <figure className="my-10">
      <NextImage
        src={src}
        alt={alt}
        width={w}
        height={h}
        className="h-auto w-full"
        sizes="(max-width: 768px) 100vw, 60ch"
      />
      <figcaption
        className="font-serif mt-3 text-sm italic"
        style={{ color: "var(--fg-muted)" }}
      >
        {caption}
      </figcaption>
    </figure>
  );
}
