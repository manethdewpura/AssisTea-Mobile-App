import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
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
  const [viewingSchedule, setViewingSchedule] = useState<SavedSchedule | null>(null);
  const [showPreviousModal, setShowPreviousModal] = useState(false);
  const [previousSchedules, setPreviousSchedules] = useState<SavedSchedule[]>([]);
  const [loadingPrevious, setLoadingPrevious] = useState(false);

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

  const loadPreviousSchedules = async () => {
    if (!userProfile?.plantationId) return;
    try {
      setLoadingPrevious(true);
      const schedules = await assignmentStorageService.getRecentSchedules(
        userProfile.plantationId,
        20,
      );
      setPreviousSchedules(schedules);
    } catch (error) {
      console.error('Error loading previous schedules:', error);
      Alert.alert('Error', 'Failed to load previous schedules');
    } finally {
      setLoadingPrevious(false);
    }
  };

  const handleOpenPreviousSchedules = () => {
    setShowPreviousModal(true);
    if (previousSchedules.length === 0) {
      loadPreviousSchedules();
    }
  };

  const displayedSchedule = viewingSchedule ?? schedule;

  // Group assignments by field
  const groupedAssignments = displayedSchedule?.assignments.reduce((acc, assignment) => {
    const fieldName = assignment.fieldName;
    if (!acc[fieldName]) {
      acc[fieldName] = [];
    }
    acc[fieldName].push(assignment);
    return acc;
  }, {} as Record<string, SavedSchedule['assignments']>);

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
        {/* Viewing Past Schedule Banner */}
        {viewingSchedule && (
          <View style={styles.pastBanner}>
            <Lucide name="clock" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.pastBannerText}>Viewing past schedule</Text>
            <TouchableOpacity
              onPress={() => setViewingSchedule(null)}
              style={styles.backToLatestBtn}
            >
              <Text style={styles.backToLatestText}>Back to Latest</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* View Previous Schedules Button */}
        {!viewingSchedule && (
          <TouchableOpacity
            style={[styles.previousBtn, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={handleOpenPreviousSchedules}
          >
            <Lucide name="history" size={18} color="#7cb342" style={{ marginRight: 8 }} />
            <Text style={[styles.previousBtnText, { color: colors.text }]}>View Previous Schedules</Text>
            <Lucide name="chevron-right" size={18} color="#7cb342" />
          </TouchableOpacity>
        )}

        {/* Date Header */}
        <View
          style={[
            styles.headerCard,
            { backgroundColor: colors.cardBackground || '#fff', borderColor: colors.border },
          ]}
        >
          <View style={styles.dateSection}>
            <Lucide name="calendar" size={32} color="#7cb342" style={{ marginRight: 12 }} />
            <View style={styles.dateInfo}>
              <Text style={[styles.dateText, { color: colors.text }]}>
                Schedule for {new Date(displayedSchedule!.date).toLocaleDateString()}
              </Text>
              <Text style={[styles.statsText, { color: colors.textSecondary }]}>
                {displayedSchedule!.totalWorkers} workers • {displayedSchedule!.totalFields} fields
                • Avg: {displayedSchedule!.averageEfficiency.toFixed(1)} kg/hr
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
                { backgroundColor: colors.cardBackground || '#fff', borderColor: colors.border },
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

      {/* Previous Schedules Modal */}
      <Modal
        visible={showPreviousModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPreviousModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.cardBackground || '#fff' }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Previous Schedules</Text>
              <TouchableOpacity onPress={() => setShowPreviousModal(false)}>
                <Lucide name="x" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {loadingPrevious ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#7cb342" />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Loading schedules...
                </Text>
              </View>
            ) : previousSchedules.length === 0 ? (
              <View style={styles.modalLoading}>
                <Lucide name="calendar-x" size={48} color="#ccc" />
                <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: 12 }]}>
                  No previous schedules found
                </Text>
              </View>
            ) : (
              <FlatList
                data={previousSchedules}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.modalList}
                renderItem={({ item }) => {
                  const isActive = (viewingSchedule?.id ?? schedule?.id) === item.id;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.scheduleItem,
                        { borderColor: colors.border },
                        isActive && styles.scheduleItemActive,
                      ]}
                      onPress={() => {
                        setViewingSchedule(item);
                        setShowPreviousModal(false);
                      }}
                    >
                      <View style={styles.scheduleItemLeft}>
                        <Lucide
                          name="calendar"
                          size={20}
                          color={isActive ? '#fff' : '#7cb342'}
                          style={{ marginRight: 10 }}
                        />
                        <View>
                          <Text style={[styles.scheduleItemDate, isActive && { color: '#fff' }, !isActive && { color: colors.text }]}>
                            {new Date(item.date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Text>
                          <Text style={[styles.scheduleItemSub, isActive && { color: '#d4edda' }, !isActive && { color: colors.textSecondary }]}>
                            {item.totalWorkers} workers • {item.totalFields} fields
                          </Text>
                        </View>
                      </View>
                      <Lucide
                        name="chevron-right"
                        size={18}
                        color={isActive ? '#fff' : colors.textSecondary}
                      />
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
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
    borderWidth: 1,
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
    borderWidth: 1,
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
  // Previous schedules button
  previousBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  previousBtnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  // Past schedule banner
  pastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7cb342',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  pastBannerText: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  backToLatestBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  backToLatestText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalLoading: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  modalList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  scheduleItemActive: {
    backgroundColor: '#7cb342',
    borderColor: '#7cb342',
  },
  scheduleItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  scheduleItemDate: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  scheduleItemSub: {
    fontSize: 12,
  },
});

export default ViewLatestScheduleScreen;
