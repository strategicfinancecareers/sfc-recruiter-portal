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
  highest_education_level?: string;
  label: string;
  profile_description?: string;
  open_to_opportunities?: boolean;
  // Storage path (bucket is private). Use /api/get-resume-url for a signed download URL.
  resume_full_url?: string;
  resume_redacted_url?: string;
  skills: Array<{ id: string; skill: string }>;
  is_favorite?: boolean; // This will be computed based on user_favorites table
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
              skill
            )
          )
        `)
        // Recruiters only see approved (status='active') candidates.
        // Pending/rejected/inactive are filtered out. The candidate-approval
        // migration backfills NULL statuses to 'active' so no null check needed.
        .eq('status', 'active');

      if (candidatesError) throw candidatesError;

      // Get user favorites
      const { data: { user } } = await supabase.auth.getUser();
      let userFavorites: string[] = [];
      
      if (user) {
        const { data: favoritesData } = await supabase
          .from('user_favorites')
          .select('candidate_id')
          .eq('user_id', user.id);
        
        userFavorites = favoritesData?.map(f => f.candidate_id) || [];
      }

      // Transform the data to group skills by candidate
      const transformedCandidates = candidatesData?.map(candidate => ({
        ...candidate,
        skills: candidate.candidate_skills?.map((cs: any) => ({
          id: cs.skills.id,
          skill: cs.skills.skill
        })) || [],
        is_favorite: userFavorites.includes(candidate.id)
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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to favorite candidates",
          variant: "destructive",
        });
        return;
      }

      if (candidate.is_favorite) {
        // Remove from favorites
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('candidate_id', candidateId);

        if (error) throw error;
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('user_favorites')
          .insert({
            user_id: user.id,
            candidate_id: candidateId
          });

        if (error) throw error;
      }

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