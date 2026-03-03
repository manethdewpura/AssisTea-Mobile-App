jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: jest.fn(),
  },
  NativeModules: {
    AgronomistAI: {
      checkModelLoaded: jest.fn(),
      initializeModel: jest.fn(),
      queryOffline: jest.fn(),
      queryOnline: jest.fn(),
    },
  },
}));

import { NativeModules, Platform } from 'react-native';
import type { AIResponse } from '../ai.service';
import { aiService } from '../ai.service';

const agronomistMock = NativeModules.AgronomistAI as unknown as {
  checkModelLoaded: jest.Mock;
  initializeModel: jest.Mock;
  queryOffline: jest.Mock;
  queryOnline: jest.Mock;
};

describe('AIService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure default platform is Android unless a test overrides it
    (Platform as any).OS = 'android';
  });

  describe('checkModelLoaded', () => {
    it('returns false and logs a warning when native module is not available (non-Android)', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      (Platform as any).OS = 'ios';

      const result = await aiService.checkModelLoaded();

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        'AgronomistAI native module not available',
      );
      warnSpy.mockRestore();
    });

    it('returns loaded flag from native module when available', async () => {
      agronomistMock.checkModelLoaded.mockResolvedValueOnce({ loaded: true });

      const result = await aiService.checkModelLoaded();

      expect(result).toBe(true);
      expect(agronomistMock.checkModelLoaded).toHaveBeenCalledTimes(1);
    });

    it('returns false when native check throws', async () => {
      const error = new Error('boom');
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      agronomistMock.checkModelLoaded.mockRejectedValueOnce(error);

      const result = await aiService.checkModelLoaded();

      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe('initializeModel', () => {
    it('returns failure when native module is not available (non-Android)', async () => {
      (Platform as any).OS = 'ios';

      const result = await aiService.initializeModel();

      expect(result).toEqual({
        success: false,
        error: 'Native module not available',
      });
    });

    it('returns success when native initialization succeeds', async () => {
      agronomistMock.initializeModel.mockResolvedValueOnce({ success: true });

      const result = await aiService.initializeModel();

      expect(result).toEqual({ success: true, error: undefined });
      expect(agronomistMock.initializeModel).toHaveBeenCalledTimes(1);
    });

    it('returns failure and propagates error message when native initialization fails', async () => {
      agronomistMock.initializeModel.mockResolvedValueOnce({
        success: false,
        error: 'model load failed',
      });

      const result = await aiService.initializeModel();

      expect(result).toEqual({ success: false, error: 'model load failed' });
    });

    it('returns failure when native initialization throws', async () => {
      agronomistMock.initializeModel.mockRejectedValueOnce(
        new Error('native boom'),
      );

      const result = await aiService.initializeModel();

      expect(result).toEqual({ success: false, error: 'native boom' });
    });
  });

  describe('queryOffline', () => {
    const baseResponse: AIResponse = {
      answer: 'Some answer',
      source: 'offline',
      confidence: 0.9,
      question: 'Q',
      language: 'en',
    };

    it('throws when native module is not available (non-Android)', async () => {
      (Platform as any).OS = 'ios';

      await expect(aiService.queryOffline('test question')).rejects.toThrow(
        'Native module not available',
      );
    });

    it('returns response from native module when successful', async () => {
      agronomistMock.queryOffline.mockResolvedValueOnce(baseResponse);

      const result = await aiService.queryOffline('test question', 'en');

      expect(result).toEqual(baseResponse);
      expect(agronomistMock.queryOffline).toHaveBeenCalledWith(
        'test question',
        'en',
      );
    });

    it('rethrows language mismatch errors with localized message (by code)', async () => {
      const error = Object.assign(new Error('Your question appears to be in X'), {
        code: 'LANGUAGE_MISMATCH',
      });
      agronomistMock.queryOffline.mockRejectedValueOnce(error);

      await expect(aiService.queryOffline('test question', 'en')).rejects.toThrow(
        'Your question appears to be in X',
      );
    });

    it('rethrows language mismatch errors detected by message contents (Sinhala)', async () => {
      const message = 'ඔබගේ ප්‍රශ්නය සිංහලෙන් පෙනේ';
      agronomistMock.queryOffline.mockRejectedValueOnce(new Error(message));

      await expect(aiService.queryOffline('test question', 'en')).rejects.toThrow(
        message,
      );
    });

    it('rethrows language mismatch errors detected by message contents (Tamil)', async () => {
      const message = 'உங்கள் வினா தமிழ் மொழியில் உள்ளது';
      agronomistMock.queryOffline.mockRejectedValueOnce(new Error(message));

      await expect(aiService.queryOffline('test question', 'en')).rejects.toThrow(
        message,
      );
    });

    it('wraps other errors with an Offline query failed prefix', async () => {
      agronomistMock.queryOffline.mockRejectedValueOnce(
        new Error('unexpected native error'),
      );

      await expect(aiService.queryOffline('test question', 'en')).rejects.toThrow(
        'Offline query failed: unexpected native error',
      );
    });
  });

  describe('queryOnline', () => {
    it('always throws not implemented error for now', async () => {
      await expect(aiService.queryOnline('anything')).rejects.toThrow(
        'Online query not yet implemented',
      );
    });
  });
});

