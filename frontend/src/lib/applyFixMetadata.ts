/**
 * Parses Sentinel-AG “Apply fix” payloads embedded in GitHub PR inline comment bodies.
 * Keep in sync with backend `applyFixMetadata.ts` (same prefix/suffix and JSON shape).
 */
export type ApplyFixMetadataV1 = {
  sentinelAg: {
    kind: 'apply_fix'
    version: 1
    patch: string
    filePath: string
    line: number | null
    violationType: string
    tribalMemoryIds: string[]
    owner: string
    repo: string
    pullNumber: number
    headSha: string
  }
}

const PREFIX = '<!-- sentinel-ag:apply-fix:v1:'
const SUFFIX = ' -->'

function base64UrlToUtf8(b64: string): string {
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
  const norm = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(norm)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function tryDecodeApplyFixMetadata(commentBody: string): ApplyFixMetadataV1 | null {
  const i = commentBody.indexOf(PREFIX)
  if (i < 0) return null
  const j = commentBody.indexOf(SUFFIX, i)
  if (j < 0) return null
  const b64 = commentBody.slice(i + PREFIX.length, j).trim()
  try {
    const json = base64UrlToUtf8(b64)
    const parsed = JSON.parse(json) as ApplyFixMetadataV1
    if (parsed?.sentinelAg?.kind === 'apply_fix' && parsed.sentinelAg.version === 1) {
      return parsed
    }
  } catch {
    return null
  }
  return null
}
