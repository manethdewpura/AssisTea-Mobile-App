import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  BackHandler,
} from 'react-native';
import { useAppSelector } from '../../hooks';
import { selectAuth, selectTheme } from '../../store/selectors';
import { teaPlantationService } from '../../services';
import type { TeaPlantation } from '../../common/interfaces';
import Button from '../../components/atoms/Button';
import TopNavbar from '../../components/organisms/TopNavbar';
import NotificationsScreen from '../NotificationsScreen';

interface TeaPlantationManagerScreenProps {
  onNavigateToWeather?: () => void;
}

const TeaPlantationManagerScreen: React.FC<TeaPlantationManagerScreenProps> = ({
  onNavigateToWeather,
}) => {
  const { userProfile } = useAppSelector(selectAuth);
  const { colors } = useAppSelector(selectTheme);
  const [plantation, setPlantation] = useState<TeaPlantation | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationCount] = useState(5); // Mock notification count

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
      // Let the parent handle back button (App.tsx will show exit confirmation)
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );
    return () => backHandler.remove();
  }, []);

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.loadingText, { color: colors.text }]}>
          Loading plantation data...
        </Text>
      </View>
    );
  }

  // Show notifications screen if requested
  if (showNotifications) {
    return (
      <View style={styles.fullContainer}>
        <NotificationsScreen
          onBackPress={() => setShowNotifications(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.fullContainer}>
      <TopNavbar
        onNotificationPress={() => setShowNotifications(true)}
        unreadCount={notificationCount}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
      >

      {plantation ? (
        <View style={styles.plantationContainer}>
          <Text style={[styles.plantationTitle, { color: colors.text }]}>
            Your Plantation
          </Text>

          <View
            style={[
              styles.plantationCard,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.plantationName, { color: colors.text }]}>
              {plantation.name}
            </Text>
            <Text
              style={[
                styles.plantationLocation,
                { color: colors.textSecondary },
              ]}
            >
              📍 {plantation.location}
            </Text>
            <Text
              style={[styles.plantationArea, { color: colors.textSecondary }]}
            >
              🌱 Area: {plantation.area} acres
            </Text>
            {plantation.description && (
              <Text
                style={[
                  styles.plantationDescription,
                  { color: colors.textSecondary },
                ]}
              >
                📝 Description: {plantation.description}
              </Text>
            )}
          </View>

          <View style={styles.managementSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Management Tools
            </Text>

            <Button
              title="📊 View Production Reports"
              onPress={() => {}}
              style={styles.managementButton}
            />

            <Button
              title="🌿 Manage Tea Varieties"
              onPress={() => {}}
              style={styles.managementButton}
            />

            <Button
              title="👥 Manage Workers"
              onPress={() => {}}
              style={styles.managementButton}
            />

            <Button
              title="📈 Track Harvest Data"
              onPress={() => {}}
              style={styles.managementButton}
            />

            <Button
              title="💰 Financial Reports"
              onPress={() => {}}
              style={styles.managementButton}
            />

            <Button
              title="🌡️ Weather Monitoring"
              onPress={onNavigateToWeather || (() => {})}
              style={styles.managementButton}
            />
          </View>

          <View style={styles.quickStatsSection}>
            <Text style={styles.sectionTitle}>Quick Stats</Text>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>Active Workers</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>Tea Varieties</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>This Month's Harvest (kg)</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statNumber}>0</Text>
                <Text style={styles.statLabel}>Quality Score</Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.noPlantationContainer}>
          <Text style={styles.noPlantationTitle}>No Plantation Assigned</Text>
          <Text style={styles.noPlantationText}>
            You haven't been assigned to any tea plantation yet. Please contact
            your administrator.
          </Text>
        </View>
      )}
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
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#28a745',
    padding: 20,
    paddingTop: 60,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
  },
  themeSelector: {
    alignSelf: 'flex-end',
  },
  plantationContainer: {
    padding: 20,
  },
  plantationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  plantationCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  plantationName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  plantationLocation: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  plantationArea: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  plantationDescription: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    fontStyle: 'italic',
  },
  managementSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  managementButton: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  managementButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  quickStatsSection: {
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    width: '48%',
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#28a745',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  noPlantationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noPlantationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  noPlantationText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default TeaPlantationManagerScreen;
