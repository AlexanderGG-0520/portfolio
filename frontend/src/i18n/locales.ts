export const supportedLocales = ['en'] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = 'en';

export function isSupportedLocale(value: string): value is Locale {
  return supportedLocales.includes(value as Locale);
}
