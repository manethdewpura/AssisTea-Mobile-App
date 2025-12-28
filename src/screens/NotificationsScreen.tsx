import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useAppSelector } from '../hooks';
import { selectTheme } from '../store/selectors';
import ScreenHeader from '../components/molecule/ScreenHeader';
import StatusCard from '../components/molecule/StatusCard';

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
  const navigation = useNavigation();
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
      <ScreenHeader 
        title="Notifications" 
        onBackPress={onBackPress || (() => navigation.goBack())} 
      />

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
            <StatusCard
              key={notification.id}
              icon={getNotificationIcon(notification.type)}
              iconColor={getNotificationColor(notification.type)}
              title={notification.title}
              message={notification.message}
              timestamp={notification.time}
              unreadDot={!notification.read}
              borderColor={getNotificationColor(notification.type)}
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
});

export default NotificationsScreen;

