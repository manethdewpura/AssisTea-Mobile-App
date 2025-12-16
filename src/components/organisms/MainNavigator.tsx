import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import {
  NavigationContainer,
  type NavigatorScreenParams,
  type NavigationContainerRefWithCurrent,
  type ParamListBase,
} from '@react-navigation/native';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
  type BottomTabScreenProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Lucide } from '@react-native-vector-icons/lucide';
import AdminDashboard from '../../screens/admin/AdminDashboard';
import ChatScreen from '../../screens/ChatScreen';
import {
  TeaPlantationNavigator,
  type TeaPlantationStackParamList,
} from '../../navigation/TeaPlantationNavigator';
import ViewLatestScheduleScreen from '../../screens/teaPlantationManager/ViewLatestScheduleScreen';
import WorkerManagementScreen from '../../screens/teaPlantationManager/WorkerManagementScreen';
import AddWorkerScreen from '../../screens/teaPlantationManager/AddWorkerScreen';
import WorkerDetailsScreen from '../../screens/teaPlantationManager/WorkerDetailsScreen';
import WeatherScreen from '../../screens/weather/WeatherScreen';
import { useAppSelector } from '../../hooks';
import { selectTheme } from '../../store/selectors';

type HomeStackParamList = {
  AdminDashboard: undefined;
  TeaPlantationHome: undefined;
  Weather: undefined;
};

type MainTabParamList = {
  Watering: undefined;
  Chat: undefined;
  Home: NavigatorScreenParams<HomeStackParamList>;
  Schedule: undefined;
  Team: undefined;
};

interface MainNavigatorProps {
  userRole: 'admin' | 'tea_plantation_manager';
  navigationRef: NavigationContainerRefWithCurrent<ParamListBase>;
}

const Tab = createBottomTabNavigator<MainTabParamList>();
const TeamStack = createNativeStackNavigator<TeaPlantationStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();

const iconMap: Record<keyof MainTabParamList, string> = {
  Watering: 'droplet',
  Chat: 'message-square',
  Home: 'house',
  Schedule: 'calendar',
  Team: 'users',
};

type MainTabProps<RouteName extends keyof MainTabParamList> = BottomTabScreenProps<
  MainTabParamList,
  RouteName
>;

const AdminWateringTab: React.FC<MainTabProps<'Watering'>> = () => (
  <AdminDashboard />
);

const ManagerWateringTab: React.FC<MainTabProps<'Watering'>> = () => (
  <TeaPlantationNavigator />
);

const AdminHomeStack: React.FC<MainTabProps<'Home'>> = ({ navigation }) => (
  <HomeStack.Navigator screenOptions={{ headerShown: false }}>
    <HomeStack.Screen
      name="AdminDashboard"
      children={() => (
        <AdminDashboard
          onNavigateToWeather={() =>
            navigation.navigate('Home', { screen: 'Weather' })
          }
        />
      )}
    />
    <HomeStack.Screen
      name="Weather"
      children={({ navigation: homeNav }) => (
        <WeatherScreen onBackPress={() => homeNav.goBack()} />
      )}
    />
  </HomeStack.Navigator>
);

const ManagerHomeStack: React.FC<MainTabProps<'Home'>> = ({ navigation }) => (
  <HomeStack.Navigator screenOptions={{ headerShown: false }}>
    <HomeStack.Screen
      name="TeaPlantationHome"
      children={() => (
        <TeaPlantationNavigator
          onNavigateToWeather={() =>
            navigation.navigate('Home', { screen: 'Weather' })
          }
        />
      )}
    />
    <HomeStack.Screen
      name="Weather"
      children={({ navigation: homeNav }) => (
        <WeatherScreen onBackPress={() => homeNav.goBack()} />
      )}
    />
  </HomeStack.Navigator>
);

const ScheduleTab: React.FC<MainTabProps<'Schedule'>> = (props) => (
  <ViewLatestScheduleScreen {...(props as any)} />
);

const TeamTab: React.FC<MainTabProps<'Team'>> = () => (
  <TeamStack.Navigator screenOptions={{ headerShown: false }}>
    <TeamStack.Screen name="WorkerManagement" component={WorkerManagementScreen} />
    <TeamStack.Screen name="AddWorker" component={AddWorkerScreen} />
    <TeamStack.Screen name="WorkerDetails" component={WorkerDetailsScreen} />
  </TeamStack.Navigator>
);

const renderCustomTabBar = (props: BottomTabBarProps) => (
  <CustomTabBar {...props} />
);

const CustomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  navigation,
}) => {
  const { colors, isDark } = useAppSelector(selectTheme);

  return (
    <View
      style={[
        styles.tabBarContainer,
        { backgroundColor: colors.surface },
        isDark ? styles.noBorder : styles.withBorder,
      ]}
    >
      {state.routes.map((route, index) => {
        const isActive = state.index === index;
        const iconName = iconMap[route.name as keyof MainTabParamList] ?? 'circle';

        const activeTabStyle: StyleProp<ViewStyle> = {
          ...styles.activeTabBase,
          backgroundColor: colors.primaryLight ?? colors.primary ?? colors.surface,
        };

        return (
          <TouchableOpacity
            key={route.key}
            style={[styles.tab, isActive && activeTabStyle]}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isActive && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            onLongPress={() => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            }}
            activeOpacity={0.7}
          >
            <Lucide
              name={iconName as any}
              size={24}
              color={isActive ? colors.textColoredSecondary : colors.text}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const MainNavigator: React.FC<MainNavigatorProps> = ({ userRole, navigationRef }) => {
  const WateringComponent =
    userRole === 'admin' ? AdminWateringTab : ManagerWateringTab;
  const HomeComponent = userRole === 'admin' ? AdminHomeStack : ManagerHomeStack;

  return (
    <NavigationContainer ref={navigationRef}>
      <View style={styles.container}>
        <Tab.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName="Home"
          tabBar={renderCustomTabBar}
        >
          <Tab.Screen name="Watering" component={WateringComponent} />

          <Tab.Screen name="Chat" component={ChatScreen} />

          <Tab.Screen name="Home" component={HomeComponent} />

          <Tab.Screen name="Schedule" component={ScheduleTab} />

          <Tab.Screen name="Team" component={TeamTab} />
        </Tab.Navigator>
      </View>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  withBorder: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  noBorder: {
    borderTopWidth: 0,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  activeTabBase: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});

export default MainNavigator;
