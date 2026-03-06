import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  FlatList,
  BackHandler,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAppSelector } from '../../hooks';
import { selectAuth, selectTheme } from '../../store/selectors';
import { teaPlantationService, userService } from '../../services';
import type { UserRole } from '../../common/types';
import { UserProfile } from '../../models';
import type { TeaPlantation } from '../../common/interfaces';
import Input from '../../components/atoms/Input';
import PasswordInput from '../../components/atoms/PasswordInput';
import Button from '../../components/atoms/Button';
import {
  handleFirebaseError,
  logError,
  validateEmail,
  validatePassword,
  validateRequired,
  validateNumeric,
  ensureNetworkConnection,
  isNetworkError,
} from '../../utils';
import CustomAlert, {
  type AlertButton,
} from '../../components/molecule/CustomAlert';
import { useTranslation } from 'react-i18next';

interface AdminDashboardProps {
  onNavigateToWeather?: () => void;
  onNavigateToSensors?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateToWeather, onNavigateToSensors }) => {
  const { userProfile } = useAppSelector(selectAuth);
  const { colors } = useAppSelector(selectTheme);
  const { t } = useTranslation('common');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [plantations, setPlantations] = useState<TeaPlantation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showCreatePlantationModal, setShowCreatePlantationModal] =
    useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    role: 'tea_plantation_manager' as UserRole,
    plantationId: '',
  });
  const [newPlantation, setNewPlantation] = useState({
    name: '',
    location: '',
    area: '',
    description: '',
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

  const [userFormErrors, setUserFormErrors] = useState({
    email: '',
    password: '',
  });
  const [plantationFormErrors, setPlantationFormErrors] = useState({
    name: '',
    location: '',
    area: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await ensureNetworkConnection();

      if (!userProfile?.uid) {
        throw new Error('User profile not found');
      }

      // Load only the admin's own plantation and its managers
      const [plantationData, managersData] = await Promise.all([
        teaPlantationService.getPlantationByAdminId(userProfile.uid),
        userProfile.plantationId
          ? userService.getManagersByPlantationId(userProfile.plantationId)
          : Promise.resolve([]),
      ]);

      setPlantations(plantationData ? [plantationData] : []);
      setUsers(managersData);
    } catch (error: any) {
      const appError = handleFirebaseError(error);
      logError(appError, 'AdminDashboard - LoadData');

      if (isNetworkError(error)) {
        showCustomAlert(t('admin.network_error'), appError.userMessage, {
          severity: 'high',
          buttons: [
            { text: t('general.cancel'), style: 'cancel' },
            { text: t('general.retry'), onPress: () => loadData() },
          ],
        });
      } else {
        showCustomAlert(
          appError.severity === 'low'
            ? t('general.notice')
            : appError.severity === 'high'
            ? t('general.error')
            : t('general.warning'),
          appError.userMessage,
          { severity: appError.severity },
        );
      }
    } finally {
      setLoading(false);
    }
  }, [userProfile?.uid, userProfile?.plantationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const backAction = () => {
      if (showCreateUserModal) {
        setShowCreateUserModal(false);
        return true;
      } else if (showCreatePlantationModal) {
        setShowCreatePlantationModal(false);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );
    return () => backHandler.remove();
  }, [showCreateUserModal, showCreatePlantationModal]);

  const validateUserForm = (): boolean => {
    let isValid = true;
    const errors = { email: '', password: '' };

    // Validate email
    const emailValidation = validateEmail(newUser.email);
    if (!emailValidation.isValid) {
      errors.email = emailValidation.error!;
      isValid = false;
    }

    // Validate password
    const passwordValidation = validatePassword(newUser.password);
    if (!passwordValidation.isValid) {
      errors.password = passwordValidation.error!;
      isValid = false;
    }

    // Validate plantation assignment for tea plantation managers
    if (newUser.role === 'tea_plantation_manager' && !newUser.plantationId) {
      showCustomAlert(
        t('admin.validation_error'),
        t('admin.validation_plantation_required'),
        { severity: 'low' },
      );
      isValid = false;
    }

    setUserFormErrors(errors);
    return isValid;
  };

  const validatePlantationForm = (): boolean => {
    let isValid = true;
    const errors = { name: '', location: '', area: '' };

    // Validate name
    const nameValidation = validateRequired(
      newPlantation.name,
      'Plantation name',
    );
    if (!nameValidation.isValid) {
      errors.name = nameValidation.error!;
      isValid = false;
    }

    // Validate location
    const locationValidation = validateRequired(
      newPlantation.location,
      'Location',
    );
    if (!locationValidation.isValid) {
      errors.location = locationValidation.error!;
      isValid = false;
    }

    // Validate area
    const areaValidation = validateNumeric(newPlantation.area, 'Area');
    if (!areaValidation.isValid) {
      errors.area = areaValidation.error!;
      isValid = false;
    }

    setPlantationFormErrors(errors);
    return isValid;
  };

  const handleCreateUser = async () => {
    // Clear previous errors
    setUserFormErrors({ email: '', password: '' });

    // Validate form
    if (!validateUserForm()) {
      return;
    }

    try {
      await userService.createUserAccount(
        newUser.email,
        newUser.password,
        newUser.role,
        newUser.plantationId || undefined,
        userProfile?.uid, // Pass adminId for access control
      );
      showCustomAlert(t('general.success'), t('admin.user_created'), {
        severity: 'low',
        buttons: [{ text: t('general.ok') }],
      });
      setShowCreateUserModal(false);
      setNewUser({
        email: '',
        password: '',
        role: 'tea_plantation_manager',
        plantationId: '',
      });
      loadData();
    } catch (error: any) {
      const appError = handleFirebaseError(error);
      logError(appError, 'AdminDashboard - CreateUser');

      if (error.code === 'auth/email-already-in-use') {
        setUserFormErrors(prev => ({
          ...prev,
          email: 'An account with this email already exists',
        }));
      } else if (error.code === 'auth/weak-password') {
        setUserFormErrors(prev => ({
          ...prev,
          password: 'Password should be at least 6 characters long',
        }));
      } else {
        showCustomAlert('Error', appError.userMessage, {
          severity: appError.severity,
        });
      }
    }
  };

  const handleCreatePlantation = async () => {
    // Clear previous errors
    setPlantationFormErrors({ name: '', location: '', area: '' });

    // Validate form
    if (!validatePlantationForm()) {
      return;
    }

    try {
      if (!userProfile?.uid) {
        throw new Error('User profile not found');
      }

      await teaPlantationService.createTeaPlantation(
        {
          name: newPlantation.name,
          location: newPlantation.location,
          area: parseFloat(newPlantation.area),
          description: newPlantation.description,
          adminId: userProfile.uid,
          managerIds: [],
        },
        userProfile.uid,
      );
      showCustomAlert(t('general.success'), t('admin.plantation_created'), {
        severity: 'low',
        buttons: [{ text: t('general.ok') }],
      });
      setShowCreatePlantationModal(false);
      setNewPlantation({ name: '', location: '', area: '', description: '' });
      loadData();
    } catch (error: any) {
      const appError = handleFirebaseError(error);
      logError(appError, 'AdminDashboard - CreatePlantation');
      showCustomAlert('Error', appError.userMessage, {
        severity: appError.severity,
      });
    }
  };

  const handleDeletePlantation = (plantationId: string) => {
    showCustomAlert(
      t('admin.delete_plantation_title'),
      t('admin.delete_plantation_message'),
      {
        severity: 'high',
        buttons: [
          { text: t('general.cancel'), style: 'cancel' },
          {
            text: t('general.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                await teaPlantationService.deleteTeaPlantation(plantationId);
                showCustomAlert(t('general.success'), t('admin.plantation_deleted'), {
                  severity: 'low',
                  buttons: [{ text: t('general.ok') }],
                });
                loadData();
              } catch (error: any) {
                const appError = handleFirebaseError(error);
                logError(appError, 'AdminDashboard - DeletePlantation');
                showCustomAlert('Error', appError.userMessage, {
                  severity: appError.severity,
                });
              }
            },
          },
        ],
      },
    );
  };

  const renderUser = ({ item }: { item: UserProfile }) => (
    <View
      style={[
        styles.userCard,
        { backgroundColor: colors.cardBackground, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.userEmail, { color: colors.text }]}>
        {item.email}
      </Text>
      <Text style={[styles.userRole, { color: colors.textSecondary }]}>
        {t('admin.role_label')} {item.role.replace('_', ' ').toUpperCase()}
      </Text>
      {item.plantationName && (
        <Text style={[styles.userPlantation, { color: colors.textSecondary }]}>
          {t('admin.plantation_prefix')} {item.plantationName}
        </Text>
      )}
    </View>
  );

  const renderPlantation = ({ item }: { item: TeaPlantation }) => (
    <View
      style={[
        styles.plantationCard,
        { backgroundColor: colors.cardBackground, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.plantationName, { color: colors.text }]}>
        {item.name}
      </Text>
      <Text
        style={[styles.plantationLocation, { color: colors.textSecondary }]}
      >
        {t('admin.location_prefix')} {item.location}
      </Text>
      <Text style={[styles.plantationArea, { color: colors.textSecondary }]}>
        {t('admin.area_prefix')} {item.area} {t('admin.area_suffix')}
      </Text>
      {item.description && (
        <Text
          style={[
            styles.plantationDescription,
            { color: colors.textSecondary },
          ]}
        >
          {item.description}
        </Text>
      )}
      <Button
        title={t('general.delete')}
        onPress={() => handleDeletePlantation(item.id)}
        variant="danger"
        size="small"
        style={styles.deleteButton}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              {t('general.loading')}
            </Text>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('admin.plantation_managers')}
            </Text>
            <Button
              title={t('admin.add_manager')}
              onPress={() => setShowCreateUserModal(true)}
              size="small"
              style={styles.addButton}
            />
          </View>

          <FlatList
            data={users}
            renderItem={renderUser}
            keyExtractor={item => item.uid}
            scrollEnabled={false}
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('admin.my_plantation')}
            </Text>
            {plantations.length === 0 && (
              <Button
                title={t('admin.create_plantation_btn_short')}
                onPress={() => setShowCreatePlantationModal(true)}
                size="small"
                style={styles.addButton}
              />
            )}
          </View>

          <FlatList
            data={plantations}
            renderItem={renderPlantation}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        </View>

        {/* Weather Section */}
        {onNavigateToWeather && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('admin.weather_section')}
            </Text>
            <Button
              title={`🌤️ ${t('admin.view_weather')}`}
              onPress={onNavigateToWeather}
              style={styles.weatherButton}
            />
          </View>
        )}

        {/* Sensors Section */}
        {onNavigateToSensors && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('admin.sensors_section')}
            </Text>
            <Button
              title={`📊 ${t('admin.view_sensors')}`}
              onPress={onNavigateToSensors}
              style={styles.weatherButton}
            />
          </View>
        )}

        {/* Create User Modal */}
        <Modal visible={showCreateUserModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalContent, { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t('admin.create_manager_title')}
              </Text>

              <Input
                placeholder={t('auth.email_label')}
                value={newUser.email}
                onChangeText={text => {
                  setNewUser({ ...newUser, email: text });
                  if (userFormErrors.email)
                    setUserFormErrors(prev => ({ ...prev, email: '' }));
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                error={userFormErrors.email}
              />

              <PasswordInput
                placeholder={t('auth.password_label')}
                value={newUser.password}
                onChangeText={text => {
                  setNewUser({ ...newUser, password: text });
                  if (userFormErrors.password)
                    setUserFormErrors(prev => ({ ...prev, password: '' }));
                }}
                error={userFormErrors.password}
              />

              <View style={styles.roleContainer}>
                <Text style={styles.roleLabel}>{t('admin.role_label')}</Text>
                <View style={[styles.roleButton, styles.roleButtonActive]}>
                  <Text
                    style={[styles.roleButtonText, styles.roleButtonTextActive]}
                  >
                    {t('menu.manager_role')}
                  </Text>
                </View>
              </View>

              {newUser.role === 'tea_plantation_manager' && (
                <View style={styles.plantationSelector}>
                  <Text style={styles.plantationLabel}>
                    {t('admin.assign_plantation')}
                  </Text>
                  {plantations.length > 0 ? (
                    <ScrollView style={styles.plantationList}>
                      {plantations.map(plantation => (
                        <TouchableOpacity
                          key={plantation.id}
                          style={[
                            styles.plantationOption,
                            newUser.plantationId === plantation.id &&
                              styles.plantationOptionActive,
                          ]}
                          onPress={() =>
                            setNewUser({
                              ...newUser,
                              plantationId: plantation.id,
                            })
                          }
                        >
                          <Text
                            style={[
                              styles.plantationOptionText,
                              newUser.plantationId === plantation.id &&
                                styles.plantationOptionTextActive,
                            ]}
                          >
                            {plantation.name} - {plantation.location}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text
                      style={[
                        styles.noPlantationText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t('admin.no_plantation_for_manager')}
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowCreateUserModal(false)}
                >
                  <Text style={styles.cancelButtonText}>{t('general.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={handleCreateUser}
                >
                  <Text style={styles.createButtonText}>{t('admin.create_manager_btn')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Create Plantation Modal */}
        <Modal
          visible={showCreatePlantationModal}
          animationType="slide"
          transparent
        >
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalContent, { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t('admin.create_plantation_title')}
              </Text>

              <Input
                placeholder={t('admin.plantation_name_placeholder')}
                value={newPlantation.name}
                onChangeText={text => {
                  setNewPlantation({ ...newPlantation, name: text });
                  if (plantationFormErrors.name)
                    setPlantationFormErrors(prev => ({ ...prev, name: '' }));
                }}
                error={plantationFormErrors.name}
              />

              <Input
                placeholder={t('admin.location_placeholder')}
                value={newPlantation.location}
                onChangeText={text => {
                  setNewPlantation({ ...newPlantation, location: text });
                  if (plantationFormErrors.location)
                    setPlantationFormErrors(prev => ({
                      ...prev,
                      location: '',
                    }));
                }}
                error={plantationFormErrors.location}
              />

              <Input
                placeholder={t('admin.area_placeholder')}
                value={newPlantation.area}
                onChangeText={text => {
                  setNewPlantation({ ...newPlantation, area: text });
                  if (plantationFormErrors.area)
                    setPlantationFormErrors(prev => ({ ...prev, area: '' }));
                }}
                keyboardType="numeric"
                error={plantationFormErrors.area}
              />

              <Input
                placeholder={t('admin.description_placeholder')}
                value={newPlantation.description}
                onChangeText={text =>
                  setNewPlantation({ ...newPlantation, description: text })
                }
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowCreatePlantationModal(false)}
                >
                  <Text style={styles.cancelButtonText}>{t('general.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={handleCreatePlantation}
                >
                  <Text style={styles.createButtonText}>
                    {t('admin.create_plantation_btn')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <CustomAlert
          visible={alertVisible}
          title={alertTitle}
          message={alertMessage}
          severity={alertSeverity}
          buttons={alertButtons}
          onDismiss={() => setAlertVisible(false)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 16,
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 20,
    paddingTop: 60,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
  },
  themeSelector: {
    alignSelf: 'flex-end',
  },
  section: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  userCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userRole: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  userPlantation: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 5,
  },
  plantationCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  plantationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  plantationLocation: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  plantationArea: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  plantationDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
    fontStyle: 'italic',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  roleContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'center',
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 10,
  },
  roleButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 10,
  },
  roleButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  roleButtonText: {
    fontSize: 14,
    color: '#666',
  },
  roleButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  plantationSelector: {
    marginBottom: 15,
  },
  plantationLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  plantationList: {
    maxHeight: 150,
  },
  plantationOption: {
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 5,
  },
  plantationOptionActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  plantationOptionText: {
    fontSize: 14,
    color: '#666',
  },
  plantationOptionTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  noPlantationText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
  },
  createButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    marginLeft: 10,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  weatherButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
});

export default AdminDashboard;
