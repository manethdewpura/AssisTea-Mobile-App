import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useAppSelector } from '../../hooks';
import { selectTheme } from '../../store/selectors';

export interface OptionCardProps {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
}

const OptionCard: React.FC<OptionCardProps> = ({
  icon,
  title,
  description,
  onPress,
}) => {
  const { colors } = useAppSelector(selectTheme);

  return (
    <TouchableOpacity
      style={[
        styles.optionBox,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
        <Lucide name={icon as any} size={32} color={colors.primary} />
      </View>
      <Text style={[styles.optionTitle, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
        {description}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  optionBox: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default OptionCard;

