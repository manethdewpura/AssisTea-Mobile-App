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
  const intervalRef = useRef<number | null>(null);
  const backendCheckIntervalRef = useRef<number | null>(null);

  // Fetch weather data
  const fetchWeatherData = useCallback(async () => {
    try {
      dispatch(setFetching(true));
      const data = await weatherService.fetchAllWeatherData(location);
      dispatch(setWeatherData(data));

      // If backend is connected, sync data to SQLite database
      if (isBackendConnected) {
        try {
          console.log('Syncing weather data to backend SQLite database...');
          const syncResult = await backendService.syncAllWeatherData(data.current, data.forecast);
          console.log('Weather data synced to SQLite:', syncResult);
        } catch (syncError: any) {
          // Log sync error but don't fail the fetch
          console.warn('Failed to sync weather data to backend SQLite:', syncError?.message || syncError);
          // Optionally update backend connection status if sync fails repeatedly
          if (syncError?.message?.includes('Failed to sync')) {
            console.warn('Backend may be disconnected, will retry on next check');
          }
        }
      } else {
        console.log('Backend not connected, skipping SQLite sync');
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
      const isConnected = await backendService.checkBackendConnection();
      dispatch(setBackendConnected(isConnected));
    } catch (error) {
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

