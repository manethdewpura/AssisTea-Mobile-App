import React, { useState, useEffect, useRef } from 'react';
import { StatusBar, StyleSheet, View, ActivityIndicator, BackHandler, Alert, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { store } from './src/store';
import { selectAuth, selectTheme } from './src/store/selectors';
import { useAppSelector } from './src/hooks/redux.hooks';
import AuthListener from './src/store/listeners/AuthListener';
import NetworkListener from './src/store/listeners/NetworkListener';
import ThemeListener from './src/store/listeners/ThemeListener';
import NotificationListener from './src/store/listeners/NotificationListener';
import WeatherListener from './src/store/listeners/WeatherListener';
import ConfigListener from './src/store/listeners/ConfigListener';
import type { ThemeState } from './src/common/types';
import LoginScreen from './src/screens/auth/LoginScreen';
import SignUpScreen from './src/screens/auth/SignUpScreen';
import ForgotPasswordScreen from './src/screens/auth/ForgotPasswordScreen';
import MainNavigator from './src/components/organisms/MainNavigator';
import TopNavbar from './src/components/organisms/TopNavbar';
import PlantationSetupModal from './src/components/organisms/PlantationSetupModal';
import HamburgerMenu from './src/components/organisms/HamburgerMenu';
import ErrorBoundary from './src/components/ErrorBoundary';
import NetworkStatus from './src/components/molecule/NetworkStatus';
import { initBackgroundFetch } from './src/utils';
import { I18nextProvider } from 'react-i18next';
import i18n, { initializeI18n } from './src/common/config/i18n';
import { useAppDispatch } from './src/hooks';
import { setLanguage } from './src/store/slices/ai.slice';
import type { Language } from './src/store/slices/ai.slice';
import { loadLanguagePreference } from './src/common/utils/languageStorage';
import { NotificationsScreenContent } from './src/screens/NotificationsScreen';

export const navigationRef = createNavigationContainerRef();
const { width: screenWidth } = Dimensions.get('window');

function App() {
  const [i18nInstance, setI18nInstance] = useState<Awaited<ReturnType<typeof initializeI18n>> | null>(null);

  useEffect(() => {
    loadLanguagePreference().then(async stored => {
      const instance = await initializeI18n(stored ?? undefined);
      setI18nInstance(instance);
    });
  }, []);

  if (!i18nInstance) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <I18nextProvider i18n={i18nInstance}>
          <AppBootstrap />
        </I18nextProvider>
      </Provider>
    </SafeAreaProvider>
  );
}

function AppBootstrap() {
  const dispatch = useAppDispatch();

  // Initialize background fetch when app starts
  useEffect(() => {
    initBackgroundFetch();
  }, []);

  // Load stored language preference (if any) and ensure Redux + i18n use the same initial language.
  useEffect(() => {
    const normalizeToSupportedLanguage = (lang: string | null | undefined): Language | null => {
      if (!lang) return null;
      const base = lang.split('-')[0];
      if (base === 'en' || base === 'si' || base === 'ta') return base as Language;
      return null;
    };

    const syncLanguage = async () => {
      const storedLanguage = await loadLanguagePreference();
      const normalizedStored = normalizeToSupportedLanguage(storedLanguage ?? undefined);
      const normalizedI18n = normalizeToSupportedLanguage(i18n.language);
      const effectiveLanguage = normalizedStored ?? normalizedI18n ?? 'en';
      dispatch(setLanguage(effectiveLanguage));
      if (i18n.language !== effectiveLanguage) {
        await i18n.changeLanguage(effectiveLanguage);
      }
    };

    syncLanguage();
  }, [dispatch]);

  return (
    <NetworkListener>
      <ThemeListener>
        <ConfigListener>
          <NotificationListener>
            <AuthListener>
              <WeatherListener>
                <ErrorBoundary>
                  <AppContent />
                </ErrorBoundary>
              </WeatherListener>
            </AuthListener>
          </NotificationListener>
        </ConfigListener>
      </ThemeListener>
    </NetworkListener>
  );
}

function AppContent() {
  const { user, userProfile, loading } = useAppSelector(selectAuth);
  const theme = useAppSelector(selectTheme) as ThemeState;
  const { isDark, colors } = theme;
  const [authScreen, setAuthScreen] = useState<'login' | 'signup' | 'forgot'>('login');
  const [showPlantationSetup, setShowPlantationSetup] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  
  // Animation refs for notifications
  const notificationsSlideAnim = useRef(new Animated.Value(screenWidth)).current;
  const notificationsFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const backAction = () => {
      if (navigationRef.isReady() && navigationRef.canGoBack()) {
        navigationRef.goBack();
        return true;
      }

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

  // Animate notifications screen
  useEffect(() => {
    if (showNotifications) {
      // Animate both screen and overlay together
      Animated.parallel([
        Animated.timing(notificationsSlideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(notificationsFadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset animations when hidden
      Animated.parallel([
        Animated.timing(notificationsSlideAnim, {
          toValue: screenWidth,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(notificationsFadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showNotifications, notificationsSlideAnim, notificationsFadeAnim]);

  const handleCloseNotifications = () => {
    // Animate both screen and overlay out together
    Animated.parallel([
      Animated.timing(notificationsSlideAnim, {
        toValue: screenWidth,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(notificationsFadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowNotifications(false);
    });
  };

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
          <TopNavbar 
            onNotificationPress={() => setShowNotifications(true)}
            onMenuPress={() => setShowHamburgerMenu(true)}
          />
          {showNotifications && (
            <View style={styles.notificationsOverlay}>
              {/* Overlay backdrop */}
              <Animated.View
                style={[
                  styles.notificationsBackdrop,
                  {
                    opacity: notificationsFadeAnim,
                  },
                ]}
              >
                <View style={styles.backdropBlur} />
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={handleCloseNotifications}
                  style={styles.backdropTouchable}
                />
              </Animated.View>

              {/* Notifications Screen */}
              <Animated.View
                style={[
                  styles.notificationsContainer,
                  {
                    backgroundColor: colors.background,
                    transform: [{ translateX: notificationsSlideAnim }],
                  },
                ]}
              >
                <NotificationsScreenContent
                  onBackPress={handleCloseNotifications}
                />
              </Animated.View>
            </View>
          )}
          <NetworkStatus />
          <MainNavigator userRole="admin" navigationRef={navigationRef} />
          <PlantationSetupModal
            visible={showPlantationSetup}
            onClose={() => setShowPlantationSetup(false)}
            onSuccess={() => setShowPlantationSetup(false)}
          />
          <HamburgerMenu
            visible={showHamburgerMenu}
            onClose={() => setShowHamburgerMenu(false)}
          />
        </View>
      );
    } else if (userProfile.role === 'tea_plantation_manager') {
      return (
        <View style={styles.container}>
          <TopNavbar 
            onNotificationPress={() => setShowNotifications(true)}
            onMenuPress={() => setShowHamburgerMenu(true)}
          />
          {showNotifications && (
            <View style={styles.notificationsOverlay}>
              {/* Overlay backdrop */}
              <Animated.View
                style={[
                  styles.notificationsBackdrop,
                  {
                    opacity: notificationsFadeAnim,
                  },
                ]}
              >
                <View style={styles.backdropBlur} />
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={handleCloseNotifications}
                  style={styles.backdropTouchable}
                />
              </Animated.View>

              {/* Notifications Screen */}
              <Animated.View
                style={[
                  styles.notificationsContainer,
                  {
                    backgroundColor: colors.background,
                    transform: [{ translateX: notificationsSlideAnim }],
                  },
                ]}
              >
                <NotificationsScreenContent
                  onBackPress={handleCloseNotifications}
                />
              </Animated.View>
            </View>
          )}
          <NetworkStatus />
          <MainNavigator userRole="tea_plantation_manager" navigationRef={navigationRef} />
          <HamburgerMenu
            visible={showHamburgerMenu}
            onClose={() => setShowHamburgerMenu(false)}
          />
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
  notificationsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  notificationsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backdropBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  backdropTouchable: {
    ...StyleSheet.absoluteFillObject,
  },
  notificationsContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
});

export default App;
