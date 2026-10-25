import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore - ESM JS helper, no .d.ts file
import { getAuthedUser } from './_shared/requireAuth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// POST (bearer) -> { url } for the Stripe-hosted Customer Portal: invoices,
// receipts, card updates, cancel-at-period-end. The portal must be activated
// once in the Stripe dashboard (Settings -> Billing -> Customer portal).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const caller = await getAuthedUser(req, supabase);
  if ((caller as any).error) {
    return res.status((caller as any).status).json({ error: (caller as any).error });
  }

  const { data: row, error } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', (caller as any).userId)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!row?.stripe_customer_id) {
    return res.status(404).json({ error: 'No billing account on file yet.' });
  }

  const origin = req.headers.origin || 'https://talent.strategicfinancecareers.com';
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripe_customer_id,
      return_url: `${origin}/account`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error('[billing-portal] Stripe error:', err.message);
    return res.status(500).json({ error: 'Could not open the billing portal. Please try again.' });
  }
}
