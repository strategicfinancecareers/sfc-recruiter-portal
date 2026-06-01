import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Heart, Handshake, Search, Filter, MapPin, GraduationCap, Calendar, Eye, Loader2, LayoutGrid, LayoutList, Shield, ChevronDown, ChevronUp } from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import TermsDialog from "../components/TermsDialog";
import LoaderScreen from "../components/LoaderScreen";
import PricingModal from "../components/PricingModal";
import { useCandidates, type Candidate } from "../hooks/useCandidates";
import { supabase } from "@/integrations/supabase/client";
import { JobForm } from "@/components/JobForm";
import AnonymousCandidateCard from "@/components/AnonymousCandidateCard";

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
  if (l.includes('private equity') || l.includes('venture') || /\bpe\b/.test(l) || /\bvc\b/.test(l)) return '#008037';
  if (l.includes('investment banking') || l.includes('banking')) return '#1e40af';
  if (l.includes('fp&a') || l.includes('fpa') || l.includes('finance')) return '#6d28d9';
  return '#6b7280';
}

export default function CandidateSearch() {
  const { user } = useAuth();
  const { toast } = useToast();
  // Admins/owners need the real `name` for the admin-only subtitle
  // under each candidate card. Recruiters do NOT receive `name` in the
  // hook payload — the SFC Take is server-side name-scrubbed at
  // generation + publish so no client-side scrub needs it.
  const { candidates, loading, toggleFavorite } = useCandidates({
    includeName: user?.role === 'admin' || user?.role === 'owner',
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [pendingIntroductions, setPendingIntroductions] = useState<string[]>([]);
  const [completedIntroductions, setCompletedIntroductions] = useState<string[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  // Per-card "Read more" expansion for the SFC Take preview (Batch 2).
  const [expandedTakes, setExpandedTakes] = useState<Set<string>>(new Set());
  const [showJobSelectionDialog, setShowJobSelectionDialog] = useState(false);
  const [currentCandidateForIntro, setCurrentCandidateForIntro] = useState<Candidate | null>(null);
  const [userJobs, setUserJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [showAdminWarningDialog, setShowAdminWarningDialog] = useState(false);
  const [isSubmittingIntro, setIsSubmittingIntro] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);

  // Profile dialog extras
  const [showFullBio, setShowFullBio] = useState(false);
  const [insightBullets, setInsightBullets] = useState<string[]>([]);
  const [insightLoading, setInsightLoading] = useState(false);
  const insightCache = useRef<Map<string, string[]>>(new Map());

  // Check ?subscribed=true after Stripe redirect
  useEffect(() => {
    if (searchParams.get('subscribed') === 'true') {
      toast({
        title: '🎉 Welcome to SFC Talent!',
        description: 'Your membership is active. You can now request introductions.',
      });
      setIsSubscribed(true);
      setSearchParams({}, { replace: true });
    }
  }, []);

  // Fetch fresh subscription status from DB
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('users')
      .select('is_subscribed')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.is_subscribed) setIsSubscribed(true);
      });
  }, [user?.id]);

  // Generate AI insight when profile dialog opens
  useEffect(() => {
    if (!selectedCandidate) { setInsightBullets([]); setShowFullBio(false); return; }
    const cached = insightCache.current.get(selectedCandidate.id);
    if (cached) { setInsightBullets(cached); return; }
    setInsightBullets([]);
    setInsightLoading(true);
    const bio = selectedCandidate.profile_description?.split('\n\n')[0] || '';
    fetch('/api/generate-candidate-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: selectedCandidate.label,
        bio,
        skills: selectedCandidate.skills.map(s => s.skill),
        experience: selectedCandidate.experience,
        education: selectedCandidate.education,
      }),
    })
      .then(r => r.json())
      .then(data => {
        const bullets = data.bullets || [];
        insightCache.current.set(selectedCandidate.id, bullets);
        setInsightBullets(bullets);
      })
      .catch(() => setInsightBullets([]))
      .finally(() => setInsightLoading(false));
  }, [selectedCandidate?.id]);

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

  // Fetch introduction statuses for current user — routed through service-role API to bypass RLS
  useEffect(() => {
    const fetchStatuses = async () => {
      if (!user?.id || candidates.length === 0) {
        setPendingIntroductions([]);
        setCompletedIntroductions([]);
        return;
      }
      try {
        const candidateIds = candidates.map(c => c.id).join(',');
        const res = await fetch(
          `/api/intro-statuses?requesterId=${encodeURIComponent(user.id)}&candidateIds=${encodeURIComponent(candidateIds)}`
        );
        if (!res.ok) throw new Error(`intro-statuses returned ${res.status}`);
        const { statuses } = await res.json();

        const pending = (statuses || []).filter((r: any) => r.status === 'pending').map((r: any) => r.candidate_id);
        const completed = (statuses || []).filter((r: any) => r.status === 'approved' || r.status === 'rejected').map((r: any) => r.candidate_id);

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
    // Admins can't request intros
    if (user?.role === 'admin') {
      setShowAdminWarningDialog(true);
      return;
    }

    // Terms check
    if (!user?.has_accepted_terms) {
      setShowTermsDialog(true);
      setCurrentCandidateForIntro(candidate);
      return;
    }

    // Subscription check — show pricing modal if not subscribed
    if (!isSubscribed) {
      setCurrentCandidateForIntro(candidate);
      setShowPricingModal(true);
      return;
    }

    // Subscribed — go straight to job selection
    setCurrentCandidateForIntro(candidate);
    setShowJobSelectionDialog(true);
  };

  const handleTermsAccepted = () => {
    setShowTermsDialog(false);
    if (currentCandidateForIntro) {
      if (!isSubscribed) {
        setShowPricingModal(true);
      } else {
        setShowJobSelectionDialog(true);
      }
    }
  };

  const submitIntroductionRequest = async () => {
    if (!currentCandidateForIntro || !user?.id || !selectedJobId) return;

    setIsSubmittingIntro(true);

    try {
      // Route through serverless function to bypass RLS on introduction_requests
      const response = await fetch('/api/submit-intro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester_id: user.id,
          candidate_id: currentCandidateForIntro.id,
          job_id: selectedJobId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to submit introduction request');

      console.log('[submitIntro] success — introId:', data.introId);

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
        onOpenChange={(open) => { setShowTermsDialog(open); }}
        onAccept={handleTermsAccepted}
      />

      <PricingModal
        open={showPricingModal}
        onOpenChange={(open) => {
          setShowPricingModal(open);
          if (!open) setCurrentCandidateForIntro(null);
        }}
        userId={user?.id}
        userEmail={user?.email}
      />
      
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6">
          {/* Free-mode banner */}
          {!isSubscribed && user?.role !== 'admin' && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span>🔓 You're browsing in free mode. Subscribe to request introductions.</span>
              <button
                onClick={() => setShowPricingModal(true)}
                className="font-semibold underline underline-offset-2 hover:text-amber-900 whitespace-nowrap"
              >
                Subscribe Now
              </button>
            </div>
          )}

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
              {filteredCandidates.map((candidate, idx) => {
                const locked = !isSubscribed && user?.role !== 'admin' && idx >= 6;
                return locked ? (
                  <div key={candidate.id} className="relative">
                    <Card className="h-full flex flex-col pointer-events-none select-none" style={{ filter: 'blur(4px)' }}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <CardTitle className="text-lg font-heading">{candidate.display_name}</CardTitle>
                            <CardDescription className="text-primary font-medium">{candidate.label}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 flex flex-col h-full">
                        <p className="text-sm text-muted-foreground line-clamp-2">{candidate.profile_description}</p>
                        <div className="flex flex-wrap gap-1">
                          {candidate.skills.slice(0, 3).map(s => (
                            <Badge key={s.id} variant="secondary" className="text-xs">{s.skill}</Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 text-center shadow-lg border border-gray-200 max-w-[85%]">
                        <div className="text-2xl mb-1">🔒</div>
                        <p className="text-xs font-semibold text-gray-700 leading-snug">Subscribe to unlock</p>
                      </div>
                    </div>
                  </div>
                ) : (
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

                    {/* SFC Take preview — Batch 2. Only renders when admin has
                        explicitly published. Anonymity is preserved
                        SERVER-SIDE: api/generate-sfc-take and
                        api/publish-sfc-take run the real-name scrub
                        before writing, so the stored take never
                        contains the candidate's real name. The
                        previous client-side scrub required shipping
                        `name` to recruiter browsers — that exposure
                        is now closed; useCandidates only includes
                        `name` for admin/owner callers, and recruiters
                        render the take as-is. */}
                    {candidate.sfc_take_published_at && candidate.sfc_take && (() => {
                      const safe = candidate.sfc_take;
                      const isExpanded = expandedTakes.has(candidate.id);
                      const TRUNCATE = 80;
                      const isLong = safe.length > TRUNCATE;
                      const display = isExpanded || !isLong ? safe : safe.slice(0, TRUNCATE).trimEnd() + '…';
                      return (
                        <div className="border-t pt-3 mt-1">
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-[#006a2d] italic mb-1.5">SFC Take</p>
                          <p className="text-xs text-foreground leading-relaxed">
                            {display}
                            {isLong && (
                              <button
                                type="button"
                                onClick={() => setExpandedTakes(prev => {
                                  const next = new Set(prev);
                                  if (isExpanded) next.delete(candidate.id); else next.add(candidate.id);
                                  return next;
                                })}
                                className="ml-1 text-[#006a2d] hover:underline font-medium"
                              >
                                {isExpanded ? 'Show less' : 'Read more'}
                              </button>
                            )}
                          </p>
                          {candidate.sfc_role_fit && candidate.sfc_role_fit.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {candidate.sfc_role_fit.map((rf, i) => (
                                <Badge key={`${rf}-${i}`} variant="outline" className="text-[10px] border-[#008037]/25 bg-[#008037]/5 text-[#005a26]">
                                  {rf}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

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
                );
              })}
              {/* Unlock wall — shown after 6th card for unsubscribed */}
              {!isSubscribed && user?.role !== 'admin' && filteredCandidates.length > 6 && (
                <div className="col-span-full mt-2 flex flex-col items-center justify-center py-10 px-6 bg-white border border-gray-200 rounded-2xl text-center shadow-sm">
                  <div className="text-3xl mb-3">🔒</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Unlock the Full Talent Network</h3>
                  <p className="text-sm text-gray-500 mb-4 max-w-xs">Subscribe to see all candidates and request introductions</p>
                  <Button className="bg-[#008037] hover:bg-[#006a2d] text-white px-6" onClick={() => setShowPricingModal(true)}>
                    View Pricing
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Candidates List */}
          {!loading && viewMode === 'list' && (
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              {filteredCandidates.map((candidate, idx) => {
                const locked = !isSubscribed && user?.role !== 'admin' && idx >= 6;
                return locked ? (
                  <div key={candidate.id} className="relative border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center gap-4 px-5 py-4 pointer-events-none select-none" style={{ filter: 'blur(4px)' }}>
                      <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white bg-gray-400">
                        {getInitials(candidate.label)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-gray-900 text-sm">{candidate.display_name}</span>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {candidate.skills.slice(0, 3).map(s => (
                            <Badge key={s.id} variant="secondary" className="text-xs px-1.5 py-0">{s.skill}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white/90 backdrop-blur-sm rounded-xl px-4 py-2 shadow border border-gray-200 flex items-center gap-2">
                        <span>🔒</span>
                        <span className="text-xs font-semibold text-gray-700">Subscribe to unlock</span>
                      </div>
                    </div>
                  </div>
                ) : (
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
                      <Badge className="text-xs bg-[#008037]/5 text-[#006a2d] border border-[#008037]/25 hover:bg-[#008037]/5 font-normal">
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
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedCandidate(candidate)}
                      className="whitespace-nowrap"
                    >
                      <Eye className="mr-1.5 h-4 w-4" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleIntroduceMe(candidate)}
                      disabled={pendingIntroductions.includes(candidate.id) || completedIntroductions.includes(candidate.id)}
                      variant={(pendingIntroductions.includes(candidate.id) || completedIntroductions.includes(candidate.id)) ? "secondary" : "default"}
                      className="whitespace-nowrap bg-[#008037] hover:bg-[#006a2d] text-white"
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
                );
              })}
              {/* Unlock wall for list view */}
              {!isSubscribed && user?.role !== 'admin' && filteredCandidates.length > 6 && (
                <div className="flex flex-col items-center justify-center py-10 px-6 text-center border-t border-gray-100">
                  <div className="text-3xl mb-3">🔒</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Unlock the Full Talent Network</h3>
                  <p className="text-sm text-gray-500 mb-4 max-w-xs">Subscribe to see all candidates and request introductions</p>
                  <Button className="bg-[#008037] hover:bg-[#006a2d] text-white px-6" onClick={() => setShowPricingModal(true)}>
                    View Pricing
                  </Button>
                </div>
              )}
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

      {/* Profile Dialog — now rendered via shared AnonymousCandidateCard. */}
      <Dialog open={!!selectedCandidate} onOpenChange={() => setSelectedCandidate(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
          {selectedCandidate && (() => {
            const c = selectedCandidate;
            const pending = pendingIntroductions.includes(c.id);
            const complete = completedIntroductions.includes(c.id);
            return (
              <AnonymousCandidateCard
                candidate={c}
                mode="recruiter"
                insightBullets={insightBullets}
                insightLoading={insightLoading}
                isAdmin={user?.role === 'admin'}
                introCtaDisabled={pending || complete}
                introCtaLabel={pending ? 'Intro Requested' : complete ? 'Intro Complete' : 'Request Introduction'}
                showSubscribeHint={!isSubscribed && user?.role !== 'admin'}
                onRequestIntro={() => { setSelectedCandidate(null); handleIntroduceMe(c); }}
              />
            );
          })()}
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