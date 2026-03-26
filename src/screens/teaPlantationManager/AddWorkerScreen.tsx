import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector, useThemedAlert } from '../../hooks';
import CustomAlert from '../../components/molecule/CustomAlert';
import { selectAuth, selectTheme } from '../../store/selectors';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TeaPlantationStackParamList } from '../../navigation/TeaPlantationNavigator';
import { workerService } from '../../services';
import { handleFirebaseError, logError, validateRequired } from '../../utils';
import { useTranslation } from 'react-i18next';
import { checkNetworkConnection } from '../../utils/network.util';

type Props = NativeStackScreenProps<
  TeaPlantationStackParamList,
  'AddWorker'
>;

const AddWorkerScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useAppSelector(selectTheme);
  const { userProfile } = useAppSelector(selectAuth);
  const { t } = useTranslation('common');
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { showAlert, hideAlert, alertState } = useThemedAlert();

  const [formData, setFormData] = useState({
    name: '',
    workerId: '',
    birthDate: '',
    age: '',
    experience: '',
    gender: 'Male' as 'Male' | 'Female',
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
      showAlert('Error', 'Plantation information not found', undefined, 'high');
      return;
    }

    try {
      setLoading(true);
      const { isConnected } = await checkNetworkConnection();
      const workerData = {
        name: formData.name.trim(),
        workerId: formData.workerId.trim(),
        birthDate: formData.birthDate,
        age: parseInt(formData.age, 10),
        experience: formData.experience.trim(),
        gender: formData.gender,
      };

      if (!isConnected) {
        // Skip duplicate ID check offline — Firebase queues the write
        await workerService.createWorker(userProfile.plantationId, workerData, false);
        showAlert('Saved Locally', 'Worker added on this device. Changes will sync automatically when you\'re back online.', [
          { text: 'OK', style: 'default', onPress: () => navigation.goBack() },
        ], 'low');
      } else {
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
        await workerService.createWorker(userProfile.plantationId, workerData, true);
        showAlert('Success', 'Worker added successfully', [
          { text: 'OK', style: 'default', onPress: () => navigation.goBack() },
        ], 'low');
      }
    } catch (error: any) {
      console.error('[AddWorker] handleSaveWorker threw an error:', error?.code, error?.message, error);
      const appError = handleFirebaseError(error);
      logError(appError, 'AddWorkerScreen');
      showAlert('Error', appError.userMessage, undefined, 'high');
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

        {/* Content */}
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={[styles.formCard, { backgroundColor: colors.cardBackground || '#fff', borderColor: colors.border }]}>
            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>{t('workers.name_label')}</Text>
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
                  placeholder={t('workers.enter_name_placeholder')}
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
              <Text style={[styles.label, { color: colors.text }]}>{t('workers.worker_id_label')}</Text>
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
                  placeholder={t('workers.worker_id_placeholder')}
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
              <Text style={[styles.label, { color: colors.text }]}>{t('workers.birth_date_label')}</Text>
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
                  {formData.birthDate || t('workers.select_date_placeholder')}
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
                      <Text style={styles.datePickerHeaderText}>{t('general.done')}</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                    minimumDate={new Date(1940, 0, 1)} // Allow birth years from 1940
                    maximumDate={new Date()}
                  />
                </View>
              </Modal>
            </View>

            {/* Age Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>{t('workers.age_label')}</Text>
              <View
                style={[
                  styles.inputBox,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  value={formData.age}
                  editable={false}
                  placeholder={t('workers.auto_calculated')}
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            {/* Experience Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>{t('workers.experience_label')}</Text>
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
                  placeholder={t('workers.experience_placeholder')}
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
              <Text style={[styles.label, { color: colors.text }]}>{t('workers.gender_label')}</Text>
              <View style={styles.genderContainer}>
                {(['Male', 'Female'] as const).map(gender => (
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
                      {gender === 'Male' ? t('workers.male') : t('workers.female')}
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
                <ActivityIndicator size="small" color="#F4B124" />
              ) : (
                <>
                  <Text style={styles.saveIcon}>✓</Text>
                  <Text style={styles.saveButtonText}>{t('general.save')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
      <CustomAlert visible={alertState.visible} title={alertState.title} message={alertState.message} buttons={alertState.buttons} onDismiss={hideAlert} severity={alertState.severity} />
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
    borderWidth: 1,
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
    height: 52,
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
    marginTop: 20,
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

export default AddWorkerScreen;
