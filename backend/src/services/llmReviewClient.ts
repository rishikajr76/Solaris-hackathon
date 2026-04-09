import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GenerativeModel } from '@google/generative-ai';
import { config } from '../config/env';

export type ResolvedReviewLlm = 'openai' | 'gemini' | 'ollama';

let openaiClient: OpenAI | null = null;
let geminiClient: GoogleGenerativeAI | null = null;

function getOpenAI(): OpenAI {
  const key = config.openaiApiKey?.trim();
  if (!key) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: key });
  }
  return openaiClient;
}

function getGemini(): GoogleGenerativeAI {
  const key = config.googleApiKey?.trim();
  if (!key) {
    throw new Error('GOOGLE_API_KEY / GEMINI_API_KEY is not set');
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(key);
  }
  return geminiClient;
}

function geminiModel(useProModel: boolean): GenerativeModel {
  const name = useProModel ? config.geminiReviewProModel : config.geminiReviewFlashModel;
  return getGemini().getGenerativeModel({ model: name });
}

async function completeGeminiByModelId(prompt: string, modelId: string): Promise<string> {
  const model = getGemini().getGenerativeModel({ model: modelId });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  if (!text?.trim()) {
    throw new Error('Gemini returned empty content');
  }
  return text;
}

/**
 * Lightweight repo-insight quality call: uses OpenAI/Ollama per LLM_PROVIDER, or Gemini via
 * GEMINI_REPO_INSIGHT_MODEL (not the same default as PR review) to reduce shared free-tier exhaustion.
 */
export async function repoInsightLlmComplete(prompt: string): Promise<string> {
  const provider = resolveReviewLlmProvider();
  switch (provider) {
    case 'openai':
      return completeOpenAI(prompt, false);
    case 'gemini':
      return completeGeminiByModelId(prompt, config.geminiRepoInsightModel);
    case 'ollama':
      return completeOllama(prompt);
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

/**
 * PR review LLM selection.
 * - `openai`: GPT-4o-class via OpenAI API (requires OPENAI_API_KEY).
 * - `gemini`: Google Generative AI (requires GOOGLE_API_KEY or GEMINI_API_KEY).
 * - `ollama`: Local HTTP API — no cloud API key; run Ollama (`ollama serve`) and pull a model.
 * - `auto`: OpenAI if key present, else Gemini if key present, else Ollama.
 */
export function resolveReviewLlmProvider(): ResolvedReviewLlm {
  const p = (config.llmProvider || 'auto').toLowerCase();

  if (p === 'openai') {
    if (!config.openaiApiKey?.trim()) {
      throw new Error('LLM_PROVIDER=openai requires OPENAI_API_KEY in backend/.env');
    }
    return 'openai';
  }
  if (p === 'gemini') {
    if (!config.googleApiKey?.trim()) {
      throw new Error('LLM_PROVIDER=gemini requires GOOGLE_API_KEY or GEMINI_API_KEY');
    }
    return 'gemini';
  }
  if (p === 'ollama') {
    return 'ollama';
  }

  if (config.openaiApiKey?.trim()) return 'openai';
  if (config.googleApiKey?.trim()) return 'gemini';
  return 'ollama';
}

export function logReviewLlmStartup(): void {
  try {
    const provider = resolveReviewLlmProvider();
    if (provider === 'openai') {
      console.log(`🤖 PR review LLM: OpenAI (${config.openaiModel})`);
    } else if (provider === 'gemini') {
      console.log(
        `🤖 PR review LLM: Google Gemini (${config.geminiReviewProModel} / ${config.geminiReviewFlashModel}) · repo insight: ${config.geminiRepoInsightModel}`
      );
    } else {
      console.log(
        `🤖 PR review LLM: Ollama (${config.ollamaModel} @ ${config.ollamaBaseUrl}) — no cloud API key`
      );
    }
  } catch (e) {
    console.warn('⚠️  PR review LLM:', (e as Error).message);
  }
}

async function completeOpenAI(prompt: string, jsonMode: boolean): Promise<string> {
  const r = await getOpenAI().chat.completions.create({
    model: config.openaiModel,
    messages: [{ role: 'user', content: prompt }],
    ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
  });
  const t = r.choices[0]?.message?.content;
  if (typeof t !== 'string' || !t.trim()) {
    throw new Error('OpenAI returned empty content');
  }
  return t;
}

async function completeGemini(prompt: string, useProModel: boolean): Promise<string> {
  const result = await geminiModel(useProModel).generateContent(prompt);
  const text = result.response.text();
  if (!text?.trim()) {
    throw new Error('Gemini returned empty content');
  }
  return text;
}

async function completeOllama(prompt: string): Promise<string> {
  const base = config.ollamaBaseUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModel,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama request failed (${res.status}): ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as { message?: { content?: string } };
  const t = data.message?.content;
  if (typeof t !== 'string' || !t.trim()) {
    throw new Error('Ollama returned empty content');
  }
  return t;
}

/** Multi-agent review calls (heavier model when the provider exposes tiers). */
export async function reviewLlmComplete(prompt: string, useProModel: boolean): Promise<string> {
  const provider = resolveReviewLlmProvider();
  switch (provider) {
    case 'openai':
      return completeOpenAI(prompt, false);
    case 'gemini':
      return completeGemini(prompt, useProModel);
    case 'ollama':
      return completeOllama(prompt);
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

/** Orchestrator summary step — JSON object when the API supports it. */
export async function reviewLlmSummarize(prompt: string): Promise<string> {
  const provider = resolveReviewLlmProvider();
  switch (provider) {
    case 'openai':
      return completeOpenAI(prompt, true);
    case 'gemini':
      return completeGemini(prompt, false);
    case 'ollama':
      return completeOllama(prompt);
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}
