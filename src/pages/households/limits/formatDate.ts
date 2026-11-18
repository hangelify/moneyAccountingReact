/** "December 1, 2026" for a `YYYY-MM-DD` date, independent of time zone. */
export function formatLongDate(isoDate: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}
