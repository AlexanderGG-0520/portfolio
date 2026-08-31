export const supportedLocales = ['en', 'ja'] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = 'en';

export function isSupportedLocale(value: string): value is Locale {
  return supportedLocales.includes(value as Locale);
}

export function alternateLocale(locale: Locale): Locale {
  return locale === 'ja' ? 'en' : 'ja';
}
