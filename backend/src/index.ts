import * as dotenv from 'dotenv';
dotenv.config(); 

import express from 'express';
import { config } from './config/env';
import { verifyWebhookSecret } from './webhooks/middleware';
import { handleWebhook } from './webhooks/handler';

const app = express();
const port = config.port || 3000;

/**
 * 🛠️ Middleware
 * We capture the rawBody as a buffer. 
 * This is strictly required for GitHub HMAC-SHA256 signature verification.
 */
app.use(express.json({ 
  verify: (req: any, res, buf) => { 
    req.rawBody = buf; 
  } 
}));

/**
 * 📡 Webhook Route
 * verifyWebhookSecret: Validates the X-Hub-Signature-256 header.
 * handleWebhook: Orchestrates the AI Agentic workflow (Perceive -> Reason -> Act).
 */
app.post('/api/webhook', verifyWebhookSecret, handleWebhook);

/**
 * 🏥 Health Check
 * Useful for local testing or cloud-based health monitoring.
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
app.listen(port, () => {
  console.log(`🚀 Sentinel-AG listening at http://localhost:${port}`);
  console.log(`📡 Webhook endpoint ready for GitHub: /api/webhook`);
  console.log(`🔑 Supabase Project: ${process.env.SUPABASE_URL}`);
});

/**
 * 🔌 Graceful Shutdown
 */
process.on('SIGINT', () => {
  console.log('Stopping Sentinel-AG gracefully...');
  process.exit(0);
});