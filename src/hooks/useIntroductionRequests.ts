
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
  // Related data
  candidate: {
    id: string;
    name: string;
    display_name: string;
    email: string;
    phone: string | null;
    location: string;
    experience: number;
    education: string;
    highest_education_level?: string | null;
    label: string;
    profile_description?: string | null;
    // TODO: this is now a storage path, not a URL — generate a signed URL via /api/get-resume-url (to be built) before using.
    resume_full_url?: string | null;
    skills: Array<{ id: string; skill: string }>;
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
        // Admin: direct Supabase query (admins have unrestricted RLS access)
        const { data, error: qErr } = await supabase
          .from('introduction_requests')
          .select(`
            *,
            candidate:candidates!introduction_requests_candidate_id_fkey (
              id,
              name,
              display_name,
              email,
              phone,
              location,
              experience,
              education,
              highest_education_level,
              label,
              profile_description,
              resume_full_url,
              candidate_skills (
                skills (
                  id,
                  skill
                )
              )
            ),
            requester:users (
              id,
              first_name,
              last_name,
              email
            ),
            job:jobs!introduction_requests_job_id_fkey (
              id,
              title,
              company,
              location
            )
          `)
          .order('created_at', { ascending: false });

        if (qErr) throw qErr;

        const transformed: IntroductionRequest[] = (data || []).map((req: any) => ({
          ...req,
          candidate: {
            ...req.candidate,
            skills: (req.candidate?.candidate_skills || []).map((cs: any) => ({
              id: cs.skills.id,
              skill: cs.skills.skill,
            })),
          },
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
