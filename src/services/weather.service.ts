import {
  ensureNetworkConnection,
  handleFirebaseError,
  logError,
} from '../utils';
import { WEATHER_API_CONFIG, WEATHER_ENDPOINTS } from '../common/constants';
import {
  CurrentWeather,
  WeatherForecast,
  WeatherLocation,
} from '../common/interfaces';
import { NetworkError } from '../utils/network.util';

const buildWeatherUrl = (
  endpoint: string,
  lat: number,
  lon: number,
): string => {
  return `${WEATHER_API_CONFIG.BASE_URL}${endpoint}?lat=${lat}&lon=${lon}&appid=${WEATHER_API_CONFIG.API_KEY}&units=${WEATHER_API_CONFIG.UNITS}`;
};

export const weatherService = {
  async fetchCurrentWeather(
    location: WeatherLocation = {
      lat: WEATHER_API_CONFIG.DEFAULT_LAT,
      lon: WEATHER_API_CONFIG.DEFAULT_LON,
    },
  ): Promise<CurrentWeather> {
    try {
      await ensureNetworkConnection();

      const url = buildWeatherUrl(WEATHER_ENDPOINTS.CURRENT, location.lat, location.lon);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new NetworkError(
          `Failed to fetch current weather: ${response.status} ${response.statusText}`,
        );
      }

      const data: CurrentWeather = await response.json();
      return data;
    } catch (error) {
      if (error instanceof NetworkError) {
        throw error;
      }
      const appError = handleFirebaseError(error);
      logError(appError, 'weatherService - fetchCurrentWeather');
      throw appError;
    }
  },

  async fetchWeatherForecast(
    location: WeatherLocation = {
      lat: WEATHER_API_CONFIG.DEFAULT_LAT,
      lon: WEATHER_API_CONFIG.DEFAULT_LON,
    },
  ): Promise<WeatherForecast> {
    try {
      await ensureNetworkConnection();

      const url = buildWeatherUrl(WEATHER_ENDPOINTS.FORECAST, location.lat, location.lon);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new NetworkError(
          `Failed to fetch weather forecast: ${response.status} ${response.statusText}`,
        );
      }

      const data: WeatherForecast = await response.json();
      return data;
    } catch (error) {
      if (error instanceof NetworkError) {
        throw error;
      }
      const appError = handleFirebaseError(error);
      logError(appError, 'weatherService - fetchWeatherForecast');
      throw appError;
    }
  },

  async fetchAllWeatherData(
    location: WeatherLocation = {
      lat: WEATHER_API_CONFIG.DEFAULT_LAT,
      lon: WEATHER_API_CONFIG.DEFAULT_LON,
    },
  ): Promise<{ current: CurrentWeather; forecast: WeatherForecast }> {
    try {
      const [current, forecast] = await Promise.all([
        this.fetchCurrentWeather(location),
        this.fetchWeatherForecast(location),
      ]);

      return { current, forecast };
    } catch (error) {
      const appError = handleFirebaseError(error);
      logError(appError, 'weatherService - fetchAllWeatherData');
      throw appError;
    }
  },
};





