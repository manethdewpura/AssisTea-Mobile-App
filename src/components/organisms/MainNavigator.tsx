import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import BottomNavbar from './BottomNavbar';
import AdminDashboard from '../../screens/admin/AdminDashboard';
import TeaPlantationManagerScreen from '../../screens/teaPlantationManager/TeaPlantationManagerScreen';
import IrrigationScreen from '../../screens/irrigationAndFertigation/IrrigationScreen';

type TabType = 'watering' | 'chat' | 'home' | 'schedule' | 'team';

interface MainNavigatorProps {
  userRole: 'admin' | 'tea_plantation_manager';
}

const MainNavigator: React.FC<MainNavigatorProps> = ({ userRole }) => {
  const [activeTab, setActiveTab] = useState<TabType>('home');

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return userRole === 'admin' ? (
          <AdminDashboard />
        ) : (
          <TeaPlantationManagerScreen />
        );
      case 'watering':
        return <IrrigationScreen />;
    //   case 'chat':
    //     return < />;
    //   case 'schedule':
    //     return < />;
    //   case 'team':
    //     return < />;
      default:
        return userRole === 'admin' ? (
          <AdminDashboard />
        ) : (
          <TeaPlantationManagerScreen />
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.screenContainer}>{renderScreen()}</View>
      <BottomNavbar activeTab={activeTab} onTabChange={setActiveTab} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
});

export default MainNavigator;

