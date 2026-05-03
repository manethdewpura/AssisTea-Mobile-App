/**
 * ragChunk.service.ts
 *
 * Handles the retrieval step of the online RAG pipeline:
 *   - Loads pre-embedded raw text chunks from bundled JSON assets
 *   - Caches chunks per language to avoid repeated JSON parsing
 *   - Computes cosine similarity between a query embedding and all chunk embeddings
 *   - Returns the top-k most relevant raw text chunks
 *
 * Embeddings in the JSON files are 768-dimensional vectors produced by
 * Vertex AI text-embedding-004 (generated offline via scripts/prepareRagChunks.mjs).
 * Query embeddings come from the same model at runtime (called via Firebase AI SDK).
 */

import type { Language } from '../store/slices/ai.slice';

// ─── Types ────────────────────────────────────────────────────────────────────

/** One entry in a rag_chunks_{lang}.json file */
export interface RagChunk {
  id: string;
  text: string;       // raw source text — Gemini reads this to derive an answer
  source: string;     // e.g. "TRI Handbook on Tea Nutrition 2022"
  title: string;      // e.g. "Fertilizer Recommendations for Mature Tea — Part 3"
  language: string;
  embedding: number[]; // 768-dim vector from text-embedding-004
}

/** A retrieved chunk with its similarity score */
export interface ChunkMatch {
  id: string;
  text: string;
  source: string;
  title: string;
  similarity: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class RagChunkService {
  /** In-memory cache: language → chunks. Populated on first access per language. */
  private readonly cache = new Map<Language, RagChunk[]>();

  /**
   * Load chunk JSON from the Metro-bundled asset.
   * Falls back to English if the requested language file is missing.
   */
  private loadChunks(language: Language): RagChunk[] {
    if (this.cache.has(language)) {
      return this.cache.get(language)!;
    }

    try {
      let chunks: RagChunk[];

      // Metro bundler resolves these require() calls at build time.
      // Switch statement is required — dynamic require paths are not supported by Metro.
      switch (language) {
        case 'si':
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          chunks = require('../assets/knowledge/rag_chunks_si.json') as RagChunk[];
          break;
        case 'ta':
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          chunks = require('../assets/knowledge/rag_chunks_ta.json') as RagChunk[];
          break;
        case 'en':
        default:
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          chunks = require('../assets/knowledge/rag_chunks_en.json') as RagChunk[];
          break;
      }

      this.cache.set(language, chunks);
      console.log(
        `[RagChunkService] Loaded ${chunks.length} chunks for language "${language}"`,
      );
      return chunks;
    } catch (error) {
      console.warn(
        `[RagChunkService] Failed to load chunks for "${language}", falling back to "en":`,
        error,
      );
      if (language !== 'en') {
        return this.loadChunks('en');
      }
      return [];
    }
  }

  /**
   * Cosine similarity between two equal-length vectors.
   * Both the query and chunk embeddings are L2-normalised by text-embedding-004,
   * so this is equivalent to a dot product — but we compute it fully for safety.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }

  private tokenizeQuery(input: string): string[] {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 3);
  }

  /**
   * Find the top-k most relevant chunks for a given query embedding.
   *
   * @param queryEmbedding  768-dim vector from text-embedding-004 (query-time)
   * @param language        Language to search in
   * @param topK            Maximum number of chunks to return (default 3)
   * @param minSimilarity   Minimum cosine similarity threshold (default 0.40)
   *
   * @returns Array of ChunkMatch sorted by similarity descending.
   *          Empty array if the chunk file has no data or no matches meet the threshold.
   */
  findTopChunks(
    queryEmbedding: number[],
    language: Language,
    topK = 3,
    minSimilarity = 0.40,
  ): ChunkMatch[] {
    if (queryEmbedding.length === 0) {
      console.warn('[RagChunkService] Empty query embedding — skipping retrieval');
      return [];
    }

    const chunks = this.loadChunks(language);

    if (chunks.length === 0) {
      console.warn(
        `[RagChunkService] No chunks available for "${language}". ` +
        'Run scripts/prepareRagChunks.mjs to generate the knowledge base.',
      );
      return [];
    }

    // If vector dimensions do not match, similarity is invalid.
    const chunkDim = chunks[0]?.embedding?.length ?? 0;
    if (chunkDim === 0 || queryEmbedding.length !== chunkDim) {
      console.warn(
        `[RagChunkService] Embedding dimension mismatch (query=${queryEmbedding.length}, chunk=${chunkDim}).`,
      );
      return [];
    }

    // Memory-safe top-k retrieval: avoid building a huge intermediate array.
    const best: ChunkMatch[] = [];

    for (const chunk of chunks) {
      const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      if (similarity < minSimilarity) continue;

      const candidate: ChunkMatch = {
        id: chunk.id,
        text: chunk.text,
        source: chunk.source,
        title: chunk.title,
        similarity,
      };

      if (best.length < topK) {
        best.push(candidate);
        best.sort((a, b) => b.similarity - a.similarity);
        continue;
      }

      const worst = best[best.length - 1];
      if (candidate.similarity > worst.similarity) {
        best[best.length - 1] = candidate;
        best.sort((a, b) => b.similarity - a.similarity);
      }
    }

    return best;
  }

  /**
   * Fallback retrieval when query embeddings are unavailable.
   * Uses lexical token overlap between query and chunk text/title/source.
   */
  findTopChunksByKeyword(
    query: string,
    language: Language,
    topK = 3,
    minScore = 0.15,
  ): ChunkMatch[] {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];
    const queryTokens = this.tokenizeQuery(cleanQuery);
    if (queryTokens.length === 0) return [];

    const chunks = this.loadChunks(language);
    if (chunks.length === 0) {
      return [];
    }

    const scored: ChunkMatch[] = chunks
      .map(chunk => {
        // Keep fallback retrieval lightweight to avoid memory/CPU spikes on-device.
        // We only scan title, source, and a short text prefix.
        const searchable =
          `${chunk.title} ${chunk.source} ${chunk.text.slice(0, 600)}`.toLowerCase();
        let matches = 0;
        for (const token of queryTokens) {
          if (searchable.includes(token)) {
            matches += 1;
          }
        }
        const score = matches / queryTokens.length;
        return {
          id: chunk.id,
          text: chunk.text,
          source: chunk.source,
          title: chunk.title,
          similarity: score,
        };
      })
      .filter(c => c.similarity >= minScore);

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK);
  }

  /**
   * Clear the in-memory cache (useful for testing or after a hot-reload).
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const ragChunkService = new RagChunkService();
