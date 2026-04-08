import express from 'express';
import { config } from './config/env';
import { verifyWebhookSecret } from './webhooks/middleware';
import { handleWebhook } from './webhooks/handler';
import { initializeSchema, closeMetricsPool } from './services/reviewMetricsService';

const app = express();

// Middleware
app.use(express.json({ verify: (req, res, buf) => (req as any).rawBody = buf }));

// Routes
app.post('/api/webhook', verifyWebhookSecret, handleWebhook);

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Internal server error');
});

const port = config.port;

async function startServer(): Promise<void> {
  try {
    await initializeSchema();
    app.listen(port, () => {
      console.log(`Sentinel-AG backend listening on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start backend:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await closeMetricsPool();
  process.exit(0);
});