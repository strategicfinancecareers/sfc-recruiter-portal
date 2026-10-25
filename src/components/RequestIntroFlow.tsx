import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { authedFetch } from '@/integrations/supabase/authedFetch';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Shared "pick a job → send introduction request" dialog, used by both
// /browse and /favorites. Exists because Favorites shipped with a stub
// handler that showed a success toast without ever creating an intro
// (silent data loss) — one shared flow means the pages cannot drift.
//
// The page owns the GATES (admin block, terms, subscription) and opens
// this flow only after they pass. This component owns job selection and
// the actual submission — one POST /api/submit-intro per candidate; the
// server derives the requester from the bearer token.

export interface IntroFlowCandidate {
  id: string;
  display_name?: string | null;
}

interface Job {
  id: string;
  title: string;
  company: string;
}

interface Props {
  // Non-empty list = dialog open. Single-candidate and bulk use the same flow.
  candidates: IntroFlowCandidate[] | null;
  onClose: () => void;
  // Called with the candidate ids that were successfully submitted.
  onSubmitted: (candidateIds: string[]) => void;
  // "Add New Job" when the recruiter has no active postings.
  onAddJob: () => void;
  // DEV harness only: skip the authed jobs fetch and render these jobs.
  fixtureJobs?: Job[];
}

export default function RequestIntroFlow({ candidates, onClose, onSubmitted, onAddJob, fixtureJobs }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const open = !!candidates && candidates.length > 0;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (fixtureJobs) { setJobs(fixtureJobs); return; }
    if (!open || !user?.id) return;
    let cancelled = false;
    setJobsLoading(true);
    supabase
      .from('jobs')
      .select('id, title, company')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('[RequestIntroFlow] jobs fetch failed:', error.message);
        setJobs((data as Job[]) || []);
        setJobsLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, user?.id]);

  const close = () => {
    setSelectedJobId('');
    setNote('');
    onClose();
  };

  const submit = async () => {
    if (!candidates || !selectedJobId || !user?.id) return;
    setSubmitting(true);
    const succeeded: string[] = [];
    let failed = 0;
    for (const c of candidates) {
      try {
        const res = await authedFetch('/api/submit-intro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidate_id: c.id, job_id: selectedJobId, message: note.trim() || null }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
        succeeded.push(c.id);
      } catch (err) {
        failed += 1;
        console.error('[RequestIntroFlow] submit failed for candidate', c.id, err);
      }
    }
    setSubmitting(false);

    if (succeeded.length > 0) {
      onSubmitted(succeeded);
      toast({
        title: succeeded.length === 1 ? 'Introduction request sent' : `${succeeded.length} introduction requests sent`,
        description:
          'Thank you for your interest. Candidates agree to respond within 48 hours, though response times are not guaranteed. We will email you as soon as the candidate accepts or declines.',
      });
    }
    if (failed > 0) {
      toast({
        title: failed === candidates.length ? 'Request failed' : 'Some requests failed',
        description: `${failed} introduction request${failed === 1 ? '' : 's'} could not be sent. Please try again.`,
        variant: 'destructive',
      });
    }
    if (failed === 0) close();
  };

  const single = candidates && candidates.length === 1 ? candidates[0] : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !submitting) close(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Job Position</DialogTitle>
          {jobs.length > 0 && (
            <DialogDescription>
              {single
                ? `Choose which job position you want to introduce ${single.display_name || 'this candidate'} for.`
                : `Choose which job position you want to introduce these ${candidates?.length ?? 0} candidates for.`}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-4 py-4">
          {jobsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading your job postings…
            </div>
          ) : jobs.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">You don't have any active job postings.</p>
              <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
                <p className="text-sm text-destructive">A job must be selected in order to request an introduction.</p>
              </div>
              <Button onClick={() => { close(); onAddJob(); }} className="w-full">
                Add New Job
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="job-select">Job Position</Label>
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger id="job-select">
                    <SelectValue placeholder="Select a job position" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.title} - {job.company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!selectedJobId && (
                <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
                  <p className="text-sm text-destructive">A job must be selected in order to request an introduction.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="intro-note">
                  {single ? 'Add a note for the candidate' : 'Add a note for the candidates'}{' '}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="intro-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="A short personal note — why this role could be a great fit, what caught your eye on their profile…"
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground text-right">{note.length}/500</p>
              </div>
            </div>
          )}
        </div>
        {jobs.length > 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!selectedJobId || submitting}>
              {submitting ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Sending…</span>
              ) : single ? 'Send Introduction Request' : `Send ${candidates?.length ?? 0} Requests`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
