import { NativeModules, Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getAI, getGenerativeModel } from '@react-native-firebase/ai';
import type { MessageSource, Language } from '../store/slices/ai.slice';
import { ragChunkService } from './ragChunk.service';
import type { ChunkMatch } from './ragChunk.service';

const { AgronomistAI } = NativeModules;

export interface RelevantEntry {
  question: string;
  answer: string;
  similarity: number;
}

const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  si: 'Sinhala',
  ta: 'Tamil',
};

export interface AIResponse {
  answer: string;
  source: MessageSource;
  confidence: number;
  question?: string;
  language: Language;
  /** Populated for online RAG answers — the raw chunks Gemini read to derive this answer */
  retrievedChunks?: ChunkMatch[];
}

/** Re-export for consumers that need the chunk type */
export type { ChunkMatch };

/** A single turn in the conversation history passed to Gemini startChat() */
export interface RagChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface AIModelStatus {
  loaded: boolean;
}

class AIService {
  /**
   * Check if the native module is available
   */
  private isModuleAvailable(): boolean {
    return Platform.OS === 'android' && AgronomistAI != null;
  }

  /**
   * Check if the ML model is loaded
   */
  async checkModelLoaded(): Promise<boolean> {
    if (!this.isModuleAvailable()) {
      console.warn('AgronomistAI native module not available');
      return false;
    }

    try {
      const result: AIModelStatus = await AgronomistAI.checkModelLoaded();
      return result.loaded || false;
    } catch (error) {
      console.error('Error checking model status:', error);
      return false;
    }
  }

  /**
   * Initialize the ML model (lazy loading)
   */
  async initializeModel(): Promise<{ success: boolean; error?: string }> {
    if (!this.isModuleAvailable()) {
      return { success: false, error: 'Native module not available' };
    }

    try {
      const result = await AgronomistAI.initializeModel();
      return { success: result.success || false, error: result.error };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Query the offline knowledge base
   */
  async queryOffline(
    query: string,
    language: Language = 'en',
  ): Promise<AIResponse> {
    if (!this.isModuleAvailable()) {
      throw new Error('Native module not available');
    }

    try {
      const result: AIResponse = await AgronomistAI.queryOffline(
        query,
        language,
      );
      return result;
    } catch (error: any) {
      // React Native native module errors can come in different formats
      // Check for language mismatch error - the message should contain the localized text
      const errorMessage = error?.message || error?.userInfo?.message || 
                          (error instanceof Error ? error.message : 'Unknown error');
      
      // Check if it's a language mismatch error by checking the error code or message content
      if (error?.code === 'LANGUAGE_MISMATCH' || 
          errorMessage.includes('appears to be in') ||
          errorMessage.includes('ඔබගේ ප්‍රශ්නය') ||
          errorMessage.includes('உங்கள் வினா')) {
        // Return the error message directly (it already contains the localized message)
        throw new Error(errorMessage);
      }
      
      throw new Error(`Offline query failed: ${errorMessage}`);
    }
  }

  /**
   * Retrieve top 3-5 relevant entries from the knowledge base (similarity >= 50%).
   * Returns empty array if native module unavailable (e.g. on iOS) or no matches.
   */
  async retrieveRelevantEntries(
    query: string,
    language: Language = 'en',
  ): Promise<RelevantEntry[]> {
    if (!this.isModuleAvailable() || !query?.trim()) {
      return [];
    }
    try {
      const result = await AgronomistAI.retrieveRelevantEntries(
        query.trim(),
        language,
      );
      return Array.isArray(result)
        ? result.map((e: { question: string; answer: string; similarity: number }) => ({
            question: e.question,
            answer: e.answer,
            similarity: Number(e.similarity) || 0,
          }))
        : [];
    } catch (error: any) {
      const errorMessage =
        error?.message ||
        error?.userInfo?.message ||
        (error instanceof Error ? error.message : 'Unknown error');

      // Surface language mismatch errors so the UI can show the same warning as offline mode
      if (
        error?.code === 'LANGUAGE_MISMATCH' ||
        errorMessage.includes('appears to be in') ||
        errorMessage.includes('ඔබගේ ප්‍රශ්නය') ||
        errorMessage.includes('உங்கள் வினா')
      ) {
        throw new Error(errorMessage);
      }

      return [];
    }
  }

  /**
   * Query online Gemini via Firebase Vertex AI.
   * Retrieves top relevant entries, builds prompt, and generates farmer-friendly answer.
   */
  async queryOnline(
    query: string,
    language: Language = 'en',
  ): Promise<AIResponse> {
    const entries = await this.retrieveRelevantEntries(query, language);
    const hasMatches = entries.length > 0;
    const langName = LANGUAGE_NAMES[language];

    let systemPrompt =
      'You are AssisTea, a Sri Lankan tea agronomy expert assistant. ' +
      'Your role is to give accurate, practical advice to tea farmers and estate workers. ' +
      'Always respond in plain text only — no markdown, no ** bold, no bullet points, no numbered lists, no special symbols. ' +
      'Use clear, simple sentences a farmer can understand. ' +
      'When exact figures are available (kg, grams, litres, dosage rates, application intervals), always include them in your answer.';

    if (hasMatches) {
      systemPrompt +=
        '\n\nThe following entries from the verified knowledge base are most relevant to this query. ' +
        'Use them as your primary source of truth. Synthesise the information into a coherent, ' +
        'complete answer — do not just repeat the entries verbatim:\n\n' +
        entries
          .map(
            (e, i) =>
              `[Entry ${i + 1}]\nQ: ${e.question}\nA: ${e.answer}`,
          )
          .join('\n\n');
      systemPrompt +=
        '\n\nIf multiple entries are relevant, combine them into a single unified answer. ' +
        'If the user asked about quantities, dosages, or measurements, make sure to state the exact figures.';
    } else {
      systemPrompt +=
        '\n\nNo pre-matched knowledge base entries were retrieved for this query, but you MUST still answer the question.' +
        ' Draw on your general knowledge of Sri Lankan tea cultivation, agronomy, and best practices to give a substantive, helpful response.' +
        ' Include specific figures and recommendations where possible.' +
        ' Do NOT say you lack information, cannot answer, or do not have sufficient data.' +
        " Always end your answer with this disclaimer on a new line: 'Note: Generated by AI based on general knowledge. Please verify with a qualified agronomist.'";
    }

    const userPrompt =
      `User Question (in ${langName}):\n${query}\n\n` +
      `Instructions: Respond fully in ${langName}. ` +
      `Give a direct, farmer-friendly answer. ` +
      `If the question asks "how much", "how many", or any quantity — always provide the specific number or range. ` +
      `Do not use bold, italics, markdown, or any decorative text styles — just plain text sentences.`;

    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    try {
      const app = getApp();
      const ai = getAI(app);
      const model = getGenerativeModel(ai, { model: 'gemini-2.5-flash-lite' });
      const result = await model.generateContent(fullPrompt);
      const answer = result.response.text();
      return {
        answer: answer?.trim() || 'No response from model.',
        source: 'online',
        confidence: hasMatches ? 1.0 : 0.5,
        language,
      };
    } catch (error: any) {
      const errorMessage =
        error?.message ||
        error?.userInfo?.message ||
        (error instanceof Error ? error.message : 'Unknown error');

      // Preserve localized language-mismatch warning (same behavior as offline)
      if (
        error?.code === 'LANGUAGE_MISMATCH' ||
        errorMessage.includes('appears to be in') ||
        errorMessage.includes('ඔබගේ ප්‍රශ්නය') ||
        errorMessage.includes('உங்கள் வினா')
      ) {
        throw new Error(errorMessage);
      }

      throw new Error(`Online query failed: ${errorMessage}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Genuine RAG pipeline (online mode)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Embed a query string using Vertex AI text-embedding-004 via Firebase AI SDK.
   * Returns a 768-dimensional vector. Returns [] on failure (graceful degradation).
   *
   * IMPORTANT: This model must match the one used in scripts/prepareRagChunks.mjs
   * so that query embeddings and chunk embeddings occupy the same vector space.
   */
  private async embedQuery(text: string): Promise<number[]> {
    try {
      const app = getApp();
      const ai = getAI(app);
      const embeddingModel = getGenerativeModel(ai, { model: 'text-embedding-004' });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (embeddingModel as any).embedContent({
        content: { parts: [{ text }], role: 'user' },
        taskType: 'RETRIEVAL_QUERY',
      });

      const values: number[] = result?.embedding?.values ?? [];
      if (values.length === 0) {
        console.warn('[AIService] embedQuery returned empty embedding vector');
      }
      return values;
    } catch (error: any) {
      console.error('[AIService] embedQuery failed:', error?.message ?? error);
      return [];
    }
  }

  /**
   * Build a structured RAG prompt.
   *
   * Separates:
   *   [SYSTEM]  — persona + language + RAG instructions
   *   [CONTEXT] — retrieved raw text chunks (numbered passages)
   *   [USER]    — the current question
   *
   * The system instruction is returned separately so it can be passed to
   * getGenerativeModel({ systemInstruction }) rather than mixed into the
   * user turn — this follows Firebase AI SDK best practice for system prompts.
   */
  private buildRAGPrompt(
    query: string,
    language: Language,
    chunks: ChunkMatch[],
  ): { systemInstruction: string; userTurn: string } {
    const langName = LANGUAGE_NAMES[language];
    const hasChunks = chunks.length > 0;

    // ── System instruction ────────────────────────────────────────────────────
    let systemInstruction =
      'You are AssisTea, a Sri Lankan tea agronomy expert assistant. ' +
      'Your role is to give accurate, practical advice to tea farmers and estate workers. ' +
      'Always respond in plain text only — no markdown, no ** bold, no bullet points, ' +
      'no numbered lists, no special symbols. ' +
      'Use clear, simple sentences a farmer can understand. ' +
      `Respond fully in ${langName}.`;

    if (hasChunks) {
      systemInstruction +=
        '\n\nThe following passages are extracted verbatim from verified agronomic source ' +
        'documents. Read every passage carefully before answering. ' +
        'Base your answer ONLY on information found in these passages. ' +
        'Do NOT draw on your parametric memory or training data to fill gaps. ' +
        'If the passages do not contain enough information to answer the question fully, ' +
        "say so clearly and add: 'Please consult a qualified agronomist for further guidance.'" +
        '\n\n[RETRIEVED PASSAGES]\n' +
        chunks
          .map(
            (c, i) =>
              `[Passage ${i + 1}] Source: ${c.source}\nTitle: ${c.title}\n\n"${c.text}"`,
          )
          .join('\n\n');
    } else {
      systemInstruction +=
        '\n\nNo relevant passages were retrieved from the knowledge base for this query. ' +
        'You MUST answer using your general knowledge of Sri Lankan tea cultivation and agronomy. ' +
        'Include specific figures and recommendations where possible. ' +
        "Always end your response with: 'Note: This answer is based on general AI knowledge. " +
        "Please verify with a qualified agronomist or the Tea Research Institute of Sri Lanka.'";
    }

    // ── User turn ─────────────────────────────────────────────────────────────
    const userTurn =
      `Question (in ${langName}): ${query}\n\n` +
      `Please provide a direct, farmer-friendly answer in ${langName}. ` +
      'If the question asks about quantities, dosages, application rates, or measurements, ' +
      'always state the specific number or range. ' +
      'Do not use bold, italics, or any text formatting — plain sentences only.';

    return { systemInstruction, userTurn };
  }

  /**
   * Full online RAG pipeline:
   *   1. Embed the query with text-embedding-004 (same model used for chunk pre-embedding)
   *   2. Retrieve top-3 raw text chunks via cosine similarity
   *   3. Build a structured RAG prompt (passages go into the system instruction)
   *   4. Send to Gemini via startChat() for multi-turn conversation support
   *
   * This is the method ChatScreen should call for online mode.
   * The existing queryOnline() is kept for backward compatibility.
   */
  async queryOnlineRAG(
    query: string,
    language: Language = 'en',
    conversationHistory: RagChatTurn[] = [],
  ): Promise<AIResponse> {
    // ── Step 1: Language mismatch check (same guard as offline path) ──────────
    // Re-use native module for language detection so UX is consistent.
    if (this.isModuleAvailable()) {
      try {
        // retrieveRelevantEntries already performs language detection and throws
        // LANGUAGE_MISMATCH — we call it with a tiny minSimilarity so it exits
        // after language detection even if no entries match.
        await this.retrieveRelevantEntries(query, language);
      } catch (error: any) {
        const msg: string =
          error?.message ||
          error?.userInfo?.message ||
          (error instanceof Error ? error.message : '');
        if (
          error?.code === 'LANGUAGE_MISMATCH' ||
          msg.includes('appears to be in') ||
          msg.includes('ඔබගේ ප්‍‍රශ්නය') ||
          msg.includes('உங்கள் வினா')
        ) {
          throw new Error(msg);
        }
        // Any other error from the native module is non-fatal — continue.
      }
    }

    // ── Step 2: Embed the query with text-embedding-004 ──────────────────────
    const queryEmbedding = await this.embedQuery(query);

    // ── Step 3: Retrieve top-3 raw text chunks ────────────────────────────────
    const chunks = ragChunkService.findTopChunks(queryEmbedding, language, 3, 0.40);
    console.log(
      `[AIService] RAG: retrieved ${chunks.length} chunks for query "${query.substring(0, 60)}"`,
      chunks.map(c => ({ title: c.title, similarity: c.similarity.toFixed(3) })),
    );

    // ── Step 4: Build structured RAG prompt ──────────────────────────────────
    const { systemInstruction, userTurn } = this.buildRAGPrompt(query, language, chunks);

    // ── Step 5: Gemini multi-turn chat ────────────────────────────────────────
    try {
      const app = getApp();
      const ai = getAI(app);
      const model = getGenerativeModel(ai, {
        model: 'gemini-2.5-flash-lite',
        // System instruction is set at model level (Firebase AI SDK best practice)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        systemInstruction: systemInstruction as any,
      });

      // Build Firebase-format history from the last conversation turns
      const history = conversationHistory
        .slice(0, -1) // exclude the current question (last user turn)
        .map(turn => ({
          role: turn.role,
          parts: [{ text: turn.text }],
        }));

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(userTurn);
      const answer = result.response.text();

      return {
        answer: answer?.trim() || 'No response from model.',
        source: 'online',
        confidence: chunks.length > 0 ? 0.9 : 0.5,
        language,
        retrievedChunks: chunks,
      };
    } catch (error: any) {
      const errorMessage =
        error?.message ||
        error?.userInfo?.message ||
        (error instanceof Error ? error.message : 'Unknown error');

      // Preserve language-mismatch errors so ChatScreen shows the right warning
      if (
        error?.code === 'LANGUAGE_MISMATCH' ||
        errorMessage.includes('appears to be in') ||
        errorMessage.includes('ඔබගේ ප්‍‍රශ්නය') ||
        errorMessage.includes('உங்கள் வினா')
      ) {
        throw new Error(errorMessage);
      }

      throw new Error(`Online RAG query failed: ${errorMessage}`);
    }
  }
}

export const aiService = new AIService();

