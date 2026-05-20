import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Heart, Handshake, Search, Filter, MapPin, GraduationCap, Calendar, Eye, Loader2, LayoutGrid, LayoutList } from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import TermsDialog from "../components/TermsDialog";
import LoaderScreen from "../components/LoaderScreen";
import RedactedResume from "../components/RedactedResume";
import { useCandidates, type Candidate } from "../hooks/useCandidates";
import { supabase } from "@/integrations/supabase/client";
import { JobForm } from "@/components/JobForm";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: 'full-time' | 'part-time' | 'contract' | 'remote';
  salary_range: string | null;
  description: string | null;
  requirements: string | null;
  created_at: string;
  status: 'active' | 'paused' | 'closed';
  user_id: string;
}

function getInitials(label: string): string {
  const words = label.trim().split(/\s+/);
  if (words.length === 1) return words[0].replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
  if (words[0].length <= 5 || words[0].includes('&')) return words[0].replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function getLabelColor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('private equity') || l.includes('venture') || /\bpe\b/.test(l) || /\bvc\b/.test(l)) return '#0F6E56';
  if (l.includes('investment banking') || l.includes('banking')) return '#1e40af';
  if (l.includes('fp&a') || l.includes('fpa') || l.includes('finance')) return '#6d28d9';
  return '#6b7280';
}

export default function CandidateSearch() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { candidates, loading, toggleFavorite } = useCandidates();
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [pendingIntroductions, setPendingIntroductions] = useState<string[]>([]);
  const [completedIntroductions, setCompletedIntroductions] = useState<string[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [showJobSelectionDialog, setShowJobSelectionDialog] = useState(false);
  const [currentCandidateForIntro, setCurrentCandidateForIntro] = useState<Candidate | null>(null);
  const [userJobs, setUserJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [showAdminWarningDialog, setShowAdminWarningDialog] = useState(false);
  const [isSubmittingIntro, setIsSubmittingIntro] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filters
  const [experienceFilter, setExperienceFilter] = useState('');
  const [educationFilter, setEducationFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [skillsFilter, setSkillsFilter] = useState('');

  // Fetch user's jobs
  const fetchUserJobs = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserJobs((data as Job[]) || []);
    } catch (error) {
      console.error('Error fetching user jobs:', error);
    }
  };

  const handleJobCreated = (newJob: Job) => {
    setUserJobs(prev => [newJob, ...prev]);
    setSelectedJobId(newJob.id);
    setShowJobForm(false);
  };

  useEffect(() => {
    fetchUserJobs();
  }, [user?.id]);

  useEffect(() => {
    let filtered = candidates.filter(() => true); // All candidates are "open to opportunities"

    if (searchTerm) {
      filtered = filtered.filter(candidate =>
        candidate.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.skills.some(skill => skill.skill.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (experienceFilter && experienceFilter !== 'any') {
      const minExp = parseInt(experienceFilter);
      filtered = filtered.filter(candidate => candidate.experience >= minExp);
    }

    if (educationFilter && educationFilter !== 'any') {
      filtered = filtered.filter(candidate => candidate.education.includes(educationFilter));
    }

    if (locationFilter) {
      filtered = filtered.filter(candidate =>
        candidate.location.toLowerCase().includes(locationFilter.toLowerCase())
      );
    }

    if (skillsFilter) {
      filtered = filtered.filter(candidate =>
        candidate.skills.some(skill => skill.skill.toLowerCase().includes(skillsFilter.toLowerCase()))
      );
    }

    setFilteredCandidates(filtered);
  }, [candidates, searchTerm, experienceFilter, educationFilter, locationFilter, skillsFilter]);

  // Fetch introduction statuses for current user
  useEffect(() => {
    const fetchStatuses = async () => {
      if (!user?.id || candidates.length === 0) {
        setPendingIntroductions([]);
        setCompletedIntroductions([]);
        return;
      }
      try {
        const candidateIds = candidates.map(c => c.id);
        const { data, error } = await supabase
          .from('introduction_requests')
          .select('candidate_id, status')
          .in('candidate_id', candidateIds)
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
  }, [user?.id, candidates]);

  const toggleSelect = (candidateId: string) => {
    setSelectedCandidates(prev => 
      prev.includes(candidateId)
        ? prev.filter(id => id !== candidateId)
        : [...prev, candidateId]
    );
  };

  const getSelectedCount = () => {
    return selectedCandidates.length;
  };

  const handleIntroduceMe = (candidate: Candidate) => {
    // Check if user is admin
    if (user?.role === 'admin') {
      setShowAdminWarningDialog(true);
      return;
    }

    if (!user?.has_accepted_terms) {
      setShowTermsDialog(true);
      setCurrentCandidateForIntro(candidate);
      return;
    }
    
    // Show job selection dialog
    setCurrentCandidateForIntro(candidate);
    setShowJobSelectionDialog(true);
  };

  const handleTermsAccepted = () => {
    setShowTermsDialog(false);
    if (currentCandidateForIntro) {
      setShowJobSelectionDialog(true);
    }
  };

  const submitIntroductionRequest = async () => {
    if (!currentCandidateForIntro || !user?.id || !selectedJobId) return;

    setIsSubmittingIntro(true);
    
    try {
      const requestData = {
        requester_id: user.id,
        candidate_id: currentCandidateForIntro.id,
        job_id: selectedJobId,
        status: 'pending'
      };

const { data: inserted, error } = await supabase
        .from('introduction_requests')
        .insert(requestData)
        .select('id')
        .single();

      if (error) throw error;

      // Fire-and-forget notification to opted-in admins
      try {
        await supabase.functions.invoke('notify-intro-created', {
          body: { request_id: inserted?.id },
        });
      } catch (fnErr) {
        console.error('notify-intro-created error:', fnErr);
      }

      // Add to pending introductions
      setPendingIntroductions(prev => [...prev, currentCandidateForIntro.id]);
      
      // Reset states
      setShowJobSelectionDialog(false);
      setCurrentCandidateForIntro(null);
      setSelectedJobId('');
      
      toast({
        title: "Introduction request sent",
        description: "Thank you for your interest. Please give us 24-48 hours to connect with the candidate and see their interest in this role. We will email you once the candidate has accepted or rejected.",
      });
    } catch (error) {
      console.error('Error submitting introduction request:', error);
      toast({
        title: "Error",
        description: "Failed to submit introduction request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingIntro(false);
    }
  };

  const handleBulkIntroduce = () => {
    if (selectedCandidates.length === 0) return;

    if (!user?.has_accepted_terms) {
      setShowTermsDialog(true);
      return;
    }

    selectedCandidates.forEach(candidateId => {
      setPendingIntroductions(prev => [...prev, candidateId]);
    });

    // Clear selections
    setSelectedCandidates([]);
    setSelectMode(false);

    toast({
      title: "Introduction requests sent",
      description: `Sent introduction requests for ${selectedCandidates.length} candidates. You'll receive updates via email.`,
    });
  };

  const clearFilters = () => {
    setSearchTerm('');
    setExperienceFilter('');
    setEducationFilter('');
    setLocationFilter('');
    setSkillsFilter('');
  };


  return (
    <>
      <TermsDialog 
        open={showTermsDialog} 
        onOpenChange={(open) => {
          setShowTermsDialog(open);
        }}
        onAccept={handleTermsAccepted}
      />
      
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold font-heading text-foreground">Browse Candidates</h1>
            <p className="text-muted-foreground">Discover and connect with top talent</p>
          </div>

          {/* Search and Filters */}
          <div className="bg-card rounded-lg shadow-sm border p-4 sm:p-6 mb-6">
            <div className="flex flex-col lg:flex-row gap-4 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search candidates by role, skills..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="whitespace-nowrap"
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
              {(searchTerm || experienceFilter || educationFilter || locationFilter || skillsFilter) && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
                <div>
                  <label className="text-sm font-medium mb-2 block">Min Experience</label>
                  <Select value={experienceFilter} onValueChange={setExperienceFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="1">1+ years</SelectItem>
                      <SelectItem value="3">3+ years</SelectItem>
                      <SelectItem value="5">5+ years</SelectItem>
                      <SelectItem value="7">7+ years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Education</label>
                  <Select value={educationFilter} onValueChange={setEducationFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="Bachelor">Bachelor's</SelectItem>
                      <SelectItem value="Master">Master's</SelectItem>
                      <SelectItem value="PhD">PhD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Location</label>
                  <Input
                    placeholder="City, State"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Skills</label>
                  <Input
                    placeholder="Enter skill"
                    value={skillsFilter}
                    onChange={(e) => setSkillsFilter(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Loading State */}
          {loading && <LoaderScreen />}

          {/* Selection Controls */}
          {!loading && <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div className="flex items-center space-x-4">
              <Button
                variant={selectMode ? "default" : "outline"}
                onClick={() => {
                  setSelectMode(!selectMode);
                  if (!selectMode) {
                    setSelectedCandidates([]);
                  }
                }}
              >
                {selectMode ? 'Cancel Selection' : 'Select Candidates'}
              </Button>
              {selectMode && (
                <>
                  <span className="text-sm text-muted-foreground">
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
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {filteredCandidates.length} candidates found
              </span>
              <div className="flex items-center border rounded-md overflow-hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={`rounded-none px-2 h-8 ${viewMode === 'grid' ? 'bg-accent' : ''}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={`rounded-none px-2 h-8 ${viewMode === 'list' ? 'bg-accent' : ''}`}
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          }

          {/* Candidates Grid */}
          {!loading && viewMode === 'grid' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredCandidates.map((candidate) => (
                <Card
                  key={candidate.id}
                  className={`transition-all duration-200 hover:shadow-lg h-full flex flex-col ${
                    candidate.is_favorite ? 'ring-2 ring-primary/20 bg-accent/50' : ''
                  } ${
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
                      </div>
                      <div className="flex items-center space-x-2">
                        {selectMode && (
                          <Checkbox
                            checked={selectedCandidates.includes(candidate.id)}
                            onCheckedChange={() => toggleSelect(candidate.id)}
                            disabled={!selectedCandidates.includes(candidate.id) && getSelectedCount() >= 5}
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFavorite(candidate.id)}
                          className={candidate.is_favorite ? 'text-destructive' : 'text-muted-foreground'}
                        >
                          <Heart className={`h-4 w-4 ${candidate.is_favorite ? 'fill-current' : ''}`} />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 flex flex-col h-full">
                    {candidate.profile_description && (
                      <p className="text-sm text-muted-foreground">{candidate.profile_description}</p>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 mr-1" />
                        {candidate.location}
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 mr-1" />
                        {candidate.experience} years experience
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <GraduationCap className="h-4 w-4 mr-1" />
                        {candidate.education}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {candidate.skills.slice(0, 3).map((skill) => (
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
                    <div className="flex space-x-2 pt-2 mt-auto">
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
                          ? 'Intro Requested'
                          : completedIntroductions.includes(candidate.id)
                            ? 'Intro Complete'
                            : 'Introduce Me'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Candidates List */}
          {!loading && viewMode === 'list' && (
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              {filteredCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                    (pendingIntroductions.includes(candidate.id) || completedIntroductions.includes(candidate.id)) ? 'opacity-60' : ''
                  }`}
                >
                  {/* Initials circle */}
                  <div
                    className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: getLabelColor(candidate.label) }}
                  >
                    {getInitials(candidate.label)}
                  </div>

                  {/* Middle section */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-gray-900 text-sm">{candidate.display_name}</span>
                      <Badge className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 font-normal">
                        {candidate.label}
                      </Badge>
                    </div>
                    {candidate.profile_description && (
                      <p className="text-xs text-gray-500 truncate mb-1">{candidate.profile_description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1 mb-1">
                      {candidate.skills.slice(0, 4).map((skill) => (
                        <Badge key={skill.id} variant="secondary" className="text-xs px-1.5 py-0 font-normal">
                          {skill.skill}
                        </Badge>
                      ))}
                      {candidate.skills.length > 4 && (
                        <span className="text-xs text-gray-400">+{candidate.skills.length - 4} more</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <span>{candidate.location}</span>
                      <span>·</span>
                      <span>{candidate.experience} yrs exp</span>
                      <span>·</span>
                      <span>{candidate.education}</span>
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFavorite(candidate.id)}
                      className={candidate.is_favorite ? 'text-destructive' : 'text-muted-foreground'}
                    >
                      <Heart className={`h-4 w-4 ${candidate.is_favorite ? 'fill-current' : ''}`} />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleIntroduceMe(candidate)}
                      disabled={pendingIntroductions.includes(candidate.id) || completedIntroductions.includes(candidate.id)}
                      variant={(pendingIntroductions.includes(candidate.id) || completedIntroductions.includes(candidate.id)) ? "secondary" : "default"}
                      className="whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Handshake className="mr-1.5 h-4 w-4" />
                      {pendingIntroductions.includes(candidate.id)
                        ? 'Intro Requested'
                        : completedIntroductions.includes(candidate.id)
                          ? 'Intro Complete'
                          : 'Request Introduction'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && filteredCandidates.length === 0 && (
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-4">
                <Search className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No candidates found</h3>
              <p className="text-muted-foreground">Try adjusting your search criteria or filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* Profile Preview Dialog */}
      <Dialog open={!!selectedCandidate} onOpenChange={() => setSelectedCandidate(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{selectedCandidate?.display_name}</DialogTitle>
            {user?.role === 'admin' && (
              <p className="text-sm text-muted-foreground">{selectedCandidate?.name}</p>
            )}
            <DialogDescription>{selectedCandidate?.label}</DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Profile Details */}
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Professional Summary</h4>
                <p className="text-sm text-muted-foreground">{selectedCandidate?.profile_description}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Location</h4>
                  <p className="text-sm text-muted-foreground">{selectedCandidate?.location}</p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Experience</h4>
                  <p className="text-sm text-muted-foreground">{selectedCandidate?.experience} years</p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Education</h4>
                  <p className="text-sm text-muted-foreground">{selectedCandidate?.education}</p>
                </div>
                {selectedCandidate?.highest_education_level && (
                  <div>
                    <h4 className="font-medium mb-2">Education Level</h4>
                    <p className="text-sm text-muted-foreground">{selectedCandidate.highest_education_level}</p>
                  </div>
                )}
                <div>
                  <h4 className="font-medium mb-2">Skills</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedCandidate?.skills.map((skill) => (
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
            
            {/* Right Column - Redacted Resume */}
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Resume Preview</h4>
                <div className="border rounded-lg max-h-96 overflow-y-auto bg-background">
                  {selectedCandidate && (
                    <RedactedResume 
                      candidate={{
                        displayName: selectedCandidate.display_name,
                        label: selectedCandidate.label,
                        location: selectedCandidate.location,
                        experience: selectedCandidate.experience,
                        education: selectedCandidate.education,
                        skills: selectedCandidate.skills.map(skill => skill.skill)
                      }} 
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Warning Dialog */}
      <Dialog open={showAdminWarningDialog} onOpenChange={setShowAdminWarningDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot Request Introductions</DialogTitle>
            <DialogDescription>
              You are an admin, you cannot request introductions
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowAdminWarningDialog(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Selection Dialog */}
      <Dialog open={showJobSelectionDialog} onOpenChange={(open) => {
        if (!open) {
          setShowJobSelectionDialog(false);
          setCurrentCandidateForIntro(null);
          setSelectedJobId('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Job Position</DialogTitle>
            {userJobs.length > 0 && (
              <DialogDescription>
                Choose which job position you want to introduce {currentCandidateForIntro?.display_name} for.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-4">
            {userJobs.length === 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You don't have any active job postings.
                </p>
                <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
                  <p className="text-sm text-destructive">
                    A job must be selected in order to request an introduction.
                  </p>
                </div>
                <Button 
                  onClick={() => setShowJobForm(true)}
                  className="w-full"
                >
                  Add New Job
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="job-select">Job Position</Label>
                  <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a job position" />
                    </SelectTrigger>
                    <SelectContent>
                      {userJobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.title} - {job.company}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!selectedJobId && (
                  <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
                    <p className="text-sm text-destructive">
                      A job must be selected in order to request an introduction.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowJobSelectionDialog(false);
                setCurrentCandidateForIntro(null);
                setSelectedJobId('');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => submitIntroductionRequest()}
              disabled={!selectedJobId || isSubmittingIntro}
            >
              {isSubmittingIntro ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Send Introduction Request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Form Dialog */}
      <JobForm
        open={showJobForm}
        onOpenChange={setShowJobForm}
        onJobCreated={handleJobCreated}
      />
    </>
  );
}