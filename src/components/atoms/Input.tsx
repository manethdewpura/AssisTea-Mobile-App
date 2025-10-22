import React from 'react';
import { TextInput, StyleSheet, View, Text } from 'react-native';
import { useAppSelector } from '../../hooks';
import { selectTheme } from '../../store/selectors';

export interface InputProps {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  label?: string;
  error?: string;
  style?: any;
  inputStyle?: any;
}

const Input: React.FC<InputProps> = ({
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  secureTextEntry = false,
  multiline = false,
  numberOfLines = 1,
  label,
  error,
  style,
  inputStyle,
}) => {
  const { colors } = useAppSelector(selectTheme);

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
      fontSize: multiline ? 16 : 16,
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
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          numberOfLines={numberOfLines}
        />
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
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    fontSize: 16,
    minHeight: 20,
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

export default Input;
