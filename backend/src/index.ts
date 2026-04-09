import dotenv from 'dotenv';
dotenv.config(); // Must stay at the top!

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors'; // Import all tools first
import { config } from './config/env';
import { verifyWebhookSecret } from './webhooks/middleware';
import { handleWebhook } from './webhooks/handler';
import {
  getRepositories,
  postRepository,
  getRepositoryByIdRoute,
  getRepositoryReviews,
  postRepositorySync,
} from './routes/repositories';
import { ensureReviewsRepoIdColumn } from './db/ensureReviewsSchema';

// 1. CREATE the app first
const app = express(); 

// 2. NOW you can use the tools (middleware)
app.use(cors()); 

app.use(express.json({ 
  verify: (req: any, res, buf) => { 
    req.rawBody = buf; 
  } 
}));

/**
 * 📡 Webhook Route
 */
app.post('/api/webhook', verifyWebhookSecret, handleWebhook);

/**
 * 📂 Tracked repositories (mounted router — reliable matching on Express 5)
 * Order: static `/` routes first, then `/:repoId/reviews`, `/:repoId/sync`, then `/:repoId`.
 */
const repositoriesRouter = express.Router();
repositoriesRouter.get('/', getRepositories);
repositoriesRouter.post('/', postRepository);
repositoriesRouter.get('/:repoId/reviews', getRepositoryReviews);
repositoriesRouter.post('/:repoId/sync', postRepositorySync);
repositoriesRouter.get('/:repoId', getRepositoryByIdRoute);
app.use('/api/repositories', repositoriesRouter);

/**
 * 🏥 Health Check
 */
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'Sentinel-AG is active',
    timestamp: new Date().toISOString()
  });
});

/**
 * 🔍 Unmatched API routes (helps distinguish “no handler” vs app JSON errors)
 */
app.use('/api', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `No route for ${req.method} ${req.originalUrl}`,
  });
});

/**
 * 🛡️ Global Error Handler
 */
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Server Error:', err.message);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

/**
 * 🚀 Execution (ensure DB column once, then listen)
 */
const port = config.port || 3000;

async function start(): Promise<void> {
  await ensureReviewsRepoIdColumn();

  app.listen(port, () => {
    console.log('--- 🛠️  SENTINEL-AG ENGINE STARTUP ---');
    console.log(`🚀 Server: http://localhost:${port}`);
    console.log('📡 Webhook: POST /api/webhook');
    console.log('📂 Repositories: GET/POST /api/repositories, GET /:id/reviews, POST /:id/sync');

    const keys = {
      Supabase: !!process.env.SUPABASE_URL,
      GoogleAI: !!process.env.GOOGLE_API_KEY || !!process.env.GEMINI_API_KEY,
      WebhookSecret: !!process.env.WEBHOOK_SECRET,
    };

    console.log('🔑 Connectivity Check:', keys);
    console.log(`-------------------------------------`);
  });
}

start().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});