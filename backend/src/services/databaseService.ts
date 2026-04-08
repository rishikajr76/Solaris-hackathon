import { Pool } from 'pg';
import { config } from '../config/env';

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
});

let schemaInitialized = false;

async function ensureSchema(): Promise<void> {
  if (schemaInitialized) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      pr_id INTEGER NOT NULL,
      complexity_score FLOAT NOT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reviews_pr_id ON reviews(pr_id);
  `);

  schemaInitialized = true;
}

export async function saveReviewComplexity(prId: number, complexityScore: number): Promise<void> {
  await ensureSchema();

  await pool.query(
    `INSERT INTO reviews (pr_id, complexity_score, timestamp) VALUES ($1, $2, NOW())`,
    [prId, complexityScore]
  );
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
