import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  TextInput,
  Modal,
} from 'react-native';
import { useAppSelector } from '../../hooks';
import { selectAuth, selectTheme } from '../../store/selectors';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TeaPlantationStackParamList } from '../../navigation/TeaPlantationNavigator';
import { workerService } from '../../services';
import { handleFirebaseError, logError, validateRequired } from '../../utils';

type Props = NativeStackScreenProps<
  TeaPlantationStackParamList,
  'AddWorker'
>;

const AddWorkerScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useAppSelector(selectTheme);
  const { userProfile } = useAppSelector(selectAuth);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [formData, setFormData] = useState({
    name: '',
    workerId: '',
    birthDate: '',
    age: '',
    experience: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
  });

  const [errors, setErrors] = useState({
    name: '',
    workerId: '',
    birthDate: '',
    age: '',
    experience: '',
  });

  const calculateAge = (birthDateString: string): number => {
    const birthDate = new Date(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return Math.max(0, age);
  };

  const handleDateChange = (event: any, date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      const dateString = date.toISOString().split('T')[0];
      const age = calculateAge(dateString);

      setFormData({
        ...formData,
        birthDate: dateString,
        age: age.toString(),
      });
    }

    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
  };

  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors = {
      name: '',
      workerId: '',
      birthDate: '',
      age: '',
      experience: '',
    };

    // Validate name
    const nameValidation = validateRequired(formData.name, 'Worker name');
    if (!nameValidation.isValid) {
      newErrors.name = nameValidation.error!;
      isValid = false;
    }

    // Validate worker ID
    const workerIdValidation = validateRequired(formData.workerId, 'Worker ID');
    if (!workerIdValidation.isValid) {
      newErrors.workerId = workerIdValidation.error!;
      isValid = false;
    }

    // Validate birth date
    if (!formData.birthDate) {
      newErrors.birthDate = 'Birth date is required';
      isValid = false;
    }

    // Validate age
    if (!formData.age) {
      newErrors.age = 'Age is required';
      isValid = false;
    }

    // Validate experience
    const experienceValidation = validateRequired(formData.experience, 'Experience');
    if (!experienceValidation.isValid) {
      newErrors.experience = experienceValidation.error!;
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSaveWorker = async () => {
    if (!validateForm()) {
      return;
    }

    if (!userProfile?.plantationId) {
      Alert.alert('Error', 'Plantation information not found');
      return;
    }

    try {
      setLoading(true);

      // Check if worker ID already exists in this plantation
      const exists = await workerService.checkWorkerIdExists(
        formData.workerId,
        userProfile.plantationId,
      );

      if (exists) {
        setErrors(prev => ({
          ...prev,
          workerId: 'This Worker ID already exists in your plantation',
        }));
        return;
      }

      // Create worker
      await workerService.createWorker(userProfile.plantationId, {
        name: formData.name.trim(),
        workerId: formData.workerId.trim(),
        birthDate: formData.birthDate,
        age: parseInt(formData.age, 10),
        experience: formData.experience.trim(),
        gender: formData.gender,
      });

      Alert.alert('Success', 'Worker added successfully', [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (error: any) {
      const appError = handleFirebaseError(error);
      logError(appError, 'AddWorkerScreen');
      Alert.alert('Error', appError.userMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AssisTea</Text>
          <TouchableOpacity style={styles.notificationButton}>
            <Text style={styles.notificationIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Green Section */}
        <View style={styles.greenSection} />

        {/* Content */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={[styles.formCard, { backgroundColor: colors.cardBackground || '#fff' }]}>
            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Name</Text>
              <View
                style={[
                  styles.inputBox,
                  {
                    borderColor: errors.name ? colors.error : colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  value={formData.name}
                  onChangeText={text => {
                    setFormData({ ...formData, name: text });
                    if (errors.name) setErrors({ ...errors, name: '' });
                  }}
                  placeholder="Enter worker name"
                  placeholderTextColor="#999"
                />
              </View>
              {errors.name && (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {errors.name}
                </Text>
              )}
            </View>

            {/* Worker ID Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Worker ID</Text>
              <View
                style={[
                  styles.inputBox,
                  {
                    borderColor: errors.workerId ? colors.error : colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  value={formData.workerId}
                  onChangeText={text => {
                    setFormData({ ...formData, workerId: text });
                    if (errors.workerId) setErrors({ ...errors, workerId: '' });
                  }}
                  placeholder="e.g., T-001"
                  placeholderTextColor="#999"
                />
              </View>
              {errors.workerId && (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {errors.workerId}
                </Text>
              )}
            </View>

            {/* Birth Date Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Birth Date</Text>
              <TouchableOpacity
                style={[
                  styles.inputBox,
                  {
                    borderColor: errors.birthDate ? colors.error : colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
                onPress={() => setShowDatePicker(true)}
                disabled={loading}
              >
                <Text style={[styles.datePickerText, { color: colors.text }]}>
                  {formData.birthDate || 'Select Date'}
                </Text>
              </TouchableOpacity>
              {errors.birthDate && (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {errors.birthDate}
                </Text>
              )}

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
            </View>

            {/* Age Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Age</Text>
              <View
                style={[
                  styles.inputBox,
                  {
                    borderColor: '#ddd',
                    backgroundColor: '#f0f0f0',
                  },
                ]}
              >
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  value={formData.age}
                  editable={false}
                  placeholder="Auto-calculated"
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            {/* Experience Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Experience</Text>
              <View
                style={[
                  styles.inputBox,
                  {
                    borderColor: errors.experience ? colors.error : colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  value={formData.experience}
                  onChangeText={text => {
                    setFormData({ ...formData, experience: text });
                    if (errors.experience) setErrors({ ...errors, experience: '' });
                  }}
                  placeholder="e.g., 10 years"
                  placeholderTextColor="#999"
                />
              </View>
              {errors.experience && (
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {errors.experience}
                </Text>
              )}
            </View>

            {/* Gender Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Gender</Text>
              <View style={styles.genderContainer}>
                {(['Male', 'Female', 'Other'] as const).map(gender => (
                  <TouchableOpacity
                    key={gender}
                    style={[
                      styles.genderButton,
                      formData.gender === gender && styles.genderButtonActive,
                      {
                        borderColor: colors.border,
                        backgroundColor:
                          formData.gender === gender
                            ? '#7cb342'
                            : colors.background,
                      },
                    ]}
                    onPress={() => setFormData({ ...formData, gender })}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.genderButtonText,
                        formData.gender === gender && styles.genderButtonTextActive,
                      ]}
                    >
                      {gender}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                { opacity: loading ? 0.6 : 1 },
              ]}
              onPress={handleSaveWorker}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.saveIcon}>✓</Text>
                  <Text style={styles.saveButtonText}>Save</Text>
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
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputBox: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 14,
    color: '#333',
  },
  datePickerText: {
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
  errorText: {
    fontSize: 12,
    color: '#dc3545',
    marginTop: 4,
  },
  genderContainer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  genderButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  genderButtonActive: {
    backgroundColor: '#7cb342',
    borderColor: '#558b2f',
  },
  genderButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  genderButtonTextActive: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#fbc02d',
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
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

export default AddWorkerScreen;
