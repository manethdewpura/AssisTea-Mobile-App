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
import { plantationSQLiteService } from '../../services/sqlite/plantationSQLite.service';
import { userSQLiteService } from '../../services/sqlite/userSQLite.service';
import type { UserRole } from '../../common/types';
import { UserProfile } from '../../models';
import type { TeaPlantation } from '../../common/interfaces';
import Input from '../../components/atoms/Input';
import PasswordInput from '../../components/atoms/PasswordInput';
import {
  handleFirebaseError,
  logError,
  validateEmail,
  validatePassword,
  validateRequired,
  validateNumeric,
  isNetworkError,
} from '../../utils';
import { checkNetworkConnection } from '../../utils/network.util';
import CustomAlert, {
  type AlertButton,
} from '../../components/molecule/CustomAlert';

interface AdminDashboardProps {
  onNavigateToWeather?: () => void;
  onNavigateToSensors?: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateToWeather }) => {
  const { userProfile } = useAppSelector(selectAuth);
  const { colors } = useAppSelector(selectTheme);
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

  const loadFromCache = useCallback(async () => {
    if (!userProfile?.plantationId) {
      setPlantations([]);
      setUsers([]);
      return;
    }

    const localPlantation = await plantationSQLiteService.getPlantation(
      userProfile.plantationId,
    );
    setPlantations(localPlantation ? [localPlantation as any] : []);
    const localManagers = await userSQLiteService.getManagersByPlantationId(
      userProfile.plantationId,
    );
    setUsers(localManagers as any);
  }, [userProfile?.plantationId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (!userProfile?.uid) {
        throw new Error('User profile not found');
      }

      const { isConnected } = await checkNetworkConnection();

      if (isConnected) {
        const [plantationData, managersData] = await Promise.all([
          teaPlantationService.getPlantationByAdminId(userProfile.uid),
          userProfile.plantationId
            ? userService.getManagersByPlantationId(userProfile.plantationId)
            : Promise.resolve([]),
        ]);

        setPlantations(plantationData ? [plantationData] : []);
        setUsers(managersData);
        return;
      }

      // Offline: use cached data if available
      await loadFromCache();
    } catch (error: any) {
      const appError = handleFirebaseError(error);
      logError(appError, 'AdminDashboard - LoadData');

      if (isNetworkError(error)) {
        // For offline state, prefer cached data and a softer warning.
        await loadFromCache();
        showCustomAlert('Offline Mode', appError.userMessage, {
          severity: 'medium',
          buttons: [{ text: 'OK', style: 'default' }],
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
  }, [userProfile?.uid, userProfile?.plantationId, loadFromCache]);

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

    const emailValidation = validateEmail(newUser.email);
    if (!emailValidation.isValid) {
      errors.email = emailValidation.error!;
      isValid = false;
    }

    const passwordValidation = validatePassword(newUser.password);
    if (!passwordValidation.isValid) {
      errors.password = passwordValidation.error!;
      isValid = false;
    }

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

    const nameValidation = validateRequired(newPlantation.name, 'Plantation name');
    if (!nameValidation.isValid) {
      errors.name = nameValidation.error!;
      isValid = false;
    }

    const locationValidation = validateRequired(newPlantation.location, 'Location');
    if (!locationValidation.isValid) {
      errors.location = locationValidation.error!;
      isValid = false;
    }

    const areaValidation = validateNumeric(newPlantation.area, 'Area');
    if (!areaValidation.isValid) {
      errors.area = areaValidation.error!;
      isValid = false;
    }

    setPlantationFormErrors(errors);
    return isValid;
  };

  const handleCreateUser = async () => {
    setUserFormErrors({ email: '', password: '' });

    if (!validateUserForm()) {
      return;
    }

    try {
      await userService.createUserAccount(
        newUser.email,
        newUser.password,
        newUser.role,
        newUser.plantationId || undefined,
        userProfile?.uid,
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
    setPlantationFormErrors({ name: '', location: '', area: '' });

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
    <View style={[styles.userCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
      <View style={styles.userCardLeft}>
        <View style={styles.userIconContainer}>
          <Text style={styles.userIconText}>🧑‍💼</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userEmail, { color: colors.text }]} numberOfLines={1}>
            {item.email}
          </Text>
          <View style={styles.roleBadge}>
            <Text style={[styles.roleBadgeText, { color: colors.text }]}>
              {item.role.replace(/_/g, ' ').toUpperCase()}
            </Text>
          </View>
          {item.plantationName && (
            <Text style={[styles.userPlantation, { color: colors.textSecondary }]}>
              🌱 {item.plantationName}
            </Text>
          )}
        </View>
      </View>
    </View>
  );

  const renderPlantation = ({ item }: { item: TeaPlantation }) => (
    <View style={[styles.plantationCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
      <View style={styles.plantationHeader}>
        <View style={styles.plantationIconContainer}>
          <Text style={styles.plantationIcon}>🌿</Text>
        </View>
        <View style={styles.plantationInfo}>
          <Text style={[styles.plantationName, { color: colors.text }]}>
            {item.name}
          </Text>
          <Text style={[styles.plantationLocation, { color: colors.textSecondary }]}>
            📍 {item.location}
          </Text>
        </View>
      </View>
      <View style={styles.plantationDetails}>
        <View style={styles.detailChip}>
          <Text style={[styles.detailChipText, { color: colors.text }]}>🌾 {item.area} acres</Text>
        </View>
        {item.description && (
          <Text style={[styles.plantationDescription, { color: colors.textSecondary }]}>
            {item.description}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={[styles.deletePlantationBtn, { alignSelf: 'flex-end' }]}
        onPress={() => handleDeletePlantation(item.id)}
        activeOpacity={0.7}
      >
        <Text style={styles.deletePlantationBtnText}>Delete Plantation</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Header */}
        <View style={styles.heroHeader}>
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroLabel}>ADMIN CONTROL CENTER</Text>
                <Text style={styles.heroTitle}>Dashboard</Text>
              </View>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>⚙️</Text>
              </View>
            </View>
            <Text style={styles.heroSubtitle}>
              Welcome back, {userProfile?.email?.split('@')[0] || 'Admin'}
            </Text>

            {/* Summary Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Text style={styles.statPillValue}>{plantations.length}</Text>
                <Text style={styles.statPillLabel}>Plantation</Text>
              </View>
              <View style={styles.statPillDivider} />
              <View style={styles.statPill}>
                <Text style={styles.statPillValue}>{users.length}</Text>
                <Text style={styles.statPillLabel}>Managers</Text>
              </View>
              <View style={styles.statPillDivider} />
              <View style={styles.statPill}>
                <Text style={styles.statPillValue}>
                  {plantations.reduce((acc, p) => acc + (p.area || 0), 0)}
                </Text>
                <Text style={styles.statPillLabel}>Acres</Text>
              </View>
            </View>
          </View>
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#73AB2E" />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading data...
            </Text>
          </View>
        )}

        {/* Plantation Managers Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <View style={styles.sectionAccent} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Plantation Managers
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setShowCreateUserModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.addBtnPlus}>＋</Text>
              <Text style={styles.addBtnText}>Add Manager</Text>
            </TouchableOpacity>
          </View>

          {users.length === 0 && !loading ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.emptyIcon}>👤</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Managers Yet</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Add a plantation manager to get started.
              </Text>
            </View>
          ) : (
            <FlatList
              data={users}
              renderItem={renderUser}
              keyExtractor={item => item.uid}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* My Plantation Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <View style={[styles.sectionAccent, styles.sectionAccentAmber]} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                My Plantation
              </Text>
            </View>
            {plantations.length === 0 && (
              <TouchableOpacity
                style={[styles.addBtn, styles.addBtnAmber]}
                onPress={() => setShowCreatePlantationModal(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.addBtnPlus, styles.addBtnPlusAmber]}>＋</Text>
                <Text style={[styles.addBtnText, styles.addBtnTextAmber]}>Create</Text>
              </TouchableOpacity>
            )}
          </View>

          {plantations.length === 0 && !loading ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.emptyIcon}>🌿</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Plantation Yet</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Create your first tea plantation to start managing.
              </Text>
            </View>
          ) : (
            <FlatList
              data={plantations}
              renderItem={renderPlantation}
              keyExtractor={item => item.id}
              scrollEnabled={false}
            />
          )}
        </View>

        {/* Weather Section */}
        {onNavigateToWeather && (
          <View style={styles.sectionContainer}>
            <View style={styles.sectionTitleGroup}>
              <View style={[styles.sectionAccent, styles.sectionAccentSky]} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Weather Forecast
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.weatherCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
              onPress={onNavigateToWeather}
              activeOpacity={0.8}
            >
              <View style={styles.weatherCardInner}>
                <View style={styles.weatherIconContainer}>
                  <Text style={styles.weatherCardIcon}>🌤️</Text>
                </View>
                <View>
                  <Text style={[styles.weatherCardTitle, { color: colors.text }]}>View Weather Forecast</Text>
                  <Text style={[styles.weatherCardSub, { color: colors.textSecondary }]}>Tap to see current forecast</Text>
                </View>
              </View>
              <Text style={styles.weatherCardArrow}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSpacer} />

        {/* Create User Modal */}
        <Modal visible={showCreateUserModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeaderBar}>
                <View style={styles.modalDragHandle} />
              </View>
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
                <Text style={[styles.roleLabel, { color: colors.textSecondary }]}>Role:</Text>
                <View style={styles.roleChip}>
                  <Text style={[styles.roleChipText, { color: colors.text }]}>Tea Plantation Manager</Text>
                </View>
              </View>

              {newUser.role === 'tea_plantation_manager' && (
                <View style={styles.plantationSelector}>
                  <Text style={[styles.plantationLabel, { color: colors.text }]}>
                    Assign to Plantation:
                  </Text>
                  {plantations.length > 0 ? (
                    <ScrollView style={styles.plantationList}>
                      {plantations.map(plantation => (
                        <TouchableOpacity
                          key={plantation.id}
                          style={[
                            styles.plantationOption,
                            { borderColor: colors.border },
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
                              { color: colors.text },
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
                    <Text style={[styles.noPlantationText, { color: colors.textSecondary }]}>
                      You need to create a plantation first before adding managers.
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => setShowCreateUserModal(false)}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
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
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeaderBar}>
                <View style={styles.modalDragHandle} />
              </View>
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
                  style={[styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => setShowCreatePlantationModal(false)}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.createButton, styles.createButtonAmber]}
                  onPress={handleCreatePlantation}
                >
                  <Text style={styles.createButtonText}>Create Plantation</Text>
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
  },

  /* ── Hero Header ── */
  heroHeader: {
    backgroundColor: '#0E401D',
    paddingTop: 52,
    paddingBottom: 28,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(115, 171, 46, 0.12)',
  },
  heroContent: {},
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#73AB2E',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  heroBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(115,171,46,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(115,171,46,0.4)',
  },
  heroBadgeText: {
    fontSize: 22,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 20,
  },

  /* Stats Row inside hero */
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
  },
  statPillValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  statPillLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statPillDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 4,
  },

  /* Loading */
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 15,
  },

  /* Section */
  sectionContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionAccent: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: '#73AB2E',
  },
  sectionAccentAmber: {
    backgroundColor: '#F4B124',
  },
  sectionAccentSky: {
    backgroundColor: '#F4B124',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  /* Add Button */
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: '#73AB2E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 14,
    backgroundColor: 'transparent',
  },
  addBtnAmber: {
    borderColor: '#F4B124',
  },
  addBtnPlus: {
    color: '#73AB2E',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 16,
  },
  addBtnPlusAmber: {
    color: '#F4B124',
  },
  addBtnText: {
    color: '#73AB2E',
    fontWeight: '700',
    fontSize: 13,
  },
  addBtnTextAmber: {
    color: '#F4B124',
  },

  /* User Card */
  userCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  userCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(115,171,46,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userIconText: {
    fontSize: 22,
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 5,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(115,171,46,0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  userPlantation: {
    fontSize: 12,
    marginTop: 2,
  },

  /* Plantation Card */
  plantationCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  plantationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  plantationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(244,177,36,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plantationIcon: {
    fontSize: 22,
  },
  plantationInfo: {
    flex: 1,
  },
  plantationName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  plantationLocation: {
    fontSize: 13,
  },
  plantationDetails: {
    marginBottom: 12,
  },
  detailChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(14,64,29,0.08)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 8,
  },
  detailChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  plantationDescription: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  deleteButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },

  /* Empty state card */
  emptyCard: {
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 8,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },

  /* Delete button (ghost outlined, red) */
  deletePlantationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: '#E53935',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  deletePlantationBtnText: {
    color: '#E53935',
    fontWeight: '700',
    fontSize: 13,
  },

  /* Weather card */
  weatherCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  weatherCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  weatherIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(244,177,36,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  weatherCardIcon: {
    fontSize: 22,
  },
  weatherCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  weatherCardSub: {
    fontSize: 12,
  },
  weatherCardArrow: {
    fontSize: 28,
    color: '#F4B124',
    fontWeight: '300',
  },

  bottomSpacer: {
    height: 36,
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 12,
    maxHeight: '88%',
  },
  modalHeaderBar: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  roleContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'center',
    gap: 10,
  },
  roleLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(115,171,46,0.12)',
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  plantationSelector: {
    marginBottom: 15,
  },
  plantationLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  plantationList: {
    maxHeight: 150,
  },
  plantationOption: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  plantationOptionActive: {
    backgroundColor: '#73AB2E',
    borderColor: '#73AB2E',
  },
  plantationOptionText: {
    fontSize: 14,
  },
  plantationOptionTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  noPlantationText: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 12,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#73AB2E',
    alignItems: 'center',
  },
  createButtonAmber: {
    backgroundColor: '#F4B124',
  },
  createButtonText: {
    fontSize: 15,
    color: 'white',
    fontWeight: '700',
  },
});

export default AdminDashboard;
