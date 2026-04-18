import { NativeModules, Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getAI, getGenerativeModel } from '@react-native-firebase/ai';
import { FIREBASE_PROJECT_ID } from '@env';
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

const OUT_OF_SCOPE_REPLY: Record<Language, string> = {
  en:
    'I can only answer tea cultivation questions using verified knowledge-base passages. Please ask a tea-farming question with specific details.',
  si:
    'මට පිළිතුරු දිය හැක්කේ තහවුරු කළ දැනුම් ගබඩා කොටස් මත පදනම් වූ තේ වගා ප්‍රශ්නවලට පමණි. කරුණාකර විස්තර සහිත තේ වගා ප්‍රශ්නයක් අසන්න.',
  ta:
    'சரிபார்க்கப்பட்ட அறிவக பகுதிகளை அடிப்படையாகக் கொண்ட தேயிலை சாகுபடி கேள்விகளுக்கே நான் பதிலளிக்க முடியும். தயவுசெய்து தெளிவான தேயிலை சாகுபடி கேள்வியை கேளுங்கள்.',
};

const NEED_MORE_DETAIL_REPLY: Record<Language, string> = {
  en:
    'Please ask a more specific tea-farming question. Include the crop stage, symptom, and where/when it happens so I can retrieve the right guidance.',
  si:
    'කරුණාකර තේ වගාවට අදාළව තව විස්තරාත්මක ප්‍රශ්නයක් අසන්න. අවස්ථාව, ලක්ෂණ, සහ එය සිදුවන තැන/වේලාව සඳහන් කරන්න.',
  ta:
    'தயவுசெய்து மேலும் குறிப்பான தேயிலை சாகுபடி கேள்வியை கேளுங்கள். வளர்ச்சி நிலை, அறிகுறி, எப்போது/எங்கே ஏற்படுகிறது என்பதையும் சேர்க்கவும்.',
};

const DEPLOYED_EMBEDDING_FALLBACK_URL =
  'https://embedquery-qnzic723va-uc.a.run.app';

const ONLINE_TEMP_UNAVAILABLE_REPLY: Record<Language, string> = {
  en:
    'Online AI is temporarily unavailable due to quota limits. I found related guidance in the knowledge base. Please review the listed sources and try again later.',
  si:
    'කෝටා සීමා නිසා Online AI තාවකාලිකව ලබාගත නොහැක. දැනුම් ගබඩාවේ අදාළ මාර්ගෝපදේශ සොයාගත්තා. කරුණාකර ලබාදුන් මූලාශ්‍ර බලන්න සහ පසුව නැවත උත්සාහ කරන්න.',
  ta:
    'கோட்டா வரம்புகள் காரணமாக Online AI தற்போது கிடைக்கவில்லை. அறிவகத்தில் தொடர்புடைய வழிகாட்டுதல்கள் கண்டறியப்பட்டன. காட்டப்பட்ட மூலங்களைப் பார்த்து பின்னர் மீண்டும் முயற்சிக்கவும்.',
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
  /** Whether current Firebase AI SDK build supports embedContent(). */
  private embeddingApiSupported: boolean | null = null;
  /** Prevent repeating the same unsupported-embedding warning on every query. */
  private hasLoggedEmbeddingUnsupported = false;
  /** Whether cloud embedding endpoint is reachable. */
  private cloudEmbeddingSupported: boolean | null = null;
  /** Prevent repeating cloud embedding warning on every query. */
  private hasLoggedCloudEmbeddingUnavailable = false;

  private getSanitizedProjectId(): string {
    const raw = (FIREBASE_PROJECT_ID || 'assistea').trim();
    const sanitized = raw.replace(/^["']|["']$/g, '');
    return sanitized || 'assistea';
  }

  private buildCloudEmbeddingUrls(): string[] {
    const projectId = this.getSanitizedProjectId();
    const emulatorUrl = `http://${Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1'}:5001/${projectId}/us-central1/embedQuery`;
    const firebaseFunctionsUrl = `https://us-central1-${projectId}.cloudfunctions.net/embedQuery`;
    const candidates = __DEV__
      ? [emulatorUrl, DEPLOYED_EMBEDDING_FALLBACK_URL, firebaseFunctionsUrl]
      : [firebaseFunctionsUrl, DEPLOYED_EMBEDDING_FALLBACK_URL];

    // Keep only valid URLs so malformed values can never crash request creation.
    return candidates
      .map(candidate => {
        try {
          return new URL(candidate).toString();
        } catch {
          return '';
        }
      })
      .filter(Boolean);
  }

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
  private async embedQueryViaCloudFunction(text: string): Promise<number[]> {
    if (this.cloudEmbeddingSupported === false) {
      return [];
    }

    const urls = this.buildCloudEmbeddingUrls();
    if (urls.length === 0) {
      if (!this.hasLoggedCloudEmbeddingUnavailable) {
        console.warn(
          '[AIService] Invalid cloud embedding endpoint URL. Check FIREBASE_PROJECT_ID and environment setup.',
        );
        this.hasLoggedCloudEmbeddingUnavailable = true;
      }
      this.cloudEmbeddingSupported = false;
      return [];
    }

    let loggedEmbeddingQuotaThisCall = false;
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          const reason =
            errorPayload?.error || errorPayload?.message || `HTTP ${response.status}`;
          const reasonStr =
            typeof reason === 'string' ? reason : JSON.stringify(reason);
          const isQuota =
            reasonStr.includes('prepayment credits') ||
            reasonStr.includes('429') ||
            reasonStr.includes('RESOURCE_EXHAUSTED') ||
            reasonStr.includes('quota');
          if (isQuota && !loggedEmbeddingQuotaThisCall) {
            loggedEmbeddingQuotaThisCall = true;
            console.error('[AIService] Cloud embedding quota/credit limit — full response:', {
              status: response.status,
              url,
              body: errorPayload,
            });
          } else if (!isQuota && !this.hasLoggedCloudEmbeddingUnavailable) {
            console.warn(
              `[AIService] Cloud embedding endpoint unavailable (${response.status}): ${reasonStr}`,
            );
          }
          continue;
        }

        const payload = await response.json().catch(() => ({}));
        const values: number[] = payload?.embedding ?? [];
        if (!Array.isArray(values) || values.length === 0) {
          continue;
        }

        this.cloudEmbeddingSupported = true;
        this.hasLoggedCloudEmbeddingUnavailable = false;
        return values;
      } catch (error: any) {
        if (!this.hasLoggedCloudEmbeddingUnavailable) {
          console.warn(
            '[AIService] Cloud embedding endpoint error:',
            error?.message ?? error,
          );
        }
      }
    }

    this.hasLoggedCloudEmbeddingUnavailable = true;
    this.cloudEmbeddingSupported = false;
    return [];
  }

  private async embedQuery(text: string): Promise<number[]> {
    // Preferred path: server-side embedding endpoint.
    const cloudEmbedding = await this.embedQueryViaCloudFunction(text);
    if (cloudEmbedding.length > 0) {
      return cloudEmbedding;
    }

    if (this.embeddingApiSupported === false) {
      return [];
    }

    try {
      const app = getApp();
      const ai = getAI(app);
      const embeddingModel = getGenerativeModel(ai, { model: 'text-embedding-004' });

      // Some @react-native-firebase/ai versions do not expose embedContent().
      // In that case, gracefully skip retrieval and continue in answer-only mode.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const maybeEmbeddingModel = embeddingModel as any;
      if (typeof maybeEmbeddingModel.embedContent !== 'function') {
        if (!this.hasLoggedEmbeddingUnsupported) {
          console.warn(
            '[AIService] embedQuery unavailable: embedContent() is not supported by this SDK version',
          );
          this.hasLoggedEmbeddingUnsupported = true;
        }
        this.embeddingApiSupported = false;
        return [];
      }
      this.embeddingApiSupported = true;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await maybeEmbeddingModel.embedContent({
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
        "Do not mention 'passages', 'retrieved context', or any internal retrieval process in the final response. " +
        'Speak directly to the farmer in natural advisory language. ' +
        'If the question is unrelated to tea cultivation/agronomy, refuse briefly. ' +
        'If the retrieved passages are relevant but incomplete, provide the best partial answer grounded in the passages. ' +
        'State clearly which specific detail is missing, and ask exactly one focused follow-up question needed to complete the recommendation. ' +
        'Only refuse when passages are clearly irrelevant to the user question. ' +
        'Do NOT draw on your parametric memory or training data to fill gaps. ' +
        'If the passages do not contain enough information to answer the question fully, ' +
        "do not invent missing figures; provide what is supported and add: 'Please consult a qualified agronomist for further guidance.'" +
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
        'Do NOT answer from general knowledge. ' +
        'Refuse briefly and ask the user to rephrase as a tea-cultivation question with concrete details.';
    }

    // ── User turn ─────────────────────────────────────────────────────────────
    const userTurn =
      `Question (in ${langName}): ${query}\n\n` +
      `Please provide a direct, farmer-friendly answer in ${langName}. ` +
      "Do not use words like 'passages', 'context', 'retrieval', or similar internal terms. " +
      'If the question asks about quantities, dosages, application rates, or measurements, ' +
      'state the specific number or range only when it is present in the retrieved passages. ' +
      'If not present, say the dosage is not available in the provided passages and ask one short follow-up question. ' +
      'Do not use bold, italics, or any text formatting — plain sentences only.';

    return { systemInstruction, userTurn };
  }

  /**
   * Normalise turns into a Gemini-compatible alternating chat history.
   *
   * Rules enforced:
   * - history starts with 'user'
   * - roles strictly alternate (no user→user / model→model)
   * - history ends with 'model' because we send a new user turn next
   */
  private normaliseHistoryForGemini(turns: RagChatTurn[]): RagChatTurn[] {
    const cleaned: RagChatTurn[] = [];

    for (const turn of turns) {
      const text = turn.text?.trim();
      if (!text) continue;

      // A chat history cannot start with model output.
      if (cleaned.length === 0 && turn.role === 'model') {
        continue;
      }

      const prev = cleaned[cleaned.length - 1];
      if (prev?.role === turn.role) {
        // Keep the latest message for the same role to maintain alternation.
        cleaned[cleaned.length - 1] = { role: turn.role, text };
        continue;
      }

      cleaned.push({ role: turn.role, text });
    }

    // We will call sendMessage(userTurn), so history must not end with user.
    while (cleaned.length > 0 && cleaned[cleaned.length - 1].role === 'user') {
      cleaned.pop();
    }

    return cleaned;
  }

  /**
   * Remove internal RAG terminology from model output before showing users.
   */
  private sanitizeRAGUserFacingAnswer(answer: string): string {
    let cleaned = answer;
    cleaned = cleaned.replace(/\bthe passages\b/gi, 'the available guidance');
    cleaned = cleaned.replace(/\bpassages\b/gi, 'available guidance');
    cleaned = cleaned.replace(/\bretrieved context\b/gi, 'available guidance');
    cleaned = cleaned.replace(/\bretrieval\b/gi, 'guidance lookup');
    cleaned = cleaned.replace(/\bcontext\b/gi, 'guidance');
    return cleaned;
  }

  private buildOnlineUnavailableReply(
    language: Language,
    chunks: ChunkMatch[],
  ): string {
    const uniqueTitles = Array.from(new Set(chunks.map(c => c.title))).slice(0, 3);
    if (uniqueTitles.length === 0) {
      return ONLINE_TEMP_UNAVAILABLE_REPLY[language];
    }
    return `${ONLINE_TEMP_UNAVAILABLE_REPLY[language]}\n\nRelated sources: ${uniqueTitles.join('; ')}`;
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
    const normalizedQuery = query.trim();
    const queryWordCount = normalizedQuery.split(/\s+/).filter(Boolean).length;
    if (normalizedQuery.length < 12 || queryWordCount < 3) {
      return {
        answer: NEED_MORE_DETAIL_REPLY[language],
        source: 'online',
        confidence: 0.2,
        language,
        retrievedChunks: [],
      };
    }

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
    let chunks: ChunkMatch[] = [];
    if (queryEmbedding.length > 0) {
      chunks = ragChunkService.findTopChunks(queryEmbedding, language, 3, 0.45);
    }
    if (chunks.length === 0) {
      chunks = ragChunkService.findTopChunksByKeyword(query, language, 3, 0.15);
    }
    console.log(
      `[AIService] RAG: retrieved ${chunks.length} chunks for query "${query.substring(0, 60)}"`,
      chunks.map(c => ({ title: c.title, similarity: c.similarity.toFixed(3) })),
    );

    // Hard guardrail: if retrieval finds no sufficiently relevant chunks, do not answer.
    if (chunks.length === 0) {
      return {
        answer: OUT_OF_SCOPE_REPLY[language],
        source: 'online',
        confidence: 0.1,
        language,
        retrievedChunks: [],
      };
    }

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

      // Build Firebase-format history from prior conversation turns.
      const history = this.normaliseHistoryForGemini(conversationHistory).map(
        turn => ({
          role: turn.role,
          parts: [{ text: turn.text }],
        }),
      );

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(userTurn);
      const rawAnswer = result.response.text();
      const answer = this.sanitizeRAGUserFacingAnswer(rawAnswer ?? '');

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

      // Graceful fallback for exhausted credits/quota/rate-limit in online generation.
      const isQuotaOrCreditLimit =
        errorMessage.includes('prepayment credits are depleted') ||
        errorMessage.includes('RESOURCE_EXHAUSTED') ||
        errorMessage.includes('[429') ||
        errorMessage.includes('429 ') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('rate limit');

      if (isQuotaOrCreditLimit) {
        console.error('[AIService] Online RAG quota/credit limit hit — full error:', {
          message: errorMessage,
          code: error?.code,
          userInfo: error?.userInfo,
          stack: error instanceof Error ? error.stack : undefined,
        });
        return {
          answer: this.buildOnlineUnavailableReply(language, chunks),
          source: 'online',
          confidence: 0.2,
          language,
          retrievedChunks: chunks,
        };
      }

      throw new Error(`Online RAG query failed: ${errorMessage}`);
    }
  }
}

export const aiService = new AIService();

