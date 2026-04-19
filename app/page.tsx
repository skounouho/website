import { getAboutPage } from "@/lib/content";
import { renderMdx } from "@/lib/content/mdx";

export default function Home() {
  const about = getAboutPage();
  return (
    <div className="mx-auto max-w-[60ch] px-6 pt-24 pb-24 md:pt-[20vh]">
      <article className="prose-site w-full">{renderMdx(about.body)}</article>
    </div>
  );
}
