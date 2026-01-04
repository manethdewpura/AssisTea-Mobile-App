import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useAppSelector, useAppDispatch } from '../../hooks';
import { selectTheme, selectConfig } from '../../store/selectors';
import Button from '../../components/atoms/Button';
import { irrigationService, fertigationService } from '../../services';
import { IrrigationStatus } from '../../services/irrigation.service';
import { FertigationStatus } from '../../services/fertigation.service';
import { showToast } from '../../store/slices/notification.slice';
import type { IrrigationStackParamList } from '../../navigation/IrrigationNavigator';

type IrrigationControlsNavigationProp = NativeStackNavigationProp<
  IrrigationStackParamList,
  'IrrigationControls'
>;

const IrrigationAndFertilizerControlsScreen: React.FC = () => {
  const navigation = useNavigation<IrrigationControlsNavigationProp>();
  const { colors } = useAppSelector(selectTheme);
  const { backendUrl } = useAppSelector(selectConfig);
  const dispatch = useAppDispatch();

  const [irrigationStatus, setIrrigationStatus] = useState<IrrigationStatus | null>(null);
  const [fertigationStatus, setFertigationStatus] = useState<FertigationStatus | null>(null);
  const [loadingIrrigation, setLoadingIrrigation] = useState(false);
  const [loadingFertigation, setLoadingFertigation] = useState(false);

  // Check backend URL configuration
  useEffect(() => {
    if (!backendUrl) {
      Alert.alert(
        'Backend URL Not Configured',
        'Please configure the backend URL in the Setup screen before using controls.',
        [{ text: 'OK' }]
      );
    }
  }, [backendUrl]);

  const loadStatus = useCallback(async () => {
    if (!backendUrl) return;

    try {
      const [irrigation, fertigation] = await Promise.all([
        irrigationService.getIrrigationStatus().catch(() => null),
        fertigationService.getFertigationStatus().catch(() => null),
      ]);
      setIrrigationStatus(irrigation);
      setFertigationStatus(fertigation);
    } catch (error: any) {
      console.warn('Failed to load status:', error);
    }
  }, [backendUrl]);

  // Load status on mount and periodically
  useEffect(() => {
    if (backendUrl) {
      loadStatus();
      const interval = setInterval(loadStatus, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [backendUrl, loadStatus]);

  const handleStartIrrigation = async () => {
    if (!backendUrl) {
      Alert.alert('Error', 'Backend URL not configured');
      return;
    }

    try {
      setLoadingIrrigation(true);
      await irrigationService.startIrrigation();
      dispatch(
        showToast({
          message: 'Irrigation started',
          type: 'success',
        })
      );
      await loadStatus();
    } catch (error: any) {
      Alert.alert('Error', error.userMessage || error.message || 'Failed to start irrigation');
    } finally {
      setLoadingIrrigation(false);
    }
  };

  const handleStopIrrigation = async () => {
    if (!backendUrl) {
      Alert.alert('Error', 'Backend URL not configured');
      return;
    }

    try {
      setLoadingIrrigation(true);
      await irrigationService.stopIrrigation();
      dispatch(
        showToast({
          message: 'Irrigation has been stopped',
          type: 'success',
        })
      );
      await loadStatus();
    } catch (error: any) {
      Alert.alert('Error', error.userMessage || error.message || 'Failed to stop irrigation');
    } finally {
      setLoadingIrrigation(false);
    }
  };

  const handleStartFertigation = async () => {
    if (!backendUrl) {
      Alert.alert('Error', 'Backend URL not configured');
      return;
    }

    try {
      setLoadingFertigation(true);
      await fertigationService.startFertigation();
      dispatch(
        showToast({
          message: 'Fertigation started',
          type: 'success',
        })
      );
      await loadStatus();
    } catch (error: any) {
      Alert.alert('Error', error.userMessage || error.message || 'Failed to start fertigation');
    } finally {
      setLoadingFertigation(false);
    }
  };

  const handleStopFertigation = async () => {
    if (!backendUrl) {
      Alert.alert('Error', 'Backend URL not configured');
      return;
    }

    try {
      setLoadingFertigation(true);
      await fertigationService.stopFertigation();
      dispatch(
        showToast({
          message: 'Fertigation has been stopped',
          type: 'success',
        })
      );
      await loadStatus();
    } catch (error: any) {
      Alert.alert('Error', error.userMessage || error.message || 'Failed to stop fertigation');
    } finally {
      setLoadingFertigation(false);
    }
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
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
        {!backendUrl && (
          <View style={[styles.warningCard, { backgroundColor: colors.error + '20', borderColor: colors.error }]}>
            <Lucide name={"alert-triangle" as any} size={24} color={colors.error} />
            <Text style={[styles.warningText, { color: colors.error }]}>
              Backend URL not configured. Please configure it in the Setup screen.
            </Text>
          </View>
        )}

        {/* Irrigation Controls */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Irrigation Controls</Text>
          <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
            Manage and control your irrigation systems
          </Text>

          {/* Status Display */}
          {irrigationStatus && (
            <View style={[styles.statusContainer, { backgroundColor: colors.background }]}>
              <View style={styles.statusRow}>
                <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Status:</Text>
                <View style={[styles.statusBadge, { backgroundColor: irrigationStatus.is_running ? colors.success + '20' : colors.textSecondary + '20' }]}>
                  <Text style={[styles.statusText, { color: irrigationStatus.is_running ? colors.success : colors.textSecondary }]}>
                    {irrigationStatus.is_running ? 'RUNNING' : 'STOPPED'}
                  </Text>
                </View>
              </View>
              {irrigationStatus.is_running && (
                <>
                  {irrigationStatus.duration && (
                    <View style={styles.statusRow}>
                      <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Duration:</Text>
                      <Text style={[styles.statusValue, { color: colors.text }]}>{formatDuration(irrigationStatus.duration)}</Text>
                    </View>
                  )}
                  {irrigationStatus.pressure && (
                    <View style={styles.statusRow}>
                      <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Pressure:</Text>
                      <Text style={[styles.statusValue, { color: colors.text }]}>{irrigationStatus.pressure} PSI</Text>
                    </View>
                  )}
                  {irrigationStatus.water_volume && (
                    <View style={styles.statusRow}>
                      <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Water Volume:</Text>
                      <Text style={[styles.statusValue, { color: colors.text }]}>{irrigationStatus.water_volume} L</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          <View style={styles.buttonRow}>
            <Button
              title="Start Irrigation"
              onPress={handleStartIrrigation}
              disabled={!backendUrl || irrigationStatus?.is_running}
              loading={loadingIrrigation}
              variant="success"
              style={styles.button}
            />
            <Button
              title="Stop Irrigation"
              onPress={handleStopIrrigation}
              disabled={!backendUrl || !irrigationStatus?.is_running}
              loading={loadingIrrigation}
              variant="danger"
              style={styles.button}
            />
          </View>
        </View>

        {/* Fertilizer Controls */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Fertilizer Controls</Text>
          <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
            Manage and control fertilizer applications
          </Text>

          {/* Status Display */}
          {fertigationStatus && (
            <View style={[styles.statusContainer, { backgroundColor: colors.background }]}>
              <View style={styles.statusRow}>
                <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Status:</Text>
                <View style={[styles.statusBadge, { backgroundColor: fertigationStatus.is_running ? colors.success + '20' : colors.textSecondary + '20' }]}>
                  <Text style={[styles.statusText, { color: fertigationStatus.is_running ? colors.success : colors.textSecondary }]}>
                    {fertigationStatus.is_running ? 'RUNNING' : 'STOPPED'}
                  </Text>
                </View>
              </View>
              {fertigationStatus.is_running && (
                <>
                  {fertigationStatus.duration && (
                    <View style={styles.statusRow}>
                      <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Duration:</Text>
                      <Text style={[styles.statusValue, { color: colors.text }]}>{formatDuration(fertigationStatus.duration)}</Text>
                    </View>
                  )}
                  {fertigationStatus.fertilizer_volume && (
                    <View style={styles.statusRow}>
                      <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Fertilizer Volume:</Text>
                      <Text style={[styles.statusValue, { color: colors.text }]}>{fertigationStatus.fertilizer_volume} L</Text>
                    </View>
                  )}
                  {fertigationStatus.water_volume && (
                    <View style={styles.statusRow}>
                      <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Water Volume:</Text>
                      <Text style={[styles.statusValue, { color: colors.text }]}>{fertigationStatus.water_volume} L</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          <View style={styles.buttonRow}>
            <Button
              title="Start Fertigation"
              onPress={handleStartFertigation}
              disabled={!backendUrl || fertigationStatus?.is_running}
              loading={loadingFertigation}
              variant="success"
              style={styles.button}
            />
            <Button
              title="Stop Fertigation"
              onPress={handleStopFertigation}
              disabled={!backendUrl || !fertigationStatus?.is_running}
              loading={loadingFertigation}
              variant="danger"
              style={styles.button}
            />
          </View>
        </View>

      </ScrollView>
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
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  warningText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
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
    marginTop: 8,
  },
  statusContainer: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
  },
});

export default IrrigationAndFertilizerControlsScreen;
