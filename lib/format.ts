/*
 * Date formatters used by the UI. All inputs are ISO strings
 * (YYYY-MM-DD for posts, YYYY-MM for resume entries).
 */

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatPostDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
}

export function formatYearMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]} ${y}`;
}

export function formatYearMonthRange(
  start: string,
  end: string | null,
): string {
  const left = formatYearMonth(start);
  if (end !== null && end === start) return left;
  const right = end === null ? "Present" : formatYearMonth(end);
  return `${left} – ${right}`;
}
