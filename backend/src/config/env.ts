import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: process.env.PORT || 3000,
  githubToken: process.env.GITHUB_TOKEN,
  webhookSecret: process.env.WEBHOOK_SECRET,
  googleApiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
  /** Gemini model IDs (Google retired gemini-1.5-* on the consumer API). Override if Google renames stable aliases. */
  geminiChatModel: process.env.GEMINI_CHAT_MODEL?.trim() || 'gemini-2.5-flash',
  geminiReviewProModel: process.env.GEMINI_REVIEW_PRO_MODEL?.trim() || 'gemini-2.5-pro',
  geminiReviewFlashModel: process.env.GEMINI_REVIEW_FLASH_MODEL?.trim() || 'gemini-2.5-flash',
  /** Separate Gemini model for repo insight quality (own free-tier quota vs PR review). Override if you hit 2.5-flash limits. */
  geminiRepoInsightModel: process.env.GEMINI_REPO_INSIGHT_MODEL?.trim() || 'gemini-2.0-flash',
  /** Shadow Execution Agent — SQLi / auth-bypass scan (non-blocking). Override gemini-1.5-* if your project still exposes it. */
  geminiShadowModel: process.env.GEMINI_SHADOW_MODEL?.trim() || 'gemini-2.5-flash',
  /** When not `false`, PR webhooks spawn the shadow worker alongside the main review. */
  shadowExecutionEnabled: process.env.SHADOW_EXECUTION_ENABLED !== 'false',
  shadowMaxFiles: parseInt(process.env.SHADOW_MAX_FILES || '12', 10) || 12,
  shadowMaxApproxTokens: parseInt(process.env.SHADOW_MAX_APPROX_TOKENS || '24000', 10) || 24000,
  shadowSkipTestPaths: process.env.SHADOW_SKIP_TEST_PATHS === 'true',
  /** OpenAI for PR review (e.g. gpt-4o). Requires OPENAI_API_KEY. */
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL?.trim() || 'gpt-4o',
  /**
   * PR review LLM: openai | gemini | ollama | auto
   * auto = OpenAI if OPENAI_API_KEY set, else Gemini if Google key set, else local Ollama (no cloud key).
   */
  llmProvider: process.env.LLM_PROVIDER || 'auto',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL?.trim() || 'http://127.0.0.1:11434',
  ollamaModel: process.env.OLLAMA_MODEL?.trim() || 'llama3.2',
  
  // UPDATED: Optimized for Supabase integration
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY, // Critical for backend-side bypasses
  },

  // Keep this if you are using a direct DB connection for RAG or local logging
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'sentinel_metrics',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  },
};

/**
 * Startup validation: only block on what the HTTP API needs (Supabase).
 * GitHub + an LLM provider are required for full PR review — warn if missing.
 */
const requiredForServer = [
  { key: config.supabase.url, name: 'SUPABASE_URL' },
  { key: config.supabase.anonKey, name: 'SUPABASE_ANON_KEY' },
];

requiredForServer.forEach(({ key, name }) => {
  if (!key) {
    console.error(`❌ CRITICAL ERROR: ${name} is missing in backend/.env`);
    process.exit(1);
  }
});

if (!config.githubToken?.trim()) {
  console.warn(
    '⚠️  GITHUB_TOKEN is not set — webhooks and GitHub API calls will fail until you add a token (Settings → Developer settings → PAT).'
  );
}
const hasOpenAI = Boolean(config.openaiApiKey?.trim());
const hasGoogle = Boolean(config.googleApiKey?.trim());
const reviewLlm = (config.llmProvider || 'auto').toLowerCase();

if (!hasGoogle) {
  console.warn(
    '⚠️  GOOGLE_API_KEY / GEMINI_API_KEY is not set — Sentinel Copilot (POST /api/chat) and LLM_PROVIDER=gemini need it.'
  );
}
if (!hasOpenAI && !hasGoogle) {
  console.warn(
    '⚠️  No OpenAI or Google key — with LLM_PROVIDER=auto, PR review uses local Ollama (e.g. ollama pull ' +
      (config.ollamaModel || 'llama3.2') +
      ').'
  );
} else if (reviewLlm === 'gemini' && !hasGoogle) {
  console.warn('⚠️  LLM_PROVIDER=gemini but GOOGLE_API_KEY / GEMINI_API_KEY is missing.');
} else if (reviewLlm === 'openai' && !hasOpenAI) {
  console.warn('⚠️  LLM_PROVIDER=openai but OPENAI_API_KEY is missing.');
}