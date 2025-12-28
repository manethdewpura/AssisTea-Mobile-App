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
    teaLeafQuality: '',
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
        teaLeafQuality: data.teaLeafQuality,
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
      !formData.fieldArea ||
      !formData.teaLeafQuality
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
        teaLeafQuality: formData.teaLeafQuality,
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
              { backgroundColor: colors.cardBackground || '#fff' },
            ]}
          >
            {/* Date Section */}
            <View style={styles.dateSection}>
              <Text style={[styles.dateLabel, { color: colors.text }]}>
                Date: {formData.date}
              </Text>
              <TouchableOpacity
                style={styles.calendarButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.calendarIcon}>📅</Text>
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
                  { backgroundColor: colors.background },
                ]}
                onPress={() => setShowWorkerDropdown(!showWorkerDropdown)}
              >
                <Text style={[styles.dropdownText, { color: colors.text }]}>
                  {getWorkerName(formData.workerId)}
                </Text>
                <Text style={styles.dropdownIcon}>▼</Text>
              </TouchableOpacity>

              {showWorkerDropdown && (
                <View style={styles.dropdownList}>
                  {workers.map(worker => (
                    <TouchableOpacity
                      key={worker.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFormData({ ...formData, workerId: worker.id });
                        setShowWorkerDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>
                        {worker.name} ({worker.workerId})
                      </Text>
                    </TouchableOpacity>
                  ))}
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
                  { backgroundColor: colors.background },
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
                  { backgroundColor: colors.background },
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
                  { backgroundColor: colors.background },
                ]}
                onPress={() => setShowFieldDropdown(!showFieldDropdown)}
              >
                <Text style={[styles.dropdownText, { color: colors.text }]}>
                  {getFieldName(formData.fieldArea)}
                </Text>
                <Text style={styles.dropdownIcon}>▼</Text>
              </TouchableOpacity>

              {showFieldDropdown && (
                <View style={styles.dropdownList}>
                  {MOCK_FIELD_AREAS.map(field => (
                    <TouchableOpacity
                      key={field.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFormData({ ...formData, fieldArea: field.id });
                        setShowFieldDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{field.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Tea Leaf Quality */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                Tea Leaf Quality
              </Text>
              <View
                style={[
                  styles.inputBox,
                  { backgroundColor: colors.background },
                ]}
              >
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="Enter quality (e.g., High, Medium, Low)"
                  placeholderTextColor="#999"
                  value={formData.teaLeafQuality}
                  onChangeText={text =>
                    setFormData({ ...formData, teaLeafQuality: text })
                  }
                />
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveData}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
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
    borderBottomColor: '#e0e0e0',
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
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textInput: {
    fontSize: 14,
    color: '#333',
  },
  dropdownBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 4,
    maxHeight: 150,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    backgroundColor: '#fbc02d',
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveIcon: {
    fontSize: 18,
    color: '#fff',
    marginRight: 6,
    fontWeight: 'bold',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EditDailyDataScreen;

