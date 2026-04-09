import { config } from '../config/env';

const EMBED_MODEL = 'text-embedding-004';
const EMBED_DIM = 768;

/**
 * Gemini text-embedding-004 via REST (768-dim vectors for pgvector tribal_memory).
 */
export async function embedTextForTribalSearch(text: string): Promise<number[]> {
  const key = config.googleApiKey?.trim();
  if (!key) {
    throw new Error('GOOGLE_API_KEY / GEMINI_API_KEY is required for tribal memory embeddings');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text: text.slice(0, 20000) }] },
      outputDimensionality: EMBED_DIM,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Embedding API ${res.status}: ${errText.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    embedding?: { values?: number[] };
  };
  const values = json.embedding?.values;
  if (!values?.length) {
    throw new Error('Embedding API returned no values');
  }
  if (values.length !== EMBED_DIM) {
    throw new Error(`Expected ${EMBED_DIM}-dim embedding, got ${values.length}`);
  }
  return values;
}

export const TRIBAL_EMBEDDING_DIMENSION = EMBED_DIM;
