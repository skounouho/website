import { getAboutPage } from "@/lib/content";
import { renderMdx } from "@/lib/content/mdx";

export default function Home() {
  const about = getAboutPage();
  return (
    <div className="mx-auto min-h-screen max-w-[60ch] px-6 py-24 md:flex md:min-h-screen md:items-center md:justify-center">
      <article className="prose-site w-full">{renderMdx(about.body)}</article>
    </div>
  );
}
