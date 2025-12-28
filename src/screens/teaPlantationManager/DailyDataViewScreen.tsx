import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector } from '../../hooks';
import { selectAuth, selectTheme } from '../../store/selectors';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TeaPlantationStackParamList } from '../../navigation/TeaPlantationNavigator';
import { dailyDataService, workerService } from '../../services';
import { handleFirebaseError, logError } from '../../utils';
import type { DailyData } from '../../models/DailyData';
import type { Worker } from '../../models/Worker';

type Props = NativeStackScreenProps<
  TeaPlantationStackParamList,
  'DailyDataView'
>;

type FilterType = 'all' | 'date' | 'dateRange' | 'worker' | 'field' | 'quality';

const DailyDataViewScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useAppSelector(selectTheme);
  const { userProfile } = useAppSelector(selectAuth);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [selectedField, setSelectedField] = useState<string>('');
  const [selectedQuality, setSelectedQuality] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [activeDatePicker, setActiveDatePicker] = useState<'start' | 'end' | null>(null);
  const [showWorkerDropdown, setShowWorkerDropdown] = useState(false);
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);
  const [showQualityDropdown, setShowQualityDropdown] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>('');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [fieldAreas, setFieldAreas] = useState<string[]>([]);
  const [qualityLevels, setQualityLevels] = useState<string[]>([]);

  // Check if workerId is passed from route params (from WorkerDetailsScreen)
  useEffect(() => {
    const params = route.params as { workerId?: string } | undefined;
    if (params?.workerId) {
      setSelectedWorkerId(params.workerId);
      setFilterType('worker');
    }
  }, [route.params]);

  // Reload data when filters change
  useEffect(() => {
    if (userProfile?.plantationId) {
      loadDailyData();
    }
  }, [filterType, dateFilter, startDateFilter, endDateFilter, selectedWorkerId, selectedField, selectedQuality, userProfile?.plantationId]);

  useEffect(() => {
    loadWorkers();
  }, []);

  // Refresh data when screen comes into focus (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      if (userProfile?.plantationId) {
        loadDailyData();
      }
    }, [userProfile?.plantationId])
  );

  const loadWorkers = async () => {
    if (!userProfile?.plantationId) {
      return;
    }

    try {
      const fetchedWorkers = await workerService.getWorkersByPlantation(
        userProfile.plantationId,
      );
      setWorkers(fetchedWorkers);
    } catch (error: any) {
      const appError = handleFirebaseError(error);
      logError(appError, 'DailyDataViewScreen - LoadWorkers');
    }
  };

  const loadDailyData = async () => {
    if (!userProfile?.plantationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let data: DailyData[] = [];

      if (filterType === 'date' && dateFilter) {
        data = await dailyDataService.getDailyDataByPlantation(
          userProfile.plantationId,
          dateFilter,
          dateFilter,
        );
      } else if (filterType === 'dateRange' && startDateFilter && endDateFilter) {
        data = await dailyDataService.getDailyDataByPlantation(
          userProfile.plantationId,
          startDateFilter,
          endDateFilter,
        );
      } else if (filterType === 'worker' && selectedWorkerId) {
        data = await dailyDataService.getDailyDataByWorker(
          selectedWorkerId,
          startDateFilter || undefined,
          endDateFilter || undefined,
        );
      } else {
        // Fetch all data for 'all', 'field', and 'quality' filters
        data = await dailyDataService.getDailyDataByPlantation(
          userProfile.plantationId,
        );
      }

      // Client-side filtering for field and quality
      if (filterType === 'field' && selectedField) {
        data = data.filter(d => d.fieldArea === selectedField);
      } else if (filterType === 'quality' && selectedQuality) {
        data = data.filter(d => d.teaLeafQuality === selectedQuality);
      }

      // Extract unique field areas and quality levels for dropdowns
      const uniqueFields = [...new Set(data.map(d => d.fieldArea))].filter(Boolean).sort();
      const uniqueQualities = [...new Set(data.map(d => d.teaLeafQuality))].filter(Boolean).sort();

      setFieldAreas(uniqueFields);
      setQualityLevels(uniqueQualities);
      setDailyData(data);
    } catch (error: any) {
      // Log the actual error for debugging
      console.error('DailyDataViewScreen - LoadDailyData Error:', {
        code: error.code,
        message: error.message,
        error: error,
      });

      const appError = handleFirebaseError(error);
      logError(appError, 'DailyDataViewScreen - LoadDailyData');

      // Show more specific error message
      let errorMessage = appError.userMessage;
      const errorCode = error.code || '';
      const errorMsg = error.message || '';

      if (errorCode === 'failed-precondition' || errorMsg.includes('index') || errorMsg.includes('Index')) {
        errorMessage = 'Database index required. The query has been optimized to work without indexes. Please try again.';
      } else if (errorCode === 'permission-denied' || errorCode === 'firestore/permission-denied') {
        errorMessage = 'You do not have permission to view this data.';
      } else if (errorCode === 'unavailable' || errorCode === 'firestore/unavailable') {
        errorMessage = 'Service temporarily unavailable. Please check your connection and try again.';
      } else if (errorCode === 'deadline-exceeded' || errorCode === 'firestore/deadline-exceeded') {
        errorMessage = 'Request timed out. Please try again.';
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDailyData();
  }, [filterType, dateFilter, startDateFilter, endDateFilter, selectedWorkerId]);

  const handleDateChange = (event: any, date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      const dateString = date.toISOString().split('T')[0];
      setDateFilter(dateString);
      setFilterType('date');
    }

    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
  };

  const handleWorkerSelect = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setFilterType('worker');
    setShowWorkerDropdown(false);
  };

  const getWorkerName = (workerId: string) => {
    const worker = workers.find(w => w.id === workerId);
    return worker ? worker.name : 'Unknown Worker';
  };

  const handleEdit = (dataId: string) => {
    navigation.navigate('EditDailyData', { dataId });
  };

  const handleDelete = (data: DailyData) => {
    Alert.alert(
      'Delete Entry',
      `Are you sure you want to delete this entry for ${getWorkerName(data.workerId)} on ${data.date}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await dailyDataService.deleteDailyData(data.id);
              Alert.alert('Success', 'Entry deleted successfully');
              loadDailyData();
            } catch (error: any) {
              const appError = handleFirebaseError(error);
              logError(appError, 'DailyDataViewScreen - DeleteData');
              Alert.alert('Error', appError.userMessage);
            }
          },
        },
      ],
    );
  };

  const clearFilters = () => {
    setFilterType('all');
    setDateFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setStartDate(null);
    setEndDate(null);
    setSelectedWorkerId('');
    setSelectedField('');
    setSelectedQuality('');
  };

  const handleStartDateChange = (event: any, date: Date | undefined) => {
    if (date) {
      setStartDate(date);
      const dateString = date.toISOString().split('T')[0];
      setStartDateFilter(dateString);
      setFilterType('dateRange');
    }
    if (Platform.OS === 'android') {
      setActiveDatePicker(null);
    }
  };

  const handleEndDateChange = (event: any, date: Date | undefined) => {
    if (date) {
      setEndDate(date);
      const dateString = date.toISOString().split('T')[0];
      setEndDateFilter(dateString);
      setFilterType('dateRange');
    }
    if (Platform.OS === 'android') {
      setActiveDatePicker(null);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Filters */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          <TouchableOpacity
            style={[
              styles.filterButton,
              filterType === 'all' && styles.filterButtonActive,
            ]}
            onPress={clearFilters}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterType === 'all' && styles.filterButtonTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filterType === 'date' && styles.filterButtonActive,
            ]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterType === 'date' && styles.filterButtonTextActive,
              ]}
            >
              📅 {dateFilter || 'Select Date'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filterType === 'dateRange' && styles.filterButtonActive,
            ]}
            onPress={() => {
              // Open a dedicated date range modal
              setShowDateRangeModal(true);
            }}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterType === 'dateRange' && styles.filterButtonTextActive,
              ]}
            >
              📆{' '}
              {startDateFilter && endDateFilter
                ? `${startDateFilter} to ${endDateFilter}`
                : 'Date Range'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filterType === 'worker' && styles.filterButtonActive,
            ]}
            onPress={() => setShowWorkerDropdown(!showWorkerDropdown)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterType === 'worker' && styles.filterButtonTextActive,
              ]}
            >
              👤{' '}
              {selectedWorkerId
                ? getWorkerName(selectedWorkerId)
                : 'Select Worker'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filterType === 'field' && styles.filterButtonActive,
            ]}
            onPress={() => setShowFieldDropdown(!showFieldDropdown)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterType === 'field' && styles.filterButtonTextActive,
              ]}
            >
              🏞️{' '}
              {selectedField || 'Select Field'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filterType === 'quality' && styles.filterButtonActive,
            ]}
            onPress={() => setShowQualityDropdown(!showQualityDropdown)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterType === 'quality' && styles.filterButtonTextActive,
              ]}
            >
              ⭐{' '}
              {selectedQuality || 'Select Quality'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {showWorkerDropdown && (
          <View style={styles.workerDropdown}>
            <ScrollView style={styles.workerDropdownList}>
              {workers.map(worker => (
                <TouchableOpacity
                  key={worker.id}
                  style={styles.workerDropdownItem}
                  onPress={() => handleWorkerSelect(worker.id)}
                >
                  <Text style={styles.workerDropdownText}>
                    {worker.name} ({worker.workerId})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {showFieldDropdown && (
          <View style={styles.workerDropdown}>
            <ScrollView style={styles.workerDropdownList}>
              {fieldAreas.map(field => (
                <TouchableOpacity
                  key={field}
                  style={styles.workerDropdownItem}
                  onPress={() => {
                    setSelectedField(field);
                    setFilterType('field');
                    setShowFieldDropdown(false);
                  }}
                >
                  <Text style={styles.workerDropdownText}>{field}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {showQualityDropdown && (
          <View style={styles.workerDropdown}>
            <ScrollView style={styles.workerDropdownList}>
              {qualityLevels.map(quality => (
                <TouchableOpacity
                  key={quality}
                  style={styles.workerDropdownItem}
                  onPress={() => {
                    setSelectedQuality(quality);
                    setFilterType('quality');
                    setShowQualityDropdown(false);
                  }}
                >
                  <Text style={styles.workerDropdownText}>{quality}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {showDatePicker && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerHeader}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text style={styles.datePickerHeaderText}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date()}
            />
          </View>
        </Modal>
      )}

      {showDateRangeModal && (
        <Modal
          visible={showDateRangeModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowDateRangeModal(false);
            setActiveDatePicker(null);
          }}
        >
          <View style={styles.dateRangeModalOverlay}>
            <View style={styles.dateRangeModalContent}>
              {/* Header */}
              <View style={styles.dateRangeHeader}>
                <Text style={styles.dateRangeTitle}>Select Date Range</Text>
                <TouchableOpacity onPress={() => {
                  setShowDateRangeModal(false);
                  setActiveDatePicker(null);
                }}>
                  <Text style={styles.dateRangeCloseButton}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* From Date Section */}
              <View style={styles.dateSection}>
                <Text style={styles.dateSectionLabel}>From Date</Text>
                <TouchableOpacity
                  style={styles.dateDisplayBox}
                  onPress={() => setActiveDatePicker('start')}
                >
                  <Text style={styles.dateDisplayText}>
                    {startDate ? startDate.toISOString().split('T')[0] : 'Tap to select start date'}
                  </Text>
                  <Text style={styles.calendarIcon}>📅</Text>
                </TouchableOpacity>
              </View>

              {/* To Date Section */}
              <View style={styles.dateSection}>
                <Text style={styles.dateSectionLabel}>To Date</Text>
                <TouchableOpacity
                  style={styles.dateDisplayBox}
                  onPress={() => setActiveDatePicker('end')}
                >
                  <Text style={styles.dateDisplayText}>
                    {endDate ? endDate.toISOString().split('T')[0] : 'Tap to select end date'}
                  </Text>
                  <Text style={styles.calendarIcon}>📅</Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons */}
              <View style={styles.dateRangeActions}>
                <TouchableOpacity
                  style={styles.clearDateButton}
                  onPress={() => {
                    setStartDate(null);
                    setEndDate(null);
                    setStartDateFilter('');
                    setEndDateFilter('');
                    setFilterType('all');
                    setActiveDatePicker(null);
                  }}
                >
                  <Text style={styles.clearDateButtonText}>Clear</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.applyDateButton,
                    (!startDate || !endDate) && styles.applyDateButtonDisabled
                  ]}
                  onPress={() => {
                    if (startDate && endDate) {
                      setFilterType('dateRange');
                      setShowDateRangeModal(false);
                      setActiveDatePicker(null);
                    }
                  }}
                  disabled={!startDate || !endDate}
                >
                  <Text style={styles.applyDateButtonText}>Apply Filter</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Date Pickers - shown conditionally */}
      {activeDatePicker === 'start' && (
        <Modal
          visible={activeDatePicker === 'start'}
          transparent
          animationType="slide"
          onRequestClose={() => setActiveDatePicker(null)}
        >
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerHeader}>
              <TouchableOpacity onPress={() => setActiveDatePicker(null)}>
                <Text style={styles.datePickerHeaderText}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={startDate || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleStartDateChange}
              maximumDate={endDate || new Date()}
            />
          </View>
        </Modal>
      )}

      {activeDatePicker === 'end' && (
        <Modal
          visible={activeDatePicker === 'end'}
          transparent
          animationType="slide"
          onRequestClose={() => setActiveDatePicker(null)}
        >
          <View style={styles.datePickerModal}>
            <View style={styles.datePickerHeader}>
              <TouchableOpacity onPress={() => setActiveDatePicker(null)}>
                <Text style={styles.datePickerHeaderText}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={endDate || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleEndDateChange}
              minimumDate={startDate || undefined}
              maximumDate={new Date()}
            />
          </View>
        </Modal>
      )}

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7cb342" />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Loading...
            </Text>
          </View>
        ) : dailyData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.text }]}>
              No daily data found
            </Text>
            <TouchableOpacity
              style={styles.addDataButton}
              onPress={() => navigation.navigate('DailyDataEntry')}
            >
              <Text style={styles.addDataButtonText}>Add Daily Data</Text>
            </TouchableOpacity>
          </View>
        ) : (
          dailyData.map(data => (
            <View
              key={data.id}
              style={[
                styles.dataCard,
                { backgroundColor: colors.cardBackground || '#fff' },
              ]}
            >
              <View style={styles.dataCardHeader}>
                <View style={styles.dataCardHeaderLeft}>
                  <Text style={[styles.workerName, { color: colors.text }]}>
                    {getWorkerName(data.workerId)}
                  </Text>
                  <Text style={[styles.dataDate, { color: colors.text }]}>
                    {data.date}
                  </Text>
                </View>
                <View style={styles.dataCardActions}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => handleEdit(data.id)}
                  >
                    <Text style={styles.editIcon}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(data)}
                  >
                    <Text style={styles.deleteIcon}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.dataCardBody}>
                <View style={styles.dataRow}>
                  <Text style={[styles.dataLabel, { color: colors.text }]}>
                    Tea Plucked:
                  </Text>
                  <Text style={[styles.dataValue, { color: colors.text }]}>
                    {data.teaPluckedKg} kg
                  </Text>
                </View>

                <View style={styles.dataRow}>
                  <Text style={[styles.dataLabel, { color: colors.text }]}>
                    Time Spent:
                  </Text>
                  <Text style={[styles.dataValue, { color: colors.text }]}>
                    {data.timeSpentHours} hours
                  </Text>
                </View>

                <View style={styles.dataRow}>
                  <Text style={[styles.dataLabel, { color: colors.text }]}>
                    Field Area:
                  </Text>
                  <Text style={[styles.dataValue, { color: colors.text }]}>
                    {data.fieldArea}
                  </Text>
                </View>

                <View style={styles.dataRow}>
                  <Text style={[styles.dataLabel, { color: colors.text }]}>
                    Quality:
                  </Text>
                  <Text style={[styles.dataValue, { color: colors.text }]}>
                    {data.teaLeafQuality}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  addButton: {
    padding: 8,
  },
  addIcon: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
  },
  greenSection: {
    height: 80,
    backgroundColor: '#2d5016',
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#7cb342',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  workerDropdown: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxHeight: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  workerDropdownList: {
    maxHeight: 200,
  },
  workerDropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  workerDropdownText: {
    fontSize: 14,
    color: '#333',
  },
  datePickerModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    alignItems: 'flex-end',
  },
  datePickerHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7cb342',
  },
  dateRangeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  dateRangeModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  dateRangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dateRangeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  dateRangeCloseButton: {
    fontSize: 24,
    color: '#666',
    fontWeight: '300',
  },
  dateSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  dateSectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  dateDisplayBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#7cb342',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateDisplayText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  calendarIcon: {
    fontSize: 18,
  },
  dateRangeActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
    gap: 12,
  },
  clearDateButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#7cb342',
  },
  clearDateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7cb342',
  },
  applyDateButton: {
    flex: 1,
    backgroundColor: '#7cb342',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyDateButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  applyDateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 20,
  },
  addDataButton: {
    backgroundColor: '#7cb342',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addDataButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dataCard: {
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
  dataCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dataCardHeaderLeft: {
    flex: 1,
  },
  workerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  dataDate: {
    fontSize: 14,
    color: '#666',
  },
  dataCardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    padding: 4,
  },
  editIcon: {
    fontSize: 20,
  },
  deleteButton: {
    padding: 4,
  },
  deleteIcon: {
    fontSize: 20,
  },
  dataCardBody: {
    gap: 8,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  dataValue: {
    fontSize: 14,
    color: '#333',
  },
});

export default DailyDataViewScreen;

