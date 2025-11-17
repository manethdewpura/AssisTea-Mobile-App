import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useAppSelector } from '../../hooks';
import { selectAuth, selectTheme } from '../../store/selectors';
import TopNavbar from '../../components/organisms/TopNavbar';
import NotificationsScreen from '../NotificationsScreen';
import OptionCard from '../../components/molecule/OptionCard';
import IrrigationAndFertilizerControlsScreen from './IrrigationAndFertilizerControlsScreen';
import IrrigationAndFertilizerSetupScreen from './IrrigationAndFertilizerSetupScreen';
import ActivityLogsScreen from './ActivityLogsScreen';

type ScreenType = 'main' | 'controls' | 'setup' | 'activityLogs' | 'notifications';

const IrrigationScreen: React.FC = () => {
  const { colors } = useAppSelector(selectTheme);
  const { userProfile } = useAppSelector(selectAuth);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('main');
  const [notificationCount] = useState(5); // Mock notification count

  const isAdmin = userProfile?.role === 'admin';

  // Show notifications screen if requested
  if (currentScreen === 'notifications') {
    return (
      <View style={styles.fullContainer}>
        <NotificationsScreen
          onBackPress={() => setCurrentScreen('main')}
        />
      </View>
    );
  }

  // Show Irrigation and Fertilizer Controls screen
  if (currentScreen === 'controls') {
    return (
      <View style={styles.fullContainer}>
        <IrrigationAndFertilizerControlsScreen
          onBackPress={() => setCurrentScreen('main')}
        />
      </View>
    );
  }

  // Show Irrigation and Fertilizer Setup screen
  if (currentScreen === 'setup') {
    return (
      <View style={styles.fullContainer}>
        <IrrigationAndFertilizerSetupScreen
          onBackPress={() => setCurrentScreen('main')}
        />
      </View>
    );
  }

  // Show Activity Logs screen
  if (currentScreen === 'activityLogs') {
    return (
      <View style={styles.fullContainer}>
        <ActivityLogsScreen
          onBackPress={() => setCurrentScreen('main')}
        />
      </View>
    );
  }

  const handleControlsPress = () => {
    setCurrentScreen('controls');
  };

  const handleSetupPress = () => {
    setCurrentScreen('setup');
  };

  const handleActivityLogsPress = () => {
    setCurrentScreen('activityLogs');
  };

  return (
    <View style={styles.fullContainer}>
      <TopNavbar
        onNotificationPress={() => setCurrentScreen('notifications')}
        unreadCount={notificationCount}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.optionsContainer}>
          {/* Irrigation and Fertilizer Controls */}
          <OptionCard
            icon="droplet"
            title="Irrigation and Fertilizer Controls"
            description="Manage and control irrigation systems and fertilizer applications"
            onPress={handleControlsPress}
          />

          {/* Irrigation and Fertilizer Setup - Admin Only */}
          {isAdmin && (
            <OptionCard
              icon="settings"
              title="Irrigation and Fertilizer Setup"
              description="Configure irrigation schedules and fertilizer plans"
              onPress={handleSetupPress}
            />
          )}

          {/* Activity Logs */}
          <OptionCard
            icon="file-text"
            title="Activity Logs"
            description="View history of irrigation and fertilizer activities"
            onPress={handleActivityLogsPress}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  optionsContainer: {
    // Spacing handled by OptionCard component
  },
});

export default IrrigationScreen;

