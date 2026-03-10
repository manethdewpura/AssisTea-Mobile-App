import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector, useThemedAlert } from '../../hooks';
import CustomAlert from '../../components/molecule/CustomAlert';
import { selectAuth, selectTheme } from '../../store/selectors';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TeaPlantationStackParamList } from '../../navigation/TeaPlantationNavigator';
import { dailyDataService, workerService, fieldService } from '../../services';
import { handleFirebaseError, logError } from '../../utils';
import { checkNetworkConnection } from '../../utils/network.util';
import { dailyDataSQLiteService } from '../../services/sqlite/dailyDataSQLite.service';
import type { DailyData } from '../../models/DailyData';
import type { Worker } from '../../models/Worker';
import type { Field } from '../../models/Field';

type Props = NativeStackScreenProps<
  TeaPlantationStackParamList,
  'DailyDataView'
>;

type FilterType = 'all' | 'date' | 'dateRange' | 'worker' | 'field';

const DailyDataViewScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useAppSelector(selectTheme);
  const { userProfile } = useAppSelector(selectAuth);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [selectedField, setSelectedField] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [activeDatePicker, setActiveDatePicker] = useState<'start' | 'end' | null>(null);
  const [showWorkerDropdown, setShowWorkerDropdown] = useState(false);
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>('');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const { showAlert, hideAlert, alertState } = useThemedAlert();
  const [syncing, setSyncing] = useState(false);

  const fieldNameMap = useMemo(
    () => Object.fromEntries(fields.map(f => [f.id, f.name])),
    [fields]
  );

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
  }, [filterType, dateFilter, startDateFilter, endDateFilter, selectedWorkerId, selectedField, userProfile?.plantationId]);

  useEffect(() => {
    loadWorkers();
    loadFields();
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

  const loadFields = async () => {
    if (!userProfile?.plantationId) {
      return;
    }

    try {
      const fetchedFields = await fieldService.getFieldsByPlantation(
        userProfile.plantationId,
      );
      setFields(fetchedFields);
    } catch (error: any) {
      const appError = handleFirebaseError(error);
      logError(appError, 'DailyDataViewScreen - LoadFields');
    }
  };

  const loadDailyData = async () => {
    if (!userProfile?.plantationId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Always read from SQLite so UI reflects true offline data.
      const allData = await dailyDataSQLiteService.getByPlantation(
        userProfile.plantationId,
      );

      // Now apply filtering based on filterType (all in-memory)
      let data: DailyData[] = allData;

      if (filterType === 'date' && dateFilter) {
        data = allData.filter(d => d.date === dateFilter);
      } else if (filterType === 'dateRange' && startDateFilter && endDateFilter) {
        data = allData.filter(d => d.date >= startDateFilter && d.date <= endDateFilter);
      } else if (filterType === 'worker' && selectedWorkerId) {
        data = allData.filter(d => {
          if (d.workerId !== selectedWorkerId) return false;
          if (startDateFilter && d.date < startDateFilter) return false;
          if (endDateFilter && d.date > endDateFilter) return false;
          return true;
        });
      } else if (filterType === 'field' && selectedField) {
        data = allData.filter(d => d.fieldArea === selectedField);
      }

      setDailyData(data);
    } catch (error: any) {
      console.error('DailyDataViewScreen - LoadDailyData Error (SQLite):', error);

      const appError = handleFirebaseError(error);
      logError(appError, 'DailyDataViewScreen - LoadDailyData (SQLite)');
      showAlert('Error', appError.userMessage, undefined, 'high');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    if (!userProfile?.plantationId || syncing) return;

    try {
      setSyncing(true);
      console.log(
        '[DailyDataViewScreen] Manual sync requested for plantation:',
        userProfile.plantationId,
      );
      const { isConnected } = await checkNetworkConnection();
      if (!isConnected) {
        console.log(
          '[DailyDataViewScreen] Manual sync aborted: device is offline.',
        );
        showAlert('Offline', 'Connect to the internet to sync daily data.', undefined, 'medium');
        return;
      }

      console.log('[DailyDataViewScreen] Calling dailyDataService.syncToSQLite...');
      await dailyDataService.syncToSQLite(userProfile.plantationId);
      console.log('[DailyDataViewScreen] Reloading daily data from SQLite after sync...');
      await loadDailyData();
      showAlert('Synced', 'Daily data has been synced from the server.', undefined, 'low');
    } catch (error: any) {
      console.error(
        '[DailyDataViewScreen] Manual sync failed:',
        error?.code,
        error?.message,
        error,
      );
      const appError = handleFirebaseError(error);
      logError(appError, 'DailyDataViewScreen - ManualSync');
      showAlert('Sync Failed', appError.userMessage, undefined, 'high');
    } finally {
      setSyncing(false);
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

      // Clear other filters
      setStartDateFilter('');
      setEndDateFilter('');
      setStartDate(null);
      setEndDate(null);
      setSelectedWorkerId('');
      setSelectedField('');
    }

    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
  };

  const handleWorkerSelect = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setFilterType('worker');
    setShowWorkerDropdown(false);

    // Clear other filters
    setDateFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setStartDate(null);
    setEndDate(null);
    setSelectedField('');
  };

  const getWorkerName = (workerId: string) => {
    const worker = workers.find(w => w.id === workerId);
    return worker ? worker.name : 'Unknown Worker';
  };

  const handleEdit = (dataId: string) => {
    navigation.navigate('EditDailyData', { dataId });
  };

  const handleDelete = (data: DailyData) => {
    showAlert(
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
              showAlert('Success', 'Entry deleted successfully', undefined, 'low');
              loadDailyData();
            } catch (error: any) {
              const appError = handleFirebaseError(error);
              logError(appError, 'DailyDataViewScreen - DeleteData');
              showAlert('Error', appError.userMessage, undefined, 'high');
            }
          },
        },
      ],
      'high'
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
  };

  const handleStartDateChange = (event: any, date: Date | undefined) => {
    if (date) {
      setStartDate(date);
      const dateString = date.toISOString().split('T')[0];
      setStartDateFilter(dateString);
      setFilterType('dateRange');

      // Clear other filters (only when start date is selected)
      setDateFilter('');
      setSelectedWorkerId('');
      setSelectedField('');
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
              { borderColor: colors.border, backgroundColor: colors.cardBackground },
              filterType === 'all' && styles.filterButtonActive,
            ]}
            onPress={clearFilters}
          >
            <Text
              style={[
                styles.filterButtonText,
                { color: colors.text },
                filterType === 'all' && styles.filterButtonTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              { borderColor: colors.border, backgroundColor: colors.cardBackground },
              filterType === 'date' && styles.filterButtonActive,
            ]}
            onPress={() => {
              setShowDatePicker(true);
            }}
          >
            <Text
              style={[
                styles.filterButtonText,
                { color: colors.text },
                filterType === 'date' && styles.filterButtonTextActive,
              ]}
            >
              {dateFilter || 'Select Date'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              { borderColor: colors.border, backgroundColor: colors.cardBackground },
              filterType === 'dateRange' && styles.filterButtonActive,
            ]}
            onPress={() => {
              setShowDateRangeModal(true);
            }}
          >
            <Text
              style={[
                styles.filterButtonText,
                { color: colors.text },
                filterType === 'dateRange' && styles.filterButtonTextActive,
              ]}
            >
              {startDateFilter && endDateFilter
                ? `${startDateFilter} to ${endDateFilter}`
                : 'Date Range'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              { borderColor: colors.border, backgroundColor: colors.cardBackground },
              filterType === 'worker' && styles.filterButtonActive,
            ]}
            onPress={() => {
              setShowWorkerDropdown(!showWorkerDropdown);
              setShowFieldDropdown(false);
            }}
          >
            <Text
              style={[
                styles.filterButtonText,
                { color: colors.text },
                filterType === 'worker' && styles.filterButtonTextActive,
              ]}
            >
              {selectedWorkerId
                ? getWorkerName(selectedWorkerId)
                : 'Worker'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              { borderColor: colors.border, backgroundColor: colors.cardBackground },
              filterType === 'field' && styles.filterButtonActive,
            ]}
            onPress={() => {
              setShowFieldDropdown(!showFieldDropdown);
              setShowWorkerDropdown(false);
            }}
          >
            <Text
              style={[
                styles.filterButtonText,
                { color: colors.text },
                filterType === 'field' && styles.filterButtonTextActive,
              ]}
            >
              {selectedField || 'Field'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              { borderColor: colors.border, backgroundColor: colors.cardBackground },
            ]}
            onPress={handleSyncNow}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text
                style={[
                  styles.filterButtonText,
                  { color: colors.text },
                ]}
              >
                Sync
              </Text>
            )}
          </TouchableOpacity>

        </ScrollView>

        {showWorkerDropdown && (
          <View style={[styles.workerDropdown, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <ScrollView style={styles.workerDropdownList}>
              {workers.map(worker => (
                <TouchableOpacity
                  key={worker.id}
                  style={[styles.workerDropdownItem, { borderBottomColor: colors.border }]}
                  onPress={() => handleWorkerSelect(worker.id)}
                >
                  <Text style={[styles.workerDropdownText, { color: colors.text }]}>
                    {worker.name} ({worker.workerId})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {showFieldDropdown && (
          <View style={[styles.workerDropdown, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <ScrollView style={styles.workerDropdownList}>
              {fields.map((field: Field) => (
                <TouchableOpacity
                  key={field.id}
                  style={[styles.workerDropdownItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setSelectedField(field.name);
                    setFilterType('field');
                    setShowFieldDropdown(false);

                    // Clear other filters
                    setDateFilter('');
                    setStartDateFilter('');
                    setEndDateFilter('');
                    setStartDate(null);
                    setEndDate(null);
                    setSelectedWorkerId('');
                  }}
                >
                  <Text style={[styles.workerDropdownText, { color: colors.text }]}>{field.name}</Text>
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
            <View style={[styles.dateRangeModalContent, { backgroundColor: colors.cardBackground }]}>
              {/* Header */}
              <View style={[styles.dateRangeHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.dateRangeTitle, { color: colors.text }]}>Select Date Range</Text>
                <TouchableOpacity onPress={() => {
                  setShowDateRangeModal(false);
                  setActiveDatePicker(null);
                }}>
                  <Text style={[styles.dateRangeCloseButton, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* From Date Section */}
              <View style={styles.dateSection}>
                <Text style={[styles.dateSectionLabel, { color: colors.text }]}>From Date</Text>
                <TouchableOpacity
                  style={[styles.dateDisplayBox, { backgroundColor: colors.background, borderColor: '#73AB2E' }]}
                  onPress={() => setActiveDatePicker('start')}
                >
                  <Text style={[styles.dateDisplayText, { color: colors.text }]}>
                    {startDate ? startDate.toISOString().split('T')[0] : 'Tap to select start date'}
                  </Text>
                  <Lucide name="calendar" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* To Date Section */}
              <View style={styles.dateSection}>
                <Text style={[styles.dateSectionLabel, { color: colors.text }]}>To Date</Text>
                <TouchableOpacity
                  style={[styles.dateDisplayBox, { backgroundColor: colors.background, borderColor: '#73AB2E' }]}
                  onPress={() => setActiveDatePicker('end')}
                >
                  <Text style={[styles.dateDisplayText, { color: colors.text }]}>
                    {endDate ? endDate.toISOString().split('T')[0] : 'Tap to select end date'}
                  </Text>
                  <Lucide name="calendar" size={18} color={colors.text} />
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
                { backgroundColor: colors.cardBackground || '#fff', borderColor: colors.border },
              ]}
            >
              <View style={[styles.dataCardHeader, { borderBottomColor: colors.border }]}>
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
                    <Lucide name="pencil" size={18} color="#F4B124" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(data)}
                  >
                    <Lucide name="trash-2" size={18} color="#f44336" />
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
                    {fieldNameMap[data.fieldArea] ?? data.fieldArea}
                  </Text>
                </View>

              </View>
            </View>
          ))
        )}
      </ScrollView>
      <CustomAlert visible={alertState.visible} title={alertState.title} message={alertState.message} buttons={alertState.buttons} onDismiss={hideAlert} severity={alertState.severity} />
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
    paddingVertical: 10,
  },
  filterScrollContent: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center',
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  filterButtonActive: {
    backgroundColor: '#73AB2E',
    borderColor: '#73AB2E',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
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
  },
  dateRangeTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  dateRangeCloseButton: {
    fontSize: 24,
    fontWeight: '300',
  },
  dateSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  dateSectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  dateDisplayBox: {
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateDisplayText: {
    fontSize: 15,
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
    backgroundColor: 'transparent',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#73AB2E',
  },
  clearDateButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#73AB2E',
  },
  applyDateButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#73AB2E',
  },
  applyDateButtonDisabled: {
    borderColor: '#ccc',
    opacity: 0.5,
  },
  applyDateButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#73AB2E',
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
    borderWidth: 1,
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

