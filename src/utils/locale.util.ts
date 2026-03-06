import i18n from '../common/config/i18n';
import { languageToLocale } from '../common/config/i18n';

export function getCurrentLocaleTag(): string {
  const lang = (i18n.language || 'en').split('-')[0] as 'en' | 'si' | 'ta';
  return languageToLocale[lang] ?? languageToLocale.en;
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

