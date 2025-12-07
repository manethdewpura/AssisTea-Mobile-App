import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { useAppSelector } from '../../hooks';
import { selectTheme } from '../../store/selectors';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChangeText,
  onSend,
  loading = false,
  disabled = false,
  placeholder = 'Ask a question...',
}) => {
  const { colors } = useAppSelector(selectTheme);

  const handleSend = () => {
    if (value.trim() && !loading && !disabled) {
      onSend();
    }
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputField,
          {
            backgroundColor: colors.inputBackground,
            borderColor: colors.border,
          },
        ]}
      >
        <TextInput
          style={[styles.textInput, { color: colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={onChangeText}
          multiline={false}
          editable={!loading && !disabled}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
      </View>
      <TouchableOpacity
        style={[
          styles.sendButton,
          {
            backgroundColor: colors.primary,
          },
          (!value.trim() || loading || disabled) && styles.sendButtonDisabled,
        ]}
        onPress={handleSend}
        disabled={!value.trim() || loading || disabled}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.textInverse} />
        ) : (
          <Lucide name="send" size={20} color={colors.textInverse} />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 16,
    gap: 8,
  },
  inputField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

export default ChatInput;

