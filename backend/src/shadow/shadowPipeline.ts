import { randomUUID } from 'crypto';
import { GitHubService } from '../services/githubService';
import { config } from '../config/env';
import { selectSaccadicFiles } from './saccadicFocus';
import { analyzeShadowSecurity } from './shadowAgent';
import {
  buildShadowRows,
  ensureRepositoryForShadow,
  insertShadowFindings,
  insertShadowRunFailure,
} from './shadowFindingsService';

export type ShadowWorkerPayload = {
  owner: string;
  repo: string;
  prNumber: number;
  headSha: string;
  runId: string;
  githubDeliveryId: string | null;
};

export async function runShadowPipeline(payload: ShadowWorkerPayload): Promise<void> {
  const { owner, repo, prNumber, runId, githubDeliveryId } = payload;

  let headSha = payload.headSha?.trim() ?? '';
  if (!headSha) {
    headSha = (await GitHubService.getPullRequestHeadSha(owner, repo, prNumber)) ?? '';
  }

  let repositoryId: string | null = null;
  try {
    repositoryId = await ensureRepositoryForShadow(owner, repo);
  } catch {
    repositoryId = null;
  }

  const modelId = config.geminiShadowModel;

  try {
    const diff = await GitHubService.getPullRequestDiff(owner, repo, prNumber);
    const files = selectSaccadicFiles(diff, {
      maxFiles: config.shadowMaxFiles,
      maxApproxTokens: config.shadowMaxApproxTokens,
      skipTestPaths: config.shadowSkipTestPaths,
    });

    console.log(
      `[Shadow] run=${runId} ${owner}/${repo}#${prNumber} files=${files.length} model=${modelId}`
    );

    const { findings, model, error: agentError } = await analyzeShadowSecurity(files, modelId);

    if (agentError && !findings.length) {
      await insertShadowRunFailure({
        owner,
        repo,
        repositoryId,
        prNumber,
        headSha,
        runId,
        githubDeliveryId,
        model,
        error: agentError,
      });
      return;
    }

    const rows = buildShadowRows({
      owner,
      repo,
      repositoryId,
      prNumber,
      headSha,
      runId,
      githubDeliveryId,
      model,
      findings,
    });

    const n = await insertShadowFindings(rows);
    console.log(`[Shadow] run=${runId} inserted=${n} findings=${findings.length}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[Shadow] run=${runId} failed:`, msg);
    await insertShadowRunFailure({
      owner,
      repo,
      repositoryId,
      prNumber,
      headSha,
      runId,
      githubDeliveryId,
      model: modelId,
      error: msg,
    });
  }
}

export function newShadowRunId(): string {
  return randomUUID();
}
