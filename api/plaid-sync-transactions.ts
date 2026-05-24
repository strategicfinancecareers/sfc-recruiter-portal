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

  const { userId } = req.body;

  try {
    const { data: connections } = await supabase
      .from('plaid_connections')
      .select('access_token, institution_name')
      .eq('user_id', userId);

    if (!connections?.length) return res.status(200).json({ transactions: [] });

    let allTransactions: any[] = [];

    for (const connection of connections) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      const response = await plaidClient.transactionsGet({
        access_token: connection.access_token,
        start_date: startDate.toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
      });

      const txs = response.data.transactions.map(tx => ({
        user_id: userId,
        plaid_transaction_id: tx.transaction_id,
        date: tx.date,
        name: tx.merchant_name || tx.name,
        amount: tx.amount,
        category: tx.personal_finance_category?.primary || tx.category?.[0] || 'Other',
        subcategory: tx.personal_finance_category?.detailed || tx.category?.[1] || null,
        account_id: tx.account_id,
      }));

      allTransactions = [...allTransactions, ...txs];
    }

    if (allTransactions.length > 0) {
      await supabase.from('transactions').upsert(allTransactions, {
        onConflict: 'plaid_transaction_id',
        ignoreDuplicates: true
      });
    }

    return res.status(200).json({ count: allTransactions.length });
  } catch (error: any) {
    console.error('Sync error:', error.response?.data || error);
    return res.status(500).json({ error: error.message });
  }
}
