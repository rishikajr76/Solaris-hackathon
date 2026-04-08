import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: process.env.PORT || 3000,
  githubToken: process.env.GITHUB_TOKEN,
  webhookSecret: process.env.WEBHOOK_SECRET,
  googleApiKey: process.env.GOOGLE_API_KEY,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'code_review_metrics',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  },
};

if (!config.githubToken) {
  throw new Error('GITHUB_TOKEN environment variable is required');
}

if (!config.googleApiKey) {
  throw new Error('GOOGLE_API_KEY environment variable is required');
}

if (!config.db.password) {
  throw new Error('DB_PASSWORD environment variable is required');
}