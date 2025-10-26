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
import BottomNavbar from '../../components/organisms/BottomNavbar';
import TopNavbar from '../../components/organisms/TopNavbar';
import NotificationsScreen from '../NotificationsScreen';
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

const AdminDashboard: React.FC = () => {
  const { userProfile } = useAppSelector(selectAuth);
  const { colors } = useAppSelector(selectTheme);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [plantations, setPlantations] = useState<TeaPlantation[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'watering' | 'chat' | 'home' | 'schedule' | 'team'
  >('home');
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
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationCount] = useState(5); // Mock notification count

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
        showCustomAlert('Network Error', appError.userMessage, {
          severity: 'high',
          buttons: [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: () => loadData() },
          ],
        });
      } else {
        showCustomAlert(
          appError.severity === 'low'
            ? 'Notice'
            : appError.severity === 'high'
            ? 'Error'
            : 'Warning',
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
        'Validation Error',
        'Tea plantation managers must be assigned to a plantation.',
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
      showCustomAlert('Success', 'User account created successfully', {
        severity: 'low',
        buttons: [{ text: 'OK' }],
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
      showCustomAlert('Success', 'Tea plantation created successfully', {
        severity: 'low',
        buttons: [{ text: 'OK' }],
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
      'Delete Plantation',
      'Are you sure you want to delete this plantation?',
      {
        severity: 'high',
        buttons: [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await teaPlantationService.deleteTeaPlantation(plantationId);
                showCustomAlert('Success', 'Plantation deleted successfully', {
                  severity: 'low',
                  buttons: [{ text: 'OK' }],
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
        Role: {item.role.replace('_', ' ').toUpperCase()}
      </Text>
      {item.plantationName && (
        <Text style={[styles.userPlantation, { color: colors.textSecondary }]}>
          Plantation: {item.plantationName}
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
        Location: {item.location}
      </Text>
      <Text style={[styles.plantationArea, { color: colors.textSecondary }]}>
        Area: {item.area} acres
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
        title="Delete"
        onPress={() => handleDeletePlantation(item.id)}
        variant="danger"
        size="small"
        style={styles.deleteButton}
      />
    </View>
  );

  // Show notifications screen if requested
  if (showNotifications) {
    return (
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <NotificationsScreen onBackPress={() => setShowNotifications(false)} />
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TopNavbar
        onNotificationPress={() => setShowNotifications(true)}
        unreadCount={notificationCount}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Loading...
            </Text>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Plantation Managers
            </Text>
            <Button
              title="+ Add Manager"
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
              My Plantation
            </Text>
            {plantations.length === 0 && (
              <Button
                title="+ Create Plantation"
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

        {/* Create User Modal */}
        <Modal visible={showCreateUserModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalContent, { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Create New Manager
              </Text>

              <Input
                placeholder="Email"
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
                placeholder="Password"
                value={newUser.password}
                onChangeText={text => {
                  setNewUser({ ...newUser, password: text });
                  if (userFormErrors.password)
                    setUserFormErrors(prev => ({ ...prev, password: '' }));
                }}
                error={userFormErrors.password}
              />

              <View style={styles.roleContainer}>
                <Text style={styles.roleLabel}>Role:</Text>
                <View style={[styles.roleButton, styles.roleButtonActive]}>
                  <Text
                    style={[styles.roleButtonText, styles.roleButtonTextActive]}
                  >
                    Tea Plantation Manager
                  </Text>
                </View>
              </View>

              {newUser.role === 'tea_plantation_manager' && (
                <View style={styles.plantationSelector}>
                  <Text style={styles.plantationLabel}>
                    Assign to Plantation:
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
                      You need to create a plantation first before adding
                      managers.
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowCreateUserModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={handleCreateUser}
                >
                  <Text style={styles.createButtonText}>Create Manager</Text>
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
                Create My Tea Plantation
              </Text>

              <Input
                placeholder="Plantation Name"
                value={newPlantation.name}
                onChangeText={text => {
                  setNewPlantation({ ...newPlantation, name: text });
                  if (plantationFormErrors.name)
                    setPlantationFormErrors(prev => ({ ...prev, name: '' }));
                }}
                error={plantationFormErrors.name}
              />

              <Input
                placeholder="Location"
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
                placeholder="Area (acres)"
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
                placeholder="Description (optional)"
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
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={handleCreatePlantation}
                >
                  <Text style={styles.createButtonText}>
                    Create My Plantation
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
      <BottomNavbar activeTab={activeTab} onTabChange={setActiveTab} />
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
});

export default AdminDashboard;
