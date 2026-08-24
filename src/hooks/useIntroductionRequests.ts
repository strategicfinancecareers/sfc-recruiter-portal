
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface IntroductionRequest {
  id: string;
  requester_id: string;
  candidate_id: string;
  job_id: string | null;
  status: 'pending' | 'approved' | 'rejected';
  message: string | null;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
  // Stamped each time an admin clicks "Resend" in the admin Introductions tab.
  last_nudged_at: string | null;
  // Related data
  candidate: {
    id: string;
    name: string;
    display_name: string;
    email: string;
    phone: string | null;
    // Revealed post-acceptance only (server scrubs non-approved intros).
    linkedin_url?: string | null;
    location: string;
    experience: number;
    education: string;
    highest_education_level?: string | null;
    label: string;
    profile_description?: string | null;
    // Storage path (bucket is private). Use /api/get-resume-url for a signed download URL.
    resume_full_url?: string | null;
    skills: Array<{ id: string; skill: string }>;
    // SFC Take (Batch 2) — recruiters see the full set ONLY after intro is approved.
    sfc_take?: string | null;
    sfc_role_fit?: string[] | null;
    sfc_strengths?: string[] | null;
    sfc_considerations?: string[] | null;
    sfc_take_published_at?: string | null;
  };
  requester: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  job: {
    id: string;
    title: string;
    company: string;
    location: string;
  } | null;
}

export const useIntroductionRequests = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<IntroductionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);

      if (user.role === 'recruiter') {
        // Route through service-role API to bypass RLS
        const res = await fetch(`/api/recruiter-intros?recruiterId=${encodeURIComponent(user.id)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `API error ${res.status}`);
        }
        const { requests: raw } = await res.json();
        // Data already comes back with candidate/requester/job aliases matching the interface.
        // Skills are not fetched via the API — default to empty array.
        const transformed: IntroductionRequest[] = (raw || []).map((req: any) => ({
          ...req,
          candidate: {
            ...(req.candidate || {}),
            skills: [],
          },
          requester: req.requester || { id: req.requester_id, first_name: '—', last_name: '', email: '' },
          job: req.job || null,
        }));
        setRequests(transformed);
      } else {
        // Admin / owner: route through service-role API. Direct browser
        // queries on introduction_requests with a users embed hit
        // "permission denied for table users" (PG 42501) — the embed
        // resolves through auth.users in a way that PostgREST refuses
        // without the service role. /api/admin-intros does the same
        // SELECT shape server-side and enforces admin/owner auth.
        const res = await fetch(`/api/admin-intros?adminUserId=${encodeURIComponent(user.id)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `API error ${res.status}`);
        }
        const { requests: raw } = await res.json();
        // The admin endpoint doesn't currently embed candidate_skills (the
        // admin Introductions tab doesn't render skills, and AdminPendingCandidates
        // is gone). Default to [] to satisfy the IntroductionRequest type.
        const transformed: IntroductionRequest[] = (raw || []).map((req: any) => ({
          ...req,
          candidate: {
            ...(req.candidate || {}),
            skills: (req.candidate?.candidate_skills || []).map((cs: any) => ({
              id: cs.skills?.id,
              skill: cs.skills?.skill,
            })).filter((s: any) => s.id && s.skill),
          },
          requester: req.requester || { id: req.requester_id, first_name: '—', last_name: '', email: '' },
          job: req.job || null,
        }));
        setRequests(transformed);
      }
    } catch (err: any) {
      console.error('[useIntroductionRequests] fetch error:', err);
      const msg = err?.message || 'Failed to load introduction requests';
      setError(msg);
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('introduction_requests')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      setRequests(prev =>
        prev.map(req =>
          req.id === requestId
            ? { ...req, status, updated_at: new Date().toISOString() }
            : req
        )
      );

      toast({
        title: `Request ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        description: `Introduction request has been ${status === 'approved' ? 'approved' : 'rejected'}.`,
      });
    } catch (err: any) {
      console.error('[useIntroductionRequests] updateRequestStatus error:', err);
      toast({
        title: 'Error',
        description: 'Failed to update request status',
        variant: 'destructive',
      });
    }
  };

  const cancelRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('introduction_requests')
        .delete()
        .eq('id', requestId)
        .eq('requester_id', user?.id);

      if (error) throw error;

      setRequests(prev => prev.filter(req => req.id !== requestId));

      toast({
        title: 'Request Cancelled',
        description: 'Introduction request has been cancelled.',
      });
    } catch (err: any) {
      console.error('[useIntroductionRequests] cancelRequest error:', err);
      toast({
        title: 'Error',
        description: 'Failed to cancel request',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user?.id]);

  return {
    requests,
    loading,
    error,
    updateRequestStatus,
    cancelRequest,
    refetchRequests: fetchRequests,
  };
};
