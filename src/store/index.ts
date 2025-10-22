import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/auth.slice';
import themeReducer from './slices/theme.slice';
import networkReducer from './slices/network.slice';
import notificationReducer from './slices/notification.slice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    theme: themeReducer,
    network: networkReducer,
    notifications: notificationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        ignoredActionPaths: ['meta.arg', 'payload.timestamp'],
        ignoredPaths: ['auth.userProfile.createdAt', 'auth.userProfile.lastLoginAt'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;


