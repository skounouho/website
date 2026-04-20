import { getAboutPage } from "@/lib/content";
import { renderMdx } from "@/lib/content/mdx";
import { PageContainer } from "@/components/layout/PageContainer";

export default function Home() {
  const about = getAboutPage();
  return (
    <PageContainer>
      <article className="prose-site w-full">{renderMdx(about.body)}</article>
    </PageContainer>
  );
}
