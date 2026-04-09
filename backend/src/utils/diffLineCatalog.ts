/**
 * Maps unified-diff files to NEW (right-side) line numbers that appear in the PR patch.
 * GitHub pull-request review comments use path + line + side: RIGHT.
 */

export type DiffLineCatalog = {
  byPath: Map<string, Set<number>>;
};

function addLine(byPath: Map<string, Set<number>>, filePath: string, line: number): void {
  if (!byPath.has(filePath)) byPath.set(filePath, new Set());
  byPath.get(filePath)!.add(line);
}

/** Normalize path from "b/foo/bar.ts" or "foo/bar.ts". */
export function normalizeDiffPath(raw: string): string {
  let p = raw.trim();
  if (p.startsWith('b/')) p = p.slice(2);
  if (p.startsWith('a/')) p = p.slice(2);
  return p.replace(/^\.\//, '');
}

/**
 * Parse a unified diff (v3 format from GitHub) into valid new-file line numbers per path.
 */
export function parseDiffLineCatalog(diff: string): DiffLineCatalog {
  const byPath = new Map<string, Set<number>>();
  if (!diff?.trim()) return { byPath };

  const segments = diff.split(/\ndiff --git /);
  for (let s = 0; s < segments.length; s++) {
    let chunk = segments[s];
    if (s > 0) chunk = 'diff --git ' + chunk;
    const lines = chunk.split('\n');
    if (lines.length === 0) continue;

    const dm = lines[0].match(/^diff --git a\/(.+?) b\/(.+)$/);
    let currentPath = dm ? normalizeDiffPath(dm[2]) : '';

    let inHunk = false;
    let newLine = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('+++ ')) {
        const pathPart = line.slice(4).split('\t')[0]?.trim() ?? '';
        const p = normalizeDiffPath(pathPart);
        if (p && p !== '/dev/null') currentPath = p;
        continue;
      }

      if (line.startsWith('@@ ')) {
        const hm = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hm && currentPath) {
          newLine = parseInt(hm[1], 10);
          inHunk = true;
        } else {
          inHunk = false;
        }
        continue;
      }

      if (!inHunk || !currentPath) continue;
      if (line.startsWith('\\')) continue;

      if (!line.length) continue;
      const c = line[0];
      if (c === '+') {
        addLine(byPath, currentPath, newLine);
        newLine++;
      } else if (c === ' ') {
        addLine(byPath, currentPath, newLine);
        newLine++;
      }
      // '-' : only in old file; do not advance newLine
    }
  }

  return { byPath };
}

/** Format catalog for LLM prompts (truncate very large lists). */
export function formatLineCatalogForPrompt(catalog: DiffLineCatalog, maxLinesPerFile = 220, maxFiles = 48): string {
  const entries = [...catalog.byPath.entries()]
    .filter(([, nums]) => nums.size > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, maxFiles);

  const parts: string[] = [];
  for (const [path, set] of entries) {
    const sorted = [...set].sort((x, y) => x - y);
    const slice = sorted.length > maxLinesPerFile ? sorted.slice(0, maxLinesPerFile) : sorted;
    const suffix = sorted.length > maxLinesPerFile ? ` …(+${sorted.length - maxLinesPerFile} more)` : '';
    parts.push(`- ${path}: ${slice.join(', ')}${suffix}`);
  }
  return parts.length ? parts.join('\n') : '(no line mapping; empty or binary-only diff)';
}

/** Snap to nearest valid line within maxDelta; otherwise null. */
export function snapLineToCatalog(path: string, line: number, catalog: DiffLineCatalog, maxDelta = 5): number | null {
  const set = catalog.byPath.get(path);
  if (!set || set.size === 0) return null;
  if (set.has(line)) return line;
  let best: number | null = null;
  let bestDist = Infinity;
  for (const l of set) {
    const d = Math.abs(l - line);
    if (d <= maxDelta && d < bestDist) {
      bestDist = d;
      best = l;
    }
  }
  return best;
}

/** Resolve path from model output to a key in catalog (exact or case-insensitive). */
export function resolveCatalogPath(requested: string, catalog: DiffLineCatalog): string | null {
  const n = normalizeDiffPath(requested);
  if (catalog.byPath.has(n)) return n;
  const lower = n.toLowerCase();
  for (const p of catalog.byPath.keys()) {
    if (p.toLowerCase() === lower) return p;
  }
  return null;
}

export type ValidatedInlineComment = { path: string; line: number; body: string };

/** Keep only comments on catalogued paths/lines; snap ±5; dedupe path:line; cap count. */
export function validateInlineComments(
  extracted: readonly { path: string; line: number; body: string }[],
  catalog: DiffLineCatalog,
  maxCount = 20
): ValidatedInlineComment[] {
  const seen = new Set<string>();
  const out: ValidatedInlineComment[] = [];
  for (const c of extracted) {
    const path = resolveCatalogPath(c.path, catalog);
    if (!path) continue;
    const set = catalog.byPath.get(path);
    if (!set?.size) continue;
    let line = c.line;
    if (!set.has(line)) {
      const snapped = snapLineToCatalog(path, line, catalog, 5);
      if (snapped === null) continue;
      line = snapped;
    }
    const key = `${path}:${line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ path, line, body: c.body.slice(0, 60000) });
    if (out.length >= maxCount) break;
  }
  return out;
}
