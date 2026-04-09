import { Octokit } from '@octokit/rest';
import { config } from '../config/env';
import { repoInsightLlmComplete, resolveReviewLlmProvider } from './llmReviewClient';

const octokit = new Octokit({ auth: config.githubToken });

/** Avoid burning Gemini calls on every refresh; GitHub tree/README stay live. */
const qualityCache = new Map<string, { exp: number; snapshot: RepoQualitySnapshot }>();
const QUALITY_CACHE_MS = 15 * 60 * 1000;
const HEURISTIC_CACHE_MS = 3 * 60 * 1000;

function commitRootTreeSha(tree: { sha?: string } | string | undefined | null): string {
  if (!tree) return '';
  if (typeof tree === 'string') return tree;
  return tree.sha?.trim() ?? '';
}

/**
 * When `getTree(recursive)` returns no blobs (parameter ignored or odd API state), walk trees depth-first via the Git API.
 */
async function listBlobsViaTreeWalk(
  owner: string,
  repo: string,
  rootTreeSha: string,
  maxTreeFetches: number
): Promise<{ blobs: { path: string; size?: number }[]; walkTruncated: boolean }> {
  const blobs: { path: string; size?: number }[] = [];
  const queue: { sha: string; prefix: string }[] = [{ sha: rootTreeSha, prefix: '' }];
  const visited = new Set<string>();
  let fetches = 0;
  let walkTruncated = false;

  while (queue.length > 0) {
    if (fetches >= maxTreeFetches) {
      walkTruncated = queue.length > 0;
      break;
    }
    const item = queue.shift()!;
    if (!item.sha || visited.has(item.sha)) continue;
    visited.add(item.sha);
    fetches++;

    const { data } = await octokit.git.getTree({ owner, repo, tree_sha: item.sha });
    for (const t of data.tree ?? []) {
      if (!t.path || !t.type) continue;
      const kind = String(t.type).toLowerCase();
      const path = item.prefix ? `${item.prefix}/${t.path}` : t.path;
      if (kind === 'blob') {
        blobs.push({ path, size: typeof t.size === 'number' ? t.size : undefined });
      } else if (kind === 'tree' && t.sha) {
        queue.push({ sha: t.sha, prefix: path });
      }
    }
  }

  blobs.sort((a, b) => a.path.localeCompare(b.path));
  return { blobs, walkTruncated };
}

/** Daily / free-tier quota — retrying only wastes attempts. */
function isGeminiQuotaExhausted(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? '');
  if (
    /quota exceeded|free_tier|free tier|GenerateRequestsPerDay|billing details|generate_content_free_tier/i.test(
      msg
    )
  ) {
    return true;
  }
  const st = (e as { status?: number }).status;
  return st === 429 && /quota|free_tier|billing/i.test(msg);
}

function isRetryableInsightLlmError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  if (isGeminiQuotaExhausted(e)) return false;
  const status = (e as { status?: number }).status;
  if (status === 503) return true;
  const msg = String((e as Error).message ?? '');
  return /high demand|unavailable|timed?\s*out|ECONNRESET|fetch failed/i.test(msg);
}

function heuristicRepoQuality(
  owner: string,
  repo: string,
  paths: string[],
  readme: string,
  truncated: boolean,
  totalFiles: number
): RepoQualitySnapshot {
  const lower = paths.map((p) => p.toLowerCase());
  const hasReadme = readme.trim().length > 0;
  const basenames = lower.map((p) => (p.includes('/') ? p.slice(p.lastIndexOf('/') + 1) : p));
  const hasLicense = basenames.some((b) => /^license(\.|$)/.test(b));
  const hasCi = lower.some(
    (p) => p.includes('.github/workflows') || p.includes('.gitlab-ci') || p.includes('jenkins')
  );
  const hasTests = lower.some((p) =>
    /(\/__tests__\/|\/test\/|\/tests\/|\.test\.|\.spec\.|_test\.go|^tests\.|vitest|jest|pytest|mocha)/i.test(
      p
    )
  );
  const hasDocker = lower.some(
    (p) => p.endsWith('dockerfile') || p.includes('docker-compose') || p.endsWith('.dockerfile')
  );
  const deepNesting = paths.some((p) => p.split('/').length > 10);

  let score = 4;
  if (hasReadme) score += 1;
  if (hasLicense) score += 1;
  if (hasCi) score += 1;
  if (hasTests) score += 2;
  if (hasDocker) score += 1;
  if (totalFiles > 8) score += 1;
  if (truncated) score = Math.min(score, 7);
  score = Math.min(10, Math.max(1, score));

  const strengths: string[] = [];
  const risks: string[] = [];
  const recs: string[] = [];
  if (hasReadme) strengths.push('README present');
  if (hasTests) strengths.push('Test-related layout detected');
  if (hasCi) strengths.push('CI/workflow paths present');
  if (!hasReadme) risks.push('No README in API response — document purpose and setup');
  if (!hasTests && totalFiles > 3) risks.push('No obvious test paths — verify coverage');
  if (deepNesting) risks.push('Very deep paths — consider flatter modules');
  if (truncated) risks.push('GitHub tree truncated — list may be incomplete');
  if (!hasCi) recs.push('Add CI (e.g. GitHub Actions) for PR checks');
  if (!hasLicense && totalFiles > 2) recs.push('Add a LICENSE if the repo is public');

  return {
    score,
    strengths: strengths.slice(0, 4),
    risks: risks.slice(0, 4),
    recommendations: recs.slice(0, 4),
    narrative: `Heuristic score for **${owner}/${repo}** from the file tree only (LLM unavailable or quota limited). For AI narrative, set \`GEMINI_REPO_INSIGHT_MODEL\`, enable Gemini billing, or use \`OPENAI_API_KEY\` with \`LLM_PROVIDER=openai\`.`,
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type RepoQualitySnapshot = {
  score: number;
  strengths: string[];
  risks: string[];
  recommendations: string[];
  narrative: string;
};

export type RepositoryInsightData = {
  defaultBranch: string;
  truncated: boolean;
  totalBlobFiles: number;
  /** Sample of repository files (paths) from default branch */
  files: { path: string; size?: number }[];
  /** Short README preview for the UI */
  readmePreview: string | null;
  quality: RepoQualitySnapshot | null;
  githubError?: string;
};

/**
 * Loads default-branch tree + README from GitHub and runs a lightweight repo-quality assessment (paths + README only).
 */
export async function buildRepositoryInsight(
  owner: string,
  repo: string
): Promise<RepositoryInsightData> {
  if (!config.githubToken?.trim()) {
    return {
      defaultBranch: 'main',
      truncated: false,
      totalBlobFiles: 0,
      files: [],
      readmePreview: null,
      quality: null,
      githubError:
        'GITHUB_TOKEN is not set — add a PAT in backend/.env to load tree and quality insights.',
    };
  }

  let defaultBranch = 'main';
  let truncated = false;
  let rootTreeSha = '';
  const treeNodes: { path: string; type: string; size?: number }[] = [];

  try {
    const { data: repoInfo } = await octokit.repos.get({ owner, repo });
    defaultBranch = repoInfo.default_branch || 'main';

    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    });
    const { data: commitData } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: refData.object.sha,
    });
    rootTreeSha = commitRootTreeSha(commitData.tree);
    if (!rootTreeSha) {
      throw new Error('Could not resolve commit tree for default branch');
    }

    const { data: treeData } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: rootTreeSha,
      // Octokit types expect string; GitHub accepts any non-empty value for recursive trees.
      recursive: '1',
    });
    truncated = Boolean(treeData.truncated);

    for (const t of treeData.tree || []) {
      if (!t.path) continue;
      const kind = String(t.type || '').toLowerCase();
      if (kind !== 'blob' && kind !== 'tree') continue;
      treeNodes.push({
        path: t.path,
        type: kind,
        size: t.size ?? undefined,
      });
    }
    treeNodes.sort((a, b) => a.path.localeCompare(b.path));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'GitHub API error';
    return {
      defaultBranch,
      truncated: false,
      totalBlobFiles: 0,
      files: [],
      readmePreview: null,
      quality: null,
      githubError: message,
    };
  }

  let blobRows = treeNodes.filter((n) => n.type === 'blob');

  if (blobRows.length === 0 && rootTreeSha) {
    try {
      const { blobs: walked, walkTruncated } = await listBlobsViaTreeWalk(owner, repo, rootTreeSha, 500);
      if (walked.length > 0) {
        blobRows = walked.map((b) => ({ path: b.path, type: 'blob', size: b.size }));
        truncated = truncated || walkTruncated;
        console.log(
          `[RepositoryInsight] Recursive tree had 0 blobs; tree walk found ${walked.length} file(s) for ${owner}/${repo}`
        );
      }
    } catch (w) {
      console.warn('[RepositoryInsight] Tree walk fallback failed:', w);
    }
  }

  const totalBlobFiles = blobRows.length;
  const files = blobRows.slice(0, 400).map((b) => ({ path: b.path, size: b.size }));

  let readmeFull = '';
  try {
    const rm = await octokit.repos.getReadme({ owner, repo, ref: defaultBranch });
    if (rm.data.content) {
      readmeFull = Buffer.from(rm.data.content, 'base64').toString('utf8');
    }
  } catch {
    readmeFull = '';
  }

  const readmePreview = readmeFull ? readmeFull.slice(0, 1800) : null;
  const pathSample = blobRows.slice(0, 200).map((b) => b.path);

  const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
  const cached = qualityCache.get(cacheKey);
  let quality: RepoQualitySnapshot | null =
    cached && cached.exp > Date.now() ? cached.snapshot : null;

  let canCallLlm = false;
  try {
    resolveReviewLlmProvider();
    canCallLlm = true;
  } catch {
    canCallLlm = false;
  }

  if (!quality && canCallLlm) {
    const prompt = `Assess engineering quality from repository **path structure** and README only (you do not have file contents except README excerpt).

Return **only** valid JSON (no markdown code fence):
{
  "score": <integer 1-10>,
  "strengths": [<up to 4 short strings>],
  "risks": [<up to 4 short strings>],
  "recommendations": [<up to 4 short strings>],
  "narrative": "<one paragraph, plain language, 2-4 sentences>"
}

Repository: ${owner}/${repo}
Default branch: ${defaultBranch}
API tree truncated: ${truncated ? 'yes' : 'no'}
Total files (blobs): ${totalBlobFiles}

Sample paths (max 200 shown):
${pathSample.join('\n')}

README excerpt:
${readmeFull ? readmeFull.slice(0, 4000) : '(not available)'}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const raw = await repoInsightLlmComplete(prompt);
        const clean = raw.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean) as Record<string, unknown>;
        quality = {
          score: Math.min(10, Math.max(1, Number(parsed.score) || 5)),
          strengths: Array.isArray(parsed.strengths)
            ? (parsed.strengths as unknown[]).slice(0, 6).map((x) => String(x))
            : [],
          risks: Array.isArray(parsed.risks)
            ? (parsed.risks as unknown[]).slice(0, 6).map((x) => String(x))
            : [],
          recommendations: Array.isArray(parsed.recommendations)
            ? (parsed.recommendations as unknown[]).slice(0, 6).map((x) => String(x))
            : [],
          narrative: typeof parsed.narrative === 'string' ? parsed.narrative : '',
        };
        qualityCache.set(cacheKey, { exp: Date.now() + QUALITY_CACHE_MS, snapshot: quality });
        break;
      } catch (e) {
        if (isGeminiQuotaExhausted(e)) {
          console.warn('[RepositoryInsight] Gemini quota/limit hit — using heuristic quality. Set GEMINI_REPO_INSIGHT_MODEL or billing.');
        }
        const retry = isRetryableInsightLlmError(e) && attempt < 2;
        console.warn(
          retry
            ? `[RepositoryInsight] Quality LLM attempt ${attempt + 1} failed, retrying…`
            : '[RepositoryInsight] Quality LLM failed:',
          e
        );
        if (retry) {
          await sleep(1600 * (attempt + 1));
        } else {
          break;
        }
      }
    }
  }

  if (!quality) {
    quality = heuristicRepoQuality(owner, repo, pathSample, readmeFull, truncated, totalBlobFiles);
    qualityCache.set(cacheKey, { exp: Date.now() + HEURISTIC_CACHE_MS, snapshot: quality });
  }

  return {
    defaultBranch,
    truncated,
    totalBlobFiles,
    files,
    readmePreview,
    quality,
  };
}
