import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Modal, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Lucide } from '@react-native-vector-icons/lucide';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { selectTheme, selectConfig } from '../../store/selectors';
import Button from '../../components/atoms/Button';
import { configService, schedulesService, IrrigationSchedule, FertigationSchedule, CreateScheduleData } from '../../services';
import { validateUrl, normalizeUrl } from '../../services/config.service';
import { saveBackendUrl, loadBackendUrl } from '../../store/slices/config.slice';
import { showToast } from '../../store/slices/notification.slice';
import type { IrrigationStackParamList } from '../../navigation/IrrigationNavigator';

type IrrigationSetupNavigationProp = NativeStackNavigationProp<
  IrrigationStackParamList,
  'IrrigationSetup'
>;

const IrrigationAndFertilizerSetupScreen: React.FC = () => {
  const navigation = useNavigation<IrrigationSetupNavigationProp>();
  const { colors } = useAppSelector(selectTheme);
  const { backendUrl } = useAppSelector(selectConfig);
  const dispatch = useAppDispatch();

  const [backendUrlInput, setBackendUrlInput] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const [irrigationSchedules, setIrrigationSchedules] = useState<IrrigationSchedule[]>([]);
  const [fertigationSchedules, setFertigationSchedules] = useState<FertigationSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [zoneInfo, setZoneInfo] = useState<{
    zone_id: number;
    valve_gpio_pin: number;
    soil_moisture_sensor_channel: number;
    altitude: number;
    slope: number;
    area: number;
    base_pressure: number;
  } | null>(null);
  const [loadingZoneInfo, setLoadingZoneInfo] = useState(false);
  
  // Schedule creation modals
  const [showIrrigationModal, setShowIrrigationModal] = useState(false);
  const [showFertigationModal, setShowFertigationModal] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [isIrrigationTimePicker, setIsIrrigationTimePicker] = useState(true);
  
  // Form data
  const [irrigationForm, setIrrigationForm] = useState<CreateScheduleData>({
    day_of_week: 0,
    time: '08:00:00',
    enabled: true,
  });
  const [fertigationForm, setFertigationForm] = useState<CreateScheduleData>({
    day_of_week: 0,
    time: '08:00:00',
    enabled: true,
  });
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [creatingSchedule, setCreatingSchedule] = useState(false);

  useEffect(() => {
    dispatch(loadBackendUrl());
  }, [dispatch]);

  const loadSchedules = useCallback(async () => {
    if (!backendUrl) return;

    try {
      setLoadingSchedules(true);
      const [irrigation, fertigation] = await Promise.all([
        schedulesService.getIrrigationSchedules().catch(() => []),
        schedulesService.getFertigationSchedules().catch(() => []),
      ]);
      setIrrigationSchedules(irrigation);
      setFertigationSchedules(fertigation);
    } catch (error: any) {
      console.warn('Failed to load schedules:', error);
    } finally {
      setLoadingSchedules(false);
    }
  }, [backendUrl]);

  const loadZoneInfo = useCallback(async () => {
    if (!backendUrl) return;

    try {
      setLoadingZoneInfo(true);
      const info = await configService.getZoneInfo().catch(() => null);
      setZoneInfo(info);
    } catch (error: any) {
      console.warn('Failed to load zone information:', error);
      setZoneInfo(null);
    } finally {
      setLoadingZoneInfo(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    if (backendUrl) {
      setBackendUrlInput(backendUrl);
      loadSchedules();
      loadZoneInfo();
    }
  }, [backendUrl, loadSchedules, loadZoneInfo]);

  const handleSaveBackendUrl = async () => {
    if (!backendUrlInput.trim()) {
      dispatch(showToast({
        message: 'Please enter a backend URL',
        type: 'error',
      }));
      return;
    }

    try {
      setSavingUrl(true);
      await dispatch(saveBackendUrl(backendUrlInput.trim())).unwrap();
      dispatch(
        showToast({
          message: 'Backend URL saved successfully',
          type: 'success',
        })
      );
      await loadSchedules();
      await loadZoneInfo();
    } catch (error: any) {
      dispatch(showToast({
        message: error.userMessage || error.message || 'Failed to save backend URL',
        type: 'error',
      }));
    } finally {
      setSavingUrl(false);
    }
  };

  const handleTestConnection = async () => {
    if (!backendUrlInput.trim()) {
      dispatch(showToast({
        message: 'Please enter a backend URL first',
        type: 'error',
      }));
      return;
    }

    try {
      const testUrl = backendUrlInput.trim();
      if (!validateUrl(testUrl)) {
        dispatch(showToast({
          message: 'Please enter a valid URL (e.g., http://192.168.1.15)',
          type: 'error',
        }));
        return;
      }

      const normalizedUrl = normalizeUrl(testUrl);
      console.log('[Test Connection] Testing URL:', normalizedUrl);
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased to 10 seconds

      // Try /health endpoint first (simpler, more reliable)
      let endpoint = `${normalizedUrl}/health`;
      console.log('[Test Connection] Trying endpoint:', endpoint);
      
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          },
        });
        clearTimeout(timeoutId);

        console.log('[Test Connection] Response status:', response.status);
        console.log('[Test Connection] Response ok:', response.ok);

        if (response.ok || response.status === 200) {
          const data = await response.json().catch(() => ({}));
          console.log('[Test Connection] Response data:', data);
          // Even if health check has issues, connection is successful
          if (data.overall_status === 'error') {
            dispatch(showToast({
              message: 'Connection successful! Server is reachable, but health check encountered an issue.',
              type: 'success',
            }));
          } else {
            dispatch(showToast({
              message: 'Connection successful!',
              type: 'success',
            }));
          }
          return;
        } else if (response.status === 500) {
          // 500 means server is reachable but has an error
          // This is still a successful connection test
          console.log('[Test Connection] Server returned 500, but connection is working');
          dispatch(showToast({
            message: 'Connection successful! Server is reachable, but encountered an error.',
            type: 'success',
          }));
          return;
        } else {
          // If /health fails, try /api/system/status as fallback
          console.log('[Test Connection] /health failed, trying /api/system/status');
          endpoint = `${normalizedUrl}/api/system/status`;
          
          const fallbackController = new AbortController();
          const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 10000);
          
          try {
            const fallbackResponse = await fetch(endpoint, {
              method: 'GET',
              signal: fallbackController.signal,
              headers: {
                'Accept': 'application/json',
              },
            });
            clearTimeout(fallbackTimeoutId);
            
            if (fallbackResponse.ok) {
              dispatch(showToast({
                message: 'Connection successful!',
                type: 'success',
              }));
              return;
            } else {
              dispatch(showToast({
                message: `Connection failed: Server returned status ${fallbackResponse.status}`,
                type: 'error',
              }));
            }
          } catch (fallbackError: any) {
            clearTimeout(fallbackTimeoutId);
            throw fallbackError;
          }
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        console.error('[Test Connection] Fetch error:', fetchError);
        
        if (fetchError.name === 'AbortError') {
          dispatch(showToast({
            message: 'Request timed out. Please check the URL and try again.',
            type: 'error',
          }));
        } else if (fetchError.message?.includes('Network request failed') || fetchError.message?.includes('Failed to connect')) {
          dispatch(showToast({
            message: `Could not reach the server. Please check: Server is running, URL is correct, device is on same network, firewall allows connection.`,
            type: 'error',
          }));
        } else if (fetchError.message?.includes('CORS')) {
          dispatch(showToast({
            message: 'CORS error detected. The server may need CORS configuration.',
            type: 'error',
          }));
        } else {
          dispatch(showToast({
            message: `Connection failed: ${fetchError.message || 'Could not connect to the backend server'}`,
            type: 'error',
          }));
        }
      }
    } catch (error: any) {
      console.error('[Test Connection] Unexpected error:', error);
      dispatch(showToast({
        message: error.message || 'Could not connect to the backend server',
        type: 'error',
      }));
    }
  };

  const handleToggleSchedule = async (schedule: IrrigationSchedule | FertigationSchedule, isIrrigation: boolean) => {
    if (!backendUrl) {
      dispatch(showToast({
        message: 'Backend URL not configured',
        type: 'error',
      }));
      return;
    }

    try {
      if (isIrrigation) {
        await schedulesService.updateIrrigationSchedule(schedule.id, { enabled: !schedule.enabled });
      } else {
        await schedulesService.updateFertigationSchedule(schedule.id, { enabled: !schedule.enabled });
      }
      dispatch(
        showToast({
          message: `Schedule ${schedule.enabled ? 'disabled' : 'enabled'}`,
          type: 'success',
        })
      );
      await loadSchedules();
      await loadZoneInfo();
    } catch (error: any) {
      dispatch(showToast({
        message: error.userMessage || error.message || 'Failed to update schedule',
        type: 'error',
      }));
    }
  };

  const formatTime = (time: string): string => {
    try {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return time;
    }
  };

  const getDayName = (dayOfWeek: number): string => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayOfWeek] || `Day ${dayOfWeek}`;
  };

  const daysOfWeek = [
    { value: 0, label: 'Monday' },
    { value: 1, label: 'Tuesday' },
    { value: 2, label: 'Wednesday' },
    { value: 3, label: 'Thursday' },
    { value: 4, label: 'Friday' },
    { value: 5, label: 'Saturday' },
    { value: 6, label: 'Sunday' },
  ];

  const handleTimeChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (date) {
      setSelectedTime(date);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}:00`;
      
      if (isIrrigationTimePicker) {
        setIrrigationForm({ ...irrigationForm, time: timeString });
      } else {
        setFertigationForm({ ...fertigationForm, time: timeString });
      }
    }
  };

  const handleCreateIrrigationSchedule = async () => {
    if (!backendUrl) {
      dispatch(showToast({
        message: 'Backend URL not configured',
        type: 'error',
      }));
      return;
    }

    try {
      setCreatingSchedule(true);
      await schedulesService.createIrrigationSchedule(irrigationForm);
      dispatch(showToast({
        message: 'Irrigation schedule created successfully',
        type: 'success',
      }));
      setShowIrrigationModal(false);
      setIrrigationForm({ day_of_week: 0, time: '08:00:00', enabled: true });
      await loadSchedules();
      await loadZoneInfo();
    } catch (error: any) {
      dispatch(showToast({
        message: error.userMessage || error.message || 'Failed to create irrigation schedule',
        type: 'error',
      }));
    } finally {
      setCreatingSchedule(false);
    }
  };

  const handleCreateFertigationSchedule = async () => {
    if (!backendUrl) {
      dispatch(showToast({
        message: 'Backend URL not configured',
        type: 'error',
      }));
      return;
    }

    try {
      setCreatingSchedule(true);
      await schedulesService.createFertigationSchedule(fertigationForm);
      dispatch(showToast({
        message: 'Fertigation schedule created successfully',
        type: 'success',
      }));
      setShowFertigationModal(false);
      setFertigationForm({ day_of_week: 0, time: '08:00:00', enabled: true });
      await loadSchedules();
      await loadZoneInfo();
    } catch (error: any) {
      dispatch(showToast({
        message: error.userMessage || error.message || 'Failed to create fertigation schedule',
        type: 'error',
      }));
    } finally {
      setCreatingSchedule(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: number, isIrrigation: boolean) => {
    if (!backendUrl) {
      dispatch(showToast({
        message: 'Backend URL not configured',
        type: 'error',
      }));
      return;
    }

    try {
      if (isIrrigation) {
        await schedulesService.deleteIrrigationSchedule(scheduleId);
      } else {
        await schedulesService.deleteFertigationSchedule(scheduleId);
      }
      dispatch(showToast({
        message: 'Schedule deleted successfully',
        type: 'success',
      }));
      await loadSchedules();
      await loadZoneInfo();
    } catch (error: any) {
      dispatch(showToast({
        message: error.userMessage || error.message || 'Failed to delete schedule',
        type: 'error',
      }));
    }
  };


  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Backend URL Configuration */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Backend Server Configuration
          </Text>
          <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
            Configure the backend server URL (e.g., http://192.168.1.15)
          </Text>

          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            value={backendUrlInput}
            onChangeText={setBackendUrlInput}
            placeholder="http://192.168.1.15"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          {backendUrl && (
            <View style={styles.currentUrlContainer}>
              <Text style={[styles.currentUrlLabel, { color: colors.textSecondary }]}>
                Current URL:
              </Text>
              <Text style={[styles.currentUrlText, { color: colors.text }]}>
                {configService.maskUrl(backendUrl)}
              </Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <Button
              title="Test Connection"
              onPress={handleTestConnection}
              disabled={!backendUrlInput.trim() || savingUrl}
              variant="secondary"
              style={styles.button}
            />
            <Button
              title="Save URL"
              onPress={handleSaveBackendUrl}
              disabled={!backendUrlInput.trim() || savingUrl}
              loading={savingUrl}
              style={styles.button}
            />
          </View>
        </View>

        {/* Zone Information */}
        {backendUrl && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Zone Information
                </Text>
                <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                  System zone configuration (read-only)
                </Text>
              </View>
            </View>

            {loadingZoneInfo ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Loading zone information...
                </Text>
              </View>
            ) : zoneInfo ? (
              <View style={[styles.zoneInfoContainer, { backgroundColor: colors.background }]}>
                <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Zone ID:</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{zoneInfo.zone_id}</Text>
                </View>
                <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Altitude:</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{zoneInfo.altitude} m</Text>
                </View>
                <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Slope:</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{zoneInfo.slope}°</Text>
                </View>
                <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Area:</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{zoneInfo.area} m²</Text>
                </View>
                <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Base Pressure:</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{zoneInfo.base_pressure} kPa</Text>
                </View>
                <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Valve GPIO Pin:</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{zoneInfo.valve_gpio_pin}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Soil Moisture Sensor Channel:</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{zoneInfo.soil_moisture_sensor_channel}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Lucide name="info" size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Zone information not available
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Irrigation Schedule Setup */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Irrigation Schedule Setup
              </Text>
              <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                Configure irrigation schedules and timing
              </Text>
            </View>
            <Button
              title="+ Add"
              onPress={() => setShowIrrigationModal(true)}
              disabled={!backendUrl}
              variant="secondary"
              style={styles.addButton}
            />
          </View>

          {loadingSchedules ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading schedules...
              </Text>
            </View>
          ) : irrigationSchedules.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Lucide name="calendar" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No irrigation schedules configured
              </Text>
            </View>
          ) : (
            irrigationSchedules.map(schedule => (
              <View
                key={schedule.id}
                style={[styles.scheduleItem, { backgroundColor: colors.background, borderColor: colors.border }]}
              >
                <View style={styles.scheduleInfo}>
                  <Text style={[styles.scheduleText, { color: colors.text }]}>
                    {getDayName(schedule.day_of_week)} at {formatTime(schedule.time)}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: schedule.enabled ? colors.success + '20' : colors.textSecondary + '20' }]}>
                    <Text style={[styles.statusText, { color: schedule.enabled ? colors.success : colors.textSecondary }]}>
                      {schedule.enabled ? 'ENABLED' : 'DISABLED'}
                    </Text>
                  </View>
                </View>
                <View style={styles.scheduleActions}>
                  <TouchableOpacity
                    onPress={() => handleToggleSchedule(schedule, true)}
                    style={[styles.toggleButton, { backgroundColor: schedule.enabled ? colors.error + '20' : colors.success + '20' }]}
                  >
                    <Text style={[styles.toggleButtonText, { color: schedule.enabled ? colors.error : colors.success }]}>
                      {schedule.enabled ? 'Disable' : 'Enable'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteSchedule(schedule.id, true)}
                    style={[styles.deleteButton, { backgroundColor: colors.error + '20' }]}
                  >
                    <Lucide name="trash-2" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Fertilizer Plan Setup */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Fertilizer Plan Setup
              </Text>
              <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                Configure fertilizer plans and application schedules
              </Text>
            </View>
            <Button
              title="+ Add"
              onPress={() => setShowFertigationModal(true)}
              disabled={!backendUrl}
              variant="secondary"
              style={styles.addButton}
            />
          </View>

          {loadingSchedules ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading schedules...
              </Text>
            </View>
          ) : fertigationSchedules.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Lucide name="settings" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No fertigation schedules configured
              </Text>
            </View>
          ) : (
            fertigationSchedules.map(schedule => (
              <View
                key={schedule.id}
                style={[styles.scheduleItem, { backgroundColor: colors.background, borderColor: colors.border }]}
              >
                <View style={styles.scheduleInfo}>
                  <Text style={[styles.scheduleText, { color: colors.text }]}>
                    {getDayName(schedule.day_of_week)} at {formatTime(schedule.time)}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: schedule.enabled ? colors.success + '20' : colors.textSecondary + '20' }]}>
                    <Text style={[styles.statusText, { color: schedule.enabled ? colors.success : colors.textSecondary }]}>
                      {schedule.enabled ? 'ENABLED' : 'DISABLED'}
                    </Text>
                  </View>
                </View>
                <View style={styles.scheduleActions}>
                  <TouchableOpacity
                    onPress={() => handleToggleSchedule(schedule, false)}
                    style={[styles.toggleButton, { backgroundColor: schedule.enabled ? colors.error + '20' : colors.success + '20' }]}
                  >
                    <Text style={[styles.toggleButtonText, { color: schedule.enabled ? colors.error : colors.success }]}>
                      {schedule.enabled ? 'Disable' : 'Enable'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteSchedule(schedule.id, false)}
                    style={[styles.deleteButton, { backgroundColor: colors.error + '20' }]}
                  >
                    <Lucide name="trash-2" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Irrigation Schedule Modal */}
      <Modal
        visible={showIrrigationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowIrrigationModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Irrigation Schedule</Text>
              <TouchableOpacity onPress={() => setShowIrrigationModal(false)}>
                <Lucide name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Day of Week Selection */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Day of Week</Text>
                <TouchableOpacity
                  onPress={() => setShowDayPicker(true)}
                  style={[styles.pickerButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <Text style={[styles.pickerButtonText, { color: colors.text }]}>
                    {getDayName(irrigationForm.day_of_week)}
                  </Text>
                  <Lucide name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Time Selection */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Time</Text>
                <TouchableOpacity
                  onPress={() => {
                    setIsIrrigationTimePicker(true);
                    const [hours, minutes] = irrigationForm.time.split(':');
                    setSelectedTime(new Date(2000, 0, 1, parseInt(hours, 10), parseInt(minutes, 10)));
                    setShowTimePicker(true);
                  }}
                  style={[styles.pickerButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <Text style={[styles.pickerButtonText, { color: colors.text }]}>
                    {formatTime(irrigationForm.time)}
                  </Text>
                  <Lucide name="clock" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Enable/Disable Toggle */}
              <View style={styles.formGroup}>
                <TouchableOpacity
                  onPress={() => setIrrigationForm({ ...irrigationForm, enabled: !irrigationForm.enabled })}
                  style={styles.toggleRow}
                >
                  <Text style={[styles.label, { color: colors.text }]}>Enabled</Text>
                  <View
                    style={[
                      styles.switch,
                      {
                        backgroundColor: irrigationForm.enabled ? colors.success : colors.textSecondary,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.switchThumb,
                        {
                          transform: [{ translateX: irrigationForm.enabled ? 20 : 0 }],
                        },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="Cancel"
                onPress={() => setShowIrrigationModal(false)}
                variant="secondary"
                style={styles.modalButton}
              />
              <Button
                title="Create Schedule"
                onPress={handleCreateIrrigationSchedule}
                loading={creatingSchedule}
                style={styles.modalButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Fertigation Schedule Modal */}
      <Modal
        visible={showFertigationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFertigationModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Fertigation Schedule</Text>
              <TouchableOpacity onPress={() => setShowFertigationModal(false)}>
                <Lucide name="x" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Day of Week Selection */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Day of Week</Text>
                <TouchableOpacity
                  onPress={() => setShowDayPicker(true)}
                  style={[styles.pickerButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <Text style={[styles.pickerButtonText, { color: colors.text }]}>
                    {getDayName(fertigationForm.day_of_week)}
                  </Text>
                  <Lucide name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Time Selection */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Time</Text>
                <TouchableOpacity
                  onPress={() => {
                    setIsIrrigationTimePicker(false);
                    const [hours, minutes] = fertigationForm.time.split(':');
                    setSelectedTime(new Date(2000, 0, 1, parseInt(hours, 10), parseInt(minutes, 10)));
                    setShowTimePicker(true);
                  }}
                  style={[styles.pickerButton, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <Text style={[styles.pickerButtonText, { color: colors.text }]}>
                    {formatTime(fertigationForm.time)}
                  </Text>
                  <Lucide name="clock" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Enable/Disable Toggle */}
              <View style={styles.formGroup}>
                <TouchableOpacity
                  onPress={() => setFertigationForm({ ...fertigationForm, enabled: !fertigationForm.enabled })}
                  style={styles.toggleRow}
                >
                  <Text style={[styles.label, { color: colors.text }]}>Enabled</Text>
                  <View
                    style={[
                      styles.switch,
                      {
                        backgroundColor: fertigationForm.enabled ? colors.success : colors.textSecondary,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.switchThumb,
                        {
                          transform: [{ translateX: fertigationForm.enabled ? 20 : 0 }],
                        },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="Cancel"
                onPress={() => setShowFertigationModal(false)}
                variant="secondary"
                style={styles.modalButton}
              />
              <Button
                title="Create Schedule"
                onPress={handleCreateFertigationSchedule}
                loading={creatingSchedule}
                style={styles.modalButton}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Day Picker Modal */}
      <Modal
        visible={showDayPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDayPicker(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={[styles.pickerModalTitle, { color: colors.text }]}>Select Day</Text>
              <TouchableOpacity onPress={() => setShowDayPicker(false)}>
                <Text style={[styles.pickerModalDone, { color: colors.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {daysOfWeek.map(day => (
                <TouchableOpacity
                  key={day.value}
                  onPress={() => {
                    if (showIrrigationModal) {
                      setIrrigationForm({ ...irrigationForm, day_of_week: day.value });
                    } else {
                      setFertigationForm({ ...fertigationForm, day_of_week: day.value });
                    }
                    setShowDayPicker(false);
                  }}
                  style={[
                    styles.dayOption,
                    {
                      backgroundColor:
                        (showIrrigationModal && irrigationForm.day_of_week === day.value) ||
                        (!showIrrigationModal && fertigationForm.day_of_week === day.value)
                          ? colors.primary + '20'
                          : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayOptionText,
                      {
                        color:
                          (showIrrigationModal && irrigationForm.day_of_week === day.value) ||
                          (!showIrrigationModal && fertigationForm.day_of_week === day.value)
                            ? colors.primary
                            : colors.text,
                      },
                    ]}
                  >
                    {day.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Time Picker */}
      {showTimePicker && (
        <Modal
          visible={showTimePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowTimePicker(false)}
        >
          <View style={styles.pickerModalOverlay}>
            <View style={[styles.pickerModalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.pickerModalHeader}>
                <Text style={[styles.pickerModalTitle, { color: colors.text }]}>Select Time</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Text style={[styles.pickerModalDone, { color: colors.primary }]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleTimeChange}
                is24Hour={false}
              />
            </View>
          </View>
        </Modal>
      )}

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  currentUrlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  currentUrlLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  currentUrlText: {
    fontSize: 14,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  scheduleInfo: {
    flex: 1,
    marginRight: 12,
  },
  scheduleText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  sectionHeaderText: {
    flex: 1,
    marginRight: 12,
  },
  addButton: {
    minWidth: 80,
  },
  scheduleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  modalBody: {
    maxHeight: '70%',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    flex: 1,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  zoneSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  zoneButton: {
    minWidth: 50,
    height: 50,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyZonesMessage: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyZonesText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  pickerButtonText: {
    fontSize: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 2,
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '50%',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  pickerModalDone: {
    fontSize: 16,
    fontWeight: '600',
  },
  dayOption: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  dayOptionText: {
    fontSize: 16,
  },
  zoneDetails: {
    marginTop: 4,
    marginBottom: 8,
  },
  zoneDetailText: {
    fontSize: 12,
    marginTop: 2,
  },
  editButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneInfoContainer: {
    borderRadius: 8,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 14,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
});

export default IrrigationAndFertilizerSetupScreen;
