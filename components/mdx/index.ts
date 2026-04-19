import type { MDXComponents } from "mdx/types";
import { MdxImage } from "./Image";
import { MdxLink } from "./Link";
import { MdxPre, MdxCode } from "./Code";
import { MdxBlockquote } from "./Blockquote";
import { PullQuote } from "./PullQuote";

export const mdxComponents: MDXComponents = {
  img: MdxImage as MDXComponents["img"],
  a: MdxLink as MDXComponents["a"],
  pre: MdxPre as MDXComponents["pre"],
  code: MdxCode as MDXComponents["code"],
  blockquote: MdxBlockquote as MDXComponents["blockquote"],
  PullQuote,
};
