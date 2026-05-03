#!/usr/bin/env node
/**
 * prepareRagChunks.mjs
 *
 * One-time data preparation script for AssisTea RAG knowledge base.
 *
 * What it does:
 *   1. Reads plain-text source documents from scripts/source_docs/{lang}/
 *   2. Splits them into overlapping text chunks (~300 words each)
 *   3. Calls Gemini API text-embedding-004 (FREE) to get 768-dim embeddings
 *   4. Writes src/assets/knowledge/rag_chunks_{lang}.json
 *
 * Prerequisites:  NO extra packages needed — uses Node.js built-in fetch.
 *
 * Get a FREE Gemini API key (no billing required):
 *   https://aistudio.google.com/app/apikey
 *
 * Usage:
 *   export GEMINI_API_KEY=your-api-key-here
 *   node scripts/prepareRagChunks.mjs              # all languages
 *   node scripts/prepareRagChunks.mjs --lang en    # English only
 *   node scripts/prepareRagChunks.mjs --lang si    # Sinhala only
 *   node scripts/prepareRagChunks.mjs --lang ta    # Tamil only
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const SOURCE_DOCS_DIR = join(__dirname, 'source_docs');
const OUTPUT_DIR = join(ROOT_DIR, 'src', 'assets', 'knowledge');

// ─── Configuration ───────────────────────────────────────────────────────────

// Free Gemini API key from https://aistudio.google.com/app/apikey
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_MODEL = 'gemini-embedding-001';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// English chunking: word-count based
const CHUNK_SIZE_WORDS = 300;
const CHUNK_OVERLAP_WORDS = 50;
const MIN_CHUNK_WORDS = 80;

// Sinhala / Tamil chunking: sentence-count based (scripts use different word boundaries)
const SENTENCES_PER_CHUNK = 10;
const SENTENCE_OVERLAP = 2;

// Gemini free tier: 100 req/min — batches of 5 with a small delay is well within limits
const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES_MS = 700;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Detect whether a string contains Sinhala or Tamil characters.
 * Used to pick the right chunking strategy.
 */
function isNonLatinScript(text) {
  // Sinhala: U+0D80–U+0DFF, Tamil: U+0B80–U+0BFF
  return /[\u0D80-\u0DFF\u0B80-\u0BFF]/.test(text);
}

/**
 * Split text into sentences. Works for both Latin and non-Latin scripts.
 * Non-Latin scripts use Unicode sentence terminators.
 */
function splitIntoSentences(text) {
  // Split on: period/exclamation/question (with space or newline after),
  // Sinhala/Tamil sentence terminators (।, ।, ।), and double newlines.
  return text
    .split(/(?<=[.!?।|॥\n])\s+|\n{2,}/)
    .map(s => s.trim())
    .filter(s => s.length > 10);
}

/**
 * Chunk a document by word count with overlap (for Latin-script documents).
 */
function chunkByWords(text, sourceFile, language, chunkSize, overlap, minWords) {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const chunks = [];
  let chunkIndex = 0;
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunkWords = words.slice(start, end);

    if (chunkWords.length >= minWords) {
      chunks.push({
        id: `${basename(sourceFile, extname(sourceFile))}-${String(chunkIndex).padStart(4, '0')}`,
        text: chunkWords.join(' '),
        source: basename(sourceFile, extname(sourceFile)).replace(/-/g, ' ').replace(/_/g, ' '),
        title: `${basename(sourceFile, extname(sourceFile))} — Part ${chunkIndex + 1}`,
        language,
        embedding: [],   // filled in later
      });
      chunkIndex++;
    }

    // Move forward by (chunkSize - overlap) words
    start += Math.max(1, chunkSize - overlap);
    if (start + minWords >= words.length) break;
  }

  return chunks;
}

/**
 * Chunk a document by sentence count with overlap (for Sinhala/Tamil documents).
 */
function chunkBySentences(text, sourceFile, language, sentencesPerChunk, overlap) {
  const sentences = splitIntoSentences(text);
  const chunks = [];
  let chunkIndex = 0;
  let start = 0;

  while (start < sentences.length) {
    const end = Math.min(start + sentencesPerChunk, sentences.length);
    const chunkSentences = sentences.slice(start, end);
    const chunkText = chunkSentences.join(' ');

    if (chunkText.length > 50) {
      chunks.push({
        id: `${basename(sourceFile, extname(sourceFile))}-${String(chunkIndex).padStart(4, '0')}`,
        text: chunkText,
        source: basename(sourceFile, extname(sourceFile)).replace(/-/g, ' ').replace(/_/g, ' '),
        title: `${basename(sourceFile, extname(sourceFile))} — Part ${chunkIndex + 1}`,
        language,
        embedding: [],
      });
      chunkIndex++;
    }

    start += Math.max(1, sentencesPerChunk - overlap);
    if (start + 2 >= sentences.length) break;
  }

  return chunks;
}

/**
 * Load and chunk a single .txt file.
 */
function processDocument(filePath, language) {
  const text = readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n').trim();

  if (isNonLatinScript(text)) {
    return chunkBySentences(text, filePath, language, SENTENCES_PER_CHUNK, SENTENCE_OVERLAP);
  } else {
    return chunkByWords(text, filePath, language, CHUNK_SIZE_WORDS, CHUNK_OVERLAP_WORDS, MIN_CHUNK_WORDS);
  }
}

// ─── Gemini API Embedding (Free Tier) ────────────────────────────────────────

/**
 * Embed a batch of texts using Gemini API embedContent (one call per text).
 * Uses the free generativelanguage.googleapis.com/v1beta endpoint — no billing.
 * Returns an array of number[768] vectors, one per input text.
 *
 * Note: batchEmbedContents has inconsistent support for text-embedding-004 in v1beta.
 * Individual embedContent calls are fully stable and documented.
 *
 * Free tier limits: 1,500 requests/day, 100 requests/minute.
 */
async function embedBatch(texts) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      'GEMINI_API_KEY environment variable is not set.\n' +
      'Get a free key at: https://aistudio.google.com/app/apikey\n' +
      'Then run: export GEMINI_API_KEY=your-key-here'
    );
  }

  const url = `${GEMINI_BASE_URL}/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;
  const embeddings = [];

  for (let i = 0; i < texts.length; i++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: texts[i] }] },
        taskType: 'RETRIEVAL_DOCUMENT',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${body}`);
    }

    const json = await response.json();
    // Response shape: { embedding: { values: number[] } }
    embeddings.push(json.embedding.values);

    // Respect free-tier rate limit (100 req/min) — wait between calls
    if (i < texts.length - 1) {
      await sleep(700);
    }
  }

  return embeddings;
}

/**
 * Embed all chunks in batches, with progress logging.
 */
async function embedAllChunks(chunks) {
  const total = chunks.length;
  let done = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.text);

    const embeddings = await embedBatch(texts);
    for (let j = 0; j < batch.length; j++) {
      batch[j].embedding = embeddings[j];
    }

    done += batch.length;
    console.log(`  Embedded ${done}/${total} chunks...`);

    if (i + BATCH_SIZE < chunks.length) {
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  return chunks;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function processLanguage(lang) {
  const sourceDir = join(SOURCE_DOCS_DIR, lang);

  if (!existsSync(sourceDir)) {
    console.warn(`  [SKIP] Source directory not found: ${sourceDir}`);
    return;
  }

  const files = readdirSync(sourceDir)
    .filter(f => extname(f).toLowerCase() === '.txt')
    .map(f => join(sourceDir, f));

  if (files.length === 0) {
    console.warn(`  [SKIP] No .txt files found in ${sourceDir}`);
    return;
  }

  console.log(`\n── Language: ${lang.toUpperCase()} ──`);
  console.log(`  Found ${files.length} source document(s)`);

  // Step 1: Chunk all documents
  const allChunks = [];
  for (const file of files) {
    const chunks = processDocument(file, lang);
    console.log(`  ${basename(file)}: ${chunks.length} chunks`);
    allChunks.push(...chunks);
  }
  console.log(`  Total chunks: ${allChunks.length}`);

  // Step 2: Embed all chunks via Gemini API text-embedding-004 (free)
  console.log(`  Embedding chunks with ${EMBEDDING_MODEL} via Gemini API...`);
  const embeddedChunks = await embedAllChunks(allChunks);

  // Step 3: Write output
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputPath = join(OUTPUT_DIR, `rag_chunks_${lang}.json`);
  writeFileSync(outputPath, JSON.stringify(embeddedChunks, null, 2), 'utf-8');
  console.log(`  ✓ Written to ${outputPath}`);
  console.log(`  File size: ${(readFileSync(outputPath).length / 1024).toFixed(1)} KB`);
}

async function main() {
  const args = process.argv.slice(2);
  const langArg = args.find((_, i) => args[i - 1] === '--lang');
  const languages = langArg && langArg !== 'all'
    ? [langArg]
    : ['en', 'si', 'ta'];

  console.log('AssisTea RAG — Knowledge Base Chunk Preparation');
  console.log('================================================');
  console.log(`Gemini API key: ${GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 8) + '...' : '(not set — will fail)'}`);
  console.log(`Embedding model: ${EMBEDDING_MODEL} (768 dimensions, free tier)`);
  console.log(`Languages: ${languages.join(', ')}`);
  console.log(`Output dir: ${OUTPUT_DIR}`);

  for (const lang of languages) {
    await processLanguage(lang);
  }

  console.log('\n✓ Done. Run the app and test online RAG queries.');
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
