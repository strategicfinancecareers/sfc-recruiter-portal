import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// Pricing configuration
const PLANS = {
  monthly: {
    unit_amount: 50000,      // $500.00
    interval: 'month' as const,
    label: 'Monthly – $500/mo',
  },
  annual: {
    unit_amount: 360000,     // $3,600.00 / year = $300/mo
    interval: 'year' as const,
    label: 'Annual – $3,600/yr ($300/mo)',
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { plan, userId, userEmail } = req.body as {
    plan: 'monthly' | 'annual';
    userId?: string;
    userEmail?: string;
  };

  if (!plan || !PLANS[plan]) {
    return res.status(400).json({ error: 'Invalid plan. Must be "monthly" or "annual".' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[create-checkout-session] STRIPE_SECRET_KEY not set');
    return res.status(500).json({ error: 'Stripe not configured' });
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
              name: 'SFC Talent – Recruiter Access',
              description: priceConfig.label,
            },
            recurring: { interval: priceConfig.interval },
            unit_amount: priceConfig.unit_amount,
          },
          quantity: 1,
        },
      ],
      ...(userEmail ? { customer_email: userEmail } : {}),
      success_url: `${origin}/browse?subscribed=true`,
      cancel_url: `${origin}/browse`,
      metadata: {
        userId: userId || '',
        plan,
      },
    });

    console.log('[create-checkout-session] created session:', session.id, 'plan:', plan, 'user:', userId);
    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error('[create-checkout-session] Stripe error:', err.message);
    return res.status(500).json({ error: 'Failed to create checkout session', message: err.message });
  }
}
