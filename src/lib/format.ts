/** An amount in `currency`, with 2 decimals; never throws on odd codes. */
export function formatAmount(
  value: number,
  currency: string | null,
  lang: string
): string {
  const plain = (): string =>
    new Intl.NumberFormat(lang, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  if (currency === null) return plain();
  try {
    return new Intl.NumberFormat(lang, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${plain()} ${currency}`;
  }
}
