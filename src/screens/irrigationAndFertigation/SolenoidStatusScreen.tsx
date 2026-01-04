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
import { solenoidService, SolenoidInfo } from '../../services/solenoid.service';
import { Lucide } from '@react-native-vector-icons/lucide';

interface SolenoidStatusScreenProps {
  onBackPress?: () => void;
}

const SolenoidStatusScreen: React.FC<SolenoidStatusScreenProps> = () => {
  const { colors } = useAppSelector(selectTheme);
  const [solenoids, setSolenoids] = useState<Record<string, SolenoidInfo>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSolenoidStatus = useCallback(async () => {
    try {
      setError(null);
      const data = await solenoidService.getAllSolenoidStatus();
      setSolenoids(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch solenoid status');
      console.error('Error fetching solenoid status:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchSolenoidStatus();
  }, [fetchSolenoidStatus]);

  // Initial fetch
  useEffect(() => {
    fetchSolenoidStatus();
  }, [fetchSolenoidStatus]);

  // Auto-refresh setup
  useEffect(() => {
    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchSolenoidStatus();
      }, 5000); // Refresh every 5 seconds
      refreshIntervalRef.current = interval;

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      };
    }
  }, [autoRefresh, fetchSolenoidStatus]);

  const formatTimestamp = (timestamp: string | undefined): string => {
    if (!timestamp) return 'N/A';
    try {
      // Normalize timestamp: if it's ISO format without timezone, treat as UTC
      let normalizedTimestamp = timestamp;
      if (timestamp && timestamp.includes('T')) {
        const hasTimezone = timestamp.endsWith('Z') ||
          /[+-]\d{2}:\d{2}$/.test(timestamp) ||
          /[+-]\d{4}$/.test(timestamp);
        if (!hasTimezone) {
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

  const formatSolenoidName = (name: string): string => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getSolenoidIcon = (name: string): string => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('pump')) {
      return 'droplet';
    } else if (lowerName.includes('tank')) {
      return 'container';
    } else if (lowerName.includes('inlet')) {
      return 'arrow-down';
    } else if (lowerName.includes('outlet')) {
      return 'arrow-up';
    }
    return 'circle';
  };

  const solenoidEntries = Object.entries(solenoids);

  if (isLoading && solenoidEntries.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading solenoid status...
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

        {/* Solenoid Cards */}
        {solenoidEntries.map(([name, info]) => {
          const icon = getSolenoidIcon(name);
          const statusColor = info.is_open ? colors.success : colors.textSecondary;
          const displayName = formatSolenoidName(name);

          return (
            <View
              key={name}
              style={[
                styles.solenoidCard,
                {
                  backgroundColor: colors.cardBackground,
                  borderColor: info.is_open ? colors.success : colors.border,
                  borderWidth: info.is_open ? 2 : 1,
                },
              ]}
            >
              <View style={styles.solenoidHeader}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: statusColor + '20' },
                  ]}
                >
                  <Lucide name={icon as any} size={24} color={statusColor} />
                </View>
                <View style={styles.solenoidInfo}>
                  <Text style={[styles.solenoidName, { color: colors.text }]}>
                    {displayName}
                  </Text>
                  <Text
                    style={[styles.solenoidId, { color: colors.textSecondary }]}
                  >
                    {name}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: info.is_open
                        ? colors.success + '20'
                        : colors.textSecondary + '20',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: info.is_open
                          ? colors.success
                          : colors.textSecondary,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color: info.is_open
                          ? colors.success
                          : colors.textSecondary,
                      },
                    ]}
                  >
                    {info.is_open ? 'Open' : 'Closed'}
                  </Text>
                </View>
              </View>

              <View style={styles.solenoidData}>
                <View style={styles.valueContainer}>
                  <Text style={[styles.valueLabel, { color: colors.textSecondary }]}>
                    Status
                  </Text>
                  <Text style={[styles.valueText, { color: statusColor }]}>
                    {info.is_open ? 'OPEN' : 'CLOSED'}
                  </Text>
                </View>

                {info.last_updated && (
                  <Text
                    style={[styles.timestamp, { color: colors.textSecondary }]}
                  >
                    Last updated: {formatTimestamp(info.last_updated)}
                  </Text>
                )}
              </View>
            </View>
          );
        })}

        {solenoidEntries.length === 0 && !isLoading && (
          <View style={styles.emptyContainer}>
            <Lucide name="circle" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No solenoid data available
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
  solenoidCard: {
    margin: 15,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  solenoidHeader: {
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
  solenoidInfo: {
    flex: 1,
  },
  solenoidName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  solenoidId: {
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  solenoidData: {
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
  timestamp: {
    fontSize: 11,
    marginTop: 8,
    fontStyle: 'italic',
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

export default SolenoidStatusScreen;

