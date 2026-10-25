/**
 * Stripe webhook handler — called by Stripe after a successful checkout.
 *
 * Set up in Stripe Dashboard → Webhooks → Add endpoint:
 *   URL: https://talent.strategicfinancecareers.com/api/payment-success
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
      // Pull subscription state so the Account Billing section and the
      // customer-portal endpoint have what they need.
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : (session.subscription as any)?.id || null;
      let subStatus: string | null = null;
      let trialEnd: string | null = null;
      let periodEnd: string | null = null;
      if (subscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          subStatus = sub.status;
          trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
          const item = sub.items?.data?.[0] as any;
          const endSec = (sub as any).current_period_end ?? item?.current_period_end;
          periodEnd = endSec ? new Date(endSec * 1000).toISOString() : null;
        } catch (subErr: any) {
          console.error('[payment-success] subscription retrieve failed:', subErr.message);
        }
      }
      const { error } = await supabase
        .from('users')
        .update({
          is_subscribed: true,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_plan: plan || null,
          subscription_status: subStatus || 'active',
          trial_end: trialEnd,
          current_period_end: periodEnd,
          subscribed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', recruiterId);

      if (error) {
        console.error('[payment-success] Failed to update is_subscribed:', error.message);
        return res.status(500).json({ error: 'DB update failed' });
      }

      console.log('[payment-success] is_subscribed set to true for user:', recruiterId);
    }
  }

  // Keep subscription state fresh; flip access off when a subscription ends.
  // Requires the webhook endpoint in Stripe to also send
  // customer.subscription.updated and customer.subscription.deleted.
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const ended = event.type === 'customer.subscription.deleted' || sub.status === 'canceled';
    const item = sub.items?.data?.[0] as any;
    const endSec = (sub as any).current_period_end ?? item?.current_period_end;
    const { error } = await supabase
      .from('users')
      .update({
        subscription_status: ended ? 'canceled' : sub.status,
        ...(ended ? { is_subscribed: false } : {}),
        trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        current_period_end: endSec ? new Date(endSec * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', sub.id);
    if (error) console.error('[payment-success] subscription sync failed:', error.message);
    else console.log('[payment-success]', event.type, '— synced', sub.id, 'status:', ended ? 'canceled' : sub.status);
  }

  return res.status(200).json({ received: true });
}
