const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const EMBEDDING_MODEL = 'gemini-embedding-001';
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

const functionOptions = {
  region: 'us-central1',
  cors: true,
  ...(isEmulator ? {} : { secrets: [GEMINI_API_KEY] }),
};

function getApiKey() {
  if (isEmulator) {
    return (
      process.env.GEMINI_API_KEY_EMULATOR ||
      process.env.GEMINI_API_KEY ||
      ''
    );
  }
  return GEMINI_API_KEY.value();
}

async function requestEmbedding(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

exports.embedQuery = onRequest(
  functionOptions,
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const text = String(req.body?.text ?? '').trim();
      if (!text) {
        res.status(400).json({ error: 'Missing text' });
        return;
      }

      const apiKey = getApiKey();
      if (!apiKey) {
        res.status(500).json({
          error:
            'API key is not configured. In emulator set GEMINI_API_KEY_EMULATOR; in production use Firebase Secret Manager GEMINI_API_KEY.',
        });
        return;
      }

      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent` +
        `?key=${encodeURIComponent(apiKey)}`;

      // First attempt: include taskType for query-time retrieval embeddings.
      let { response, payload } = await requestEmbedding(url, {
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_QUERY',
      });

      // Fallback: retry without taskType if request is rejected for that field.
      if (!response.ok) {
        const errMsg = String(payload?.error?.message || '');
        if (
          response.status === 400 &&
          (errMsg.toLowerCase().includes('tasktype') ||
            errMsg.toLowerCase().includes('invalid argument'))
        ) {
          ({ response, payload } = await requestEmbedding(url, {
            model: `models/${EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
          }));
        }
      }

      if (!response.ok) {
        const message = payload?.error?.message || 'Embedding request failed';
        logger.error('embedQuery upstream error', { error: message });
        res.status(502).json({ error: message });
        return;
      }

      const values = payload?.embedding?.values;
      if (!Array.isArray(values) || values.length === 0) {
        res.status(502).json({ error: 'Empty embedding vector returned' });
        return;
      }

      res.status(200).json({ embedding: values, model: EMBEDDING_MODEL });
    } catch (error) {
      logger.error('embedQuery failed', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);
