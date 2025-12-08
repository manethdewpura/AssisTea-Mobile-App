import type { RootState } from './index';
import type { ThemeState } from '../common/types';

export const selectAuth = (state: RootState) => state.auth;
export const selectTheme = (state: RootState): ThemeState =>
  state.theme as unknown as ThemeState;
export const selectNetwork = (state: RootState) => state.network;
export const selectNotifications = (state: RootState) => state.notifications;
export const selectWeather = (state: RootState) => state.weather;
export const selectAI = (state: RootState) => state.ai;
