import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAppSelector } from '../../hooks';
import { selectAuth, selectTheme } from '../../store/selectors';
import { teaPlantationService } from '../../services';
import Input from '../atoms/Input';
import Button from '../atoms/Button';
import {
  handleFirebaseError,
  logError,
  validateRequired,
  validateNumeric,
  ensureNetworkConnection,
} from '../../utils';
import CustomAlert, { type AlertButton } from '../molecule/CustomAlert';

interface PlantationSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PlantationSetupModal: React.FC<PlantationSetupModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { userProfile } = useAppSelector(selectAuth);
  const { colors } = useAppSelector(selectTheme);
  const [loading, setLoading] = useState(false);
  const [plantationData, setPlantationData] = useState({
    name: '',
    location: '',
    area: '',
    description: '',
  });
  const [errors, setErrors] = useState({
    name: '',
    location: '',
    area: '',
  });
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<AlertButton[] | undefined>(
    undefined,
  );
  const [alertSeverity, setAlertSeverity] = useState<
    'low' | 'medium' | 'high' | 'critical'
  >('medium');

  const showCustomAlert = (
    title: string,
    message: string,
    options?: {
      buttons?: AlertButton[];
      severity?: 'low' | 'medium' | 'high' | 'critical';
    },
  ) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertButtons(options?.buttons);
    setAlertSeverity(options?.severity || 'medium');
    setAlertVisible(true);
  };

  const validateForm = (): boolean => {
    let isValid = true;
    const newErrors = { name: '', location: '', area: '' };

    // Validate name
    const nameValidation = validateRequired(
      plantationData.name,
      'Plantation name',
    );
    if (!nameValidation.isValid) {
      newErrors.name = nameValidation.error!;
      isValid = false;
    }

    // Validate location
    const locationValidation = validateRequired(
      plantationData.location,
      'Location',
    );
    if (!locationValidation.isValid) {
      newErrors.location = locationValidation.error!;
      isValid = false;
    }

    // Validate area
    const areaValidation = validateNumeric(plantationData.area, 'Area');
    if (!areaValidation.isValid) {
      newErrors.area = areaValidation.error!;
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleCreatePlantation = async () => {
    // Clear previous errors
    setErrors({ name: '', location: '', area: '' });

    // Validate form
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await ensureNetworkConnection();

      await teaPlantationService.createTeaPlantation(
        {
          name: plantationData.name,
          location: plantationData.location,
          area: parseFloat(plantationData.area),
          description: plantationData.description,
          adminId: userProfile!.uid,
          managerIds: [],
        },
        userProfile!.uid,
      );

      showCustomAlert(
        'Success',
        'Your tea plantation has been created successfully!',
        {
          severity: 'low',
          buttons: [{ text: 'OK', onPress: () => {} }],
        },
      );
      onSuccess();
      onClose();
    } catch (error: any) {
      const appError = handleFirebaseError(error);
      logError(appError, 'PlantationSetupModal - CreatePlantation');
      showCustomAlert('Error', appError.userMessage, {
        severity: appError.severity,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <View
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Set Up Your Tea Plantation
              </Text>
              <Text
                style={[styles.modalSubtitle, { color: colors.textSecondary }]}
              >
                Please provide information about your tea plantation to get
                started.
              </Text>

              <Input
                placeholder="Plantation Name"
                value={plantationData.name}
                onChangeText={text => {
                  setPlantationData({ ...plantationData, name: text });
                  if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                }}
                error={errors.name}
              />

              <Input
                placeholder="Location"
                value={plantationData.location}
                onChangeText={text => {
                  setPlantationData({ ...plantationData, location: text });
                  if (errors.location)
                    setErrors(prev => ({ ...prev, location: '' }));
                }}
                error={errors.location}
              />

              <Input
                placeholder="Area (acres)"
                value={plantationData.area}
                onChangeText={text => {
                  setPlantationData({ ...plantationData, area: text });
                  if (errors.area) setErrors(prev => ({ ...prev, area: '' }));
                }}
                keyboardType="numeric"
                error={errors.area}
              />

              <Input
                placeholder="Description (optional)"
                value={plantationData.description}
                onChangeText={text =>
                  setPlantationData({ ...plantationData, description: text })
                }
                multiline
                numberOfLines={3}
                style={styles.textArea}
              />

              <View style={styles.modalButtons}>
                <Button
                  title={loading ? 'Creating...' : 'Create Plantation'}
                  onPress={handleCreatePlantation}
                  loading={loading}
                  disabled={loading}
                  style={styles.createButton}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        severity={alertSeverity}
        buttons={alertButtons}
        onDismiss={() => setAlertVisible(false)}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    width: '90%',
    maxHeight: '85%',
    minHeight: '50%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  scrollContent: {
    padding: 20,
    flexGrow: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    marginTop: 20,
    paddingBottom: 10,
  },
  createButton: {
    width: '100%',
  },
});

export default PlantationSetupModal;
