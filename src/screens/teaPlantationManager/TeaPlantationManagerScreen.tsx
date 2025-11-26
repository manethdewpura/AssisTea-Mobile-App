import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  BackHandler,
  TouchableOpacity,
  SafeAreaView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useAppSelector } from '../../hooks';
import { selectAuth, selectTheme } from '../../store/selectors';
import { authService, teaPlantationService } from '../../services';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TeaPlantation } from '../../common/interfaces';
import type { TeaPlantationStackParamList } from '../../navigation/TeaPlantationNavigator';

type Props = NativeStackScreenProps<
  TeaPlantationStackParamList,
  'TeaPlantationHome'
>;

const TeaPlantationManagerScreen: React.FC<Props> = ({ navigation }) => {
  const { userProfile } = useAppSelector(selectAuth);
  const { colors } = useAppSelector(selectTheme);
  const [plantation, setPlantation] = useState<TeaPlantation | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPlantationData = useCallback(async () => {
    if (!userProfile?.plantationId) {
      setLoading(false);
      return;
    }

    try {
      const plantationData = await teaPlantationService.getTeaPlantation(
        userProfile.plantationId,
      );
      setPlantation(plantationData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load plantation data');
    } finally {
      setLoading(false);
    }
  }, [userProfile?.plantationId]);

  useEffect(() => {
    loadPlantationData();
  }, [loadPlantationData]);

  useEffect(() => {
    const backAction = () => {
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );
    return () => backHandler.remove();
  }, []);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => authService.signOut(),
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color="#7cb342" />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AssisTea</Text>
        <TouchableOpacity style={styles.notificationButton}>
          <Text style={styles.notificationIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../common/assets/images/LogoRound.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Welcome Text */}
        <Text style={styles.welcomeText}>
          Welcome, {userProfile?.role || 'Supervisor'}!
        </Text>

        {/* Split Button Container */}
        <View style={styles.splitButtonContainer}>
          <TouchableOpacity
            style={[styles.splitButton, styles.leftButton]}
            onPress={() => navigation.navigate('DailyDataEntry')}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.buttonIcon}>+</Text>
              <Text style={styles.buttonText}>Enter Daily Data</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.buttonDivider} />

          <TouchableOpacity
            style={[styles.splitButton, styles.rightButton]}
            onPress={() => navigation.navigate('WorkerManagement')}
          >
            <Text style={styles.buttonText}>Manage Workers</Text>
          </TouchableOpacity>
        </View>

        {/* Generate Schedule Button */}
        <TouchableOpacity style={styles.scheduleButton}>
          <Text style={styles.scheduleIcon}>📅</Text>
          <Text style={styles.scheduleText}>Generate Today's Schedule</Text>
        </TouchableOpacity>

        {/* View Latest Schedule Link */}
        <TouchableOpacity
          style={styles.linkContainer}
          onPress={() => navigation.navigate('ViewLatestSchedule')}
        >
          <Text style={styles.linkText}>View Latest Schedule</Text>
        </TouchableOpacity>

        {/* Spacer */}
        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    backgroundColor: '#7cb342',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuButton: {
    padding: 8,
  },
  menuIcon: {
    fontSize: 24,
    color: '#fff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  notificationButton: {
    padding: 8,
  },
  notificationIcon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#7cb342',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoImage: {
    width: 100,
    height: 100,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1b5e20',
    textAlign: 'center',
    marginBottom: 30,
  },
  splitButtonContainer: {
    backgroundColor: '#7cb342',
    borderRadius: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  splitButton: {
    flex: 1,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftButton: {
    paddingRight: 8,
  },
  rightButton: {
    paddingLeft: 8,
  },
  buttonDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    fontSize: 20,
    color: '#fff',
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  scheduleButton: {
    backgroundColor: '#fbc02d',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scheduleIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  scheduleText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  linkContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  linkText: {
    color: '#1b5e20',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  spacer: {
    height: 40,
  },
});

export default TeaPlantationManagerScreen;
