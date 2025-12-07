import { WEATHER_API_KEY } from '@env';

export const WEATHER_API_CONFIG = {
  BASE_URL: 'https://api.openweathermap.org/data/2.5',
  API_KEY: WEATHER_API_KEY,
  DEFAULT_LAT: 6.308746,
  DEFAULT_LON: 80.418792,
  UNITS: 'metric',
  FETCH_INTERVAL: 3600000*3, // 3 hours in milliseconds
} as const;

export const WEATHER_ENDPOINTS = {
  CURRENT: '/weather',
  FORECAST: '/forecast',
} as const;





