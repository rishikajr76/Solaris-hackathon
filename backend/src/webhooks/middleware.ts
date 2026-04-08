import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config/env';

export function verifyWebhookSecret(req: Request, res: Response, next: NextFunction): void {
  const signature = req.get('X-Hub-Signature-256');
  const body = JSON.stringify(req.body);

  if (!signature) {
    console.error('No signature provided');
    res.status(401).send('Unauthorized');
    return;
  }

  const hmac = crypto.createHmac('sha256', config.webhookSecret!);
  hmac.update(body, 'utf8');
  const expectedSignature = `sha256=${hmac.digest('hex')}`;

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    console.error('Invalid signature');
    res.status(401).send('Unauthorized');
    return;
  }

  next();
}