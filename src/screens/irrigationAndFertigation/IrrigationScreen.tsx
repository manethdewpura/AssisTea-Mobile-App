import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSelector } from '../../hooks';
import { selectAuth, selectTheme } from '../../store/selectors';
import OptionCard from '../../components/molecule/OptionCard';
import type { IrrigationStackParamList } from '../../navigation/IrrigationNavigator';
import { useTranslation } from 'react-i18next';

type IrrigationScreenNavigationProp = NativeStackNavigationProp<
  IrrigationStackParamList,
  'IrrigationHome'
>;

const IrrigationScreen: React.FC = () => {
  const { colors } = useAppSelector(selectTheme);
  const { userProfile } = useAppSelector(selectAuth);
  const { t } = useTranslation('common');
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

  const handleSolenoidStatusPress = () => {
    navigation.navigate('SolenoidStatus');
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
            title={t('irrigation.controls_title')}
            description={t('irrigation.controls_desc')}
            onPress={handleControlsPress}
          />

          {/* Irrigation and Fertilizer Setup - Admin Only */}
          {isAdmin && (
            <OptionCard
              icon="settings"
              title={t('irrigation.setup_title')}
              description={t('irrigation.setup_desc')}
              onPress={handleSetupPress}
            />
          )}

          {/* Sensor Data */}
          <OptionCard
            icon="activity"
            title={t('irrigation.sensors_title')}
            description={t('irrigation.sensors_desc')}
            onPress={handleSensorDataPress}
          />

          {/* Solenoid Valve Status */}
          <OptionCard
            icon="circle"
            title={t('irrigation.solenoid_title')}
            description={t('irrigation.solenoid_desc')}
            onPress={handleSolenoidStatusPress}
          />

          {/* Activity Logs */}
          <OptionCard
            icon="file-text"
            title={t('irrigation.activity_logs_title')}
            description={t('irrigation.activity_logs_desc')}
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

