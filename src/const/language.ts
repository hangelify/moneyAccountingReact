/**
 * Language Code constants (erasable syntax)
 */
export const LANGUAGE_CODE = {
  EN: 'EN',
  ES: 'ES',
  FR: 'FR',
  DE: 'DE',
  IT: 'IT',
  PT: 'PT',
  RU: 'RU',
  ZH: 'ZH',
  JA: 'JA',
  KO: 'KO',
} as const;

/**
 * Language Code type (union of all language code values)
 */
export type LanguageCode = (typeof LANGUAGE_CODE)[keyof typeof LANGUAGE_CODE];
