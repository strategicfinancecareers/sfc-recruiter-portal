import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

const plaidClient = new PlaidApi(new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    }
  }
}));

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.body.userId || 'admin' },
      client_name: 'SFC Talent Expenses',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    return res.status(200).json({ link_token: response.data.link_token });
  } catch (error: any) {
    console.error('Plaid link token error:', error.response?.data || error);
    return res.status(500).json({ error: error.message });
  }
}
