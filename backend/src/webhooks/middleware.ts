import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config/env';

/**
 * Middleware to verify that the request actually came from GitHub.
 * Protects your AI tokens and DB from unauthorized spoofing.
 */
export function verifyWebhookSecret(req: Request, res: Response, next: NextFunction): void {
  const signature = req.get('X-Hub-Signature-256');
  
  // Ensure we have a secret to check against
  if (!config.webhookSecret) {
    console.warn('⚠️ WEBHOOK_SECRET is not set. Skipping verification (Not recommended for production).');
    return next();
  }

  if (!signature) {
    console.error('❌ Security: No signature provided on incoming webhook.');
    res.status(401).send('Unauthorized: Missing Signature');
    return;
  }

  // CRITICAL: We need the raw body buffer for HMAC verification.
  // This requires a tweak in your main index.ts (see 'What to add' below).
  const payload = (req as any).rawBody || JSON.stringify(req.body);

  const hmac = crypto.createHmac('sha256', config.webhookSecret);
  const digest = Buffer.from('sha256=' + hmac.update(payload).digest('hex'), 'utf8');
  const checksum = Buffer.from(signature, 'utf8');

  try {
    // timingSafeEqual prevents "Time-based" side-channel attacks
    if (checksum.length !== digest.length || !crypto.timingSafeEqual(digest, checksum)) {
      console.error('❌ Security: Invalid Webhook Signature');
      res.status(401).send('Unauthorized: Invalid Signature');
      return;
    }
  } catch (error) {
    console.error('❌ Security: Signature verification process failed:', error);
    res.status(401).send('Unauthorized');
    return;
  }

  next();
}