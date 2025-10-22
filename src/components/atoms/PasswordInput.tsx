import React, { useState } from 'react';
import {
  TextInput,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useAppSelector } from '../../hooks';
import { selectTheme } from '../../store/selectors';

export interface PasswordInputProps {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  error?: string;
  style?: any;
  inputStyle?: any;
  showPassword?: boolean;
  onTogglePassword?: () => void;
}

const PasswordInput: React.FC<PasswordInputProps> = ({
  placeholder = 'Password',
  value,
  onChangeText,
  label,
  error,
  style,
  inputStyle,
  showPassword: externalShowPassword,
  onTogglePassword,
}) => {
  const { colors } = useAppSelector(selectTheme);
  const [internalShowPassword, setInternalShowPassword] = useState(false);

  // Use external control if provided, otherwise use internal state
  const showPassword =
    externalShowPassword !== undefined
      ? externalShowPassword
      : internalShowPassword;
  const togglePassword =
    onTogglePassword || (() => setInternalShowPassword(!internalShowPassword));

  const containerStyle = [
    styles.container,
    {
      backgroundColor: colors.inputBackground,
      borderColor: error ? colors.error : colors.border,
    },
    style,
  ];

  const textInputStyle = [
    styles.input,
    {
      color: colors.text,
    },
    inputStyle,
  ];

  return (
    <View style={styles.wrapper}>
      {label && (
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      )}
      <View style={containerStyle}>
        <TextInput
          style={textInputStyle}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.eyeButton} onPress={togglePassword}>
          <Text style={styles.eyeButtonText}>{showPassword ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      </View>
      {error && (
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    minHeight: 20,
  },
  eyeButton: {
    padding: 8,
    paddingLeft: 8,
  },
  eyeButtonText: {
    fontSize: 18,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    marginTop: 4,
  },
});

export default PasswordInput;
