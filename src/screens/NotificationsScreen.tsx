import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useAppSelector } from '../hooks';
import { selectTheme } from '../store/selectors';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'info' | 'warning' | 'error' | 'success';
  read: boolean;
}

interface NotificationsScreenProps {
  onBackPress?: () => void;
}

const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  onBackPress,
}) => {
  const { colors } = useAppSelector(selectTheme);
  const [notifications] = useState<Notification[]>([
    {
      id: '1',
      title: 'Watering Schedule Updated',
      message: 'The watering schedule for Plot A has been updated for tomorrow at 8:00 AM.',
      time: '2 hours ago',
      type: 'info',
      read: false,
    },
    {
      id: '2',
      title: 'Team Member Assigned',
      message: 'John Doe has been assigned to manage Plot B.',
      time: '5 hours ago',
      type: 'success',
      read: false,
    },
    {
      id: '3',
      title: 'Weather Alert',
      message: 'Heavy rain expected in the next 24 hours. Consider adjusting your irrigation schedule.',
      time: '1 day ago',
      type: 'warning',
      read: true,
    },
    {
      id: '4',
      title: 'System Maintenance',
      message: 'System maintenance will be performed on 15th at 2:00 AM. No action needed.',
      time: '2 days ago',
      type: 'info',
      read: true,
    },
    {
      id: '5',
      title: 'Harvest Reminder',
      message: 'Tea leaves in Plot C are ready for harvesting.',
      time: '3 days ago',
      type: 'success',
      read: true,
    },
    {
      id: '6',
      title: 'New Feature Available',
      message: 'The mobile app has been updated with new features. Update now for the best experience.',
      time: '1 week ago',
      type: 'info',
      read: true,
    },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

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
        return 'bell';
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackPress}
          activeOpacity={0.7}
        >
          <Lucide name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.notificationsContainer}
        contentContainerStyle={styles.notificationsContent}
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Lucide name="bell" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No notifications
            </Text>
          </View>
        ) : (
          notifications.map(notification => (
            <TouchableOpacity
              key={notification.id}
              style={[
                styles.notificationCard,
                {
                  backgroundColor: colors.surface,
                  borderLeftColor: getNotificationColor(notification.type),
                },
              ]}
              activeOpacity={0.7}
            >
              <View style={styles.notificationHeader}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: getNotificationColor(notification.type) + '20' },
                  ]}
                >
                  <Lucide
                    name={getNotificationIcon(notification.type) as any}
                    size={20}
                    color={getNotificationColor(notification.type)}
                  />
                </View>
                <View style={styles.notificationContent}>
                  <View style={styles.titleRow}>
                    <Text
                      style={[styles.notificationTitle, { color: colors.text }]}
                    >
                      {notification.title}
                    </Text>
                    {!notification.read && (
                      <View
                        style={[
                          styles.unreadDot,
                          { backgroundColor: colors.primary },
                        ]}
                      />
                    )}
                  </View>
                  <Text
                    style={[styles.notificationMessage, { color: colors.textSecondary }]}
                  >
                    {notification.message}
                  </Text>
                  <Text
                    style={[styles.notificationTime, { color: colors.textSecondary }]}
                  >
                    {notification.time}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
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
  notificationCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  notificationHeader: {
    flexDirection: 'row',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notificationMessage: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
  },
});

export default NotificationsScreen;

