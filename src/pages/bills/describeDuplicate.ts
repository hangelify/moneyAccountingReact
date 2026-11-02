import type { TFunction } from 'i18next';
import { formatAmount } from '@/pages/dashboard/format';
import type { PossibleDuplicate } from '@/types/bills';

/** "Oct 3" for a YYYY-MM-DD bill date, read as a calendar day. */
export function shortBillDate(billDate: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${billDate.slice(0, 10)}T00:00:00Z`));
}

/** Who added the bill, or "Someone" when the API doesn't say. */
export function addedBy(t: TFunction, d: PossibleDuplicate): string {
  return d.created_by_name ?? t('bills:duplicates.someone');
}

/** One-line warning for a look-alike, worded by how strong the match is. */
export function describeDuplicate(
  t: TFunction,
  d: PossibleDuplicate,
  lang: string
): string {
  const date = shortBillDate(d.bill_date, lang);
  const amount = formatAmount(d.total_amount, d.currency, lang);
  const lead = t(`bills:duplicates.match.${d.match ?? 'strong'}`, {
    name: addedBy(t, d),
    date,
  });
  // The weak wording has no date, so it goes in the details instead.
  const details = [d.match === 'weak' ? date : d.market_name, amount].filter(
    (part): part is string => !!part
  );
  return `${lead} (${details.join(', ')}).`;
}
