import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TeaPlantationManagerScreen from '../screens/teaPlantationManager/TeaPlantationManagerScreen';
import WorkerManagementScreen from '../screens/teaPlantationManager/WorkerManagementScreen';
import WorkerDetailsScreen from '../screens/teaPlantationManager/WorkerDetailsScreen';
import AddWorkerScreen from '../screens/teaPlantationManager/AddWorkerScreen';
import DailyDataEntryScreen from '../screens/teaPlantationManager/DailyDataEntryScreen';
import DailyDataViewScreen from '../screens/teaPlantationManager/DailyDataViewScreen';
import EditDailyDataScreen from '../screens/teaPlantationManager/EditDailyDataScreen';
import ViewLatestScheduleScreen from '../screens/teaPlantationManager/ViewLatestScheduleScreen';
import AssignmentGenerationScreen from '../screens/teaPlantationManager/AssignmentGenerationScreen';
import FieldManagementScreen from '../screens/teaPlantationManager/FieldManagementScreen';
import { databaseService } from '../services/database.service';

interface TeaPlantationNavigatorProps {
  onNavigateToWeather?: () => void;
}

export type TeaPlantationStackParamList = {
  TeaPlantationHome: undefined;
  WorkerManagement: undefined;
  WorkerDetails: { workerId: string };
  AddWorker: undefined;
  DailyDataEntry: undefined;
  DailyDataView: { workerId?: string } | undefined;
  EditDailyData: { dataId: string };
  ViewLatestSchedule: undefined;
  AssignmentGeneration: undefined;
  FieldManagement: undefined;
};

const Stack = createNativeStackNavigator<TeaPlantationStackParamList>();

export const TeaPlantationNavigator: React.FC<TeaPlantationNavigatorProps> = ({
  onNavigateToWeather,
}) => {
  // Initialize SQLite database when this navigator mounts
  useEffect(() => {
    const initDatabase = async () => {
      try {
        await databaseService.initialize();
        console.log('📱 SQLite database ready for tea plantation manager!');
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
        name="TeaPlantationHome"
        children={() => (
          <TeaPlantationManagerScreen onNavigateToWeather={onNavigateToWeather} />
        )}
      />
      <Stack.Screen
        name="WorkerManagement"
        component={WorkerManagementScreen}
      />
      <Stack.Screen
        name="WorkerDetails"
        component={WorkerDetailsScreen}
      />
      <Stack.Screen
        name="AddWorker"
        component={AddWorkerScreen}
      />
      <Stack.Screen
        name="DailyDataEntry"
        component={DailyDataEntryScreen}
      />
      <Stack.Screen
        name="DailyDataView"
        component={DailyDataViewScreen}
      />
      <Stack.Screen
        name="EditDailyData"
        component={EditDailyDataScreen}
      />
      <Stack.Screen
        name="ViewLatestSchedule"
        component={ViewLatestScheduleScreen}
      />
      <Stack.Screen
        name="AssignmentGeneration"
        component={AssignmentGenerationScreen}
      />
      <Stack.Screen
        name="FieldManagement"
        component={FieldManagementScreen}
        options={{ title: 'Field Management' }}
      />
    </Stack.Navigator>
  );
};
