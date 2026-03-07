import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useAppSelector } from '../hooks';
import { selectTheme } from '../store/selectors';
import ScreenHeader from '../components/molecule/ScreenHeader';
import StatusCard from '../components/molecule/StatusCard';
import { useTranslation } from 'react-i18next';
import { logsService, OperationalLog } from '../services/logs.service';

export interface NotificationsScreenProps {
  onBackPress?: () => void;
}

/** Format timestamp to relative time (e.g. "2 hours ago") using i18n */
function useFormatTimeAgo() {
  const { t } = useTranslation('common');
  return useCallback(
    (isoTimestamp: string): string => {
      const date = new Date(isoTimestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      const diffWeeks = Math.floor(diffDays / 7);

      if (diffMins < 1) return t('time_ago.just_now');
      if (diffMins < 60) return t(diffMins === 1 ? 'time_ago.minute_ago_one' : 'time_ago.minute_ago_other', { count: diffMins });
      if (diffHours < 24) return t(diffHours === 1 ? 'time_ago.hour_ago_one' : 'time_ago.hour_ago_other', { count: diffHours });
      if (diffDays < 7) return t(diffDays === 1 ? 'time_ago.day_ago_one' : 'time_ago.day_ago_other', { count: diffDays });
      return t(diffWeeks === 1 ? 'time_ago.week_ago_one' : 'time_ago.week_ago_other', { count: diffWeeks });
    },
    [t]
  );
}

/** Map operation status to card type for icon/color */
function getLogCardType(status: string): 'info' | 'success' | 'warning' | 'error' {
  switch (status?.toLowerCase()) {
    case 'completed':
      return 'success';
    case 'failed':
    case 'stopped':
      return 'error';
    case 'in_progress':
    case 'started':
      return 'info';
    case 'skipped':
      return 'warning';
    default:
      return 'info';
  }
}

/**
 * Presentational notifications content. Use this when the component is rendered
 * outside NavigationContainer (e.g. in an overlay). Pass onBackPress for back behavior.
 */
export const NotificationsScreenContent: React.FC<{
  onBackPress: () => void;
}> = ({ onBackPress }) => {
  const { colors } = useAppSelector(selectTheme);
  const { t } = useTranslation('common');
  const formatTimeAgo = useFormatTimeAgo();

  const [logs, setLogs] = useState<OperationalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await logsService.getOperationalLogs({
        limit: 50,
        hours: 168, // last 7 days
      });
      setLogs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const getOperationTitle = (log: OperationalLog): string => {
    const opLabel = log.operation_type === 'fertigation'
      ? t('irrigation_controls.fertilizer_title')
      : t('irrigation_controls.irrigation_title');
    const zone = log.zone_id != null ? ` - Zone ${log.zone_id}` : '';
    return `${opLabel}${zone}`;
  };

  const getOperationMessage = (log: OperationalLog): string => {
    const status = log.status || '';
    const parts: string[] = [status.replace(/_/g, ' ')];
    if (log.duration != null) parts.push(`${log.duration}s`);
    if (log.water_volume != null) parts.push(`${log.water_volume} L water`);
    if (log.fertilizer_volume != null) parts.push(`${log.fertilizer_volume} L fertilizer`);
    if (log.notes) parts.push(log.notes);
    return parts.join(' · ');
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'info':
        return 'info';
      case 'success':
        return 'check-circle';
      case 'warning':
        return 'alert-triangle';
      case 'error':
        return 'alert-circle';
      default:
        return 'droplets';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'error':
        return colors.error;
      default:
        return colors.primary;
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <ScreenHeader
        title={t('notifications.title')}
        onBackPress={onBackPress}
      />
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('notifications.loading_logs')}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Lucide name={"alert-circle" as any} size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={loadLogs}
          >
            <Text style={styles.retryButtonText}>{t('general.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.notificationsContainer}
          contentContainerStyle={styles.notificationsContent}
        >
          {logs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Lucide name="droplets" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {t('notifications.no_notifications')}
              </Text>
            </View>
          ) : (
            logs.map((log) => {
              const cardType = getLogCardType(log.status);
              return (
                <StatusCard
                  key={String(log.id)}
                  icon={getNotificationIcon(cardType)}
                  iconColor={getNotificationColor(cardType)}
                  title={getOperationTitle(log)}
                  message={getOperationMessage(log)}
                  timestamp={formatTimeAgo(log.timestamp)}
                  borderColor={getNotificationColor(cardType)}
                />
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

/**
 * Notifications screen that uses React Navigation. Use only inside a navigator (NavigationContainer).
 */
const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  onBackPress,
}) => {
  const navigation = useNavigation();
  return (
    <NotificationsScreenContent
      onBackPress={onBackPress ?? (() => navigation.goBack())}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notificationsContainer: {
    flex: 1,
  },
  notificationsContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NotificationsScreen;
