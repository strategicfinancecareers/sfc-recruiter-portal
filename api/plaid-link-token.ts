import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    console.log('PLAID_CLIENT_ID exists:', !!process.env.PLAID_CLIENT_ID);
    console.log('PLAID_SECRET exists:', !!process.env.PLAID_SECRET);
    console.log('PLAID_ENV:', process.env.PLAID_ENV);

    const configuration = new Configuration({
      basePath: PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SECRET,
        },
      },
    });

    const plaidClient = new PlaidApi(configuration);

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.body.userId || 'test-user' },
      client_name: 'SFC Talent',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });

    return res.status(200).json({ link_token: response.data.link_token });
  } catch (error: any) {
    console.error('Plaid error:', error.response?.data || error.message || error);
    return res.status(500).json({
      error: error.message,
      details: error.response?.data || null
    });
  }
}
