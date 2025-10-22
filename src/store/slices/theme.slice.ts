import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors } from '../../common/constants';
import { ThemeState, ThemeMode } from '../../common/types';

const THEME_STORAGE_KEY = '@assistea_theme_mode';

const initialState: ThemeState = {
  mode: 'system',
  isDark: false,
  colors: lightColors,
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setThemeMode(state, action: PayloadAction<ThemeMode>) {
      state.mode = action.payload;
    },
    setDarkMode(state, action: PayloadAction<boolean>) {
      state.isDark = action.payload;
      state.colors = action.payload ? darkColors : lightColors;
    },
    initializeTheme(
      state,
      action: PayloadAction<{ mode: ThemeMode; systemIsDark: boolean }>,
    ) {
      state.mode = action.payload.mode;

      // Determine if dark mode should be active
      let shouldBeDark = false;
      if (action.payload.mode === 'dark') {
        shouldBeDark = true;
      } else if (action.payload.mode === 'light') {
        shouldBeDark = false;
      } else {
        // system
        shouldBeDark = action.payload.systemIsDark;
      }

      state.isDark = shouldBeDark;
      state.colors = shouldBeDark ? darkColors : lightColors;
    },
  },
});

export const { setThemeMode, setDarkMode, initializeTheme } =
  themeSlice.actions;

// Helper function to load theme from storage
export const loadThemeFromStorage = async (): Promise<ThemeMode> => {
  try {
    const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    return (savedTheme as ThemeMode) || 'system';
  } catch (error) {
    console.warn('Failed to load theme from storage:', error);
    return 'system';
  }
};

// Helper function to save theme to storage
export const saveThemeToStorage = async (theme: ThemeMode): Promise<void> => {
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.warn('Failed to save theme to storage:', error);
  }
};

export default themeSlice.reducer;
