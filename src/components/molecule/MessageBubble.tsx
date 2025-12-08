import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppSelector } from '../../hooks';
import { selectTheme } from '../../store/selectors';
import type { ChatMessage, MessageSource } from '../../store/slices/ai.slice';

interface MessageBubbleProps {
  message: ChatMessage;
  isUser: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isUser }) => {
  const { colors } = useAppSelector(selectTheme);

  const getSourceLabel = (source: MessageSource): string => {
    switch (source) {
      case 'offline':
        return 'Offline AI';
      case 'online':
        return 'Online AI';
      default:
        return 'AI';
    }
  };

  const getSourceColor = (source: MessageSource): string => {
    switch (source) {
      case 'offline':
        return colors.primary || '#28a745';
      case 'online':
        return colors.warning || '#ffc107';
      default:
        return colors.textSecondary || '#666';
    }
  };

  if (isUser) {
    return (
      <View style={styles.userMessageContainer}>
        <View
          style={[
            styles.userMessageBubble,
            { backgroundColor: colors.primary },
          ]}
        >
          <Text style={[styles.userMessageText, { color: colors.textInverse }]}>
            {message.question}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.aiMessageContainer}>
      <View
        style={[
          styles.aiMessageBubble,
          { backgroundColor: colors.surface || colors.inputBackground },
        ]}
      >
        <Text style={[styles.aiMessageText, { color: colors.text }]}>
          {message.answer}
        </Text>
        <View style={styles.metadataContainer}>
          <View
            style={[
              styles.sourceBadge,
              { backgroundColor: getSourceColor(message.source) + '20' },
            ]}
          >
            <Text
              style={[
                styles.sourceText,
                { color: getSourceColor(message.source) },
              ]}
            >
              {getSourceLabel(message.source)}
            </Text>
          </View>
          {message.confidence !== undefined && (
            <Text
              style={[styles.confidenceText, { color: colors.textSecondary }]}
            >
              {(message.confidence * 100).toFixed(0)}% match
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  userMessageContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  userMessageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderTopRightRadius: 4,
  },
  userMessageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  aiMessageContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  aiMessageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderTopLeftRadius: 4,
  },
  aiMessageText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  confidenceText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
});

export default MessageBubble;

