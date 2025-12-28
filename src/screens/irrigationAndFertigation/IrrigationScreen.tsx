import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSelector } from '../../hooks';
import { selectAuth, selectTheme } from '../../store/selectors';
import OptionCard from '../../components/molecule/OptionCard';
import type { IrrigationStackParamList } from '../../navigation/IrrigationNavigator';

type IrrigationScreenNavigationProp = NativeStackNavigationProp<
  IrrigationStackParamList,
  'IrrigationHome'
>;

const IrrigationScreen: React.FC = () => {
  const { colors } = useAppSelector(selectTheme);
  const { userProfile } = useAppSelector(selectAuth);
  const navigation = useNavigation<IrrigationScreenNavigationProp>();

  const isAdmin = userProfile?.role === 'admin';

  const handleControlsPress = () => {
    navigation.navigate('IrrigationControls');
  };

  const handleSetupPress = () => {
    navigation.navigate('IrrigationSetup');
  };

  const handleActivityLogsPress = () => {
    navigation.navigate('ActivityLogs');
  };

  const handleSensorDataPress = () => {
    navigation.navigate('SensorData');
  };

  return (
    <View style={styles.fullContainer}>
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

          {/* Sensor Data */}
          <OptionCard
            icon="activity"
            title="Sensor Data"
            description="View real-time sensor readings and data"
            onPress={handleSensorDataPress}
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

