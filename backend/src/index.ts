import dotenv from 'dotenv';
dotenv.config(); // Must stay at the top!

import express from 'express';
import cors from 'cors'; // Import all tools first
import { config } from './config/env';
import { verifyWebhookSecret } from './webhooks/middleware';
import { handleWebhook } from './webhooks/handler';
import { getRepositories, postRepository } from './routes/repositories';

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
 * 📂 Tracked repositories (Supabase via backend)
 */
app.get('/api/repositories', getRepositories);
app.post('/api/repositories', postRepository);

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
 * 🛡️ Global Error Handler
 */
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Server Error:', err.message);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

/**
 * 🚀 Execution
 */
const port = config.port || 3000;
app.listen(port, () => {  // <-- REMOVE THE () AFTER port
  console.log('--- 🛠️  SENTINEL-AG ENGINE STARTUP ---');
  console.log(`🚀 Server: http://localhost:${port}`);
  console.log('📡 Webhook: POST /api/webhook');
  console.log('📂 Repositories: GET/POST /api/repositories');
  
  const keys = {
    Supabase: !!process.env.SUPABASE_URL,
    GoogleAI: !!process.env.GOOGLE_API_KEY || !!process.env.GEMINI_API_KEY,
    WebhookSecret: !!process.env.WEBHOOK_SECRET
  };

  console.log('🔑 Connectivity Check:', keys);
  console.log(`-------------------------------------`);
});