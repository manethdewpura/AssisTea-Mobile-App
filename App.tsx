import React, { useState, useEffect } from 'react';
import { StatusBar, StyleSheet, View, ActivityIndicator, BackHandler, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { store } from './src/store';
import { selectAuth, selectTheme } from './src/store/selectors';
import { useAppSelector } from './src/hooks/redux.hooks';
import AuthListener from './src/store/listeners/AuthListener';
import ThemeListener from './src/store/listeners/ThemeListener';
import NotificationListener from './src/store/listeners/NotificationListener';
import WeatherListener from './src/store/listeners/WeatherListener';
import type { ThemeState } from './src/common/types';
import LoginScreen from './src/screens/auth/LoginScreen';
import SignUpScreen from './src/screens/auth/SignUpScreen';
import ForgotPasswordScreen from './src/screens/auth/ForgotPasswordScreen';
import MainNavigator from './src/components/organisms/MainNavigator';
import PlantationSetupModal from './src/components/organisms/PlantationSetupModal';
import ErrorBoundary from './src/components/ErrorBoundary';
import NetworkStatus from './src/components/molecule/NetworkStatus';
import { initBackgroundFetch } from './src/utils';

function App() {
  // Initialize background fetch when app starts
  useEffect(() => {
    initBackgroundFetch();
  }, []);

  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <ThemeListener>
          <NotificationListener>
            <AuthListener>
              <WeatherListener>
                <ErrorBoundary>
                  <AppContent />
                </ErrorBoundary>
              </WeatherListener>
            </AuthListener>
          </NotificationListener>
        </ThemeListener>
      </Provider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { user, userProfile, loading } = useAppSelector(selectAuth);
  const theme = useAppSelector(selectTheme) as ThemeState;
  const { isDark, colors } = theme;
  const [authScreen, setAuthScreen] = useState<'login' | 'signup' | 'forgot'>('login');
  const [showPlantationSetup, setShowPlantationSetup] = useState(false);

  useEffect(() => {
    const backAction = () => {
      if (user && userProfile) {
        // If user is logged in, show exit confirmation
        Alert.alert(
          'Exit App',
          'Are you sure you want to exit the app?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() }
          ]
        );
        return true; // Prevent default behavior
      } else if (authScreen === 'signup' || authScreen === 'forgot') {
        // If on sign up or forgot password screen, go back to login
        setAuthScreen('login');
        return true; // Prevent default behavior
      }
      // If on login screen and not logged in, allow default behavior (exit app)
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [user, userProfile, authScreen]);

  // Show plantation setup modal for admins without plantation information
  useEffect(() => {
    if (user && userProfile && userProfile.role === 'admin' && !userProfile.plantationId) {
      setShowPlantationSetup(true);
    }
  }, [user, userProfile]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }


  if (user && userProfile) {
    // Route based on user role
    if (userProfile.role === 'admin') {
      return (
        <View style={styles.container}>
          <NetworkStatus />
          <MainNavigator userRole="admin" />
          <PlantationSetupModal
            visible={showPlantationSetup}
            onClose={() => setShowPlantationSetup(false)}
            onSuccess={() => setShowPlantationSetup(false)}
          />
        </View>
      );
    } else if (userProfile.role === 'tea_plantation_manager') {
      return (
        <View style={styles.container}>
          <NetworkStatus />
          <MainNavigator userRole="tea_plantation_manager" />
        </View>
      );
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <NetworkStatus />
      {authScreen === 'login' && (
        <LoginScreen
          onSwitchToSignUp={() => setAuthScreen('signup')}
          onSwitchToForgotPassword={() => setAuthScreen('forgot')}
        />
      )}
      {authScreen === 'signup' && (
        <SignUpScreen onSwitchToLogin={() => setAuthScreen('login')} />
      )}
      {authScreen === 'forgot' && (
        <ForgotPasswordScreen onSwitchToLogin={() => setAuthScreen('login')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
