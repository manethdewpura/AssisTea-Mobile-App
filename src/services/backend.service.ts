import { ensureNetworkConnection } from '../utils';
import { CurrentWeather, WeatherForecast } from '../common/interfaces';
import { NetworkError } from '../utils/network.util';

// Backend API configuration
// TODO: Update this URL when backend is deployed
const BACKEND_BASE_URL = 'http://192.168.1.4:5000'; // Flask backend URL on local network

export interface BackendSyncResponse {
  success: boolean;
  message: string;
  syncedAt?: number;
}

export const backendService = {
  /**
   * Check if backend is available and connected
   * Implements retry logic with exponential backoff for resilience
   */
  async checkBackendConnection(): Promise<boolean> {
    const maxRetries = 3;
    const timeoutMs = 10000; // Increased to 10 seconds for more reliable checks

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await ensureNetworkConnection();

        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), timeoutMs);
        });

        // Race between fetch and timeout
        const response = await Promise.race([
          fetch(`${BACKEND_BASE_URL}/health`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }),
          timeoutPromise,
        ]);

        if (response.ok) {
          return true;
        } else {
          console.warn(`Backend Health check failed with status: ${response.status}`);
        }
      } catch (error: any) {
        const errorMsg = error?.message || 'Unknown error';
        console.warn(`[Backend] Attempt ${attempt}/${maxRetries} failed: ${errorMsg}`);

        // If this was the last attempt, return false
        if (attempt === maxRetries) {
          return false;
        }

        // Exponential backoff: wait 1s, 2s, 4s between retries
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        await new Promise<void>(resolve => setTimeout(() => resolve(), delayMs));
      }
    }

    return false;
  },

  /**
   * Sync current weather data to backend
   */
  async syncCurrentWeather(
    weatherData: CurrentWeather,
  ): Promise<BackendSyncResponse> {
    try {
      await ensureNetworkConnection();

      const response = await fetch(`${BACKEND_BASE_URL}/weather/current`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: weatherData,
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new NetworkError(
          `Failed to sync current weather: ${response.status} ${response.statusText}`,
        );
      }

      const result: BackendSyncResponse = await response.json();
      return result;
    } catch (error) {
      if (error instanceof NetworkError) {
        throw error;
      }
      throw new NetworkError('Failed to sync current weather to backend');
    }
  },

  /**
   * Sync weather forecast data to backend
   */
  async syncWeatherForecast(
    forecastData: WeatherForecast,
  ): Promise<BackendSyncResponse> {
    try {
      await ensureNetworkConnection();

      const response = await fetch(`${BACKEND_BASE_URL}/weather/forecast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: forecastData,
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new NetworkError(
          `Failed to sync weather forecast: ${response.status} ${response.statusText}`,
        );
      }

      const result: BackendSyncResponse = await response.json();
      return result;
    } catch (error) {
      if (error instanceof NetworkError) {
        throw error;
      }
      throw new NetworkError('Failed to sync weather forecast to backend');
    }
  },

  /**
   * Sync both current weather and forecast to backend
   */
  async syncAllWeatherData(
    current: CurrentWeather,
    forecast: WeatherForecast,
  ): Promise<BackendSyncResponse> {
    try {
      await ensureNetworkConnection();

      const response = await fetch(`${BACKEND_BASE_URL}/weather/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current: current,
          forecast: forecast,
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new NetworkError(
          `Failed to sync weather data: ${response.status} ${response.statusText}`,
        );
      }

      const result: BackendSyncResponse = await response.json();
      return result;
    } catch (error) {
      if (error instanceof NetworkError) {
        throw error;
      }
      throw new NetworkError('Failed to sync weather data to backend');
    }
  },
};

