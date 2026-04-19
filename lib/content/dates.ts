import { z } from "zod";

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const yearMonth = z
  .string()
  .regex(YEAR_MONTH_RE, "must be YYYY-MM");

export const yearMonthOrNull = yearMonth.nullable();

export const isoDate = z
  .preprocess((v) => {
    if (v instanceof Date) {
      const y = v.getUTCFullYear();
      const m = String(v.getUTCMonth() + 1).padStart(2, "0");
      const d = String(v.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return v;
  }, z.string().regex(ISO_DATE_RE, "must be YYYY-MM-DD"))
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    );
  }, "must be a valid calendar date");
