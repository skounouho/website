import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeShiki from "@shikijs/rehype";
import type { ReactNode } from "react";
import { mdxComponents } from "@/components/mdx";

/*
 * Compile an MDX string into a React node tree, with:
 *   - GFM (tables, task lists, strikethrough, footnotes)
 *   - Math ($…$ / $$…$$) via KaTeX
 *   - Dual-theme syntax highlighting via Shiki
 *   - Shared custom component overrides
 *
 * Trusted-author input only. `source` is evaluated as MDX (can execute
 * arbitrary JSX/components) — do not pass user-submitted content here
 * without a sandboxing layer.
 */
export function renderMdx(source: string): ReactNode {
  return (
    <MDXRemote
      source={source}
      components={mdxComponents}
      options={{
        parseFrontmatter: false,
        mdxOptions: {
          remarkPlugins: [remarkGfm, remarkMath],
          rehypePlugins: [
            rehypeKatex,
            [
              rehypeShiki,
              {
                themes: { light: "github-light", dark: "github-dark" },
                defaultColor: false,
              },
            ],
          ],
        },
      }}
    />
  );
}
