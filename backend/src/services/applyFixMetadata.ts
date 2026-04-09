import type { ApplyFixMetadataV1 } from '../types/remediation';

/** Machine-readable marker the frontend can strip and decode for an “Apply fix” action. */
export const APPLY_FIX_HTML_PREFIX = '<!-- sentinel-ag:apply-fix:v1:';
export const APPLY_FIX_HTML_SUFFIX = ' -->';

export function encodeApplyFixMetadataBlock(meta: ApplyFixMetadataV1): string {
  const json = JSON.stringify(meta);
  const b64 = Buffer.from(json, 'utf8').toString('base64url');
  return `${APPLY_FIX_HTML_PREFIX}${b64}${APPLY_FIX_HTML_SUFFIX}`;
}

/**
 * Builds the full GitHub PR inline-comment body: markdown for humans + hidden metadata for the UI.
 */
export function buildRemediationCommentBody(markdownExplanation: string, meta: ApplyFixMetadataV1): string {
  return `${markdownExplanation.trim()}\n\n${encodeApplyFixMetadataBlock(meta)}`;
}

/** Parse metadata from a stored comment body (frontend or tooling). */
export function tryDecodeApplyFixMetadata(commentBody: string): ApplyFixMetadataV1 | null {
  const i = commentBody.indexOf(APPLY_FIX_HTML_PREFIX);
  if (i < 0) return null;
  const j = commentBody.indexOf(APPLY_FIX_HTML_SUFFIX, i);
  if (j < 0) return null;
  const b64 = commentBody.slice(i + APPLY_FIX_HTML_PREFIX.length, j).trim();
  try {
    const json = Buffer.from(b64, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as ApplyFixMetadataV1;
    if (parsed?.sentinelAg?.kind === 'apply_fix' && parsed.sentinelAg.version === 1) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}
