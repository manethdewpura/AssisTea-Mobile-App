import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector } from '../../hooks';
import { selectAuth, selectTheme } from '../../store/selectors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TeaPlantationStackParamList } from '../../navigation/TeaPlantationNavigator';
import { assignmentStorageService } from '../../services/assignmentStorage.service';
import { SavedSchedule } from '../../models/SavedSchedule';

type Props = NativeStackScreenProps<
  TeaPlantationStackParamList,
  'ViewLatestSchedule'
>;

const ViewLatestScheduleScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useAppSelector(selectTheme);
  const { userProfile } = useAppSelector(selectAuth);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<SavedSchedule | null>(null);

  useEffect(() => {
    loadLatestSchedule();
  }, []);

  const loadLatestSchedule = async () => {
    if (!userProfile?.plantationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const latestSchedule = await assignmentStorageService.getLatestSchedule(
        userProfile.plantationId,
      );
      setSchedule(latestSchedule);
    } catch (error) {
      console.error('Error loading schedule:', error);
      Alert.alert('Error', 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  // Group assignments by field
  const groupedAssignments = schedule?.assignments.reduce((acc, assignment) => {
    const fieldName = assignment.fieldName;
    if (!acc[fieldName]) {
      acc[fieldName] = [];
    }
    acc[fieldName].push(assignment);
    return acc;
  }, {} as Record<string, typeof schedule.assignments>);

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#7cb342" />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading schedule...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!schedule) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.emptyContainer}>
          <Lucide name="calendar" size={64} color="#ccc" />
          <Text style={[styles.emptyText, { color: colors.text }]}>
            No schedule found
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Generate an assignment schedule first
          </Text>
          <TouchableOpacity
            style={styles.generateButton}
            onPress={() => navigation.navigate('AssignmentGeneration')}
          >
            <Text style={styles.generateButtonText}>Generate Schedule</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Date Header */}
        <View
          style={[
            styles.headerCard,
            { backgroundColor: colors.cardBackground || '#fff' },
          ]}
        >
          <View style={styles.dateSection}>
            <Lucide name="calendar" size={32} color="#7cb342" style={{ marginRight: 12 }} />
            <View style={styles.dateInfo}>
              <Text style={[styles.dateText, { color: colors.text }]}>
                Schedule for {new Date(schedule.date).toLocaleDateString()}
              </Text>
              <Text style={[styles.statsText, { color: colors.textSecondary }]}>
                {schedule.totalWorkers} workers • {schedule.totalFields} fields
                • Avg: {schedule.averageEfficiency.toFixed(1)} kg/hr
              </Text>
            </View>
          </View>
        </View>

        {/* Field Groups */}
        {groupedAssignments &&
          Object.entries(groupedAssignments).map(([fieldName, assignments]) => (
            <View
              key={fieldName}
              style={[
                styles.fieldCard,
                { backgroundColor: colors.cardBackground || '#fff' },
              ]}
            >
              <View style={styles.fieldHeader}>
                <Text style={[styles.fieldName, { color: colors.text }]}>
                  {fieldName}
                </Text>
                <Text
                  style={[styles.workerCount, { color: colors.textSecondary }]}
                >
                  {assignments.length} workers
                </Text>
              </View>

              {assignments.map((assignment, index) => (
                <View
                  key={assignment.workerId}
                  style={[
                    styles.assignmentRow,
                    index === assignments.length - 1 && styles.lastRow,
                  ]}
                >
                  <View style={styles.workerInfo}>
                    <Text style={[styles.workerName, { color: colors.text }]}>
                      {assignment.workerName}
                    </Text>
                    <Text
                      style={[
                        styles.efficiency,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {assignment.predictedEfficiency.toFixed(2)} kg/hour
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {assignment.predictedEfficiency >= 8 ? '⭐' : '✓'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  generateButton: {
    backgroundColor: '#fbc02d',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  greenSection: {
    height: 80,
    backgroundColor: '#2d5016',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dateSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  dateInfo: {
    flex: 1,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  statsText: {
    fontSize: 13,
    color: '#666',
  },
  fieldCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  fieldName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1b5e20',
  },
  workerCount: {
    fontSize: 13,
    color: '#666',
  },
  assignmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  workerInfo: {
    flex: 1,
  },
  workerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  efficiency: {
    fontSize: 13,
    color: '#666',
  },
  badge: {
    backgroundColor: '#e8f5e9',
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 16,
  },
});

export default ViewLatestScheduleScreen;
