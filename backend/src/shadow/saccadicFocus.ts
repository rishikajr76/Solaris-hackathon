import { normalizeDiffPath } from '../utils/diffLineCatalog';

export type ScoredDiffFile = {
  path: string;
  patchText: string;
  score: number;
  entropy: number;
  pathWeight: number;
};

const BOILERPLATE_SKIP = [
  /package-lock\.json$/i,
  /yarn\.lock$/i,
  /pnpm-lock\.yaml$/i,
  /bun\.lockb$/i,
  /\.min\.(js|css)$/i,
  /(^|\/)dist\//i,
  /(^|\/)node_modules\//i,
  /(^|\/)build\//i,
  /\.(png|jpg|jpeg|gif|webp|ico|svg|woff2?|ttf|eot)$/i,
];

function shouldSkipPath(pathStr: string, skipTests: boolean): boolean {
  const p = pathStr.toLowerCase();
  if (BOILERPLATE_SKIP.some((re) => re.test(pathStr))) return true;
  if (skipTests && (/(^|\/)__tests__\//i.test(p) || /\.(test|spec)\.(tsx?|jsx?|mjs|cjs)$/i.test(p))) {
    return true;
  }
  return false;
}

/** Shannon entropy over string (0..log2(alphabetSize)), normalized to 0..1 for byte values. */
function shannonEntropy(text: string): number {
  if (!text.length) return 0;
  const freq = new Map<number, number>();
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    freq.set(c, (freq.get(c) ?? 0) + 1);
  }
  const n = text.length;
  let h = 0;
  freq.forEach((count) => {
    const p = count / n;
    h -= p * Math.log2(p);
  });
  const maxH = Math.log2(Math.min(256, freq.size || 1));
  return maxH > 0 ? h / maxH : 0;
}

/** Extract added-line content from a unified diff chunk for entropy. */
function addedLinesOnly(patchChunk: string): string {
  const lines = patchChunk.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      out.push(line.slice(1));
    }
  }
  return out.join('\n');
}

function pathHeuristicWeight(pathStr: string): number {
  const p = pathStr.toLowerCase();
  let w = 1;
  const boosts: [RegExp, number][] = [
    [/controller/i, 2.5],
    [/service/i, 2.2],
    [/route/i, 2],
    [/middleware/i, 2],
    [/auth/i, 2.4],
    [/api\//i, 1.6],
    [/handler/i, 1.8],
    [/sql/i, 1.5],
    [/query/i, 1.3],
    [/prisma/i, 1.6],
    [/sequelize/i, 1.5],
    [/typeorm/i, 1.5],
    [/repository/i, 1.4],
  ];
  for (const [re, add] of boosts) {
    if (re.test(p)) w += add;
  }
  return w;
}

export type SaccadicOptions = {
  maxFiles: number;
  maxApproxTokens: number;
  skipTestPaths: boolean;
};

const DEFAULT_OPTS: SaccadicOptions = {
  maxFiles: 12,
  maxApproxTokens: 24000,
  skipTestPaths: false,
};

/** ~4 chars per token for rough budgeting. */
function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split unified diff into per-file segments, score by path heuristics + entropy of added lines,
 * then take top files within token/file caps (Saccadic Focus).
 */
export function selectSaccadicFiles(diff: string, options: Partial<SaccadicOptions> = {}): ScoredDiffFile[] {
  const opts = { ...DEFAULT_OPTS, ...options };
  if (!diff?.trim()) return [];

  const segments = diff.split(/\ndiff --git /);
  const files: ScoredDiffFile[] = [];

  for (let s = 0; s < segments.length; s++) {
    let chunk = segments[s];
    if (s > 0) chunk = 'diff --git ' + chunk;
    const lines = chunk.split('\n');
    if (lines.length === 0) continue;

    const dm = lines[0].match(/^diff --git a\/(.+?) b\/(.+)$/);
    let currentPath = dm ? normalizeDiffPath(dm[2]) : '';

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('+++ ')) {
        const pathPart = line.slice(4).split('\t')[0]?.trim() ?? '';
        const p = normalizeDiffPath(pathPart);
        if (p && p !== '/dev/null') currentPath = p;
        break;
      }
    }

    if (!currentPath || shouldSkipPath(currentPath, opts.skipTestPaths)) continue;

    const added = addedLinesOnly(chunk);
    const entropy = shannonEntropy(added.length > 80 ? added : added + chunk.slice(0, 2000));
    const pathWeight = pathHeuristicWeight(currentPath);
    const score = pathWeight * (0.85 + 0.35 * entropy);

    files.push({
      path: currentPath,
      patchText: chunk,
      score,
      entropy,
      pathWeight,
    });
  }

  files.sort((a, b) => b.score - a.score);

  const picked: ScoredDiffFile[] = [];
  let tokens = 0;
  for (const f of files) {
    if (picked.length >= opts.maxFiles) break;
    const t = approxTokens(f.patchText);
    if (tokens + t > opts.maxApproxTokens && picked.length > 0) break;
    picked.push(f);
    tokens += t;
  }

  return picked;
}
