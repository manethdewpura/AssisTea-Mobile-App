import * as Keychain from 'react-native-keychain';
import { AppError } from '../utils/errorHandling.util';
import { apiClient } from '../utils/apiClient.util';
import { handleFirebaseError, logError } from '../utils/errorHandling.util';

const BACKEND_URL_SERVICE = 'assistea_backend_url';
const KEYCHAIN_OPTIONS = {
  service: BACKEND_URL_SERVICE,
};

/**
 * Validates if a URL is properly formatted
 */
export function validateUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Remove trailing slash
  const trimmedUrl = url.trim().replace(/\/$/, '');

  // Basic URL validation
  try {
    const urlObj = new URL(trimmedUrl);
    // Only allow http and https protocols
    return (urlObj as any).protocol === 'http:' || (urlObj as any).protocol === 'https:';
  } catch {
    // If URL parsing fails, check if it's a valid IP address or hostname format
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
    const ipPattern = /^(https?:\/\/)?(\d{1,3}\.){3}\d{1,3}(:\d+)?$/;
    return urlPattern.test(trimmedUrl) || ipPattern.test(trimmedUrl);
  }
}

/**
 * Normalizes URL by ensuring it has http:// or https:// prefix
 */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

export const configService = {
  /**
   * Get the backend URL from secure keychain storage
   */
  async getBackendUrl(): Promise<string | null> {
    try {
      const credentials = await Keychain.getGenericPassword(KEYCHAIN_OPTIONS);
      if (credentials) {
        return credentials.password; // password field stores the URL
      }
      return null;
    } catch (error) {
      console.warn('Failed to get backend URL from keychain:', error);
      return null;
    }
  },

  /**
   * Set and save the backend URL (encrypted in keychain)
   */
  async setBackendUrl(url: string): Promise<void> {
    try {
      if (!validateUrl(url)) {
        throw new AppError(
          'Invalid URL format',
          'INVALID_URL',
          'low',
          true,
          'Please enter a valid URL (e.g., http://192.168.1.15 or https://example.com)'
        );
      }

      const normalizedUrl = normalizeUrl(url);
      await Keychain.setGenericPassword(
        'backend_url', // username (required but not used)
        normalizedUrl, // password field stores the URL
        KEYCHAIN_OPTIONS
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'Failed to save backend URL',
        'STORAGE_ERROR',
        'high',
        true,
        'Failed to save backend configuration. Please try again.'
      );
    }
  },

  /**
   * Remove the backend URL from keychain
   */
  async clearBackendUrl(): Promise<void> {
    try {
      await Keychain.resetGenericPassword(KEYCHAIN_OPTIONS);
    } catch (error) {
      console.warn('Failed to clear backend URL from keychain:', error);
    }
  },

  /**
   * Mask URL for display (shows only first few and last few characters)
   */
  maskUrl(url: string): string {
    if (!url) return '';
    if (url.length <= 20) return url;
    const start = url.substring(0, 12);
    const end = url.substring(url.length - 8);
    return `${start}...${end}`;
  },

  /**
   * Get zone configuration information (read-only)
   */
  async getZoneInfo(): Promise<{
    zone_id: number;
    valve_gpio_pin: number;
    soil_moisture_sensor_channel: number;
    altitude: number;
    slope: number;
    area: number;
    base_pressure: number;
  }> {
    try {
      const response = await apiClient.get<{
        zone: {
          zone_id: number;
          valve_gpio_pin: number;
          soil_moisture_sensor_channel: number;
          altitude: number;
          slope: number;
          area: number;
          base_pressure: number;
        };
      }>('/system/zone-info');

      if (!response.success) {
        throw new Error(response.error || 'Failed to get zone information');
      }

      return response.zone || response.data?.zone;
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'configService - getZoneInfo');
      throw appError;
    }
  },
};
