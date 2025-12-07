import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type MessageSource = 'offline' | 'online';
export type Language = 'en' | 'si';

export interface ChatMessage {
  id: string;
  question: string;
  answer: string;
  source: MessageSource;
  confidence?: number;
  timestamp: number;
  language: Language;
}

interface AIState {
  messages: ChatMessage[];
  loading: boolean;
  language: Language;
  modelLoaded: boolean;
  error: string | null;
}

const initialState: AIState = {
  messages: [],
  loading: false,
  language: 'en',
  modelLoaded: false,
  error: null,
};

const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    sendMessage: (state, action: PayloadAction<{ question: string; language: Language }>) => {
      const { question, language } = action.payload;
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        question,
        answer: '',
        source: 'offline',
        timestamp: Date.now(),
        language,
      };
      state.messages.push(userMessage);
      state.loading = true;
      state.error = null;
    },
    receiveMessage: (
      state,
      action: PayloadAction<{
        questionId: string;
        answer: string;
        source: MessageSource;
        confidence?: number;
      }>,
    ) => {
      const { questionId, answer, source, confidence } = action.payload;
      // First try to find by questionId
      let questionMessage = state.messages.find(msg => msg.id === questionId);
      
      // If not found, find the most recent message without an answer
      if (!questionMessage) {
        questionMessage = state.messages
          .slice()
          .reverse()
          .find(msg => !msg.answer && msg.question);
      }
      
      if (questionMessage) {
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          question: questionMessage.question,
          answer,
          source,
          confidence,
          timestamp: Date.now(),
          language: questionMessage.language,
        };
        state.messages.push(aiMessage);
      } else {
        console.warn('[ai.slice] Could not find question message for answer:', { questionId, answer: answer.substring(0, 50) });
      }
      state.loading = false;
      state.error = null;
    },
    setLanguage: (state, action: PayloadAction<Language>) => {
      state.language = action.payload;
    },
    clearHistory: state => {
      state.messages = [];
      state.error = null;
    },
    setAILoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },
    setModelLoaded: (state, action: PayloadAction<boolean>) => {
      state.modelLoaded = action.payload;
    },
  },
});

export const {
  sendMessage,
  receiveMessage,
  setLanguage,
  clearHistory,
  setAILoading,
  setError,
  setModelLoaded,
} = aiSlice.actions;

export default aiSlice.reducer;

