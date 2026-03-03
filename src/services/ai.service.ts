import { NativeModules, Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getAI, getGenerativeModel } from '@react-native-firebase/ai';
import type { MessageSource, Language } from '../store/slices/ai.slice';

const { AgronomistAI } = NativeModules;

export interface RelevantEntry {
  question: string;
  answer: string;
  similarity: number;
}

const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  si: 'Sinhala',
  ta: 'Tamil',
};

export interface AIResponse {
  answer: string;
  source: MessageSource;
  confidence: number;
  question?: string;
  language: Language;
}

export interface AIModelStatus {
  loaded: boolean;
}

class AIService {
  /**
   * Check if the native module is available
   */
  private isModuleAvailable(): boolean {
    return Platform.OS === 'android' && AgronomistAI != null;
  }

  /**
   * Check if the ML model is loaded
   */
  async checkModelLoaded(): Promise<boolean> {
    if (!this.isModuleAvailable()) {
      console.warn('AgronomistAI native module not available');
      return false;
    }

    try {
      const result: AIModelStatus = await AgronomistAI.checkModelLoaded();
      return result.loaded || false;
    } catch (error) {
      console.error('Error checking model status:', error);
      return false;
    }
  }

  /**
   * Initialize the ML model (lazy loading)
   */
  async initializeModel(): Promise<{ success: boolean; error?: string }> {
    if (!this.isModuleAvailable()) {
      return { success: false, error: 'Native module not available' };
    }

    try {
      const result = await AgronomistAI.initializeModel();
      return { success: result.success || false, error: result.error };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Query the offline knowledge base
   */
  async queryOffline(
    query: string,
    language: Language = 'en',
  ): Promise<AIResponse> {
    if (!this.isModuleAvailable()) {
      throw new Error('Native module not available');
    }

    try {
      const result: AIResponse = await AgronomistAI.queryOffline(
        query,
        language,
      );
      return result;
    } catch (error: any) {
      // React Native native module errors can come in different formats
      // Check for language mismatch error - the message should contain the localized text
      const errorMessage = error?.message || error?.userInfo?.message || 
                          (error instanceof Error ? error.message : 'Unknown error');
      
      // Check if it's a language mismatch error by checking the error code or message content
      if (error?.code === 'LANGUAGE_MISMATCH' || 
          errorMessage.includes('appears to be in') ||
          errorMessage.includes('ඔබගේ ප්‍රශ්නය') ||
          errorMessage.includes('உங்கள் வினா')) {
        // Return the error message directly (it already contains the localized message)
        throw new Error(errorMessage);
      }
      
      throw new Error(`Offline query failed: ${errorMessage}`);
    }
  }

  /**
   * Retrieve top 3-5 relevant entries from the knowledge base (similarity >= 50%).
   * Returns empty array if native module unavailable (e.g. on iOS) or no matches.
   */
  async retrieveRelevantEntries(
    query: string,
    language: Language = 'en',
  ): Promise<RelevantEntry[]> {
    if (!this.isModuleAvailable() || !query?.trim()) {
      return [];
    }
    try {
      const result = await AgronomistAI.retrieveRelevantEntries(
        query.trim(),
        language,
      );
      return Array.isArray(result)
        ? result.map((e: { question: string; answer: string; similarity: number }) => ({
            question: e.question,
            answer: e.answer,
            similarity: Number(e.similarity) || 0,
          }))
        : [];
    } catch (error: any) {
      const errorMessage =
        error?.message ||
        error?.userInfo?.message ||
        (error instanceof Error ? error.message : 'Unknown error');

      // Surface language mismatch errors so the UI can show the same warning as offline mode
      if (
        error?.code === 'LANGUAGE_MISMATCH' ||
        errorMessage.includes('appears to be in') ||
        errorMessage.includes('ඔබගේ ප්‍රශ්නය') ||
        errorMessage.includes('உங்கள் வினா')
      ) {
        throw new Error(errorMessage);
      }

      return [];
    }
  }

  /**
   * Query online Gemini via Firebase Vertex AI.
   * Retrieves top relevant entries, builds prompt, and generates farmer-friendly answer.
   */
  async queryOnline(
    query: string,
    language: Language = 'en',
  ): Promise<AIResponse> {
    const entries = await this.retrieveRelevantEntries(query, language);
    const hasMatches = entries.length > 0;
    const langName = LANGUAGE_NAMES[language];

    let systemPrompt =
      'You are a Sri Lankan tea agronomy assistant. Provide answers using the knowledge base provided.';
    if (hasMatches) {
      systemPrompt +=
        '\n\nRelevant Knowledge Base:\n' +
        entries
          .map(
            (e, i) =>
              `${i + 1}. Q: ${e.question}\n   A: ${e.answer}`,
          )
          .join('\n\n');
    } else {
      systemPrompt +=
        "\n\nNote: No matching knowledge base entries found. Provide a helpful answer and include this disclaimer at the end: 'Generated by AI, might not be accurate.'";
    }

    const userPrompt = `User Question:\n${query}\n\nProvide a farmer-friendly answer in ${langName} but do not exaggerate or provide false information or make things too friendly just give an direct answer.`;

    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    try {
      const app = getApp();
      const ai = getAI(app);
      const model = getGenerativeModel(ai, { model: 'gemini-2.5-flash' });
      const result = await model.generateContent(fullPrompt);
      const answer = result.response.text();
      return {
        answer: answer?.trim() || 'No response from model.',
        source: 'online',
        confidence: hasMatches ? 1.0 : 0.5,
        language,
      };
    } catch (error: any) {
      const errorMessage =
        error?.message ||
        error?.userInfo?.message ||
        (error instanceof Error ? error.message : 'Unknown error');

      // Preserve localized language-mismatch warning (same behavior as offline)
      if (
        error?.code === 'LANGUAGE_MISMATCH' ||
        errorMessage.includes('appears to be in') ||
        errorMessage.includes('ඔබගේ ප්‍රශ්නය') ||
        errorMessage.includes('உங்கள் வினா')
      ) {
        throw new Error(errorMessage);
      }

      throw new Error(`Online query failed: ${errorMessage}`);
    }
  }
}

export const aiService = new AIService();

