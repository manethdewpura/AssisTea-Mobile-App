import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useAppSelector } from '../../hooks';
import { selectTheme, selectConfig } from '../../store/selectors';
import StatusCard from '../../components/molecule/StatusCard';
import { logsService, OperationalLog, activityLogsSQLiteService } from '../../services';
import type { IrrigationStackParamList } from '../../navigation/IrrigationNavigator';

type ActivityLogsNavigationProp = NativeStackNavigationProp<
  IrrigationStackParamList,
  'ActivityLogs'
>;

const ActivityLogsScreen: React.FC = () => {
  const navigation = useNavigation<ActivityLogsNavigationProp>();
  const { colors } = useAppSelector(selectTheme);
  const { backendUrl } = useAppSelector(selectConfig);
  const [activityLogs, setActivityLogs] = useState<OperationalLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      
      // First, try to load from local DB for instant display
      try {
        const localLogs = await activityLogsSQLiteService.getLogs({ limit: 50 });
        if (localLogs.length > 0) {
          setActivityLogs(localLogs);
          setLoading(false);
          setRefreshing(false);
        }
      } catch (localError) {
        console.warn('Failed to load from local DB:', localError);
      }

      // Then try to fetch from backend if URL is configured
      if (backendUrl) {
        try {
          const logs = await logsService.getOperationalLogs({ limit: 50 });
          setActivityLogs(logs);
        } catch (error: any) {
          console.warn('Failed to load activity logs from backend:', error);
          // Keep local logs if available
        }
      }
    } catch (error: any) {
      console.warn('Failed to load activity logs:', error);
      // Try to load from local DB as fallback
      try {
        const localLogs = await activityLogsSQLiteService.getLogs({ limit: 50 });
        setActivityLogs(localLogs);
      } catch {
        setActivityLogs([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    if (backendUrl) {
      loadLogs();
    }
  }, [backendUrl, loadLogs]);

  const onRefresh = () => {
    setRefreshing(true);
    loadLogs();
  };

  const getActivityIcon = (operationType: string): string => {
    const type = operationType?.toLowerCase() || '';
    if (type.includes('irrigation')) {
      return 'droplet';
    } else if (type.includes('fertigation') || type.includes('fertilizer')) {
      return 'leaf';
    }
    return 'activity';
  };

  const getStatusColor = (status: string): string => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'success':
      case 'completed':
        return colors.success || '#28a745';
      case 'failed':
      case 'error':
        return colors.error || '#dc3545';
      case 'pending':
      case 'running':
        return colors.warning || '#ffc107';
      default:
        return colors.textSecondary || '#6c757d';
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) {
        return 'Just now';
      } else if (diffMins < 60) {
        return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
      } else if (diffHours < 24) {
        return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
      } else if (diffDays < 7) {
        return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
      } else {
        return date.toLocaleDateString();
      }
    } catch {
      return timestamp;
    }
  };

  const formatAction = (log: OperationalLog): string => {
    const operationType = log.operation_type || '';
    const zone = log.zone_id ? `Zone ${log.zone_id}` : '';
    
    if (operationType.toLowerCase().includes('irrigation')) {
      return zone ? `${zone} irrigation ${log.status?.toLowerCase() || ''}` : `Irrigation ${log.status?.toLowerCase() || ''}`;
    } else if (operationType.toLowerCase().includes('fertigation')) {
      return zone ? `${zone} fertigation ${log.status?.toLowerCase() || ''}` : `Fertigation ${log.status?.toLowerCase() || ''}`;
    }
    
    return `${operationType} ${log.status?.toLowerCase() || ''}`;
  };

  if (!backendUrl) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <View style={styles.emptyContainer}>
          <Lucide name={"alert-triangle" as any} size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Backend URL not configured
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Please configure the backend URL in the Setup screen
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading logs...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {activityLogs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Lucide name="file-text" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No activity logs available
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Pull down to refresh
              </Text>
            </View>
          ) : (
            activityLogs.map(log => (
              <StatusCard
                key={log.id}
                icon={getActivityIcon(log.operation_type)}
                iconColor={getStatusColor(log.status)}
                title={formatAction(log)}
                timestamp={formatTimestamp(log.timestamp)}
                statusBadge={{
                  text: log.status?.toUpperCase() || 'UNKNOWN',
                  color: getStatusColor(log.status),
                }}
                borderColor={getStatusColor(log.status)}
                message={
                  log.duration
                    ? `Duration: ${Math.floor(log.duration / 60)}m ${log.duration % 60}s`
                    : undefined
                }
              />
            ))
          )}
        </ScrollView>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default ActivityLogsScreen;
