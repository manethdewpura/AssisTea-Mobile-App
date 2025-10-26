import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useAppSelector } from '../../hooks';
import { selectTheme } from '../../store/selectors';

export interface BottomNavbarProps {
  activeTab: 'watering' | 'chat' | 'home' | 'schedule' | 'team';
  onTabChange: (tab: 'watering' | 'chat' | 'home' | 'schedule' | 'team') => void;
}

const BottomNavbar: React.FC<BottomNavbarProps> = ({ activeTab, onTabChange }) => {
  const { colors, isDark } = useAppSelector(selectTheme);

  const tabs = [
    { key: 'watering' as const, name: 'droplet' },
    { key: 'chat' as const, name: 'message-square' },
    { key: 'home' as const, name: 'house' },
    { key: 'schedule' as const, name: 'calendar' },
    { key: 'team' as const, name: 'users' },
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface },
        isDark ? styles.noBorder : styles.withBorder,
      ]}
    >
      {tabs.map(({ key, name }) => {
        const isActive = activeTab === key;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.tab, isActive && styles.activeTab]}
            onPress={() => onTabChange(key)}
            activeOpacity={0.7}
          >
            <Lucide
              name={name as any}
              size={24}
              color={isActive ? colors.textColoredSecondary : colors.text}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  withBorder: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  noBorder: {
    borderTopWidth: 0,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  activeTab: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});

export default BottomNavbar;

