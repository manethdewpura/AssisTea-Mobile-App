import i18n from '../common/config/i18n';
import { languageToLocale, type SupportedLanguage } from '../common/config/i18n';

const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['en', 'si', 'ta'];

export function getCurrentLocaleTag(): string {
  const lang = (i18n.language || 'en').split('-')[0];
  const key = SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage)
    ? (lang as SupportedLanguage)
    : 'en';
  return languageToLocale[key];
}

export function formatTimeFromUnixSeconds(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleTimeString(getCurrentLocaleTag(), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTimeToColombo(input: string | number): string {
  const date = new Date(input);
  return date.toLocaleString(getCurrentLocaleTag(), {
    timeZone: 'Asia/Colombo',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatCompactDateTime(input: string | number): string {
  const date = new Date(input);
  return date.toLocaleString(getCurrentLocaleTag(), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Like formatCompactDateTime but includes seconds. Use for frequently-updating UIs (e.g. 5s refresh). */
export function formatCompactDateTimeWithSeconds(input: string | number): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return String(input);
  }
  return date.toLocaleString(getCurrentLocaleTag(), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

