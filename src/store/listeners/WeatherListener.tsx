import React, { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { selectWeather, selectNetwork } from '../selectors';
import {
  setFetching,
  setWeatherData,
  setError,
  setBackendConnected,
  setPredictions,
  setPredictionMode,
  clearPredictions,
  setCurrentWeather,
} from '../slices/weather.slice';
import { weatherService, backendService } from '../../services';
import { WEATHER_API_CONFIG } from '../../common/constants';
import NetInfo from '@react-native-community/netinfo';

interface WeatherListenerProps {
  children: React.ReactNode;
}

const WeatherListener: React.FC<WeatherListenerProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const { location, isBackendConnected } = useAppSelector(selectWeather);
  const { isOnline } = useAppSelector(selectNetwork);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backendCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const predictionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch ML predictions from backend (reachable on LAN even without internet)
  const fetchPredictions = useCallback(async () => {
    try {
      console.log('[WeatherListener] API unavailable - fetching ML predictions from backend LAN...');
      const result = await backendService.fetchMLPredictions();

      if (result.success && result.predictions.length > 0) {
        dispatch(setPredictions(result.predictions));
        dispatch(setPredictionMode(true));

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
        console.log('[WeatherListener] No ML predictions available from backend');
        dispatch(setError('Weather API unavailable and no ML predictions available'));
      }
    } catch (error: any) {
      console.warn('[WeatherListener] Failed to fetch ML predictions:', error?.message || error);
      dispatch(setError('Weather API and backend both unreachable'));
    }
  }, [dispatch]);

  // Fetch weather data from API - falls back to ML predictions if API fails
  const fetchWeatherData = useCallback(async () => {
    try {
      dispatch(setFetching(true));
      const data = await weatherService.fetchAllWeatherData(location);
      dispatch(setWeatherData(data));

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

      // API failed - fall back to ML predictions from backend (reachable on LAN)
      await fetchPredictions();

      // Set up periodic prediction polling (every 15 min) while API is down
      if (!predictionIntervalRef.current) {
        predictionIntervalRef.current = setInterval(() => {
          fetchPredictions();
        }, 15 * 60 * 1000);
      }
    } finally {
      dispatch(setFetching(false));
    }
  }, [dispatch, location, isBackendConnected, fetchPredictions]);

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

  // Set up backend connection checking (always runs, independent of internet)
  useEffect(() => {
    // Initial backend check
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
  }, [checkBackendConnection]);

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

      // Always check backend regardless of internet (it's on LAN)
      if (connected) {
        checkBackendConnection();
      }
    });

    return () => unsubscribe();
  }, [fetchWeatherData, checkBackendConnection]);

  return <>{children}</>;
};

export default WeatherListener;
