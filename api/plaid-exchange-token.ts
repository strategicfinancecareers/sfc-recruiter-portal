import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { createClient } from '@supabase/supabase-js';

const plaidClient = new PlaidApi(new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    }
  }
}));

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { public_token, userId, institution_name } = req.body;

  try {
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchangeResponse.data;

    await supabase.from('plaid_connections').upsert({
      user_id: userId,
      access_token,
      item_id,
      institution_name: institution_name || 'Unknown Bank'
    }, { onConflict: 'item_id' });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Plaid exchange error:', error.response?.data || error);
    return res.status(500).json({ error: error.message });
  }
}
