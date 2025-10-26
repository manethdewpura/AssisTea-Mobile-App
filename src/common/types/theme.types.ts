export type ThemeColors = {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  tertiary: string;
  text: string;
  textSecondary: string;
  textColored: string;
  textColoredSecondary: string;
  textInverse: string;
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
