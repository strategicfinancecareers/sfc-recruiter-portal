import { useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon, Loader2, RefreshCw, Mail } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { useIntroductionRequests, type IntroductionRequest } from '../../hooks/useIntroductionRequests';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const recruiterLabel = (r: IntroductionRequest['requester']): string => {
  const fn = (r?.first_name || '').trim();
  const ln = (r?.last_name || '').trim();
  const full = [fn, ln].filter(Boolean).join(' ');
  return full || r?.email || '—';
};

const fmt = (iso?: string | null) => (iso ? format(new Date(iso), 'MMM d') : '—');

// ─── Component ────────────────────────────────────────────────────────────────

interface AdminIntroductionsTabProps {
  // Called after a successful Resend (or future status-changing action)
  // so the parent can refresh its pending-count badge. No-op for resend
  // itself (count doesn't change) but symmetric with other admin tabs.
  onCountChange?: () => void;
}

export default function AdminIntroductionsTab({ onCountChange }: AdminIntroductionsTabProps = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { requests, loading, error, refetchRequests } = useIntroductionRequests();

  // Optimistic last_nudged_at overrides keyed by intro id — applied on top
  // of the server-fetched value so the "Last nudged: X ago" line updates
  // immediately on a successful resend, without waiting for a refetch.
  const [optimisticNudgedAt, setOptimisticNudgedAt] = useState<Record<string, string>>({});

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [recruiterFilter, setRecruiterFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    // Default range: last 30 days. Set explicitly so the chosen behaviour is
    // visible — the user can clear it to view all-time.
    const to = new Date();
    const from = new Date(to.getTime() - 30 * ONE_DAY_MS);
    return { from, to };
  });

  // Per-row resend state — keyed by introId
  const [resending, setResending] = useState<Record<string, boolean>>({});

  // ── Distinct recruiters from the loaded data (keeps the dropdown relevant) ──
  const recruiterOptions = useMemo(() => {
    const byId = new Map<string, { id: string; label: string }>();
    for (const r of requests) {
      const id = r.requester?.id || r.requester_id;
      if (!id) continue;
      if (!byId.has(id)) {
        byId.set(id, { id, label: recruiterLabel(r.requester) });
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [requests]);

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return requests.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;

      if (recruiterFilter !== 'all') {
        const id = r.requester?.id || r.requester_id;
        if (id !== recruiterFilter) return false;
      }

      if (dateRange?.from) {
        const t = new Date(r.created_at).getTime();
        if (t < dateRange.from.getTime()) return false;
        if (dateRange.to && t > dateRange.to.getTime() + ONE_DAY_MS - 1) return false;
      }

      return true;
    });
  }, [requests, statusFilter, recruiterFilter, dateRange]);

  const clearFilters = () => {
    setStatusFilter('all');
    setRecruiterFilter('all');
    setDateRange(undefined);
  };

  // ── Resend handler ──────────────────────────────────────────────────────────
  const handleResend = async (intro: IntroductionRequest) => {
    if (!user?.id) return;
    setResending(prev => ({ ...prev, [intro.id]: true }));
    try {
      const res = await fetch('/api/resend-intro-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ introId: intro.id, adminUserId: user.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || body?.detail || `Failed (${res.status})`);
      // Optimistic update: server returns last_nudged_at; fall back to
      // 'now' if the stamp UPDATE failed server-side (email still went out).
      const stampedAt = body?.last_nudged_at || new Date().toISOString();
      setOptimisticNudgedAt(prev => ({ ...prev, [intro.id]: stampedAt }));
      onCountChange?.();
      toast({
        title: 'Email resent',
        description: intro.candidate?.email
          ? `Sent to ${intro.candidate.email}`
          : `Sent to ${intro.candidate?.name || intro.candidate?.display_name || 'candidate'}.`,
      });
    } catch (err: any) {
      console.error('[AdminIntroductionsTab] resend failed:', err);
      toast({
        title: 'Resend failed',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setResending(prev => ({ ...prev, [intro.id]: false }));
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Introduction Requests</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Platform-wide view of every intro request sent by any recruiter.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchRequests()}>
          <RefreshCw className="w-3.5 h-3.5 mr-2" /> Refresh
        </Button>
      </div>

      {/* ── Filters row ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status */}
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        {/* Recruiter */}
        <Select value={recruiterFilter} onValueChange={setRecruiterFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Recruiter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All recruiters</SelectItem>
            {recruiterOptions.map(opt => (
              <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'justify-start text-left font-normal w-[260px]',
                !dateRange?.from && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {dateRange?.from
                ? dateRange.to
                  ? `${format(dateRange.from, 'MMM d, y')} – ${format(dateRange.to, 'MMM d, y')}`
                  : format(dateRange.from, 'MMM d, y')
                : 'All time'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
            />
            <div className="flex justify-end gap-2 p-3 border-t">
              <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>
                Clear
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Active-filters indicator */}
        {(statusFilter !== 'all' || recruiterFilter !== 'all' || dateRange?.from) && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        )}

        <div className="ml-auto text-sm text-muted-foreground">
          Showing {filtered.length} of {requests.length}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      )}

      {/* ── Empty: zero intros at all ── */}
      {!loading && requests.length === 0 && (
        <div className="p-10 bg-gray-50 border border-gray-200 rounded-lg text-center text-sm text-muted-foreground">
          No intro requests yet — they'll show here as recruiters send them.
        </div>
      )}

      {/* ── Empty: filtered to zero ── */}
      {!loading && requests.length > 0 && filtered.length === 0 && (
        <div className="p-10 bg-gray-50 border border-gray-200 rounded-lg text-center text-sm text-muted-foreground">
          <p>No intros match your filters.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      )}

      {/* ── Table ── */}
      {!loading && filtered.length > 0 && (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Date Requested</TableHead>
                <TableHead>Recruiter</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Job</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[120px]">Date Responded</TableHead>
                <TableHead className="text-right w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(intro => {
                // Resend is available on ANY pending intro. No age gate —
                // admin should be able to nudge a candidate that's been
                // sitting for 1 hour just as easily as one sitting for a
                // week.
                const isPending = intro.status === 'pending';
                const busy = !!resending[intro.id];
                return (
                  <TableRow key={intro.id}>
                    <TableCell className="text-sm">{fmt(intro.created_at)}</TableCell>
                    <TableCell className="text-sm">{recruiterLabel(intro.requester)}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {/* Admin sees real candidate name first, anonymous label as subtitle. */}
                      <div>
                        <p>{intro.candidate?.name || intro.candidate?.display_name || '—'}</p>
                        {intro.candidate?.display_name && intro.candidate.display_name !== intro.candidate.name && (
                          <p className="text-[11px] text-muted-foreground leading-tight">{intro.candidate.display_name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {intro.job ? (
                        <div>
                          <div>{intro.job.title || '—'}</div>
                          {intro.job.company && (
                            <div className="text-xs text-muted-foreground">{intro.job.company}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">General</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('capitalize', STATUS_BADGE[intro.status] || STATUS_BADGE.cancelled)}>
                        {intro.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{fmt(intro.responded_at)}</TableCell>
                    <TableCell className="text-right">
                      {isPending ? (
                        <div className="flex flex-col items-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => handleResend(intro)}
                            title="Resend request to candidate"
                          >
                            {busy ? (
                              <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Sending</>
                            ) : (
                              <><Mail className="w-3 h-3 mr-1" /> Resend</>
                            )}
                          </Button>
                          {(() => {
                            const nudgedAt = optimisticNudgedAt[intro.id] || intro.last_nudged_at;
                            if (!nudgedAt) return null;
                            return (
                              <p className="text-[11px] text-muted-foreground leading-tight">
                                Last nudged: {formatDistanceToNow(new Date(nudgedAt))} ago
                              </p>
                            );
                          })()}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
