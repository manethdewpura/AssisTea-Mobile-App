import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector } from '../../hooks';
import { selectTheme } from '../../store/selectors';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TeaPlantationStackParamList } from '../../navigation/TeaPlantationNavigator';
import { workerService } from '../../services';
import { handleFirebaseError, logError } from '../../utils';
import type { Worker } from '../../models/Worker';
type Props = NativeStackScreenProps<
  TeaPlantationStackParamList,
  'WorkerDetails'
>;

const WorkerDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useAppSelector(selectTheme);
  const { workerId, editMode } = route.params;
  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Editable form state
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [age, setAge] = useState('');
  const [experience, setExperience] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');

  useEffect(() => {
    loadWorkerDetails();
  }, [workerId]);

  const loadWorkerDetails = async () => {
    try {
      setLoading(true);
      const fetchedWorker = await workerService.getWorkerById(workerId);

      if (fetchedWorker) {
        setWorker(fetchedWorker);
        setName(fetchedWorker.name);
        setBirthDate(fetchedWorker.birthDate);
        // Initialise the date picker value from the stored birth date
        const parsed = new Date(fetchedWorker.birthDate);
        if (!isNaN(parsed.getTime())) {
          setSelectedDate(parsed);
        }
        setAge(String(fetchedWorker.age));
        setExperience(fetchedWorker.experience);
        setGender(fetchedWorker.gender === 'Other' ? 'Male' : fetchedWorker.gender);
      } else {
        Alert.alert('Error', 'Worker not found');
        navigation.goBack();
      }
    } catch (error: any) {
      const appError = handleFirebaseError(error);
      logError(appError, 'WorkerDetailsScreen - LoadWorkerDetails');
      Alert.alert('Error', appError.userMessage);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (birthDateString: string): number => {
    const bd = new Date(birthDateString);
    const today = new Date();
    let calculatedAge = today.getFullYear() - bd.getFullYear();
    const monthDiff = today.getMonth() - bd.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < bd.getDate())) {
      calculatedAge--;
    }
    return Math.max(0, calculatedAge);
  };

  const handleDateChange = (event: any, date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      const dateString = date.toISOString().split('T')[0];
      setBirthDate(dateString);
      setAge(String(calculateAge(dateString)));
    }
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
  };

  const handleUpdate = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Please enter a name');
      return;
    }
    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge <= 0) {
      Alert.alert('Validation', 'Please enter a valid age');
      return;
    }
    const trimmedBirthDate = birthDate.trim();
    const birthDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!trimmedBirthDate || !birthDateRegex.test(trimmedBirthDate)) {
      Alert.alert('Validation', 'Please enter a valid birth date in the format YYYY-MM-DD');
      return;
    }
    const trimmedExperience = experience.trim();
    if (!trimmedExperience) {
      Alert.alert('Validation', 'Please enter experience');
      return;
    }
    try {
      setSaving(true);
      await workerService.updateWorker(workerId, {
        name: name.trim(),
        birthDate: trimmedBirthDate,
        age: parsedAge,
        experience: trimmedExperience,
        gender,
      });
      Alert.alert('Success', 'Worker updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      const appError = handleFirebaseError(error);
      logError(appError, 'WorkerDetailsScreen - UpdateWorker');
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
      </View>
    );
  }

  if (!worker) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.errorText, { color: colors.text }]}>
          Worker not found
        </Text>
      </View>
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
        <View
          style={[
            styles.detailsCard,
            { backgroundColor: colors.cardBackground || '#fff', borderColor: colors.border },
          ]}
        >
          {/* Profile Avatar */}
          <View style={styles.avatarSection}>
            <View
              style={[
                styles.avatarContainer,
                { borderColor: '#7cb342' },
              ]}
            >
              <Text style={styles.avatarEmoji}>👤</Text>
            </View>
          </View>

          {/* Details Section */}
          <View style={styles.detailsSection}>
            {/* Name */}
            <View style={styles.detailGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Name</Text>
              <View
                style={[
                  styles.detailBox,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                {editMode ? (
                  <TextInput
                    style={[styles.detailValue, { color: colors.text }]}
                    value={name}
                    onChangeText={setName}
                    placeholderTextColor="#999"
                  />
                ) : (
                  <Text style={[styles.detailValue, { color: colors.text }]}>{worker.name}</Text>
                )}
              </View>
            </View>

            {/* Worker ID */}
            <View style={styles.detailGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Worker ID</Text>
              <View
                style={[
                  styles.detailBox,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.detailValue, { color: colors.text }]}>{worker.workerId}</Text>
              </View>
            </View>

            {/* Birth Date */}
            <View style={styles.detailGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Birth Date</Text>
              {editMode ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.detailBox,
                      { backgroundColor: colors.background, borderColor: colors.border },
                    ]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={[styles.detailValue, { color: birthDate ? colors.text : '#999' }]}>
                      {birthDate || 'Select Date'}
                    </Text>
                  </TouchableOpacity>
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
                        minimumDate={new Date(1940, 0, 1)}
                        maximumDate={new Date()}
                      />
                    </View>
                  </Modal>
                </>
              ) : (
                <View
                  style={[
                    styles.detailBox,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.detailValue, { color: colors.text }]}>{worker.birthDate}</Text>
                </View>
              )}
            </View>

            {/* Age */}
            <View style={styles.detailGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Age</Text>
              <View
                style={[
                  styles.detailBox,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                {editMode ? (
                  <TextInput
                    style={[styles.detailValue, { color: colors.text }]}
                    value={age}
                    onChangeText={setAge}
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />
                ) : (
                  <Text style={[styles.detailValue, { color: colors.text }]}>{worker.age}</Text>
                )}
              </View>
            </View>

            {/* Experience */}
            <View style={styles.detailGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Experience</Text>
              <View
                style={[
                  styles.detailBox,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                {editMode ? (
                  <TextInput
                    style={[styles.detailValue, { color: colors.text }]}
                    value={experience}
                    onChangeText={setExperience}
                    placeholderTextColor="#999"
                  />
                ) : (
                  <Text style={[styles.detailValue, { color: colors.text }]}>{worker.experience}</Text>
                )}
              </View>
            </View>

            {/* Gender */}
            <View style={styles.detailGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Gender</Text>
              {editMode ? (
                <View style={styles.genderRow}>
                  {(['Male', 'Female'] as const).map(option => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.genderOption,
                        { borderColor: colors.border },
                        gender === option && styles.genderOptionSelected,
                      ]}
                      onPress={() => setGender(option)}
                    >
                      <Text
                        style={[
                          styles.genderOptionText,
                          { color: gender === option ? '#fff' : colors.text },
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View
                  style={[
                    styles.detailBox,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.detailValue, { color: colors.text }]}>{worker.gender}</Text>
                </View>
              )}
            </View>

            {/* Update Button */}
            {editMode && (
              <TouchableOpacity
                style={[styles.updateButton, saving && styles.updateButtonDisabled]}
                onPress={handleUpdate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#F4B124" />
                ) : (
                  <Text style={styles.updateButtonText}>Update Worker</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
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
  errorText: {
    fontSize: 16,
    fontWeight: '500',
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
  detailsCard: {
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 60,
  },
  detailsSection: {
    width: '100%',
  },
  detailGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  detailBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 52,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  genderOptionSelected: {
    backgroundColor: '#73AB2E',
    borderColor: '#73AB2E',
  },
  genderOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F4B124',
    backgroundColor: 'transparent',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 24,
  },
  updateButtonDisabled: {
    opacity: 0.5,
  },
  updateButtonText: {
    color: '#F4B124',
    fontSize: 15,
    fontWeight: '700',
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
  viewDataButton: {
    backgroundColor: '#7cb342',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default WorkerDetailsScreen;
