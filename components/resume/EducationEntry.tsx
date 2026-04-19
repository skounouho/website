import type { EducationEntry as Edu } from "@/lib/content";
import { formatYearMonthRange } from "@/lib/format";

export function EducationEntry({ entry }: { entry: Edu }) {
  const meta = [
    entry.minor ? `Minor: ${entry.minor}` : null,
    entry.certificate ? `Certificate: ${entry.certificate}` : null,
    entry.gpa ? `GPA: ${entry.gpa}` : null,
    ...entry.honors,
  ].filter((x): x is string => Boolean(x));

  return (
    <article className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-2">
      <h3
        className="text-[22px] font-medium leading-tight"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {entry.degree}
      </h3>
      <div
        className="text-right text-sm"
        style={{ color: "var(--fg-muted)", fontFamily: "var(--font-serif)" }}
      >
        {formatYearMonthRange(entry.start, entry.end)}
      </div>
      <div
        className="col-span-2"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {entry.institution}
      </div>
      {meta.length > 0 ? (
        <div
          className="col-span-2 text-sm"
          style={{ color: "var(--fg-muted)", fontFamily: "var(--font-serif)" }}
        >
          {meta.join(" · ")}
        </div>
      ) : null}
    </article>
  );
}
