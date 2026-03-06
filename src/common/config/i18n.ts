import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as RNLocalize from 'react-native-localize';
import enCommon from '../locales/en/common.json';
import siCommon from '../locales/si/common.json';
import taCommon from '../locales/ta/common.json';

export type SupportedLanguage = 'en' | 'si' | 'ta';

const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export const languageToLocale: Record<SupportedLanguage, string> = {
  en: 'en-US',
  si: 'si-LK',
  ta: 'ta-LK',
};

const resources = {
  en: { common: enCommon },
  si: { common: siCommon },
  ta: { common: taCommon },
} as const;

function detectInitialLanguage(): SupportedLanguage {
  const locales = RNLocalize.getLocales();
  if (!Array.isArray(locales) || locales.length === 0) {
    return DEFAULT_LANGUAGE;
  }

  const deviceLanguageCode = locales[0].languageCode as SupportedLanguage | string;

  if (deviceLanguageCode === 'si') {
    return 'si';
  }
  if (deviceLanguageCode === 'ta') {
    return 'ta';
  }

  return DEFAULT_LANGUAGE;
}

export function initializeI18n(initialLanguage?: SupportedLanguage) {
  const lng = initialLanguage ?? detectInitialLanguage();

  if (!i18n.isInitialized) {
    i18n
      .use(initReactI18next)
      .init({
        compatibilityJSON: 'v3',
        resources,
        lng,
        fallbackLng: DEFAULT_LANGUAGE,
        ns: ['common'],
        defaultNS: 'common',
        interpolation: {
          escapeValue: false,
        },
      })
      .catch(error => {
        // eslint-disable-next-line no-console
        console.error('[i18n] Failed to initialize i18next', error);
      });
  } else if (i18n.language !== lng) {
    i18n.changeLanguage(lng).catch(error => {
      // eslint-disable-next-line no-console
      console.error('[i18n] Failed to change language during initialization', error);
    });
  }

  return i18n;
}

export default i18n;

