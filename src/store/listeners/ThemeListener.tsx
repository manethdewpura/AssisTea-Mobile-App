import React, { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../hooks';
import {
  initializeTheme,
  loadThemeFromStorage,
  saveThemeToStorage,
} from '../slices';
import { selectTheme } from '../selectors';

const ThemeListener: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const dispatch = useAppDispatch();
  const systemColorScheme = useColorScheme();
  const { mode } = useAppSelector(selectTheme);

  useEffect(() => {
    const initializeThemeFromStorage = async () => {
      try {
        const savedMode = await loadThemeFromStorage();
        dispatch(
          initializeTheme({
            mode: savedMode,
            systemIsDark: systemColorScheme === 'dark',
          }),
        );
      } catch (error) {
        console.warn('Failed to initialize theme:', error);
        // Fallback to system theme
        dispatch(
          initializeTheme({
            mode: 'system',
            systemIsDark: systemColorScheme === 'dark',
          }),
        );
      }
    };

    initializeThemeFromStorage();
  }, [dispatch, systemColorScheme]);

  // Update theme when system color scheme changes (only if mode is 'system')
  useEffect(() => {
    if (mode === 'system') {
      dispatch(
        initializeTheme({
          mode: 'system',
          systemIsDark: systemColorScheme === 'dark',
        }),
      );
    }
  }, [dispatch, systemColorScheme, mode]);

  // Update theme when mode changes (for light/dark modes)
  useEffect(() => {
    if (mode === 'light' || mode === 'dark') {
      dispatch(
        initializeTheme({
          mode: mode,
          systemIsDark: systemColorScheme === 'dark',
        }),
      );
    }
  }, [dispatch, mode, systemColorScheme]);

  // Save theme mode to storage when it changes
  useEffect(() => {
    if (mode) {
      saveThemeToStorage(mode);
    }
  }, [mode]);

  return <>{children}</>;
};

export default ThemeListener;
