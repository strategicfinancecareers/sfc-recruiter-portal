import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { usePlaidLink } from 'react-plaid-link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreditCard, RefreshCw, TrendingDown, Tag, Hash, Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  plaid_transaction_id: string;
  date: string;
  name: string;
  amount: number;
  category: string;
  subcategory: string | null;
  account_id: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  FOOD_AND_DRINK: '#10B981',
  TRAVEL: '#3B82F6',
  SHOPPING: '#8B5CF6',
  ENTERTAINMENT: '#F59E0B',
  TRANSFER: '#6B7280',
  GENERAL_MERCHANDISE: '#EC4899',
  PERSONAL_CARE: '#14B8A6',
  UTILITIES: '#F97316',
  RENT_AND_UTILITIES: '#F97316',
  MEDICAL: '#EF4444',
  LOAN_PAYMENTS: '#6366F1',
  Other: '#9CA3AF',
};

const DATE_RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

const PAGE_SIZE = 20;

function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS['Other'];
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.abs(n));
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ title, value, icon: Icon, sub }: { title: string; value: string; icon: React.ElementType; sub?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function CategoryBar({ category, amount, total }: { category: string; amount: number; total: number }) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  const color = categoryColor(category);
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-sm text-gray-700 truncate shrink-0">{formatCategory(category)}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="text-sm font-medium text-gray-900 w-20 text-right shrink-0">{formatCurrency(amount)}</div>
      <div className="text-xs text-muted-foreground w-10 text-right shrink-0">{pct.toFixed(0)}%</div>
    </div>
  );
}

// ─── Plaid Link wrapper ────────────────────────────────────────────────────────

function ConnectButton({
  linkToken,
  userId,
  onConnected,
  size = 'default',
}: {
  linkToken: string | null;
  userId: string;
  onConnected: () => void;
  size?: 'default' | 'lg';
}) {
  const onSuccess = useCallback(async (public_token: string, metadata: any) => {
    await fetch('/api/plaid-exchange-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        public_token,
        userId,
        institution_name: metadata?.institution?.name || 'Unknown Bank',
      }),
    });
    onConnected();
  }, [userId, onConnected]);

  const { open, ready } = usePlaidLink({ token: linkToken || '', onSuccess });

  return (
    <Button
      size={size}
      className="bg-emerald-600 hover:bg-emerald-700 text-white"
      onClick={() => open()}
      disabled={!ready || !linkToken}
    >
      <CreditCard className="h-4 w-4 mr-2" />
      Connect Bank
    </Button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const Expenses = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [hasConnection, setHasConnection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [rangeDays, setRangeDays] = useState(30);
  const [page, setPage] = useState(1);

  // Load link token + transactions on mount
  useEffect(() => {
    if (!user?.id) return;
    initPage();
  }, [user?.id]);

  const initPage = async () => {
    setLoading(true);
    await Promise.all([fetchLinkToken(), checkConnection(), fetchTransactions()]);
    setLoading(false);
  };

  const fetchLinkToken = async () => {
    try {
      const res = await fetch('/api/plaid-link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id }),
      });
      const data = await res.json();
      if (data.link_token) setLinkToken(data.link_token);
    } catch (err) {
      console.error('Link token error:', err);
    }
  };

  const checkConnection = async () => {
    const { data } = await supabase
      .from('plaid_connections')
      .select('id')
      .eq('user_id', user?.id)
      .limit(1);
    setHasConnection(!!(data && data.length > 0));
  };

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user?.id)
      .order('date', { ascending: false });
    setTransactions((data as Transaction[]) || []);
  };

  const syncTransactions = async () => {
    setSyncing(true);
    try {
      await fetch('/api/plaid-sync-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id }),
      });
      await fetchTransactions();
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(false);
    }
  };

  const onConnected = async () => {
    setHasConnection(true);
    await syncTransactions();
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - rangeDays);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const rangeTransactions = transactions.filter(t => t.date >= cutoffStr);

  // Stats (last 30d always)
  const thirtyDaysCutoff = new Date();
  thirtyDaysCutoff.setDate(thirtyDaysCutoff.getDate() - 30);
  const thirtyStr = thirtyDaysCutoff.toISOString().split('T')[0];
  const thirty = transactions.filter(t => t.date >= thirtyStr && t.amount > 0);
  const totalSpend = thirty.reduce((s, t) => s + t.amount, 0);
  const largestTx = thirty.reduce((max, t) => (t.amount > max ? t.amount : max), 0);
  const catTotals: Record<string, number> = {};
  thirty.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });
  const topCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  // Category breakdown for range
  const rangeCatTotals: Record<string, number> = {};
  rangeTransactions.filter(t => t.amount > 0).forEach(t => {
    rangeCatTotals[t.category] = (rangeCatTotals[t.category] || 0) + t.amount;
  });
  const catEntries = Object.entries(rangeCatTotals).sort((a, b) => b[1] - a[1]);
  const catTotal = catEntries.reduce((s, [, v]) => s + v, 0);

  // Filtered + paginated table
  const filtered = rangeTransactions.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Empty state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasConnection && transactions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
            <CreditCard className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Connect your bank to get started</h2>
          <p className="text-sm text-gray-500 mb-6">Securely connect via Plaid to see your transactions</p>
          <ConnectButton linkToken={linkToken} userId={user?.id || ''} onConnected={onConnected} size="lg" />
        </div>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Expense Tracker</h1>
            <p className="text-muted-foreground mt-1">Personal spend overview</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={syncTransactions}
              disabled={syncing}
            >
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Sync Transactions
            </Button>
            <ConnectButton linkToken={linkToken} userId={user?.id || ''} onConnected={onConnected} />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Spend (30d)"
            value={formatCurrency(totalSpend)}
            icon={TrendingDown}
            sub="Sum of expenses"
          />
          <StatCard
            title="Largest Transaction"
            value={largestTx > 0 ? formatCurrency(largestTx) : '—'}
            icon={CreditCard}
            sub="Single transaction"
          />
          <StatCard
            title="Top Category"
            value={formatCategory(topCategory)}
            icon={Tag}
            sub="Most spend"
          />
          <StatCard
            title="Transactions"
            value={String(thirty.length)}
            icon={Hash}
            sub="Last 30 days"
          />
        </div>

        {/* Date range filter */}
        <div className="flex gap-2 mb-6">
          {DATE_RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => { setRangeDays(r.days); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                rangeDays === r.days
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Category breakdown */}
        {catEntries.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {catEntries.map(([cat, amt]) => (
                <CategoryBar key={cat} category={cat} amount={amt} total={catTotal} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Transactions table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">Transactions</CardTitle>
              <Input
                placeholder="Search merchant..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="max-w-xs"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Merchant</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-muted-foreground text-sm">
                        No transactions found
                      </td>
                    </tr>
                  ) : pageItems.map(tx => (
                    <tr key={tx.plaid_transaction_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {new Date(tx.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-medium max-w-[200px] truncate">{tx.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: categoryColor(tx.category) }}
                        >
                          {formatCategory(tx.category)}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${tx.amount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {tx.amount > 0 ? '-' : '+'}{formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} · {filtered.length} transactions
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default Expenses;
