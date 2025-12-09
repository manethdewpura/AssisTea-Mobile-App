import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector, useAppDispatch } from '../hooks';
import { selectTheme, selectAI } from '../store/selectors';
import {
  sendMessage,
  receiveMessage,
  setAIError,
  setModelLoaded,
  setAILoading,
} from '../store/slices/ai.slice';
import { aiService } from '../services';
import MessageBubble from '../components/molecule/MessageBubble';
import LanguageSelector from '../components/molecule/LanguageSelector';
import ChatInput from '../components/molecule/ChatInput';

const ChatScreen: React.FC = () => {
  const { colors } = useAppSelector(selectTheme);
  const { messages, loading, language, modelLoaded, error } =
    useAppSelector(selectAI);
  const dispatch = useAppDispatch();
  const scrollViewRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = useState('');
  const [isOnline] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const pendingQuestionRef = useRef<string | null>(null);

  // Check network status
  // useEffect(() => {
  //   const unsubscribeNetInfo = NetInfo.addEventListener(state => {
  //     setIsOnline(state.isConnected ?? false);
  //   });

  //   return () => {
  //     unsubscribeNetInfo();
  //   };
  // }, []);

  // Initialize model on mount
  useEffect(() => {
    const initializeModel = async () => {
      try {
        const isLoaded = await aiService.checkModelLoaded();
        if (!isLoaded && !initializing) {
          setInitializing(true);
          const result = await aiService.initializeModel();
          if (result.success) {
            dispatch(setModelLoaded(true));
          } else {
            console.warn('Model initialization failed:', result.error);
            // Continue anyway - fallback will be used
            dispatch(setModelLoaded(false));
          }
          setInitializing(false);
        } else {
          dispatch(setModelLoaded(isLoaded));
        }
      } catch (err) {
        console.error('Error checking model:', err);
        dispatch(setModelLoaded(false));
        setInitializing(false);
      }
    };

    initializeModel();
  }, [dispatch, initializing]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // Log messages state changes
  useEffect(() => {
    console.log('[ChatScreen] Messages updated:', {
      count: messages.length,
      messages: messages.map(m => ({
        id: m.id,
        question: m.question?.substring(0, 50),
        hasAnswer: !!m.answer,
        answer: m.answer?.substring(0, 50),
      })),
    });
  }, [messages]);

  const handleSendMessage = async () => {
    console.log('[ChatScreen] handleSendMessage called');
    const question = inputText.trim();
    console.log('[ChatScreen] Question:', question);
    console.log('[ChatScreen] Loading state:', loading);
    
    if (!question || loading) {
      console.log('[ChatScreen] Early return - question empty or loading');
      return;
    }

    setInputText('');
    pendingQuestionRef.current = question;

    // Dispatch user message
    console.log('[ChatScreen] Dispatching sendMessage with:', { question, language });
    dispatch(sendMessage({ question, language }));

    try {
      console.log('[ChatScreen] Setting AI loading to true');
      dispatch(setAILoading(true));
      dispatch(setAIError(null));

      // Query offline AI
      console.log('[ChatScreen] Calling aiService.queryOffline with:', { question, language });
      const response = await aiService.queryOffline(question, language);
      console.log('[ChatScreen] Received response from aiService:', {
        hasAnswer: !!response.answer,
        answer: response.answer?.substring(0, 100),
        source: response.source,
        confidence: response.confidence,
        fullResponse: response,
      });

      // Find the message ID from the current messages state
      // Get the most recent message that matches the question and has no answer
      const currentMessages = messages;
      const questionMessage = currentMessages
        .slice()
        .reverse()
        .find(msg => msg.question === question && !msg.answer);
      
      const actualQuestionId = questionMessage?.id || `user-${Date.now()}`;
      console.log('[ChatScreen] Found question message ID:', actualQuestionId);
      console.log('[ChatScreen] All messages:', currentMessages.map(m => ({ id: m.id, question: m.question?.substring(0, 30), hasAnswer: !!m.answer })));

      // Dispatch AI response
      // Note: Redux slice will fallback to most recent unanswered message if questionId doesn't match
      const receiveMessagePayload = {
        questionId: actualQuestionId,
        answer: response.answer,
        source: response.source,
        confidence: response.confidence,
      };
      console.log('[ChatScreen] Dispatching receiveMessage with:', {
        questionId: actualQuestionId,
        hasAnswer: !!receiveMessagePayload.answer,
        answer: receiveMessagePayload.answer?.substring(0, 100),
        source: receiveMessagePayload.source,
        confidence: receiveMessagePayload.confidence,
      });
      dispatch(receiveMessage(receiveMessagePayload));
      console.log('[ChatScreen] receiveMessage dispatched successfully');
      pendingQuestionRef.current = null;
    } catch (err) {
      console.error('[ChatScreen] Error in handleSendMessage:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to get response';
      console.log('[ChatScreen] Error message:', errorMessage);
      dispatch(setAIError(errorMessage));

      // Find the message ID for error case too
      const currentMessages = messages;
      const questionMessage = currentMessages
        .slice()
        .reverse()
        .find(msg => msg.question === question && !msg.answer);
      const actualQuestionId = questionMessage?.id || `user-${Date.now()}`;

      // Show error message in chat
      // Redux slice will fallback to most recent unanswered message if questionId doesn't match
      const errorPayload = {
        questionId: actualQuestionId,
        answer: `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
        source: 'offline' as const,
        confidence: 0,
      };
      console.log('[ChatScreen] Dispatching error receiveMessage with:', errorPayload);
      dispatch(receiveMessage(errorPayload));
      pendingQuestionRef.current = null;
    } finally {
      console.log('[ChatScreen] Setting AI loading to false');
      dispatch(setAILoading(false));
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      {/* Status Indicator */}
      <View style={styles.statusContainer}>
        <View
          style={[
            styles.statusBubble,
            {
              backgroundColor: isOnline
                ? colors.primaryLight
                : colors.inputBackground,
              borderColor: isOnline ? colors.primary : colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: isOnline ? colors.primary : colors.textSecondary },
            ]}
          >
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
        {!modelLoaded && (
          <View style={styles.modelStatusContainer}>
            {initializing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[styles.modelStatusText, { color: colors.textSecondary }]}
              >
                Model: Using fallback
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Language Selector */}
      <LanguageSelector />

      {/* Chat Messages */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesScrollView}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Start a conversation by asking a question about tea farming
              </Text>
              <Text
                style={[
                  styles.emptySubtext,
                  { color: colors.textSecondary },
                ]}
              >
                Try asking about diseases, fertilizers, harvesting, or pruning
              </Text>
            </View>
          ) : (
            messages.map((message, index) => {
              console.log(`[ChatScreen] Rendering message ${index}:`, {
                id: message.id,
                hasQuestion: !!message.question,
                question: message.question?.substring(0, 30),
                hasAnswer: !!message.answer,
                answer: message.answer?.substring(0, 30),
                fullMessage: message,
              });

              // User messages (have question, no answer)
              if (message.question && !message.answer) {
                console.log(`[ChatScreen] Rendering as USER message (index ${index})`);
                return (
                  <MessageBubble
                    key={message.id || index}
                    message={message}
                    isUser={true}
                  />
                );
              }

              // AI messages (have answer)
              if (message.answer) {
                console.log(`[ChatScreen] Rendering as AI message (index ${index})`);
                return (
                  <MessageBubble
                    key={message.id || index}
                    message={message}
                    isUser={false}
                  />
                );
              }

              console.log(`[ChatScreen] Message ${index} doesn't match any condition, returning null`);
              return null;
            })
          )}
          {loading && (
            <View style={styles.typingIndicator}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text
                style={[styles.typingText, { color: colors.textSecondary }]}
              >
                AI is thinking...
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Error Display */}
        {error && (
          <View
            style={[
              styles.errorContainer,
              { backgroundColor: colors.error + '20', borderColor: colors.error },
            ]}
          >
            <Text style={[styles.errorText, { color: colors.error }]}>
              {error}
            </Text>
          </View>
        )}

        {/* Input Field */}
        <ChatInput
          value={inputText}
          onChangeText={setInputText}
          onSend={handleSendMessage}
          loading={loading}
          disabled={initializing}
          placeholder="Ask about tea farming..."
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusContainer: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  statusBubble: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modelStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modelStatusText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  chatContainer: {
    flex: 1,
  },
  messagesScrollView: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  errorContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default ChatScreen;
