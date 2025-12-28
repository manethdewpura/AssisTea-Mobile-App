import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  BackHandler,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSelector } from '../../hooks';
import { selectAuth, selectTheme } from '../../store/selectors';
import { teaPlantationService } from '../../services';
import type { TeaPlantation } from '../../common/interfaces';
import Button from '../../components/atoms/Button';
import type { TeaPlantationStackParamList } from '../../navigation/TeaPlantationNavigator';

interface TeaPlantationManagerScreenProps {
  onNavigateToWeather?: () => void;
  onNavigateToSensors?: () => void;
}

const TeaPlantationManagerScreen: React.FC<TeaPlantationManagerScreenProps> = ({
  onNavigateToWeather,
  onNavigateToSensors,
}) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<TeaPlantationStackParamList>>();
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

  return (
    <View style={styles.fullContainer}>
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
              {/* Sensors Section */}
              {onNavigateToSensors && (
                <Button
                  title="📊 Sensor Data"
                  onPress={onNavigateToSensors || (() => {})}
                  style={styles.managementButton}
                />
              )}
            </View>

            {/* Split Button Container */}
            <View style={styles.splitButtonContainer}>
              <TouchableOpacity
                style={[styles.splitButton, styles.leftButton]}
                onPress={() => navigation.navigate('DailyDataEntry')}
              >
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonIcon}>📝</Text>
                  <Text style={styles.buttonText}>Enter Daily Data</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.buttonDivider} />

              <TouchableOpacity
                style={[styles.splitButton, styles.rightButton]}
                onPress={() => navigation.navigate('DailyDataView')}
              >
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonIcon}>📊</Text>
                  <Text style={styles.buttonText}>View Daily Data</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Split Button 2: Manage Workers | Manage Fields (Yellow) */}
            <View style={[styles.splitButtonContainer, styles.yellowButton]}>
              <TouchableOpacity
                style={[styles.splitButton, styles.leftButton]}
                onPress={() => navigation.navigate('WorkerManagement')}
              >
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonIcon}>👥</Text>
                  <Text style={styles.buttonText}>Manage Workers</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.buttonDivider} />

              <TouchableOpacity
                style={[styles.splitButton, styles.rightButton]}
                onPress={() => navigation.navigate('FieldManagement')}
              >
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonIcon}>🌱</Text>
                  <Text style={styles.buttonText}>Manage Fields</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Split Button 3: Generate Today's Schedule | View Latest Schedule (Green) */}
            <View style={styles.splitButtonContainer}>
              <TouchableOpacity
                style={[styles.splitButton, styles.leftButton]}
                onPress={() => navigation.navigate('AssignmentGeneration')}
              >
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonIcon}>📅</Text>
                  <Text style={styles.buttonText}>Generate Schedule</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.buttonDivider} />

              <TouchableOpacity
                style={[styles.splitButton, styles.rightButton]}
                onPress={() => navigation.navigate('ViewLatestSchedule')}
              >
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonIcon}>📋</Text>
                  <Text style={styles.buttonText}>View Schedule</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.noPlantationContainer}>
            <Text style={styles.noPlantationTitle}>No Plantation Assigned</Text>
            <Text style={styles.noPlantationText}>
              You haven't been assigned to any tea plantation yet. Please
              contact your administrator.
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
  yellowButton: {
    backgroundColor: '#fbc02d',
  },
  splitButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
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
    fontSize: 16,
    color: '#fff',
    marginRight: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  spacer: {
    height: 40,
  },
});

export default TeaPlantationManagerScreen;
