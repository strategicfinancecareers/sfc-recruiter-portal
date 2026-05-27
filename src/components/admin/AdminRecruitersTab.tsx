import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type RecruiterStatus = 'pending' | 'approved' | 'rejected' | null;

interface RecruiterRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  linkedin_url: string | null;
  recruiter_status: RecruiterStatus;
  rejection_reason: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  is_active: boolean | null;
  roles: { name: string } | null;
}

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  legacy:   'bg-gray-100 text-gray-600 border-gray-200',
};

const fullName = (r: RecruiterRow) =>
  [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || r.email;

// ─── Component ────────────────────────────────────────────────────────────────

interface AdminRecruitersTabProps {
  // Called after a successful approve/reject so the parent can refresh
  // its pending-count badge. Optional — the tab works standalone too.
  onCountChange?: () => void;
}

export default function AdminRecruitersTab({ onCountChange }: AdminRecruitersTabProps = {}) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [recruiters, setRecruiters] = useState<RecruiterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>('pending');

  // Pending action state
  const [actionLoading, setActionLoading] = useState(false);
  const [approveTarget, setApproveTarget] = useState<RecruiterRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RecruiterRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Direct browser query — RLS allows admins to read public.users.
      // No users embed (we ARE querying users), so no PostgREST permission
      // issue like the introduction_requests case.
      const { data, error: qErr } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, company, linkedin_url, recruiter_status, rejection_reason, approved_at, approved_by, created_at, is_active, roles(name)')
        .order('created_at', { ascending: false });
      if (qErr) throw qErr;
      // Only show users with the 'recruiter' role here. Admins/owners are in the Users tab.
      const onlyRecruiters = (data || []).filter((u: any) => u.roles?.name === 'recruiter') as RecruiterRow[];
      setRecruiters(onlyRecruiters);
    } catch (err: any) {
      console.error('[AdminRecruitersTab] load error:', err);
      setError(err?.message || 'Failed to load recruiters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Counts + filter ────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0, legacy: 0 };
    for (const r of recruiters) {
      const s = r.recruiter_status;
      if (s === 'pending') c.pending++;
      else if (s === 'approved') c.approved++;
      else if (s === 'rejected') c.rejected++;
      else c.legacy++;
    }
    return c;
  }, [recruiters]);

  const filtered = useMemo(() => {
    if (filter === 'all') return recruiters;
    return recruiters.filter(r => r.recruiter_status === filter);
  }, [recruiters, filter]);

  // ── Action: approve ────────────────────────────────────────────────────────
  const doApprove = async (rec: RecruiterRow) => {
    if (!user?.id) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/review-recruiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recruiterUserId: rec.id,
          adminUserId: user.id,
          action: 'approve',
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      toast({
        title: `Approved ${fullName(rec)}`,
        description: body.emailSent
          ? 'Welcome email sent.'
          : `Status updated. Email not sent: ${body.emailError || 'unknown'}.`,
        variant: body.emailSent ? undefined : 'destructive',
      });
      await load();
      onCountChange?.();
      setApproveTarget(null);
    } catch (err: any) {
      console.error('[AdminRecruitersTab] approve failed:', err);
      toast({ title: 'Action failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Action: reject ─────────────────────────────────────────────────────────
  const doReject = async (rec: RecruiterRow, reason: string) => {
    if (!user?.id) return;
    if (!reason.trim()) {
      toast({ title: 'Reason required', description: 'Please enter a rejection reason.', variant: 'destructive' });
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/review-recruiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recruiterUserId: rec.id,
          adminUserId: user.id,
          action: 'reject',
          rejectionReason: reason.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      toast({
        title: `Rejected ${fullName(rec)}`,
        description: body.emailSent
          ? 'Rejection email sent.'
          : `Status updated. Email not sent: ${body.emailError || 'unknown'}.`,
        variant: body.emailSent ? undefined : 'destructive',
      });
      await load();
      onCountChange?.();
      setRejectTarget(null);
      setRejectReason('');
    } catch (err: any) {
      console.error('[AdminRecruitersTab] reject failed:', err);
      toast({ title: 'Action failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Recruiter Vetting</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Approve or reject new recruiter applications.
        </p>
      </div>

      {/* Status filter sub-tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">Pending ({counts.pending})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({counts.approved})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({counts.rejected})</TabsTrigger>
          <TabsTrigger value="all">All ({recruiters.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* States */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="p-10 bg-gray-50 border border-gray-200 rounded-lg text-center text-sm text-muted-foreground">
          {filter === 'pending'
            ? 'No pending recruiter applications 🎉'
            : `No ${filter === 'all' ? '' : filter + ' '}recruiters`}
        </div>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>LinkedIn</TableHead>
                <TableHead className="w-[120px]">Signup Date</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="text-right w-[180px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(rec => {
                const status = rec.recruiter_status;
                const badgeStatus = status || 'legacy';
                return (
                  <TableRow key={rec.id}>
                    <TableCell className="font-medium text-sm">{fullName(rec)}</TableCell>
                    <TableCell className="text-sm">{rec.email}</TableCell>
                    <TableCell className="text-sm">{rec.company || '—'}</TableCell>
                    <TableCell className="text-sm">
                      {rec.linkedin_url ? (
                        <a
                          href={rec.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
                        >
                          Profile <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {rec.created_at ? format(new Date(rec.created_at), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('capitalize', STATUS_BADGE[badgeStatus])}>
                        {status || 'legacy'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {status === 'pending' ? (
                        <div className="inline-flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            onClick={() => { setRejectReason(''); setRejectTarget(rec); }}
                          >
                            <XCircle className="w-3 h-3 mr-1" /> Reject
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => setApproveTarget(rec)}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" /> Approve
                          </Button>
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

      {/* Approve confirmation */}
      <AlertDialog
        open={!!approveTarget}
        onOpenChange={(open) => { if (!open && !actionLoading) setApproveTarget(null); }}
      >
        <AlertDialogContent>
          {approveTarget && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Approve {fullName(approveTarget)}?</AlertDialogTitle>
                <AlertDialogDescription>
                  They'll get a welcome email with a sign-in link and gain access to the recruiter portal.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={actionLoading}
                  onClick={(e) => { e.preventDefault(); doApprove(approveTarget); }}
                >
                  {actionLoading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Approving…</>
                    : 'Approve'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject dialog with required reason */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => { if (!open && !actionLoading) { setRejectTarget(null); setRejectReason(''); } }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject {rejectTarget ? fullName(rejectTarget) : ''}</DialogTitle>
            <DialogDescription>
              The reason below IS included in the email to the applicant. Be constructive.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reject-reason">Reason (sent to applicant)</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. We currently only work with finance-focused recruiters."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={actionLoading}
              onClick={() => { setRejectTarget(null); setRejectReason(''); }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={actionLoading || !rejectReason.trim()}
              onClick={() => { if (rejectTarget) doReject(rejectTarget, rejectReason); }}
            >
              {actionLoading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rejecting…</>
                : <><XCircle className="w-4 h-4 mr-2" />Reject Recruiter</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
