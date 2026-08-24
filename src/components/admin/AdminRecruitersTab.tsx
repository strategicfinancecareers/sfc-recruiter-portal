import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, CheckCircle, XCircle, ExternalLink, Briefcase, Handshake, Heart, Ban, RotateCcw } from 'lucide-react';

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

// Shape of /api/admin-recruiter-detail's response (drill-down dialog).
interface RecruiterDetail {
  recruiter: RecruiterRow & { updated_at?: string | null };
  auth: {
    last_sign_in_at: string | null;
    email_confirmed_at: string | null;
    auth_created_at: string | null;
    providers: string[];
  } | null;
  intros: Array<{
    id: string;
    status: string;
    created_at: string;
    responded_at: string | null;
    candidate: { display_name: string | null; name: string | null } | null;
    job: { title: string | null; company: string | null } | null;
  }>;
  jobs: Array<{ id: string; title: string; company: string | null; status: string | null; created_at: string }>;
  favoritesCount: number;
}

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

  // Drill-down detail dialog
  const [detailTarget, setDetailTarget] = useState<RecruiterRow | null>(null);
  const [detail, setDetail] = useState<RecruiterDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<RecruiterRow | null>(null);

  const openDetail = (rec: RecruiterRow) => {
    if (!user?.id) return;
    setDetailTarget(rec);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/admin-recruiter-detail?recruiterUserId=${encodeURIComponent(rec.id)}&adminUserId=${encodeURIComponent(user.id)}`
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
        setDetail(body as RecruiterDetail);
      } catch (err: any) {
        console.error('[AdminRecruitersTab] detail load failed:', err);
        setDetailError(err?.message || 'Failed to load recruiter details');
      } finally {
        setDetailLoading(false);
      }
    })();
  };

  // ── Action: deactivate / reactivate (is_active flip, no email) ─────────────
  const doSetActive = async (rec: RecruiterRow, active: boolean) => {
    if (!user?.id) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/review-recruiter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recruiterUserId: rec.id,
          adminUserId: user.id,
          action: active ? 'reactivate' : 'deactivate',
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      toast({
        title: active ? `Reactivated ${fullName(rec)}` : `Deactivated ${fullName(rec)}`,
        description: active
          ? 'They can sign in again.'
          : 'They will be signed out on their next page load and can no longer access the portal.',
      });
      await load();
      setDeactivateTarget(null);
      // Keep the detail dialog in sync if it's open on this recruiter.
      setDetailTarget(prev => (prev && prev.id === rec.id ? { ...prev, is_active: active } : prev));
      setDetail(prev => (prev && prev.recruiter.id === rec.id
        ? { ...prev, recruiter: { ...prev.recruiter, is_active: active } }
        : prev));
    } catch (err: any) {
      console.error('[AdminRecruitersTab] set-active failed:', err);
      toast({ title: 'Action failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

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
                  <TableRow
                    key={rec.id}
                    onClick={() => openDetail(rec)}
                    className={cn('cursor-pointer', rec.is_active === false && 'opacity-60')}
                  >
                    <TableCell className="font-medium text-sm">{fullName(rec)}</TableCell>
                    <TableCell className="text-sm">{rec.email}</TableCell>
                    <TableCell className="text-sm">{rec.company || '—'}</TableCell>
                    <TableCell className="text-sm">
                      {rec.linkedin_url ? (
                        <a
                          href={rec.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
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
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={cn('capitalize', STATUS_BADGE[badgeStatus])}>
                          {status || 'legacy'}
                        </Badge>
                        {rec.is_active === false && (
                          <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">
                            deactivated
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {status === 'pending' ? (
                        <div className="inline-flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            onClick={(e) => { e.stopPropagation(); setRejectReason(''); setRejectTarget(rec); }}
                          >
                            <XCircle className="w-3 h-3 mr-1" /> Reject
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={(e) => { e.stopPropagation(); setApproveTarget(rec); }}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" /> Approve
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">View →</span>
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

      {/* ── Recruiter drill-down detail dialog ──────────────────────────── */}
      <Dialog open={!!detailTarget} onOpenChange={(open) => { if (!open) { setDetailTarget(null); setDetail(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {detailTarget ? fullName(detailTarget) : ''}
              {detailTarget && (
                <Badge variant="outline" className={cn('capitalize', STATUS_BADGE[detailTarget.recruiter_status || 'legacy'])}>
                  {detailTarget.recruiter_status || 'legacy'}
                </Badge>
              )}
              {detailTarget?.is_active === false && (
                <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">deactivated</Badge>
              )}
            </DialogTitle>
            <DialogDescription>{detailTarget?.company || detailTarget?.email}</DialogDescription>
          </DialogHeader>

          {detailLoading && (
            <div className="py-10 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading recruiter details…
            </div>
          )}
          {detailError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{detailError}</div>
          )}

          {detail && (
            <div className="space-y-5">
              {/* Account facts */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {([
                  { label: 'Email', value: detail.recruiter.email },
                  {
                    label: 'Email verified',
                    value: detail.auth
                      ? (detail.auth.email_confirmed_at ? `Yes — ${format(new Date(detail.auth.email_confirmed_at), 'MMM d, yyyy')}` : 'No')
                      : 'Unknown',
                  },
                  {
                    label: 'Signup date',
                    value: detail.recruiter.created_at ? format(new Date(detail.recruiter.created_at), 'MMM d, yyyy · h:mm a') : '—',
                  },
                  {
                    label: 'Last login',
                    value: detail.auth?.last_sign_in_at
                      ? format(new Date(detail.auth.last_sign_in_at), 'MMM d, yyyy · h:mm a')
                      : 'Never / unknown',
                  },
                  {
                    label: 'Sign-in method',
                    value: detail.auth?.providers?.length
                      ? detail.auth.providers.map(p => (p === 'email' ? 'Email & password' : p)).join(', ')
                      : '—',
                  },
                  {
                    label: 'Approved',
                    value: detail.recruiter.approved_at
                      ? format(new Date(detail.recruiter.approved_at), 'MMM d, yyyy')
                      : '—',
                  },
                ] as Array<{ label: string; value: string }>).map(row => (
                  <div key={row.label}>
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="font-medium break-words">{row.value}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Passwords are stored as one-way hashes by Supabase Auth and cannot be viewed by anyone, including admins.
              </p>
              {detail.recruiter.rejection_reason && (
                <div className="p-3 bg-red-50/60 border border-red-100 rounded-lg text-xs text-red-800">
                  <span className="font-semibold">Rejection reason:</span> {detail.recruiter.rejection_reason}
                </div>
              )}

              {/* Activity summary */}
              <div className="grid grid-cols-3 gap-3">
                {([
                  { icon: Handshake, label: 'Intros sent', value: detail.intros.length },
                  { icon: Briefcase, label: 'Jobs posted', value: detail.jobs.length },
                  { icon: Heart, label: 'Favorites', value: detail.favoritesCount },
                ] as Array<{ icon: typeof Handshake; label: string; value: number }>).map(s => (
                  <div key={s.label} className="rounded-lg border bg-gray-50/60 p-3 text-center">
                    <s.icon className="w-4 h-4 mx-auto text-gray-400 mb-1" />
                    <p className="text-lg font-bold leading-none">{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Introductions list */}
              {detail.intros.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Introduction requests</p>
                  <div className="rounded-lg border divide-y max-h-56 overflow-y-auto">
                    {detail.intros.map(i => (
                      <div key={i.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {i.candidate?.name || i.candidate?.display_name || 'Candidate'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {i.job?.title ? `${i.job.title}${i.job.company ? ` · ${i.job.company}` : ''}` : 'General introduction'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge variant="outline" className={cn('capitalize text-xs',
                            i.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : i.status === 'rejected' ? 'bg-red-100 text-red-800 border-red-200'
                            : 'bg-amber-100 text-amber-800 border-amber-200')}>
                            {i.status}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(i.created_at), 'MMM d, yyyy')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Jobs list */}
              {detail.jobs.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Jobs posted</p>
                  <div className="rounded-lg border divide-y max-h-40 overflow-y-auto">
                    {detail.jobs.map(j => (
                      <div key={j.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <p className="font-medium truncate">{j.title}{j.company ? ` · ${j.company}` : ''}</p>
                        <p className="text-[10px] text-muted-foreground shrink-0">{format(new Date(j.created_at), 'MMM d, yyyy')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {detailTarget?.recruiter_status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => { setRejectReason(''); setRejectTarget(detailTarget); }}
                >
                  <XCircle className="w-4 h-4 mr-1" /> Reject
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setApproveTarget(detailTarget)}
                >
                  <CheckCircle className="w-4 h-4 mr-1" /> Approve
                </Button>
              </>
            )}
            {detailTarget && detailTarget.recruiter_status !== 'pending' && (
              detailTarget.is_active === false ? (
                <Button
                  variant="outline"
                  disabled={actionLoading}
                  onClick={() => doSetActive(detailTarget, true)}
                >
                  {actionLoading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Reactivating…</>
                    : <><RotateCcw className="w-4 h-4 mr-1" /> Reactivate access</>}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  disabled={actionLoading}
                  onClick={() => setDeactivateTarget(detailTarget)}
                >
                  <Ban className="w-4 h-4 mr-1" /> Deactivate access
                </Button>
              )
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate confirmation */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(open) => { if (!open) setDeactivateTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivateTarget ? fullName(deactivateTarget) : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be signed out on their next page load and can no longer access the recruiter portal.
              No email is sent. You can reactivate them at any time from this same screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={actionLoading}
              onClick={(e) => {
                e.preventDefault();
                if (deactivateTarget) doSetActive(deactivateTarget, false);
              }}
            >
              {actionLoading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deactivating…</>
                : <><Ban className="w-4 h-4 mr-2" />Deactivate</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
