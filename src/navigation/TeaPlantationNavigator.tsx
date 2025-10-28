import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TeaPlantationManagerScreen from '../screens/teaPlantationManager/TeaPlantationManagerScreen';
import WorkerManagementScreen from '../screens/teaPlantationManager/WorkerManagementScreen';
import AddWorkerScreen from '../screens/teaPlantationManager/AddWorkerScreen';

export type TeaPlantationStackParamList = {
  TeaPlantationHome: undefined;
  WorkerManagement: undefined;
  AddWorker: undefined;
  WorkerDetails?: { workerId: string };
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
        name="AddWorker"
        component={AddWorkerScreen}
      />
    </Stack.Navigator>
  );
};
