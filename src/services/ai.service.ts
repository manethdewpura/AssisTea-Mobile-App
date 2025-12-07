import { NativeModules, Platform } from 'react-native';
import type { MessageSource, Language } from '../store/slices/ai.slice';

const { AgronomistAI } = NativeModules;

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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Offline query failed: ${errorMessage}`);
    }
  }

  /**
   * Query online LLM (To-Do: Implement later)
   * This is kept as a placeholder for future implementation
   */
  async queryOnline(
    query: string,
    language: Language = 'en',
  ): Promise<AIResponse> {
    // TODO: Implement online query when LLMService is ready
    throw new Error('Online query not yet implemented');
    
    // Uncomment when ready:
    // if (!this.isModuleAvailable()) {
    //   throw new Error('Native module not available');
    // }
    // try {
    //   const result: AIResponse = await AgronomistAI.queryOnline(query, language);
    //   return result;
    // } catch (error) {
    //   const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    //   throw new Error(`Online query failed: ${errorMessage}`);
    // }
  }
}

export const aiService = new AIService();

