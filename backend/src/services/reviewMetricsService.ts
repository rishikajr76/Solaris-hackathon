import { config } from '../config/env';
import { Pool } from 'pg';

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
});

export interface ReviewMetricsRecord {
  id: number;
  repo_id: number;
  pr_number: number;
  complexity_score: number;
  status: string;
  created_at: string;
}

export async function initializeSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS repositories (
      id SERIAL PRIMARY KEY,
      repo_name VARCHAR(255) NOT NULL,
      owner VARCHAR(255) NOT NULL,
      last_synced_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (repo_name, owner)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      repo_id INTEGER NOT NULL REFERENCES repositories(id),
      pr_number INTEGER NOT NULL,
      complexity_score FLOAT NOT NULL,
      status VARCHAR(50) NOT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS violations (
      id SERIAL PRIMARY KEY,
      review_id INTEGER NOT NULL REFERENCES reviews(id),
      type VARCHAR(50) NOT NULL,
      severity VARCHAR(50) NOT NULL,
      line_number INTEGER,
      message TEXT,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export async function upsertRepository(owner: string, repoName: string): Promise<number> {
  const result = await pool.query(
    `INSERT INTO repositories (repo_name, owner)
     VALUES ($1, $2)
     ON CONFLICT (repo_name, owner) DO UPDATE SET last_synced_at = CURRENT_TIMESTAMP
     RETURNING id;`,
    [repoName, owner]
  );
  return result.rows[0].id;
}

export async function saveReviewRecord(
  repoId: number,
  prNumber: number,
  complexityScore: number,
  status: string
): Promise<number> {
  const result = await pool.query(
    `INSERT INTO reviews (repo_id, pr_number, complexity_score, status)
     VALUES ($1, $2, $3, $4)
     RETURNING id;`,
    [repoId, prNumber, complexityScore, status]
  );
  return result.rows[0].id;
}

export async function saveViolation(
  reviewId: number,
  type: string,
  severity: string,
  lineNumber: number | null,
  message: string
): Promise<void> {
  await pool.query(
    `INSERT INTO violations (review_id, type, severity, line_number, message)
     VALUES ($1, $2, $3, $4, $5);`,
    [reviewId, type, severity, lineNumber, message]
  );
}

export async function closeMetricsPool(): Promise<void> {
  await pool.end();
}
