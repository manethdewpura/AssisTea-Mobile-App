import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { selectTheme, selectAI, selectNetwork } from '../store/selectors';
import {
  sendMessage,
  receiveMessage,
  setAIError,
  setModelLoaded,
  setAILoading,
  setMessages,
} from '../store/slices/ai.slice';
import { aiService } from '../services';
import type { RagChatTurn } from '../services/ai.service';
import { chatHistorySQLiteService } from '../services/sqlite/chatHistorySQLite.service';
import MessageBubble from '../components/molecule/MessageBubble';
import LanguageSelector from '../components/molecule/LanguageSelector';
import ChatInput from '../components/molecule/ChatInput';
import type { Language, MessageSource } from '../store/slices/ai.slice';
 
const getEmptyTexts = (lang: Language) => {
  switch (lang) {
    case 'si':
      return {
        title:
          'තේ වගාව පිළිබඳ ප්‍රශ්නයක් ඇසීමෙන් සංවාදය ආරම්භ කරන්න',
        subtitle:
          'රෝග, පොහොර, අස්වනු කප්පාදු, කපන කටයුතු වැනි දේවල් පිළිබඳව ප්‍රශ්න කරන්න උත්සාහ කරන්න',
      };
    case 'ta':
      return {
        title:
          'தேயிலை விவசாயத்தைப் பற்றி ஒரு கேள்வி கேட்டு உரையாடலைத் தொடங்குங்கள்',
        subtitle:
          'நோய்கள், உரங்கள், அறுவடை அல்லது வெட்டுதல் பற்றி கேட்டு முயற்சி செய்யுங்கள்',
      };
    case 'en':
    default:
      return {
        title:
          'Start a conversation by asking a question about tea farming',
        subtitle:
          'Try asking about diseases, fertilizers, harvesting, or pruning',
      };
  }
};
 
const ChatScreen: React.FC = () => {
  const { colors } = useAppSelector(selectTheme);
  const { messages, loading, language, modelLoaded, error } =
    useAppSelector(selectAI);
  const { isOnline } = useAppSelector(selectNetwork);
  const dispatch = useAppDispatch();
  const scrollViewRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = useState('');
  const [initializing, setInitializing] = useState(false);
  const pendingQuestionRef = useRef<string | null>(null);
  const historyRequestIdRef = useRef(0);

  const scrollChatToBottom = useCallback((animated: boolean) => {
    scrollViewRef.current?.scrollToEnd({ animated });
  }, []);

  /**
   * Build the last N conversation turns as RagChatTurn[] for Gemini's startChat().
   * Includes both question (user) and answer (model) for each completed exchange.
   */
  const buildConversationHistory = (): RagChatTurn[] => {
    return messages.slice(-12).flatMap(msg => {
      const turns: RagChatTurn[] = [];
      if (msg.question) turns.push({ role: 'user', text: msg.question });
      if (msg.answer)   turns.push({ role: 'model', text: msg.answer });
      return turns;
    });
  };
 
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
 
  // Load chat history from SQLite when language changes.
  // When the user switches language, we always load that language's history from the DB.
  // Dependency is only [dispatch, language] so we don't overwrite in-memory messages after each send.
  useEffect(() => {
    const currentRequestId = ++historyRequestIdRef.current;
    let isCurrent = true;
 
    const loadHistory = async () => {
      try {
        const history = await chatHistorySQLiteService.getMessagesByLanguage(
          language,
        );
        if (!isCurrent || currentRequestId !== historyRequestIdRef.current) {
          return;
        }
        dispatch(setMessages(history));
      } catch (err) {
        console.error('[ChatScreen] Failed to load chat history:', err);
      }
    };
 
    loadHistory();
 
    return () => {
      isCurrent = false;
    };
  }, [dispatch, language]);
 
  /**
   * Keep the latest messages in view. `scrollToEnd` in a bare useEffect often runs
   * before ScrollView has measured the new content height (e.g. after opening the
   * screen or switching language), so the scroll offset stays at 0 — the "top".
   * `onContentSizeChange` runs after layout, so pairing it with a deferred
   * scroll fixes that race.
   */
  useEffect(() => {
    if (messages.length === 0 && !loading) {
      return;
    }
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) {
          scrollChatToBottom(false);
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [messages, loading, scrollChatToBottom]);

  const handleMessagesContentSizeChange = useCallback(() => {
    if (messages.length === 0 && !loading) {
      return;
    }
    scrollChatToBottom(false);
  }, [messages.length, loading, scrollChatToBottom]);
 
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
 
      const response = isOnline
        ? await aiService.queryOnlineRAG(question, language, buildConversationHistory())
        : await aiService.queryOffline(question, language);
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
        // Map retrieved RAG chunks to source attribution entries
        sources: response.retrievedChunks?.map(c => ({
          title: c.title,
          docSource: c.source,
        })),
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
 
      // Persist this Q/A pair in per-language chat history
      try {
        await chatHistorySQLiteService.saveMessagePair({
          question,
          answer: response.answer,
          source: response.source,
          confidence: response.confidence,
          language,
        });
      } catch (persistError) {
        console.error(
          '[ChatScreen] Failed to persist chat history:',
          persistError,
        );
      }
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
 
      // Check if it's a language mismatch error - display the message directly
      const isLanguageMismatch = errorMessage.includes('appears to be in') ||
                                 errorMessage.includes('ඔබගේ ප්‍රශ්නය') ||
                                 errorMessage.includes('உங்கள் வினா');
     
      // Show error message in chat
      // Redux slice will fallback to most recent unanswered message if questionId doesn't match
      const errorPayload = {
        questionId: actualQuestionId,
        answer: isLanguageMismatch
          ? errorMessage
          : `Sorry, I encountered an error: ${errorMessage}. Please try again.`,
        source: (isOnline ? 'online' : 'offline') as MessageSource,
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
      edges={['top', 'bottom']}
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesScrollView}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={handleMessagesContentSizeChange}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              {(() => {
                const { title, subtitle } = getEmptyTexts(language);
                return (
                  <>
                    <Text
                      style={[styles.emptyText, { color: colors.textSecondary }]}
                    >
                      {title}
                    </Text>
                    <Text
                      style={[
                        styles.emptySubtext,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {subtitle}
                    </Text>
                  </>
                );
              })()}
            </View>
          ) : (
            /*
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
          */
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