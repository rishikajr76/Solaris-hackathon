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
  getRepositoryInsight,
} from './routes/repositories';
import { ensureReviewsRepoIdColumn } from './db/ensureReviewsSchema';
import { postChat, postChatStream } from './routes/chat';
import { postHeal, postRemediationComment, postTribalMemoryIngest } from './routes/remediation';
import { logReviewLlmStartup } from './services/llmReviewClient';

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
repositoriesRouter.get('/:repoId/insight', getRepositoryInsight);
repositoriesRouter.post('/:repoId/sync', postRepositorySync);
repositoriesRouter.get('/:repoId', getRepositoryByIdRoute);
app.use('/api/repositories', repositoriesRouter);

/**
 * 🤖 Sentinel Copilot (Google Gemini, same API key as PR review when using gemini)
 */
app.post('/api/chat/stream', postChatStream);
app.post('/api/chat', postChat);

/**
 * Self-healing remediation (Tribal Memory RAG + GitHub inline comments)
 */
app.post('/api/remediation/heal', postHeal);
app.post('/api/remediation/post-comment', postRemediationComment);
app.post('/api/remediation/tribal-memory', postTribalMemoryIngest);

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
    console.log('🤖 Copilot: POST /api/chat, POST /api/chat/stream (SSE)');
    console.log('🔧 Remediation: POST /api/remediation/heal, POST /api/remediation/post-comment');

    logReviewLlmStartup();

    const keys = {
      Supabase: !!process.env.SUPABASE_URL,
      GoogleAI: !!config.googleApiKey?.trim(),
      OpenAI: !!config.openaiApiKey?.trim(),
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