import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useAppSelector } from '../../hooks';
import { selectTheme } from '../../store/selectors';
import ScreenHeader from '../../components/molecule/ScreenHeader';
import StatusCard from '../../components/molecule/StatusCard';

interface ActivityLog {
  id: string;
  type: 'irrigation' | 'fertilizer';
  action: string;
  timestamp: string;
  status: 'success' | 'failed' | 'pending';
}

interface ActivityLogsScreenProps {
  onBackPress?: () => void;
}

const ActivityLogsScreen: React.FC<ActivityLogsScreenProps> = ({
  onBackPress,
}) => {
  const { colors } = useAppSelector(selectTheme);
  const [activityLogs] = useState<ActivityLog[]>([
    {
      id: '1',
      type: 'irrigation',
      action: 'Zone A irrigation started',
      timestamp: '2 hours ago',
      status: 'success',
    },
    {
      id: '2',
      type: 'fertilizer',
      action: 'Fertilizer application completed',
      timestamp: '5 hours ago',
      status: 'success',
    },
    {
      id: '3',
      type: 'irrigation',
      action: 'Zone B irrigation scheduled',
      timestamp: '1 day ago',
      status: 'pending',
    },
    {
      id: '4',
      type: 'irrigation',
      action: 'Zone C irrigation failed',
      timestamp: '2 days ago',
      status: 'failed',
    },
    {
      id: '5',
      type: 'fertilizer',
      action: 'Fertilizer mix prepared',
      timestamp: '3 days ago',
      status: 'success',
    },
  ]);

  const getActivityIcon = (type: string) => {
    return type === 'irrigation' ? 'droplet' : 'leaf';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return colors.success || '#28a745';
      case 'failed':
        return colors.error || '#dc3545';
      case 'pending':
        return colors.warning || '#ffc107';
      default:
        return colors.textSecondary;
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      {/* Header */}
      <ScreenHeader title="Activity Logs" onBackPress={onBackPress} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {activityLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Lucide name="file-text" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No activity logs available
            </Text>
          </View>
        ) : (
          activityLogs.map(log => (
            <StatusCard
              key={log.id}
              icon={getActivityIcon(log.type)}
              iconColor={getStatusColor(log.status)}
              title={log.action}
              timestamp={log.timestamp}
              statusBadge={{
                text: log.status.toUpperCase(),
                color: getStatusColor(log.status),
              }}
              borderColor={getStatusColor(log.status)}
            />
          ))
        )}
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
});

export default ActivityLogsScreen;

