
import { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Heart, Handshake, MapPin, GraduationCap, Calendar, Eye, X } from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCandidates } from "../hooks/useCandidates";
import { supabase } from "@/integrations/supabase/client";
import TermsDialog from "../components/TermsDialog";

interface LocalCandidate {
  isSelected: boolean;
}

const Favorites = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { candidates: allCandidates, loading, toggleFavorite: toggleCandidateFavorite } = useCandidates();
  const [localState, setLocalState] = useState<Record<string, LocalCandidate>>({});
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [pendingIntroductions, setPendingIntroductions] = useState<string[]>([]);
  const [completedIntroductions, setCompletedIntroductions] = useState<string[]>([]);

  // Filter to only show favorited candidates (memoized to stabilize reference)
  const favoriteCandidates = useMemo(
    () => allCandidates.filter(candidate => candidate.is_favorite),
    [allCandidates]
  );
  const favoriteCandidateIds = useMemo(
    () => favoriteCandidates.map(c => c.id),
    [favoriteCandidates]
  );

  // Fetch introduction statuses for current user
  useEffect(() => {
    const fetchStatuses = async () => {
      if (!user?.id || favoriteCandidateIds.length === 0) {
        setPendingIntroductions([]);
        setCompletedIntroductions([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('introduction_requests')
          .select('candidate_id, status')
          .in('candidate_id', favoriteCandidateIds)
          .eq('requester_id', user.id);
        if (error) throw error;

        const pending = (data || []).filter((r: any) => r.status === 'pending').map((r: any) => r.candidate_id);
        const completed = (data || []).filter((r: any) => r.status === 'approved' || r.status === 'rejected').map((r: any) => r.candidate_id);

        setPendingIntroductions(pending);
        setCompletedIntroductions(completed);
      } catch (err) {
        console.error('Error fetching introduction statuses:', err);
      }
    };
    fetchStatuses();
  }, [user?.id, favoriteCandidateIds.join(',')]);

  const toggleFavorite = async (candidateId: string) => {
    await toggleCandidateFavorite(candidateId);
    
    const candidate = favoriteCandidates.find(c => c.id === candidateId);
    if (candidate) {
      toast({
        title: "Removed from favorites",
        description: `${candidate.display_name} removed from your favorites.`,
      });
    }
  };

  const toggleSelect = (candidateId: string) => {
    setLocalState(prev => ({
      ...prev,
      [candidateId]: {
        ...prev[candidateId],
        isSelected: !prev[candidateId]?.isSelected
      }
    }));
  };

  const getSelectedCount = () => {
    return Object.values(localState).filter(state => state.isSelected).length;
  };

  const handleIntroduceMe = (candidate: any) => {
    // Check if user is admin
    if (user?.role === 'admin') {
      toast({
        title: "Cannot Request Introductions",
        description: "You are an admin, you cannot request introductions",
        variant: "destructive",
      });
      return;
    }

    if (!user?.has_accepted_terms) {
      setShowTermsDialog(true);
      return;
    }
    
    // Add to pending introductions
    setPendingIntroductions(prev => [...prev, candidate.id]);
    
    toast({
      title: "Introduction request sent",
      description: "Thank you for your interest. Please give us 24-48 hours to connect with the candidate and see their interest in this role. We will email you once the candidate has accepted or rejected.",
    });
  };

  const handleBulkIntroduce = () => {
    const selectedCandidateIds = Object.keys(localState).filter(id => localState[id]?.isSelected);
    if (selectedCandidateIds.length === 0) return;

    if (!user?.has_accepted_terms) {
      setShowTermsDialog(true);
      return;
    }

    selectedCandidateIds.forEach(candidateId => {
      setPendingIntroductions(prev => [...prev, candidateId]);
    });

    // Deselect all
    setLocalState({});
    setSelectMode(false);

    toast({
      title: "Introduction requests sent",
      description: `Sent introduction requests for ${selectedCandidateIds.length} candidates. You'll receive updates via email.`,
    });
  };

  const handleAcceptTerms = () => {
    setShowTermsDialog(false);
    // Here you would typically update the user's terms acceptance status
    toast({
      title: "Terms accepted",
      description: "You can now request introductions to candidates.",
    });
  };

  return (
    <>
      <TermsDialog 
        open={showTermsDialog} 
        onOpenChange={(open) => {
          setShowTermsDialog(open);
          if (!open) {
            // Handle when dialog is closed without accepting
          }
        }}
      />
      
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold font-heading text-foreground">Favorite Candidates</h1>
              <p className="text-muted-foreground">Your saved candidates for future consideration</p>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {/* Selection Controls */}
          {!loading && favoriteCandidates.length > 0 && (
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-4">
                <Button
                  variant={selectMode ? "default" : "outline"}
                  onClick={() => {
                    setSelectMode(!selectMode);
                    if (!selectMode) {
                      // Clear selections when entering select mode
                      setLocalState({});
                    }
                  }}
                >
                  {selectMode ? 'Cancel Selection' : 'Select Candidates'}
                </Button>
                {selectMode && (
                  <>
                    <span className="text-sm text-gray-600">
                      {getSelectedCount()}/5 selected
                    </span>
                    {getSelectedCount() > 0 && (
                      <Button onClick={handleBulkIntroduce}>
                        <Handshake className="mr-2 h-4 w-4" />
                        Introduce Me ({getSelectedCount()})
                      </Button>
                    )}
                  </>
                )}
              </div>
              <div className="text-sm text-gray-600">
                {favoriteCandidates.length} favorite{favoriteCandidates.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}

          {/* Candidates Grid */}
          {!loading && favoriteCandidates.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Heart className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">You have not favorited any candidates yet</h3>
                <p className="text-gray-600 mb-4">
                  Start browsing candidates and add them to your favorites for easy access.
                </p>
                <Button onClick={() => window.location.href = '/browse'}>
                  Browse Candidates
                </Button>
              </CardContent>
            </Card>
          ) : !loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {favoriteCandidates.map((candidate) => (
                <Card
                  key={candidate.id}
                   className={`transition-all duration-200 hover:shadow-lg ring-2 ring-primary/20 bg-accent/50 ${
                    (pendingIntroductions.includes(candidate.id) || completedIntroductions.includes(candidate.id)) ? 'opacity-75 bg-muted/50' : ''
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-heading">{candidate.display_name}</CardTitle>
                        {user?.role === 'admin' && (
                          <p className="text-sm text-muted-foreground">{candidate.name}</p>
                        )}
                        <CardDescription className="text-primary font-medium">
                          {candidate.label}
                        </CardDescription>
                        <Badge variant="outline" className="mt-1 text-xs">
                          ID: {candidate.id}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        {selectMode && (
                          <Checkbox
                            checked={localState[candidate.id]?.isSelected || false}
                            onCheckedChange={() => toggleSelect(candidate.id)}
                            disabled={!localState[candidate.id]?.isSelected && getSelectedCount() >= 5}
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFavorite(candidate.id)}
                          className="text-red-500"
                        >
                          <Heart className="h-4 w-4 fill-current" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600">{candidate.profile_description}</p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-500">
                        <MapPin className="h-4 w-4 mr-1" />
                        {candidate.location}
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="h-4 w-4 mr-1" />
                        {candidate.experience} years experience
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <GraduationCap className="h-4 w-4 mr-1" />
                        {candidate.education}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {candidate.skills.slice(0, 3).map((skill: any) => (
                        <Badge key={skill.id} variant="secondary" className="text-xs">
                          {skill.skill}
                        </Badge>
                      ))}
                      {candidate.skills.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{candidate.skills.length - 3} more
                        </Badge>
                      )}
                     </div>


                     <div className="flex space-x-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCandidate(candidate)}
                        className="flex-1"
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        View Profile
                      </Button>
                       <Button
                         size="sm"
                         onClick={() => handleIntroduceMe(candidate)}
                         disabled={pendingIntroductions.includes(candidate.id) || completedIntroductions.includes(candidate.id)}
                         variant={(pendingIntroductions.includes(candidate.id) || completedIntroductions.includes(candidate.id)) ? "secondary" : "default"}
                         className="flex-1"
                       >
                         <Handshake className="mr-1 h-4 w-4" />
                         {pendingIntroductions.includes(candidate.id)
                           ? 'Introduction Sent'
                           : completedIntroductions.includes(candidate.id)
                             ? 'Introduction Complete'
                             : 'Introduce Me'}
                       </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Resume Preview Dialog */}
      <Dialog open={!!selectedCandidate} onOpenChange={() => setSelectedCandidate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="font-heading">{selectedCandidate?.display_name}</DialogTitle>
                {user?.role === 'admin' && (
                  <p className="text-sm text-muted-foreground">{selectedCandidate?.name}</p>
                )}
                <DialogDescription>{selectedCandidate?.label}</DialogDescription>
                <Badge variant="outline" className="mt-1 text-xs">
                  ID: {selectedCandidate?.id}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCandidate(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="bg-gray-100 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Professional Summary</h4>
              <p className="text-sm text-gray-600">{selectedCandidate?.profile_description}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2">Location</h4>
                <p className="text-sm text-gray-600">{selectedCandidate?.location}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Experience</h4>
                <p className="text-sm text-gray-600">{selectedCandidate?.experience} years</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Education</h4>
                <p className="text-sm text-gray-600">{selectedCandidate?.education}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Skills</h4>
                <div className="flex flex-wrap gap-1">
                  {selectedCandidate?.skills?.map((skill: any) => (
                    <Badge key={skill.id} variant="secondary" className="text-xs">
                      {skill.skill}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-warning/10 border border-warning/20 p-4 rounded-lg">
              <p className="text-sm text-warning-foreground">
                <strong>Note:</strong> This is a redacted profile preview. Full contact information and detailed work history will be shared upon successful introduction.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
};

export default Favorites;
