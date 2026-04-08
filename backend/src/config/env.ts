import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: process.env.PORT || 3000,
  githubToken: process.env.GITHUB_TOKEN,
  webhookSecret: process.env.WEBHOOK_SECRET,
  googleApiKey: process.env.GOOGLE_API_KEY,
  
  // UPDATED: Optimized for Supabase integration
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY, // Critical for backend-side bypasses
  },

  // Keep this if you are using a direct DB connection for RAG or local logging
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'sentinel_metrics',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  },
};

/**
 * FAIL-FAST VALIDATION
 * Prevents the backend from running if critical keys are missing.
 */
const requiredKeys = [
  { key: config.githubToken, name: 'GITHUB_TOKEN' },
  { key: config.googleApiKey, name: 'GOOGLE_API_KEY' },
  { key: config.supabase.url, name: 'SUPABASE_URL' },
  { key: config.supabase.anonKey, name: 'SUPABASE_ANON_KEY' }
];

requiredKeys.forEach(({ key, name }) => {
  if (!key) {
    console.error(`❌ CRITICAL ERROR: ${name} is missing in .env`);
    process.exit(1); // Stop the server immediately
  }
});