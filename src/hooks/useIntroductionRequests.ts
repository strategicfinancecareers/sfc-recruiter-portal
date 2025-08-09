
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
  } | null;
}

export const useIntroductionRequests = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<IntroductionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // Build the query based on user role with specific relationship aliases
      let query = supabase
        .from('introduction_requests')
        .select(`
          *,
          candidate:candidates!introduction_requests_candidate_id_fkey (
            id,
            name,
            display_name,
            email,
            phone,
            location
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
            company
          )
        `)
        .order('created_at', { ascending: false });

      // If user is a recruiter, only show their own requests
      if (user.role === 'recruiter') {
        query = query.eq('requester_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Type the data properly with unknown first
      const typedData = (data || []) as unknown as IntroductionRequest[];
      setRequests(typedData);
    } catch (error) {
      console.error('Error fetching introduction requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load introduction requests',
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

      // Update local state
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
    } catch (error) {
      console.error('Error updating request status:', error);
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
        .eq('requester_id', user?.id); // Ensure users can only cancel their own requests

      if (error) throw error;

      // Update local state
      setRequests(prev => prev.filter(req => req.id !== requestId));

      toast({
        title: 'Request Cancelled',
        description: 'Introduction request has been cancelled.',
      });
    } catch (error) {
      console.error('Error cancelling request:', error);
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
    updateRequestStatus,
    cancelRequest,
    refetchRequests: fetchRequests,
  };
};
