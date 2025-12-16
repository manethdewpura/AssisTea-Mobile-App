import React, { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { selectWeather, selectNetwork } from '../selectors';
import {
  setFetching,
  setWeatherData,
  setError,
  setBackendConnected,
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

  // Fetch weather data
  const fetchWeatherData = useCallback(async () => {
    try {
      dispatch(setFetching(true));
      const data = await weatherService.fetchAllWeatherData(location);
      dispatch(setWeatherData(data));

      // If backend is connected, sync data to SQLite database
      if (isBackendConnected) {
        try {
          console.log('[WeatherListener] Syncing weather data to backend...');

          // First, try to sync any queued data from AsyncStorage
          const { backgroundSyncService } = await import('../../services');
          const syncedCount = await backgroundSyncService.syncQueuedData();
          if (syncedCount > 0) {
            console.log(`[WeatherListener] Synced ${syncedCount} queued items from AsyncStorage`);
          }

          // Then sync current data
          const syncResult = await backendService.syncAllWeatherData(data.current, data.forecast);
          console.log('[WeatherListener] Current weather data synced to backend:', syncResult);
        } catch (syncError: any) {
          console.warn('[WeatherListener] Failed to sync to backend:', syncError?.message || syncError);

          // Queue data in AsyncStorage for later sync
          console.log('[WeatherListener] Queueing data in AsyncStorage for later sync');
          const { syncQueueService } = await import('../../services');
          await syncQueueService.addToQueue(data.current, data.forecast);
        }
      } else {
        // Backend not connected - queue data for later sync
        console.log('[WeatherListener] Backend not connected, queueing data in AsyncStorage');
        const { syncQueueService } = await import('../../services');
        await syncQueueService.addToQueue(data.current, data.forecast);

        // Log queue stats
        const stats = await syncQueueService.getStats();
        console.log(`[WeatherListener] Queue stats - Total: ${stats.total}, Unsynced: ${stats.unsynced}`);
      }
    } catch (error: any) {
      dispatch(setError(error.message || 'Failed to fetch weather data'));
    } finally {
      dispatch(setFetching(false));
    }
  }, [dispatch, location, isBackendConnected]);

  // Check backend connection
  const checkBackendConnection = useCallback(async () => {
    try {
      console.log('[WeatherListener] Checking backend connection...');
      const isConnected = await backendService.checkBackendConnection();
      console.log(`[WeatherListener] Backend connection status: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
      dispatch(setBackendConnected(isConnected));
    } catch (error) {
      console.error('[WeatherListener] Backend connection check failed:', error);
      dispatch(setBackendConnected(false));
    }
  }, [dispatch]);

  // Set up periodic fetching
  useEffect(() => {
    if (!isOnline) {
      // Clear interval if offline
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial fetch
    fetchWeatherData();

    // Set up interval for periodic fetching
    intervalRef.current = setInterval(() => {
      fetchWeatherData();
    }, WEATHER_API_CONFIG.FETCH_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchWeatherData, isOnline]);

  // Set up backend connection checking
  useEffect(() => {
    if (!isOnline) {
      dispatch(setBackendConnected(false));
      if (backendCheckIntervalRef.current) {
        clearInterval(backendCheckIntervalRef.current);
        backendCheckIntervalRef.current = null;
      }
      return;
    }

    // Initial backend check
    checkBackendConnection();

    // Check backend connection every 30 seconds
    backendCheckIntervalRef.current = setInterval(() => {
      checkBackendConnection();
    }, 30000);

    return () => {
      if (backendCheckIntervalRef.current) {
        clearInterval(backendCheckIntervalRef.current);
        backendCheckIntervalRef.current = null;
      }
    };
  }, [checkBackendConnection, isOnline, dispatch]);

  // Listen to network changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected ?? false;

      if (connected && isOnline) {
        // Network came back online, fetch data immediately
        fetchWeatherData();
        checkBackendConnection();
      }
    });

    return () => unsubscribe();
  }, [isOnline, fetchWeatherData, checkBackendConnection]);

  return <>{children}</>;
};

export default WeatherListener;

