export type ThemeColors = {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  text: string;
  textSecondary: string;
  border: string;
  inputBackground: string;
  buttonBackground: string;
  buttonText: string;
  error: string;
  success: string;
  warning: string;
  cardBackground: string;
  shadow: string;
};

export type ThemeMode = 'light' | 'dark' | 'system';

export type ThemeState = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
};
