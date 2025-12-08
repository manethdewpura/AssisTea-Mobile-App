import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CurrentWeather, WeatherForecast, WeatherLocation } from '../../common/interfaces';

interface WeatherState {
  current: CurrentWeather | null;
  forecast: WeatherForecast | null;
  location: WeatherLocation;
  lastUpdated: number | null;
  isFetching: boolean;
  error: string | null;
  fetchInterval: number | null;
  isBackendConnected: boolean;
}

const initialState: WeatherState = {
  current: null,
  forecast: null,
  location: {
    lat: 6.308746,
    lon: 80.418792,
  },
  lastUpdated: null,
  isFetching: false,
  error: null,
  fetchInterval: null,
  isBackendConnected: false,
};

const weatherSlice = createSlice({
  name: 'weather',
  initialState,
  reducers: {
    setFetching(state, action: PayloadAction<boolean>) {
      state.isFetching = action.payload;
    },
    setCurrentWeather(state, action: PayloadAction<CurrentWeather>) {
      state.current = action.payload;
      state.lastUpdated = Date.now();
      state.error = null;
    },
    setWeatherForecast(state, action: PayloadAction<WeatherForecast>) {
      state.forecast = action.payload;
      state.error = null;
    },
    setWeatherData(
      state,
      action: PayloadAction<{
        current: CurrentWeather;
        forecast: WeatherForecast;
      }>,
    ) {
      state.current = action.payload.current;
      state.forecast = action.payload.forecast;
      state.lastUpdated = Date.now();
      state.error = null;
    },
    setLocation(state, action: PayloadAction<WeatherLocation>) {
      state.location = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.isFetching = false;
    },
    setFetchInterval(state, action: PayloadAction<number | null>) {
      state.fetchInterval = action.payload;
    },
    setBackendConnected(state, action: PayloadAction<boolean>) {
      state.isBackendConnected = action.payload;
    },
    resetWeather(state) {
      state.current = null;
      state.forecast = null;
      state.lastUpdated = null;
      state.error = null;
      state.isFetching = false;
    },
  },
});

export const {
  setFetching,
  setCurrentWeather,
  setWeatherForecast,
  setWeatherData,
  setLocation,
  setError,
  setFetchInterval,
  setBackendConnected,
  resetWeather,
} = weatherSlice.actions;

export default weatherSlice.reducer;





