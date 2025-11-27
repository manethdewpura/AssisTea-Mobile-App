import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TeaPlantationManagerScreen from '../screens/teaPlantationManager/TeaPlantationManagerScreen';
import WorkerManagementScreen from '../screens/teaPlantationManager/WorkerManagementScreen';
import WorkerDetailsScreen from '../screens/teaPlantationManager/WorkerDetailsScreen';
import AddWorkerScreen from '../screens/teaPlantationManager/AddWorkerScreen';
import DailyDataEntryScreen from '../screens/teaPlantationManager/DailyDataEntryScreen';
import DailyDataViewScreen from '../screens/teaPlantationManager/DailyDataViewScreen';
import EditDailyDataScreen from '../screens/teaPlantationManager/EditDailyDataScreen';
import ViewLatestScheduleScreen from '../screens/teaPlantationManager/ViewLatestScheduleScreen';

export type TeaPlantationStackParamList = {
  TeaPlantationHome: undefined;
  WorkerManagement: undefined;
  WorkerDetails: { workerId: string };
  AddWorker: undefined;
  DailyDataEntry: undefined;
  DailyDataView: { workerId?: string } | undefined;
  EditDailyData: { dataId: string };
  ViewLatestSchedule: undefined;
};

const Stack = createNativeStackNavigator<TeaPlantationStackParamList>();

export const TeaPlantationNavigator: React.FC = () => {
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
        component={TeaPlantationManagerScreen}
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
    </Stack.Navigator>
  );
};
