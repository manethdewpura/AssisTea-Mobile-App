import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useAppSelector } from '../../hooks';
import { selectTheme } from '../../store/selectors';

export interface StatusCardProps {
  icon: string;
  iconColor: string;
  title: string;
  message?: string;
  timestamp?: string;
  statusBadge?: {
    text: string;
    color: string;
  };
  unreadDot?: boolean;
  borderColor: string;
  onPress?: () => void;
}

const StatusCard: React.FC<StatusCardProps> = ({
  icon,
  iconColor,
  title,
  message,
  timestamp,
  statusBadge,
  unreadDot,
  borderColor,
  onPress,
}) => {
  const { colors } = useAppSelector(selectTheme);

  const CardContent = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderLeftColor: borderColor,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: iconColor + '20' },
          ]}
        >
          <Lucide name={icon as any} size={20} color={iconColor} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            {unreadDot && (
              <View
                style={[
                  styles.unreadDot,
                  { backgroundColor: colors.primary },
                ]}
              />
            )}
          </View>
          {message && (
            <Text
              style={[styles.message, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {message}
            </Text>
          )}
          <View style={styles.footer}>
            {timestamp && (
              <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                {timestamp}
              </Text>
            )}
            {statusBadge && (
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusBadge.color + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: statusBadge.color },
                  ]}
                >
                  {statusBadge.text}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {CardContent}
      </TouchableOpacity>
    );
  }

  return CardContent;
};

const styles = StyleSheet.create({
  card: {
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
  cardHeader: {
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
  cardContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  message: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timestamp: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
});

export default StatusCard;

