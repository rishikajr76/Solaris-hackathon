/**
 * Curated knowledge anchors for Copilot UI (citations + "signals scanned" demo framing).
 * Not live web retrieval — highlights where Sentinel-AG aligns with real stack docs.
 */
export type CopilotSource = {
  id: string;
  title: string;
  url: string;
  category: 'platform' | 'github' | 'supabase' | 'gemini' | 'security';
};

export const COPILOT_KNOWLEDGE_SOURCES: CopilotSource[] = [
  {
    id: 'webhooks',
    title: 'GitHub Webhooks — repository events',
    url: 'https://docs.github.com/en/webhooks',
    category: 'github',
  },
  {
    id: 'pulls',
    title: 'GitHub REST — Pull requests API',
    url: 'https://docs.github.com/en/rest/pulls',
    category: 'github',
  },
  {
    id: 'supabase-realtime',
    title: 'Supabase — Realtime subscriptions',
    url: 'https://supabase.com/docs/guides/realtime',
    category: 'supabase',
  },
  {
    id: 'supabase-db',
    title: 'Supabase — Postgres & Row Level Security',
    url: 'https://supabase.com/docs/guides/database',
    category: 'supabase',
  },
  {
    id: 'gemini-api',
    title: 'Google AI — Gemini API models',
    url: 'https://ai.google.dev/gemini-api/docs/models',
    category: 'gemini',
  },
  {
    id: 'express',
    title: 'Express — routing & middleware',
    url: 'https://expressjs.com/en/guide/routing.html',
    category: 'platform',
  },
  {
    id: 'octokit',
    title: 'Octokit — GitHub API client',
    url: 'https://github.com/octokit/octokit.js',
    category: 'github',
  },
  {
    id: 'sentinel-rag',
    title: 'Sentinel-AG — local RAG / project map (backend context)',
    url: 'https://github.com/topics/code-review',
    category: 'platform',
  },
  {
    id: 'security-ci',
    title: 'OWASP — Code review cheat sheet',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/Code_Review_Cheat_Sheet.html',
    category: 'security',
  },
  {
    id: 'complexity',
    title: 'Cognitive complexity in code changes',
    url: 'https://en.wikipedia.org/wiki/Cognitive_complexity',
    category: 'platform',
  },
  {
    id: 'vite',
    title: 'Vite — env variables (frontend)',
    url: 'https://vitejs.dev/guide/env-and-mode.html',
    category: 'platform',
  },
  {
    id: 'cors',
    title: 'MDN — CORS for browser APIs',
    url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS',
    category: 'platform',
  },
];

export type CopilotStreamMetaPayload = {
  type: 'meta';
  signalCount: number;
  sourceCount: number;
  sources: CopilotSource[];
  thinkingTrace: string[];
  routePath: string | null;
};

export function buildCopilotStreamMeta(pagePath?: string): Omit<CopilotStreamMetaPayload, 'type'> {
  const path = pagePath?.trim() || '';
  const routePath = path || null;
  const pathSegments = path.split('/').filter(Boolean);
  const sources = COPILOT_KNOWLEDGE_SOURCES.slice();
  const signalCount = 50 + pathSegments.length * 2 + Math.min(path.length, 20);
  const thinkingTrace = [
    `Resolved UI route "${path || '/'}"`,
    `Loaded ${sources.length} curated knowledge anchors (citations below)`,
    `Weighted ${signalCount} contextual signals from route + Sentinel stack playbooks`,
    'Applied Copilot system policy (no fabricated secrets)',
    'Streaming Gemini output with incremental delivery',
  ];

  return {
    signalCount,
    sourceCount: sources.length,
    sources,
    thinkingTrace,
    routePath,
  };
}
