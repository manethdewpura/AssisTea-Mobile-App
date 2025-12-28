import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useAppSelector } from '../../hooks';
import { selectTheme, selectNotifications } from '../../store/selectors';


export interface TopNavbarProps {
  onNotificationPress: () => void;
  onMenuPress?: () => void;
  unreadCount?: number;
}

const TopNavbar: React.FC<TopNavbarProps> = ({ onNotificationPress, onMenuPress, unreadCount }) => {
  const { colors, isDark } = useAppSelector(selectTheme);
  const notifications = useAppSelector(selectNotifications);
  const resolvedUnreadCount = unreadCount ?? notifications.unreadCount ?? 5;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.primary },
        isDark ? styles.noBorder : styles.withBorder,
      ]}
    >
      {/* Hamburger Menu Icon */}
      <TouchableOpacity
        style={styles.iconButton}
        onPress={() => onMenuPress?.()}
        activeOpacity={0.7}
      >
        <Lucide name="menu" size={24} color={colors.buttonText} />
      </TouchableOpacity>

      {/* App Name */}
      <View style={styles.appNameContainer}>
        <Text style={[styles.appName, { color: colors.buttonText }]}>AssisTea</Text>
      </View>

      {/* Notification Icon */}
      <TouchableOpacity
        style={styles.iconButton}
        onPress={onNotificationPress}
        activeOpacity={0.7}
      >
        <Lucide name="bell" size={24} color={colors.buttonText} />
        {resolvedUnreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.error }]}>
            <Text style={styles.badgeText}>
              {resolvedUnreadCount > 9 ? '9+' : resolvedUnreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingVertical: 6,
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  withBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appNameContainer: {
    flex: 1,
    alignItems: 'center',
  },
  appName: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default TopNavbar;

