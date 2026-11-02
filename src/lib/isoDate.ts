// Helpers for calendar dates as `YYYY-MM-DD` strings. All arithmetic is done
// in UTC so the result never depends on the user's time zone.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseIsoDate(v: string | null): string | null {
  if (!v || !ISO_DATE.test(v)) return null;
  const [y, m, d] = v.split('-').map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = Date.parse(`${v}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  // Reject normalized dates (e.g. "2026-02-31" → "2026-03-03") by
  // round-tripping through a UTC Date and confirming the components match.
  const dt = new Date(t);
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() + 1 !== m ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return v;
}

function toUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function fromUtc(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  return fromUtc(new Date(toUtc(iso).getTime() + n * DAY_MS));
}

export function addMonths(iso: string, n: number): string {
  const dt = toUtc(iso);
  const day = dt.getUTCDate();
  const target = new Date(
    Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + n, 1)
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return fromUtc(target);
}

export function addYears(iso: string, n: number): string {
  return addMonths(iso, n * 12);
}

export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / DAY_MS);
}
