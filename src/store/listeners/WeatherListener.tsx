import React, { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { selectWeather, selectConfig } from '../selectors';
import {
  setFetching,
  setWeatherData,
  setError,
  setBackendConnected,
  setPredictions,
  setPredictionMode,
  setForecastFallbackMode,
  clearPredictions,
  setCurrentWeather,
  setWeatherForecast,
} from '../slices/weather.slice';
import { weatherService, backendService } from '../../services';
import { WEATHER_API_CONFIG } from '../../common/constants';
import { CurrentWeather, WeatherForecast } from '../../common/interfaces';
import NetInfo from '@react-native-community/netinfo';

interface WeatherListenerProps {
  children: React.ReactNode;
}

const WeatherListener: React.FC<WeatherListenerProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const { location, isBackendConnected } = useAppSelector(selectWeather);
  const { backendUrl, isInitialized: isConfigInitialized } = useAppSelector(selectConfig);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backendCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const predictionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getNearestForecastAsCurrent = (forecast: WeatherForecast): CurrentWeather | null => {
    if (!forecast?.list?.length) {
      return null;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const futureOrNow = forecast.list.filter(item => item.dt >= nowSec);

    // Prefer next upcoming slot; if none, use latest available past slot.
    const selected = futureOrNow.length > 0
      ? futureOrNow.reduce((closest, item) => (item.dt < closest.dt ? item : closest), futureOrNow[0])
      : forecast.list.reduce((latest, item) => (item.dt > latest.dt ? item : latest), forecast.list[0]);

    return {
      coord: {
        lat: forecast.city?.coord?.lat ?? 0,
        lon: forecast.city?.coord?.lon ?? 0,
      },
      weather: selected.weather ?? [],
      base: 'forecast_fallback',
      main: selected.main,
      visibility: selected.visibility ?? 10000,
      wind: selected.wind,
      clouds: selected.clouds,
      rain: selected.rain,
      snow: selected.snow,
      dt: selected.dt,
      sys: {
        country: forecast.city?.country ?? '',
        sunrise: forecast.city?.sunrise ?? 0,
        sunset: forecast.city?.sunset ?? 0,
      },
      timezone: forecast.city?.timezone ?? 0,
      id: forecast.city?.id ?? 0,
      name: forecast.city?.name ?? 'Unknown',
      cod: 200,
    };
  };

  // Fetch ML predictions from backend (reachable on LAN even without internet)
  const fetchPredictions = useCallback(async () => {
    if (!isConfigInitialized) {
      console.log('[WeatherListener] Config not initialized - skipping prediction fetch');
      return;
    }

    if (!backendUrl) {
      console.log('[WeatherListener] Backend URL not configured - cannot fetch predictions');
      dispatch(clearPredictions());
      dispatch(setForecastFallbackMode(false));
      dispatch(setError('Backend URL not configured. Please set it in Setup to enable local predictions.'));
      return;
    }

    try {
      console.log('[WeatherListener] API unavailable - fetching ML predictions from backend LAN...');
      const result = await backendService.fetchMLPredictions();

      if (result.success && result.current) {
        dispatch(setPredictions(result.predictions));
        dispatch(setPredictionMode(true));
        dispatch(setForecastFallbackMode(false));

        // Also set the best prediction as current weather for the main display
        if (result.current) {
          dispatch(setCurrentWeather(result.current));
        }

        dispatch(setError(null));
        console.log(
          `[WeatherListener] Loaded ${result.prediction_count} ML predictions ` +
          `(best confidence: ${(result.best_confidence * 100).toFixed(0)}%)`
        );
      } else {
        console.log('[WeatherListener] No ML predictions available, falling back to backend forecast');
        dispatch(clearPredictions());

        try {
          const forecastResult = await backendService.fetchLatestForecast();
          if (forecastResult.success && forecastResult.data) {
            dispatch(setWeatherForecast(forecastResult.data));
            const fallbackCurrent = getNearestForecastAsCurrent(forecastResult.data);
            if (fallbackCurrent) {
              dispatch(setCurrentWeather(fallbackCurrent));
            }
            dispatch(setForecastFallbackMode(true));
            dispatch(
              setError(
                'Weather API unavailable. Showing backend forecast fallback (next available slots).',
              ),
            );
          } else {
            dispatch(setForecastFallbackMode(false));
            dispatch(setError('Weather API unavailable and no ML predictions available'));
          }
        } catch {
          dispatch(setForecastFallbackMode(false));
          dispatch(setError('Weather API unavailable and no ML predictions available'));
        }
      }
    } catch (error: any) {
      console.warn('[WeatherListener] Failed to fetch ML predictions:', error?.message || error);
      dispatch(clearPredictions());
      try {
        const forecastResult = await backendService.fetchLatestForecast();
        if (forecastResult.success && forecastResult.data) {
          dispatch(setWeatherForecast(forecastResult.data));
          const fallbackCurrent = getNearestForecastAsCurrent(forecastResult.data);
          if (fallbackCurrent) {
            dispatch(setCurrentWeather(fallbackCurrent));
          }
          dispatch(setForecastFallbackMode(true));
          dispatch(
            setError(
              'ML predictions unavailable. Showing backend forecast fallback.',
            ),
          );
          return;
        }
      } catch {
        // Fall through to default error
      }
      dispatch(setForecastFallbackMode(false));
      dispatch(setError('Weather API and backend predictions are unreachable'));
    }
  }, [dispatch, backendUrl, isConfigInitialized]);

  // Fetch weather data from API - falls back to ML predictions if API fails
  const fetchWeatherData = useCallback(async () => {
    try {
      dispatch(setFetching(true));
      const data = await weatherService.fetchAllWeatherData(location);
      dispatch(setWeatherData(data));
      dispatch(setForecastFallbackMode(false));

      // API succeeded - clear prediction mode since we have live data
      dispatch(clearPredictions());

      // Clear any prediction polling interval since API is working
      if (predictionIntervalRef.current) {
        clearInterval(predictionIntervalRef.current);
        predictionIntervalRef.current = null;
      }

      // If backend is connected, sync data
      if (isBackendConnected) {
        try {
          const { backgroundSyncService } = await import('../../services');
          const syncedCount = await backgroundSyncService.syncQueuedData();
          if (syncedCount > 0) {
            console.log(`[WeatherListener] Synced ${syncedCount} queued items from database`);
          }
          const syncResult = await backendService.syncAllWeatherData(data.current, data.forecast);
          console.log('[WeatherListener] Current weather data synced to backend:', syncResult);
        } catch (syncError: any) {
          console.warn('[WeatherListener] Failed to sync to backend:', syncError?.message || syncError);
          const { syncQueueService } = await import('../../services');
          await syncQueueService.addToQueue(data.current, data.forecast);
        }
      } else {
        const { syncQueueService } = await import('../../services');
        await syncQueueService.addToQueue(data.current, data.forecast);
        const stats = await syncQueueService.getStats();
        console.log(`[WeatherListener] Queue stats - Total: ${stats.total}, Unsynced: ${stats.unsynced}`);
      }
    } catch (error: any) {
      console.warn('[WeatherListener] Weather API fetch failed:', error?.message || error);

      // API failed - fall back to ML predictions from backend
      // but only if backend URL is configured.
      if (isConfigInitialized && backendUrl) {
        await fetchPredictions();

        // Set up periodic prediction polling (every 15 min) while API is down
        if (!predictionIntervalRef.current) {
          predictionIntervalRef.current = setInterval(() => {
            fetchPredictions();
          }, 15 * 60 * 1000);
        }
      } else {
        dispatch(clearPredictions());
        dispatch(setForecastFallbackMode(false));
        dispatch(
          setError(
            'Weather API unavailable. Configure the backend URL in Setup to enable local predictions.',
          ),
        );
      }
    } finally {
      dispatch(setFetching(false));
    }
  }, [dispatch, location, isBackendConnected, fetchPredictions, backendUrl, isConfigInitialized]);

  // Check backend connection (always runs - backend is on LAN, not internet)
  const checkBackendConnection = useCallback(async () => {
    try {
      // Directly try to reach the backend on LAN, skip ensureNetworkConnection
      const isConnected = await backendService.checkBackendConnection();
      dispatch(setBackendConnected(isConnected));
    } catch (error) {
      console.error('[WeatherListener] Backend connection check failed:', error);
      dispatch(setBackendConnected(false));
    }
  }, [dispatch]);

  // Set up periodic weather fetching
  useEffect(() => {
    // Initial fetch
    fetchWeatherData();

    // Set up interval for periodic fetching (tries API first, falls back to predictions)
    intervalRef.current = setInterval(() => {
      fetchWeatherData();
    }, WEATHER_API_CONFIG.FETCH_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (predictionIntervalRef.current) {
        clearInterval(predictionIntervalRef.current);
        predictionIntervalRef.current = null;
      }
    };
  }, [fetchWeatherData]);

  // Set up backend connection checking (waits for config and reacts to backend URL)
  useEffect(() => {
    // Wait until configuration (including backend URL) has finished loading
    if (!isConfigInitialized) {
      return;
    }

    // If no backend URL is configured, explicitly mark as disconnected and skip checks
    if (!backendUrl) {
      dispatch(setBackendConnected(false));
      return;
    }

    // Backend URL exists; mark status as unknown while we re-check
    dispatch(setBackendConnected(null));

    // Initial backend check once URL is available
    checkBackendConnection();

    // Check backend connection every 5 minutes
    backendCheckIntervalRef.current = setInterval(() => {
      checkBackendConnection();
    }, 300000);

    return () => {
      if (backendCheckIntervalRef.current) {
        clearInterval(backendCheckIntervalRef.current);
        backendCheckIntervalRef.current = null;
      }
    };
  }, [checkBackendConnection, backendUrl, isConfigInitialized, dispatch]);

  // Listen to network changes - retry API immediately when network status changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? false;
      const internetReachable = state.isInternetReachable ?? false;

      if (connected && internetReachable) {
        // Internet came back - try API immediately
        console.log('[WeatherListener] Internet reachable - retrying weather API');
        fetchWeatherData();
      }

      // Only check backend if a URL has been configured
      if (connected && backendUrl) {
        checkBackendConnection();
      }
    });

    return () => unsubscribe();
  }, [fetchWeatherData, checkBackendConnection, backendUrl]);

  return <>{children}</>;
};

export default WeatherListener;
