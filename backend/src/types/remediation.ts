/**
 * Input to the Self-Healing Remediation Agent.
 */
export type RemediationViolation = {
  /** Repo-relative file path */
  filePath: string;
  lineNumber: number | null;
  /** e.g. SQLi, Complexity, Auth, General */
  errorType: string;
  /** Human-readable finding from linter or review */
  message?: string;
};

export type ApplyFixMetadataV1 = {
  sentinelAg: {
    kind: 'apply_fix';
    version: 1;
    patch: string;
    filePath: string;
    line: number | null;
    violationType: string;
    /** IDs from tribal_memory rows used as context */
    tribalMemoryIds: string[];
    owner: string;
    repo: string;
    pullNumber: number;
    headSha: string;
  };
};
