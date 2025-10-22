import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAppSelector } from '../../hooks';
import { selectTheme } from '../../store/selectors';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'small' | 'medium' | 'large';
  style?: any;
  textStyle?: any;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  size = 'medium',
  style,
  textStyle,
}) => {
  const { colors } = useAppSelector(selectTheme);

  const getButtonColor = () => {
    switch (variant) {
      case 'primary':
        return colors.primary;
      case 'secondary':
        return colors.secondary;
      case 'danger':
        return colors.error;
      case 'success':
        return colors.success;
      default:
        return colors.primary;
    }
  };

  const getButtonSize = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 };
      case 'large':
        return { paddingVertical: 18, paddingHorizontal: 20, fontSize: 18 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 16, fontSize: 16 };
    }
  };

  const buttonStyle = [
    styles.button,
    {
      backgroundColor: disabled ? '#ccc' : getButtonColor(),
      paddingVertical: getButtonSize().paddingVertical,
      paddingHorizontal: getButtonSize().paddingHorizontal,
    },
    style,
  ];

  const buttonTextStyle = [
    styles.buttonText,
    {
      color: colors.buttonText,
      fontSize: getButtonSize().fontSize,
    },
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={colors.buttonText} size="small" />
      ) : (
        <Text style={buttonTextStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontWeight: '600',
  },
});

export default Button;
