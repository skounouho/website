import type { Metadata } from "next";
import Image from "next/image";
import {
  getAboutPage,
  getBlogPosts,
  getEducation,
  getPins,
  getPublications,
  getWork,
} from "@/lib/content";
import {
  partitionPublicationsByKind,
  partitionWorkByCategory,
  sortPublicationsByYearDesc,
  sortWorkByStartDesc,
} from "@/lib/content/resume-sections";
import { renderMdx } from "@/lib/content/mdx";
import { WorkEntry } from "@/components/resume/WorkEntry";
import { EducationEntry } from "@/components/resume/EducationEntry";
import { PublicationEntry } from "@/components/resume/PublicationEntry";
import { PageContainer } from "@/components/layout/PageContainer";

export const metadata: Metadata = {
  title: "Senou Kounouho",
  description: "About, work, education, and publications.",
};

export default function Home() {
  const about = getAboutPage();
  const { paid, teachingOther } = partitionWorkByCategory(getWork());
  const paidWork = sortWorkByStartDesc(paid);
  const teachingWork = sortWorkByStartDesc(teachingOther);
  const education = sortWorkByStartDesc(getEducation());
  const { papers, conferences } = partitionPublicationsByKind(getPublications());
  const currentYear = new Date().getFullYear();
  const sortedPapers = sortPublicationsByYearDesc(papers, currentYear);
  const sortedConferences = sortPublicationsByYearDesc(conferences, currentYear);
  const posts = getBlogPosts();
  const pins = getPins();

  const sectionHeading =
    "font-sans mb-[var(--space-block)] text-[24px] font-bold";

  return (
    <PageContainer>
      <section id="about">
        <Image
          src="/headshot_white.png"
          alt="Illustrated portrait of Senou Kounouho"
          width={800}
          height={801}
          priority
          quality={95}
          sizes="96px"
          className="mb-[var(--space-block)] h-24 w-24 rounded-full object-cover"
        />
        <article className="prose-site w-full">{renderMdx(about.body)}</article>
        <ul
          className="mt-[var(--space-block)] flex flex-wrap gap-x-5 gap-y-2 font-sans text-sm"
          style={{ color: "var(--fg-muted)" }}
        >
          <li>
            <a
              href="https://www.linkedin.com/in/kounouho/"
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:text-[color:var(--accent)]"
            >
              LinkedIn
            </a>
          </li>
          <li>
            <a
              href="https://x.com/SenouKounouho"
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:text-[color:var(--accent)]"
            >
              X
            </a>
          </li>
          <li>
            <a
              href="https://github.com/skounouho"
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:text-[color:var(--accent)]"
            >
              GitHub
            </a>
          </li>
        </ul>
      </section>

      <hr
        className="mt-[var(--space-section)] border-0 border-t"
        aria-hidden="true"
      />

      <div id="resume" className="mt-[var(--space-section)]">
        <section id="work">
          <h2 className={sectionHeading}>Work &amp; Internships</h2>
          <div className="space-y-10">
            {paidWork.map((entry) => (
              <WorkEntry key={entry.id} entry={entry} posts={posts} pins={pins} />
            ))}
          </div>
        </section>

        <section id="teaching" className="mt-[var(--space-section)]">
          <h2 className={sectionHeading}>Teaching &amp; Other</h2>
          <div className="space-y-10">
            {teachingWork.map((entry) => (
              <WorkEntry key={entry.id} entry={entry} posts={posts} pins={pins} />
            ))}
          </div>
        </section>

        <section id="education" className="mt-[var(--space-section)]">
          <h2 className={sectionHeading}>Education</h2>
          <div className="space-y-10">
            {education.map((entry) => (
              <EducationEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </section>

        <section id="papers" className="mt-[var(--space-section)]">
          <h2 className={sectionHeading}>Published Papers</h2>
          <div className="space-y-10">
            {sortedPapers.map((entry) => (
              <PublicationEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </section>

        <section id="conferences" className="mt-[var(--space-section)]">
          <h2 className={sectionHeading}>Conferences</h2>
          <div className="space-y-10">
            {sortedConferences.map((entry) => (
              <PublicationEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
