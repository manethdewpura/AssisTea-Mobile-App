import { databaseService } from '../database.service';
import type {
  ChatMessage,
  Language,
  MessageSource,
} from '../../store/slices/ai.slice';

type ChatRow = {
  id: number;
  question: string;
  answer: string;
  source: MessageSource;
  confidence: number | null;
  timestamp: number;
  language: Language;
};

/**
 * Ensure database is initialized before use
 */
async function ensureDatabaseInitialized(): Promise<void> {
  try {
    databaseService.getDatabase();
  } catch {
    await databaseService.initialize();
  }
}

class ChatHistorySQLiteService {
  /**
   * Save a question/answer pair for a given language.
   * Stored as a single row and expanded back into two ChatMessage entries on read.
   */
  async saveMessagePair(params: {
    question: string;
    answer: string;
    source: MessageSource;
    confidence?: number;
    language: Language;
    timestamp?: number;
  }): Promise<void> {
    const { question, answer, source, confidence, language } = params;
    const ts = params.timestamp ?? Date.now();

    if (!question || !answer) {
      return;
    }

    await ensureDatabaseInitialized();

    const query = `
      INSERT INTO chat_messages (
        question,
        answer,
        source,
        confidence,
        timestamp,
        language
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    const queryParams = [
      question,
      answer,
      source,
      confidence ?? null,
      ts,
      language,
    ];

    await databaseService.executeSql(query, queryParams);
  }

  /**
   * Load chat history for a specific language and map it into ChatMessage[]
   * (user + AI messages, ordered by timestamp).
   */
  async getMessagesByLanguage(language: Language): Promise<ChatMessage[]> {
    await ensureDatabaseInitialized();

    const query = `
      SELECT id, question, answer, source, confidence, timestamp, language
      FROM chat_messages
      WHERE language = ?
      ORDER BY timestamp ASC
    `;

    const result = await databaseService.executeSql(query, [language]);

    const messages: ChatMessage[] = [];

    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows.item(i) as ChatRow;

      // User question message
      messages.push({
        id: `db-user-${row.id}`,
        question: row.question,
        answer: '',
        source: 'offline',
        timestamp: row.timestamp,
        language: row.language,
      });

      // AI answer message
      messages.push({
        id: `db-ai-${row.id}`,
        question: row.question,
        answer: row.answer,
        source: row.source,
        confidence: row.confidence ?? undefined,
        timestamp: row.timestamp + 1, // ensure ordering after question
        language: row.language,
      });
    }

    return messages;
  }

  /**
   * Clear chat history for a specific language.
   */
  async clearHistoryByLanguage(language: Language): Promise<void> {
    await ensureDatabaseInitialized();
    const query = 'DELETE FROM chat_messages WHERE language = ?';
    await databaseService.executeSql(query, [language]);
  }
}

export const chatHistorySQLiteService = new ChatHistorySQLiteService();

