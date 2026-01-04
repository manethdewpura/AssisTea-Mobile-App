import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useAppSelector } from '../../hooks';
import { selectTheme } from '../../store/selectors';
import { sensorsService, SensorReading } from '../../services/sensors.service';
import { Lucide } from '@react-native-vector-icons/lucide';

interface SensorDataScreenProps {
  onBackPress?: () => void;
}

const SensorDataScreen: React.FC<SensorDataScreenProps> = () => {
  const { colors } = useAppSelector(selectTheme);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSensorData = useCallback(async () => {
    try {
      setError(null);
      const data = await sensorsService.getCurrentSensorReadings();
      // Filter out weather sensors and ensure all other sensors are shown
      const filteredData = data.filter(reading => {
        const sensorType = reading.sensor_type?.toLowerCase() || '';
        const sensorId = reading.sensor_id?.toLowerCase() || '';
        // Exclude weather sensors
        return !sensorType.includes('weather') && !sensorId.includes('weather');
      });
      setReadings(filteredData);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sensor data');
      console.error('Error fetching sensor data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchSensorData();
  }, [fetchSensorData]);

  // Initial fetch
  useEffect(() => {
    fetchSensorData();
  }, [fetchSensorData]);

  // Auto-refresh setup
  useEffect(() => {
    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchSensorData();
      }, 5000); // Refresh every 5 seconds
      refreshIntervalRef.current = interval;

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      };
    }
  }, [autoRefresh, fetchSensorData]);

  const formatTimestamp = (timestamp: string): string => {
    try {
      // Normalize timestamp: if it's ISO format without timezone, treat as UTC
      // Backend timestamps are typically UTC but may not have 'Z' indicator
      let normalizedTimestamp = timestamp;
      if (timestamp && timestamp.includes('T')) {
        // Check if it's ISO format without timezone (ends with seconds or milliseconds, no Z or offset)
        const hasTimezone = timestamp.endsWith('Z') || 
                           /[+-]\d{2}:\d{2}$/.test(timestamp) || 
                           /[+-]\d{4}$/.test(timestamp);
        if (!hasTimezone) {
          // ISO format without timezone - append 'Z' to treat as UTC
          normalizedTimestamp = timestamp + 'Z';
        }
      }
      
      const date = new Date(normalizedTimestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  const getSensorIcon = (sensorType: string, sensorId?: string): string => {
    const type = sensorType?.toLowerCase() || '';
    const id = sensorId?.toLowerCase() || '';
    // Check both sensor_type and sensor_id for better detection
    if (type.includes('soil') || type.includes('moisture') || id.includes('soil') || id.includes('moisture')) {
      return 'droplet';
    } else if (type.includes('pressure') || id.includes('pressure')) {
      return 'gauge';
    } else if (type.includes('tank') || type.includes('level') || id.includes('tank') || id.includes('level')) {
      return 'container';
    }
    return 'activity';
  };

  const getSensorColor = (sensorType: string, sensorId?: string, isHealthy?: boolean): string => {
    if (isHealthy === false) return colors.error;
    
    const type = sensorType?.toLowerCase() || '';
    const id = sensorId?.toLowerCase() || '';
    // Check both sensor_type and sensor_id for better detection
    if (type.includes('soil') || type.includes('moisture') || id.includes('soil') || id.includes('moisture')) {
      return colors.primary;
    } else if (type.includes('pressure') || id.includes('pressure')) {
      return '#4CAF50';
    } else if (type.includes('tank') || type.includes('level') || id.includes('tank') || id.includes('level')) {
      return '#2196F3';
    }
    return colors.primary;
  };

  const formatSensorName = (sensorType: string, sensorId?: string): string => {
    const type = sensorType?.toLowerCase() || '';
    const id = sensorId?.toLowerCase() || '';
    // Check both sensor_type and sensor_id for better detection
    if (type.includes('soil') || type.includes('moisture') || id.includes('soil') || id.includes('moisture')) {
      // Extract zone number if available
      const zoneMatch = (type + '_' + id).match(/[_-]?(\d+)/);
      const zone = zoneMatch ? ` Zone ${zoneMatch[1]}` : '';
      return `Soil Moisture${zone}`;
    } else if (type.includes('pressure') || id.includes('pressure')) {
      // Extract zone number if available
      const zoneMatch = (type + '_' + id).match(/[_-]?(\d+)/);
      const zone = zoneMatch ? ` Zone ${zoneMatch[1]}` : '';
      return `Water Pressure${zone}`;
    } else if (type.includes('tank') || type.includes('level') || id.includes('tank') || id.includes('level')) {
      return 'Tank Level';
    }
    // Return formatted sensor type if not recognized
    return sensorType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatValue = (reading: SensorReading): string => {
    if (reading.error) {
      return 'Error';
    }
    
    const value = reading.value;
    const unit = reading.unit || '';
    
    // Format based on unit
    if (unit === '%') {
      return `${value.toFixed(1)}%`;
    } else if (unit === 'kPa') {
      return `${value.toFixed(2)} ${unit}`;
    } else if (unit === 'cm') {
      return `${value.toFixed(1)} ${unit}`;
    }
    
    return `${value.toFixed(2)} ${unit}`;
  };

  if (isLoading && readings.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading sensor data...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Status Bar */}
        <View
          style={[
            styles.statusBar,
            {
              backgroundColor: autoRefresh
                ? colors.success
                : colors.warning,
            },
          ]}
        >
          <View style={styles.statusBarContent}>
            <View style={styles.statusBarText}>
              <Text style={styles.statusText}>
                {autoRefresh
                  ? '🔄 Auto-refresh: ON (5s)'
                  : '⏸ Auto-refresh: OFF'}
              </Text>
              {lastUpdated && (
                <Text style={styles.statusSubText}>
                  Last updated: {formatTimestamp(lastUpdated.toISOString())}
                </Text>
              )}
            </View>
            <View style={styles.statusBarButtons}>
              <TouchableOpacity
                onPress={onRefresh}
                style={styles.refreshButton}
                disabled={isRefreshing}
              >
                <Lucide
                  name="refresh-cw"
                  size={20}
                  color={isRefreshing ? colors.textSecondary : colors.background}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setAutoRefresh(!autoRefresh)}
                style={styles.autoRefreshToggle}
              >
                <Lucide
                  name={autoRefresh ? 'pause' : 'play'}
                  size={24}
                  color={colors.background}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Error Message */}
        {error && (
          <View
            style={[
              styles.errorCard,
              { backgroundColor: colors.error, opacity: 0.1 },
            ]}
          >
            <Text style={[styles.errorText, { color: colors.error }]}>
              {error}
            </Text>
          </View>
        )}

        {/* Sensor Cards */}
        {readings.map((reading, index) => {
          const icon = getSensorIcon(reading.sensor_type, reading.sensor_id);
          const iconColor = getSensorColor(reading.sensor_type, reading.sensor_id, reading.is_healthy);
          const sensorName = formatSensorName(reading.sensor_type, reading.sensor_id);

          return (
            <View
              key={`${reading.sensor_id}-${index}`}
              style={[
                styles.sensorCard,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: reading.is_healthy ? colors.border : colors.error,
                },
              ]}
            >
              <View style={styles.sensorHeader}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: iconColor + '20' },
                  ]}
                >
                  <Lucide name={icon as any} size={24} color={iconColor} />
                </View>
                <View style={styles.sensorInfo}>
                  <View style={styles.sensorTitleRow}>
                    <Text style={[styles.sensorName, { color: colors.text }]}>
                      {sensorName}
                    </Text>
                    {reading.zone_id && (
                      <Text
                        style={[styles.zoneLabel, { color: colors.textSecondary }]}
                      >
                        Zone {reading.zone_id}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[styles.sensorId, { color: colors.textSecondary }]}
                  >
                    {reading.sensor_id}
                  </Text>
                </View>
                <View
                  style={[
                    styles.healthBadge,
                    {
                      backgroundColor: reading.is_healthy
                        ? colors.success + '20'
                        : colors.error + '20',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.healthDot,
                      {
                        backgroundColor: reading.is_healthy
                          ? colors.success
                          : colors.error,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.healthText,
                      {
                        color: reading.is_healthy
                          ? colors.success
                          : colors.error,
                      },
                    ]}
                  >
                    {reading.is_healthy ? 'Healthy' : 'Error'}
                  </Text>
                </View>
              </View>

              {reading.error ? (
                <View style={styles.errorContainer}>
                  <Text style={[styles.errorMessage, { color: colors.error }]}>
                    {reading.error}
                  </Text>
                </View>
              ) : (
                <View style={styles.sensorData}>
                  <View style={styles.valueContainer}>
                    <Text style={[styles.valueLabel, { color: colors.textSecondary }]}>
                      Current Value
                    </Text>
                    <Text style={[styles.valueText, { color: colors.text }]}>
                      {formatValue(reading)}
                    </Text>
                  </View>

                  {reading.value_percent !== undefined && (
                    <View style={styles.valueContainer}>
                      <Text style={[styles.valueLabel, { color: colors.textSecondary }]}>
                        Level
                      </Text>
                      <Text style={[styles.valueText, { color: colors.text }]}>
                        {reading.value_percent.toFixed(1)}%
                      </Text>
                    </View>
                  )}

                  {reading.raw_value !== undefined && (
                    <View style={styles.rawValueContainer}>
                      <Text
                        style={[styles.rawValueLabel, { color: colors.textSecondary }]}
                      >
                        Raw: {reading.raw_value.toFixed(3)} {reading.raw_unit || ''}
                      </Text>
                    </View>
                  )}

                  <Text
                    style={[styles.timestamp, { color: colors.textSecondary }]}
                  >
                    {formatTimestamp(reading.timestamp)}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {readings.length === 0 && !isLoading && (
          <View style={styles.emptyContainer}>
            <Lucide name="activity" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No sensor data available
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusBar: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 16,
  },
  statusBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBarText: {
    flex: 1,
  },
  statusBarButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refreshButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  autoRefreshToggle: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  statusSubText: {
    color: 'white',
    fontSize: 11,
    marginTop: 4,
    opacity: 0.9,
  },
  errorCard: {
    margin: 15,
    padding: 15,
    borderRadius: 10,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  sensorCard: {
    margin: 15,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sensorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sensorInfo: {
    flex: 1,
  },
  sensorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sensorName: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  zoneLabel: {
    fontSize: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  sensorId: {
    fontSize: 12,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  healthText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sensorData: {
    marginTop: 8,
  },
  valueContainer: {
    marginBottom: 12,
  },
  valueLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  valueText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  rawValueContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  rawValueLabel: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
  },
  errorContainer: {
    marginTop: 8,
  },
  errorMessage: {
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
});

export default SensorDataScreen;

