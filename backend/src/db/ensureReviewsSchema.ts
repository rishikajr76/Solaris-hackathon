import pg from 'pg';
import { config } from '../config/env';

/**
 * Build postgres:// from SUPABASE_URL project ref + DB password (no DATABASE_URL needed).
 * Password: same as Supabase Dashboard → Database → Database password.
 */
function connectionStringFromSupabaseRef(): string | null {
  const url = (process.env.SUPABASE_URL || config.supabase.url || '').trim();
  if (!url) return null;

  const ref =
    url.match(/https?:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1] ?? null;
  if (!ref) return null;

  const pass =
    process.env.SUPABASE_DB_PASSWORD?.trim() ||
    process.env.POSTGRES_PASSWORD?.trim() ||
    config.db.password?.trim();
  if (!pass) return null;

  const user = process.env.SUPABASE_DB_USER?.trim() || 'postgres';
  const dbname = process.env.SUPABASE_DB_NAME?.trim() || 'postgres';

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@db.${ref}.supabase.co:5432/${dbname}`;
}

/**
 * Postgres connection URI: prefer DATABASE_URL (Supabase → Settings → Database → URI).
 * Then derive from SUPABASE_URL + SUPABASE_DB_PASSWORD (or DB_PASSWORD).
 * Otherwise builds from DB_HOST / DB_USER / DB_PASSWORD / DB_NAME / DB_PORT.
 */
function postgresConnectionString(): string | null {
  const uri = process.env.DATABASE_URL?.trim();
  if (uri) return uri;

  const fromRef = connectionStringFromSupabaseRef();
  if (fromRef) return fromRef;

  const password = config.db.password?.trim();
  if (!password) return null;

  const { host, port, database, user } = config.db;
  if (!host) return null;

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

/**
 * Ensures `public.reviews.repo_id` exists so list/filter by repository works.
 * Safe to run every startup (`IF NOT EXISTS`).
 */
export async function ensureReviewsRepoIdColumn(): Promise<void> {
  const connectionString = postgresConnectionString();
  if (!connectionString) {
    console.warn(
      '⚠️  Add one of: DATABASE_URL, or (SUPABASE_URL + SUPABASE_DB_PASSWORD), or DB_PASSWORD + DB_HOST (db.<ref>.supabase.co) so the server can run ALTER TABLE. Or paste backend/sql/add_reviews_repo_id.sql in Supabase SQL editor.'
    );
    return;
  }

  const isLocal =
    /localhost|127\.0\.0\.1/.test(connectionString) &&
    !connectionString.includes('supabase');
  const client = new pg.Client({
    connectionString,
    ssl: process.env.DB_SSL === 'false' || isLocal ? undefined : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    // TEXT works for uuid-typed or bigint repository ids passed as strings from the API
    await client.query(`
      ALTER TABLE public.reviews
      ADD COLUMN IF NOT EXISTS repo_id text;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reviews_repo_id ON public.reviews (repo_id);
    `);
    console.log('✅ Database: public.reviews.repo_id column is present');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('⚠️  Could not ensure reviews.repo_id:', msg);
    console.warn('   Fix DB credentials or run backend/sql/add_reviews_repo_id.sql in Supabase.');
  } finally {
    await client.end().catch(() => undefined);
  }
}
