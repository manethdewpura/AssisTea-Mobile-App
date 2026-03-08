import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  TextInput,
  Modal,
} from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector } from '../../hooks';
import { selectAuth, selectTheme } from '../../store/selectors';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TeaPlantationStackParamList } from '../../navigation/TeaPlantationNavigator';
import { workerService, dailyDataService } from '../../services';
import { handleFirebaseError, logError } from '../../utils';
import type { Worker } from '../../models/Worker';

type Props = NativeStackScreenProps<
  TeaPlantationStackParamList,
  'EditDailyData'
>;

interface FieldArea {
  id: string;
  name: string;
}

const MOCK_FIELD_AREAS: FieldArea[] = [
  { id: '1', name: 'Field A' },
  { id: '2', name: 'Field B' },
  { id: '3', name: 'Field C' },
];

const EditDailyDataScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useAppSelector(selectTheme);
  const { userProfile } = useAppSelector(selectAuth);
  const { dataId } = route.params;
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    workerId: '',
    teaPluckedKg: '',
    timeSpentHours: '',
    fieldArea: '',
  });

  const [showWorkerDropdown, setShowWorkerDropdown] = useState(false);
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);

  useEffect(() => {
    loadWorkers();
    loadDailyData();
  }, [dataId]);

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
      logError(appError, 'EditDailyDataScreen - LoadWorkers');
    }
  };

  const loadDailyData = async () => {
    try {
      setLoading(true);
      const data = await dailyDataService.getDailyDataById(dataId);

      if (!data) {
        Alert.alert('Error', 'Daily data not found');
        navigation.goBack();
        return;
      }

      // Parse date string to Date object
      const dateParts = data.date.split('-');
      const date = new Date(
        parseInt(dateParts[0]),
        parseInt(dateParts[1]) - 1,
        parseInt(dateParts[2]),
      );

      setSelectedDate(date);
      setFormData({
        date: data.date,
        workerId: data.workerId,
        teaPluckedKg: data.teaPluckedKg.toString(),
        timeSpentHours: data.timeSpentHours.toString(),
        fieldArea: data.fieldArea,
      });
    } catch (error: any) {
      const appError = handleFirebaseError(error);
      logError(appError, 'EditDailyDataScreen - LoadDailyData');
      Alert.alert('Error', appError.userMessage);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      const dateString = date.toISOString().split('T')[0];
      setFormData({ ...formData, date: dateString });
    }

    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
  };

  const getWorkerName = (workerId: string) => {
    const worker = workers.find(w => w.id === workerId);
    return worker ? worker.name : 'Select Worker';
  };

  const getFieldName = (fieldId: string) => {
    const field = MOCK_FIELD_AREAS.find(f => f.id === fieldId);
    return field ? field.name : 'Select Field Area';
  };

  const handleSaveData = async () => {
    if (
      !formData.workerId ||
      !formData.teaPluckedKg ||
      !formData.timeSpentHours ||
      !formData.fieldArea
    ) {
      Alert.alert('Validation', 'Please fill in all fields');
      return;
    }

    try {
      setSaving(true);
      await dailyDataService.updateDailyData(dataId, {
        workerId: formData.workerId,
        date: formData.date,
        teaPluckedKg: parseFloat(formData.teaPluckedKg),
        timeSpentHours: parseFloat(formData.timeSpentHours),
        fieldArea: formData.fieldArea,
      });

      Alert.alert('Success', 'Daily data updated successfully', [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (error: any) {
      const appError = handleFirebaseError(error);
      logError(appError, 'EditDailyDataScreen - SaveData');
      Alert.alert('Error', appError.userMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color="#7cb342" />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>

        {/* Content */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View
            style={[
              styles.formCard,
              { backgroundColor: colors.cardBackground || '#fff', borderColor: colors.border },
            ]}
          >
            {/* Date Section */}
            <View style={[styles.dateSection, { borderBottomColor: colors.border }]}>
              <Text style={[styles.dateLabel, { color: colors.text }]}>
                Date: {formData.date}
              </Text>
              <TouchableOpacity
                style={styles.calendarButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Lucide name="calendar" size={24} color={colors.text} />
              </TouchableOpacity>
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

            {/* Select Worker */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                Select Worker
              </Text>
              <TouchableOpacity
                style={[
                  styles.dropdownBox,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
                onPress={() => setShowWorkerDropdown(!showWorkerDropdown)}
              >
                <Text style={[styles.dropdownText, { color: colors.text }]}>
                  {getWorkerName(formData.workerId)}
                </Text>
                <Text style={styles.dropdownIcon}>▼</Text>
              </TouchableOpacity>

              {showWorkerDropdown && (
                <View style={[styles.dropdownList, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {workers.map(worker => (
                      <TouchableOpacity
                        key={worker.id}
                        style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                        onPress={() => {
                          setFormData({ ...formData, workerId: worker.id });
                          setShowWorkerDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.text }]}>
                          {worker.name} ({worker.workerId})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Amount of Tea Plucked */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                Amount of Tea Plucked(kg)
              </Text>
              <View
                style={[
                  styles.inputBox,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="Enter amount in kg"
                  placeholderTextColor="#999"
                  value={formData.teaPluckedKg}
                  onChangeText={text =>
                    setFormData({ ...formData, teaPluckedKg: text })
                  }
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Time Spent */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                Time Spent (hours)
              </Text>
              <View
                style={[
                  styles.inputBox,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="Enter time in hours"
                  placeholderTextColor="#999"
                  value={formData.timeSpentHours}
                  onChangeText={text =>
                    setFormData({ ...formData, timeSpentHours: text })
                  }
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Field Area */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                Field Area Worked
              </Text>
              <TouchableOpacity
                style={[
                  styles.dropdownBox,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
                onPress={() => setShowFieldDropdown(!showFieldDropdown)}
              >
                <Text style={[styles.dropdownText, { color: colors.text }]}>
                  {getFieldName(formData.fieldArea)}
                </Text>
                <Text style={styles.dropdownIcon}>▼</Text>
              </TouchableOpacity>

              {showFieldDropdown && (
                <View style={[styles.dropdownList, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {MOCK_FIELD_AREAS.map(field => (
                      <TouchableOpacity
                        key={field.id}
                        style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                        onPress={() => {
                          setFormData({ ...formData, fieldArea: field.id });
                          setShowFieldDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.text }]}>{field.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>


            {/* Save Button */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveData}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#F4B124" />
              ) : (
                <>
                  <Text style={styles.saveIcon}>✓</Text>
                  <Text style={styles.saveButtonText}>Update</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
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
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginTop: 0,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dateSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  calendarButton: {
    padding: 8,
  },
  calendarIcon: {
    fontSize: 24,
  },
  inputGroup: {
    marginBottom: 16,
    position: 'relative',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 52,
    justifyContent: 'center',
    borderWidth: 1,
  },
  textInput: {
    fontSize: 14,
    color: '#333',
  },
  dropdownBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 52,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 14,
    color: '#333',
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#666',
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 2,
    maxHeight: 180,
    zIndex: 1000,
    elevation: 10,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  dropdownItemText: {
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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#F4B124',
    backgroundColor: 'transparent',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 32,
    marginTop: 25,
    alignSelf: 'center',
  },
  saveIcon: {
    fontSize: 15,
    color: '#F4B124',
    fontWeight: '700',
  },
  saveButtonText: {
    color: '#F4B124',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default EditDailyDataScreen;

