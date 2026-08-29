import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Pricing configuration
const PLANS = {
  monthly: {
    unit_amount: 15000,      // $150.00
    interval: 'month' as const,
    label: 'Monthly - $150/mo',
  },
  annual: {
    unit_amount: 120000,     // $1,200.00 / year = $100/mo
    interval: 'year' as const,
    label: 'Annual - $1,200/yr ($100/mo)',
  },
};

// Promo codes granting a 90-day free trial (both billing modes: monthly
// bills $150/mo starting month 4; annual bills $1,200 at day 90).
// Server-side only, so codes are not visible in the client bundle.
// Edit this list to add or retire codes.
const FREE_MONTHS_CODES = ['SFCLAUNCH'];
const FREE_TRIAL_DAYS = 90;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { plan, userId, userEmail, initialsFee, initialsComms, signature, termsVersion, promoCode } = req.body as {
    plan: 'monthly' | 'annual';
    userId?: string;
    userEmail?: string;
    initialsFee?: string;
    initialsComms?: string;
    signature?: string;
    termsVersion?: string;
    promoCode?: string;
  };

  if (!plan || !PLANS[plan]) {
    return res.status(400).json({ error: 'Invalid plan. Must be "monthly" or "annual".' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[create-checkout-session] STRIPE_SECRET_KEY not set');
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  // ── Recruiter Agreement gate ────────────────────────────────────────────
  // Payment requires initials on BOTH key clauses (placement fee,
  // communications) plus a typed full-name signature. Recorded on the
  // users row BEFORE the session is created, so acceptance evidence
  // exists even if the recruiter abandons checkout.
  const feeInit = (initialsFee || '').trim();
  const commsInit = (initialsComms || '').trim();
  const signed = (signature || '').trim();
  if (!userId || !feeInit || !commsInit || feeInit.length > 8 || commsInit.length > 8) {
    return res.status(400).json({ error: 'Initials on both highlighted clauses are required before payment.' });
  }
  if (signed.length < 2 || signed.length > 120) {
    return res.status(400).json({ error: 'A typed full name is required to sign the agreement.' });
  }
  const { error: agreeErr } = await supabase
    .from('users')
    .update({
      recruiter_agreement_accepted_at: new Date().toISOString(),
      recruiter_agreement_initials_fee: feeInit,
      recruiter_agreement_initials_comms: commsInit,
      recruiter_agreement_signature: signed,
      recruiter_agreement_version: (termsVersion || '1.0').slice(0, 16),
    })
    .eq('id', userId);
  if (agreeErr) {
    console.error('[create-checkout-session] agreement record failed:', agreeErr.message);
    return res.status(500).json({ error: 'Could not record agreement. Please try again.' });
  }

  // ── Promo code (3 months free) ──────────────────────────────────────────
  // Valid code -> 90-day trial on the subscription. An INVALID non-empty
  // code is rejected rather than silently ignored, so nobody expecting
  // free months gets charged immediately.
  const promoClean = (promoCode || '').trim().toUpperCase();
  let trialDays: number | undefined;
  if (promoClean) {
    if (FREE_MONTHS_CODES.includes(promoClean)) {
      trialDays = FREE_TRIAL_DAYS;
    } else {
      return res.status(400).json({ error: 'That promo code is not valid.', invalidPromo: true });
    }
  }

  const origin = req.headers.origin || 'https://sfc-recruiter-portal.vercel.app';
  const priceConfig = PLANS[plan];

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'SFC Talent Recruiter Access',
              description: priceConfig.label,
            },
            recurring: { interval: priceConfig.interval },
            unit_amount: priceConfig.unit_amount,
          },
          quantity: 1,
        },
      ],
      ...(userEmail ? { customer_email: userEmail } : {}),
      ...(trialDays ? { subscription_data: { trial_period_days: trialDays } } : {}),
      success_url: `${origin}/browse?subscribed=true`,
      cancel_url: `${origin}/browse`,
      metadata: {
        userId: userId || '',
        plan,
        ...(promoClean ? { promoCode: promoClean } : {}),
      },
    });

    console.log('[create-checkout-session] created session:', session.id, 'plan:', plan, 'user:', userId);
    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error('[create-checkout-session] Stripe error:', err.message);
    return res.status(500).json({ error: 'Failed to create checkout session', message: err.message });
  }
}
