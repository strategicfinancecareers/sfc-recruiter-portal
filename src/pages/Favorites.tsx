
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Heart, Handshake, MapPin, GraduationCap, Calendar, Eye, X } from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import TermsDialog from "../components/TermsDialog";

interface Candidate {
  id: string;
  name: string;
  displayName: string;
  label: string;
  description: string;
  location: string;
  experience: number;
  education: string;
  skills: string[];
  isFavorite: boolean;
  isSelected: boolean;
  uniqueIdentifier: string;
}

// Generate anonymous candidate names based on their qualifications
const generateDisplayName = (candidate: any, index: number) => {
  const seniorityMap: { [key: number]: string } = {
    1: "Junior", 2: "Junior", 3: "Mid-level", 4: "Mid-level", 
    5: "Senior", 6: "Senior", 7: "Lead", 8: "Lead"
  };
  
  const seniority = seniorityMap[Math.min(candidate.experience, 8)] || "Senior";
  const primarySkill = candidate.skills[0] || "Tech";
  const locationCode = candidate.location.split(',')[1]?.trim().substring(0, 2) || candidate.location.substring(0, 2);
  
  return `${seniority} ${primarySkill} Professional (${locationCode})`;
};

// This would typically come from a global state or API
const mockFavoriteCandidates: Candidate[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    displayName: '',
    label: 'Senior Full Stack Developer',
    description: 'Experienced developer specializing in React and Node.js with a passion for creating scalable web applications.',
    location: 'San Francisco, CA',
    experience: 5,
    education: 'Bachelor\'s',
    skills: ['React', 'Node.js', 'TypeScript', 'AWS'],
    isFavorite: true,
    isSelected: false,
    uniqueIdentifier: 'SR-REACT-SF-5Y'
  },
  {
    id: '3',
    name: 'Emily Rodriguez',
    displayName: '',
    label: 'UX/UI Designer',
    description: 'Creative designer focused on user-centered design principles and modern interface development.',
    location: 'Austin, TX',
    experience: 4,
    education: 'Bachelor\'s',
    skills: ['Figma', 'Adobe Creative Suite', 'Prototyping', 'User Research'],
    isFavorite: true,
    isSelected: false,
    uniqueIdentifier: 'ML-FIGMA-TX-4Y'
  },
].map((candidate, index) => ({
  ...candidate,
  displayName: generateDisplayName(candidate, index)
}));

const Favorites = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<Candidate[]>(mockFavoriteCandidates);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [pendingIntroductions, setPendingIntroductions] = useState<string[]>([]);

  const toggleFavorite = (candidateId: string) => {
    setCandidates(prev => {
      const updated = prev.map(candidate =>
        candidate.id === candidateId
          ? { ...candidate, isFavorite: !candidate.isFavorite }
          : candidate
      );
      
      // Remove from favorites list if unfavorited
      return updated.filter(candidate => candidate.isFavorite);
    });
    
    const candidate = candidates.find(c => c.id === candidateId);
    if (candidate) {
      toast({
        title: "Removed from favorites",
        description: `${candidate.displayName} removed from your favorites.`,
      });
    }
  };

  const toggleSelect = (candidateId: string) => {
    setCandidates(prev => prev.map(candidate =>
      candidate.id === candidateId
        ? { ...candidate, isSelected: !candidate.isSelected }
        : candidate
    ));
  };

  const getSelectedCount = () => {
    return candidates.filter(c => c.isSelected).length;
  };

  const handleIntroduceMe = (candidate: Candidate) => {
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
    const selectedCandidates = candidates.filter(c => c.isSelected);
    if (selectedCandidates.length === 0) return;

    if (!user?.has_accepted_terms) {
      setShowTermsDialog(true);
      return;
    }

    selectedCandidates.forEach(candidate => {
      setPendingIntroductions(prev => [...prev, candidate.id]);
    });

    // Deselect all
    setCandidates(prev => prev.map(candidate => ({ ...candidate, isSelected: false })));
    setSelectMode(false);

    toast({
      title: "Introduction requests sent",
      description: `Sent introduction requests for ${selectedCandidates.length} candidates. You'll receive updates via email.`,
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

          {/* Selection Controls */}
          {candidates.length > 0 && (
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-4">
                <Button
                  variant={selectMode ? "default" : "outline"}
                  onClick={() => {
                    setSelectMode(!selectMode);
                    if (!selectMode) {
                      // Clear selections when entering select mode
                      setCandidates(prev => prev.map(c => ({ ...c, isSelected: false })));
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
                {candidates.length} favorite{candidates.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}

          {/* Candidates Grid */}
          {candidates.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Heart className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No favorite candidates yet</h3>
                <p className="text-gray-600 mb-4">
                  Start browsing candidates and add them to your favorites for easy access.
                </p>
                <Button onClick={() => window.location.href = '/candidate-search'}>
                  Browse Candidates
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {candidates.map((candidate) => (
                <Card
                  key={candidate.id}
                  className={`transition-all duration-200 hover:shadow-lg ring-2 ring-primary/20 bg-accent/50 ${
                    pendingIntroductions.includes(candidate.id) ? 'opacity-75 bg-muted/50' : ''
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-heading">{candidate.displayName}</CardTitle>
                        {user?.role === 'admin' && (
                          <p className="text-sm text-muted-foreground">{candidate.name}</p>
                        )}
                        <CardDescription className="text-primary font-medium">
                          {candidate.label}
                        </CardDescription>
                        <Badge variant="outline" className="mt-1 text-xs">
                          ID: {candidate.uniqueIdentifier}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        {selectMode && (
                          <Checkbox
                            checked={candidate.isSelected}
                            onCheckedChange={() => toggleSelect(candidate.id)}
                            disabled={!candidate.isSelected && getSelectedCount() >= 5}
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
                    <p className="text-sm text-gray-600">{candidate.description}</p>
                    
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
                      {candidate.skills.slice(0, 3).map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {candidate.skills.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{candidate.skills.length - 3} more
                        </Badge>
                      )}
                     </div>

                     {pendingIntroductions.includes(candidate.id) && (
                       <Badge variant="secondary" className="mb-2 bg-warning/10 text-warning border-warning/20">
                         Pending Introduction
                       </Badge>
                     )}

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
                        disabled={pendingIntroductions.includes(candidate.id)}
                        variant={pendingIntroductions.includes(candidate.id) ? "secondary" : "default"}
                        className="flex-1"
                      >
                        <Handshake className="mr-1 h-4 w-4" />
                        {pendingIntroductions.includes(candidate.id) ? 'Introduction Sent' : 'Introduce Me'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resume Preview Dialog */}
      <Dialog open={!!selectedCandidate} onOpenChange={() => setSelectedCandidate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="font-heading">{selectedCandidate?.displayName}</DialogTitle>
                {user?.role === 'admin' && (
                  <p className="text-sm text-muted-foreground">{selectedCandidate?.name}</p>
                )}
                <DialogDescription>{selectedCandidate?.label}</DialogDescription>
                <Badge variant="outline" className="mt-1 text-xs">
                  ID: {selectedCandidate?.uniqueIdentifier}
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
              <p className="text-sm text-gray-600">{selectedCandidate?.description}</p>
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
                  {selectedCandidate?.skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
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
