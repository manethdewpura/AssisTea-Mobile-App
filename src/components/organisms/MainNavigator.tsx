import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import BottomNavbar from './BottomNavbar';
import AdminDashboard from '../../screens/admin/AdminDashboard';
import { TeaPlantationNavigator } from '../../navigation/TeaPlantationNavigator';

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
          <TeaPlantationNavigator />
        );
    //   case 'watering':
    //     return < />;
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
          <TeaPlantationNavigator />
        );
    }
  };

  return (
    <NavigationContainer>
      <View style={styles.container}>
        <View style={styles.screenContainer}>{renderScreen()}</View>
        <BottomNavbar activeTab={activeTab} onTabChange={setActiveTab} />
      </View>
    </NavigationContainer>
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

