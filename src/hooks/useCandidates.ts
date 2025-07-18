import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Candidate {
  id: string;
  name: string;
  display_name: string;
  email: string;
  phone?: string;
  location: string;
  experience: number;
  education: string;
  label: string;
  profile_description?: string;
  is_favorite: boolean;
  resume_full_url?: string;
  resume_redacted_url?: string;
  skills: Array<{ id: string; name: string }>;
}

export function useCandidates() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCandidates = async () => {
    try {
      const { data: candidatesData, error: candidatesError } = await supabase
        .from('candidates')
        .select(`
          *,
          candidate_skills!inner(
            skill_id,
            skills!inner(
              id,
              name
            )
          )
        `);

      if (candidatesError) throw candidatesError;

      // Transform the data to group skills by candidate
      const transformedCandidates = candidatesData?.map(candidate => ({
        ...candidate,
        skills: candidate.candidate_skills?.map((cs: any) => ({
          id: cs.skills.id,
          name: cs.skills.name
        })) || []
      })) || [];

      setCandidates(transformedCandidates);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      toast({
        title: "Error",
        description: "Failed to load candidates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (candidateId: string) => {
    try {
      const candidate = candidates.find(c => c.id === candidateId);
      if (!candidate) return;

      const { error } = await supabase
        .from('candidates')
        .update({ is_favorite: !candidate.is_favorite })
        .eq('id', candidateId);

      if (error) throw error;

      setCandidates(prev => 
        prev.map(c => 
          c.id === candidateId 
            ? { ...c, is_favorite: !c.is_favorite }
            : c
        )
      );

      toast({
        title: candidate.is_favorite ? "Removed from favorites" : "Added to favorites",
        description: candidate.is_favorite 
          ? `${candidate.display_name} removed from favorites`
          : `${candidate.display_name} added to favorites`,
      });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast({
        title: "Error",
        description: "Failed to update favorite status",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  return {
    candidates,
    loading,
    toggleFavorite,
    refetch: fetchCandidates
  };
}