import { ensureNetworkConnection } from '../utils';
import { CurrentWeather, WeatherForecast } from '../common/interfaces';
import { NetworkError } from '../utils/network.util';

// Backend API configuration
// TODO: Update this URL when backend is deployed
const BACKEND_BASE_URL = 'http://127.0.0.1:5000'; // Default Flask backend URL

export interface BackendSyncResponse {
  success: boolean;
  message: string;
  syncedAt?: number;
}

export const backendService = {
  /**
   * Check if backend is available and connected
   */
  async checkBackendConnection(): Promise<boolean> {
    try {
      await ensureNetworkConnection();
      
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 5000);
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

      return response.ok;
    } catch (error) {
      return false;
    }
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

