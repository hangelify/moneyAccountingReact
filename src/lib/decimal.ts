// Digits with at most one `.` or `,`: what a user may have typed so far.
const DRAFT = /^\d*[.,]?\d*$/;

/** Whether `text` is a non-negative decimal, possibly half-typed (`12.`). */
export function isDecimalDraft(text: string): boolean {
  return DRAFT.test(text);
}

/**
 * The number in a typed decimal, accepting `,` as the separator (ru locale).
 * Null when nothing is typed or the text is not a plain decimal.
 */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim();
  if (!isDecimalDraft(trimmed) || !/\d/.test(trimmed)) return null;
  return Number(trimmed.replace(',', '.'));
}
