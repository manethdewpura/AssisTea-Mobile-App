import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import IrrigationScreen from '../screens/irrigationAndFertigation/IrrigationScreen';
import IrrigationAndFertilizerControlsScreen from '../screens/irrigationAndFertigation/IrrigationAndFertilizerControlsScreen';
import IrrigationAndFertilizerSetupScreen from '../screens/irrigationAndFertigation/IrrigationAndFertilizerSetupScreen';
import ActivityLogsScreen from '../screens/irrigationAndFertigation/ActivityLogsScreen';
import SensorDataScreen from '../screens/irrigationAndFertigation/SensorDataScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import { databaseService } from '../services/database.service';

export type IrrigationStackParamList = {
  IrrigationHome: undefined;
  IrrigationControls: undefined;
  IrrigationSetup: undefined;
  ActivityLogs: undefined;
  SensorData: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<IrrigationStackParamList>();

export const IrrigationNavigator: React.FC = () => {
  // Initialize SQLite database when this navigator mounts
  useEffect(() => {
    const initDatabase = async () => {
      try {
        await databaseService.initialize();
        console.log('📱 SQLite database ready for irrigation features!');
      } catch (error) {
        console.error('❌ Failed to initialize database:', error);
      }
    };

    initDatabase();
  }, []);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#f5f5f5' },
        animation: 'default',
      }}
    >
      <Stack.Screen
        name="IrrigationHome"
        component={IrrigationScreen}
      />
      <Stack.Screen
        name="IrrigationControls"
        component={IrrigationAndFertilizerControlsScreen}
      />
      <Stack.Screen
        name="IrrigationSetup"
        component={IrrigationAndFertilizerSetupScreen}
      />
      <Stack.Screen
        name="ActivityLogs"
        component={ActivityLogsScreen}
      />
      <Stack.Screen
        name="SensorData"
        component={SensorDataScreen}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
      />
    </Stack.Navigator>
  );
};

