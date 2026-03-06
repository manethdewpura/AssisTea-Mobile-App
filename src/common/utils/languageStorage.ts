import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupportedLanguage } from '../config/i18n';

const LANGUAGE_KEY = '@assistea_language';

export async function saveLanguagePreference(language: SupportedLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[languageStorage] Failed to save language preference', error);
  }
}

export async function loadLanguagePreference(): Promise<SupportedLanguage | null> {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (!stored) {
      return null;
    }
    if (stored === 'en' || stored === 'si' || stored === 'ta') {
      return stored;
    }
    return null;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[languageStorage] Failed to load language preference', error);
    return null;
  }
}

