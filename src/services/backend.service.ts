import { CurrentWeather, WeatherForecast, MLPrediction } from '../common/interfaces';
import { NetworkError } from '../utils/network.util';
import { configService } from './config.service';

/**
 * Get the backend base URL from the saved configuration.
 * Throws if no URL has been configured yet.
 */
async function getBaseUrl(): Promise<string> {
  const url = await configService.getBackendUrl();
  if (!url) {
    throw new NetworkError(
      'Backend URL not configured. Please set it in the Setup screen.'
    );
  }
  return url;
}

export interface BackendSyncResponse {
  success: boolean;
  message: string;
  syncedAt?: number;
}

export interface MLPredictionsResponse {
  success: boolean;
  message: string;
  current: CurrentWeather | null;
  best_confidence: number;
  predictions: MLPrediction[];
  prediction_count: number;
}

export const backendService = {
  /**
   * Check if backend is available and connected on LAN
   * Does NOT require internet - backend is on local network
   * Implements retry logic with exponential backoff for resilience
   */
  async checkBackendConnection(): Promise<boolean> {
    const maxRetries = 3;
    const timeoutMs = 10000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {


        // Create a timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), timeoutMs);
        });

        const baseUrl = await getBaseUrl();

        // Race between fetch and timeout
        const response = await Promise.race([
          fetch(`${baseUrl}/health`, {
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
   * Fetch ML predictions from backend when internet is unavailable
   */
  async fetchMLPredictions(): Promise<MLPredictionsResponse> {
    try {
      const timeoutMs = 10000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), timeoutMs);
      });

      const baseUrl = await getBaseUrl();

      const response = await Promise.race([
        fetch(`${baseUrl}/api/weather/predictions/latest`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }),
        timeoutPromise,
      ]);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Failed to fetch ML predictions: ${response.status}`,
        );
      }

      const result: MLPredictionsResponse = await response.json();
      return result;
    } catch (error: any) {
      console.error('[Backend] Error fetching ML predictions:', error?.message || error);
      throw error;
    }
  },

  /**
   * Sync current weather data to backend
   */
  async syncCurrentWeather(
    weatherData: CurrentWeather,
  ): Promise<BackendSyncResponse> {
    try {
      const baseUrl = await getBaseUrl();
      const response = await fetch(`${baseUrl}/api/weather/current`, {
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
      const baseUrl = await getBaseUrl();
      const response = await fetch(`${baseUrl}/api/weather/forecast`, {
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
      const baseUrl = await getBaseUrl();
      const response = await fetch(`${baseUrl}/api/weather/sync`, {
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
        let errorBody = '';
        try {
          const errorData = await response.json();
          errorBody = JSON.stringify(errorData);
          console.warn(
            `[Backend] syncAllWeatherData failed - Status: ${response.status}, Body:`,
            errorData,
          );
        } catch {
          console.warn(
            `[Backend] syncAllWeatherData failed - Status: ${response.status} ${response.statusText}`,
          );
        }

        // Include status code in error message
        // 4xx = client error (non-retriable), 5xx = server error (maybe retriable)
        const error = new NetworkError(
          `Failed to sync weather data: ${response.status} ${response.statusText}` +
          (errorBody ? ` - ${errorBody}` : ''),
        );
        (error as any).statusCode = response.status;
        throw error;
      }

      const result: BackendSyncResponse = await response.json();
      return result;
    } catch (error) {
      if (error instanceof NetworkError) {
        throw error;
      }
      // True network failure (fetch itself threw — no response at all)
      console.error('[Backend] syncAllWeatherData network failure:', error);
      const networkError = new NetworkError('Failed to sync weather data to backend (network unreachable)');
      (networkError as any).isNetworkFailure = true;
      throw networkError;
    }
  },
};

