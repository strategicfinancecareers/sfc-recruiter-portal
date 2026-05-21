/**
 * Stripe webhook handler — called by Stripe after a successful checkout.
 *
 * Set up in Stripe Dashboard → Webhooks → Add endpoint:
 *   URL: https://sfc-recruiter-portal.vercel.app/api/payment-success
 *   Events: checkout.session.completed
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET  (from Stripe Dashboard after adding the endpoint)
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * SQL to run once in Supabase SQL editor:
 *   ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT false;
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export const config = { api: { bodyParser: false } };

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error('[payment-success] Missing stripe-signature or STRIPE_WEBHOOK_SECRET');
    return res.status(400).send('Missing signature or webhook secret');
  }

  let event: Stripe.Event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error('[payment-success] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const recruiterId = session.metadata?.userId;
    const plan = session.metadata?.plan;

    console.log('[payment-success] checkout.session.completed — recruiterId:', recruiterId, '| plan:', plan);

    if (recruiterId) {
      const { error } = await supabase
        .from('users')
        .update({ is_subscribed: true, updated_at: new Date().toISOString() })
        .eq('id', recruiterId);

      if (error) {
        console.error('[payment-success] Failed to update is_subscribed:', error.message);
        return res.status(500).json({ error: 'DB update failed' });
      }

      console.log('[payment-success] is_subscribed set to true for user:', recruiterId);
    }
  }

  return res.status(200).json({ received: true });
}
