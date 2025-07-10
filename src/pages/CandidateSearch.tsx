import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Heart, Handshake, Search, Filter, MapPin, GraduationCap, Calendar, Eye, X } from "lucide-react";

import { useAuth } from "../contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import TermsDialog from "../components/TermsDialog";
import RedactedResume from "../components/RedactedResume";

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
  openToOpportunities: boolean;
  uniqueIdentifier: string;
}

// Generate anonymous candidate names based on their qualifications
const generateDisplayName = (candidate: any, index: number) => {
  const seniorityMap: { [key: number]: string } = {
    1: "Junior",
    2: "Junior",
    3: "Mid-level",
    4: "Mid-level", 
    5: "Senior",
    6: "Senior",
    7: "Lead",
    8: "Lead"
  };
  
  const seniority = seniorityMap[Math.min(candidate.experience, 8)] || "Senior";
  const primarySkill = candidate.skills[0] || "Tech";
  const locationCode = candidate.location.split(',')[1]?.trim().substring(0, 2) || candidate.location.substring(0, 2);
  
  return `${seniority} ${primarySkill} Professional (${locationCode})`;
};

const mockCandidates: Candidate[] = [
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
    isFavorite: false,
    isSelected: false,
    openToOpportunities: true,
    uniqueIdentifier: 'SR-REACT-SF-5Y'
  },
  {
    id: '2',
    name: 'Michael Chen',
    displayName: '',
    label: 'DevOps Engineer',
    description: 'Infrastructure expert with deep knowledge of cloud platforms and automation tools.',
    location: 'Seattle, WA',
    experience: 7,
    education: 'Master\'s',
    skills: ['Kubernetes', 'Docker', 'AWS', 'Terraform'],
    isFavorite: false,
    isSelected: false,
    openToOpportunities: true,
    uniqueIdentifier: 'LD-K8S-WA-7Y'
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
    isFavorite: false,
    isSelected: false,
    openToOpportunities: true,
    uniqueIdentifier: 'ML-FIGMA-TX-4Y'
  },
  {
    id: '4',
    name: 'David Kim',
    displayName: '',
    label: 'Data Scientist',
    description: 'Analytics expert with expertise in machine learning and statistical modeling for business insights.',
    location: 'New York, NY',
    experience: 6,
    education: 'PhD',
    skills: ['Python', 'Machine Learning', 'SQL', 'Tableau'],
    isFavorite: false,
    isSelected: false,
    openToOpportunities: true,
    uniqueIdentifier: 'SR-PYTHON-NY-6Y'
  },
].map((candidate, index) => ({
  ...candidate,
  displayName: generateDisplayName(candidate, index)
}));

const CandidateSearch = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [candidates, setCandidates] = useState<Candidate[]>(mockCandidates);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>(mockCandidates);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [pendingIntroductions, setPendingIntroductions] = useState<string[]>([]);

  // Filters
  const [experienceFilter, setExperienceFilter] = useState('');
  const [educationFilter, setEducationFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [skillsFilter, setSkillsFilter] = useState('');

  useEffect(() => {
    let filtered = candidates.filter(candidate => candidate.openToOpportunities);

    if (searchTerm) {
      filtered = filtered.filter(candidate =>
        candidate.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        candidate.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase())) ||
        candidate.uniqueIdentifier.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (experienceFilter && experienceFilter !== 'any') {
      const minExp = parseInt(experienceFilter);
      filtered = filtered.filter(candidate => candidate.experience >= minExp);
    }

    if (educationFilter && educationFilter !== 'any') {
      filtered = filtered.filter(candidate => candidate.education === educationFilter);
    }

    if (locationFilter) {
      filtered = filtered.filter(candidate =>
        candidate.location.toLowerCase().includes(locationFilter.toLowerCase())
      );
    }

    if (skillsFilter) {
      filtered = filtered.filter(candidate =>
        candidate.skills.some(skill => skill.toLowerCase().includes(skillsFilter.toLowerCase()))
      );
    }

    setFilteredCandidates(filtered);
  }, [candidates, searchTerm, experienceFilter, educationFilter, locationFilter, skillsFilter]);

  const toggleFavorite = (candidateId: string) => {
    setCandidates(prev => prev.map(candidate =>
      candidate.id === candidateId
        ? { ...candidate, isFavorite: !candidate.isFavorite }
        : candidate
    ));
    
    const candidate = candidates.find(c => c.id === candidateId);
    if (candidate) {
      toast({
        title: candidate.isFavorite ? "Removed from favorites" : "Added to favorites",
        description: `${candidate.displayName} ${candidate.isFavorite ? 'removed from' : 'added to'} your favorites.`,
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
    if (!user?.hasAcceptedTerms) {
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

    if (!user?.hasAcceptedTerms) {
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
                  placeholder="Search candidates by role, skills, or identifier..."
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
                      <SelectItem value="Bachelor's">Bachelor's</SelectItem>
                      <SelectItem value="Master's">Master's</SelectItem>
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

          {/* Selection Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
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
            <div className="text-sm text-muted-foreground">
              {filteredCandidates.length} candidates found
            </div>
          </div>

          {/* Candidates Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCandidates.map((candidate) => (
              <Card
                key={candidate.id}
                className={`transition-all duration-200 hover:shadow-lg ${
                  candidate.isFavorite ? 'ring-2 ring-primary/20 bg-accent/50' : ''
                } ${
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
                        className={candidate.isFavorite ? 'text-destructive' : 'text-muted-foreground'}
                      >
                        <Heart className={`h-4 w-4 ${candidate.isFavorite ? 'fill-current' : ''}`} />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{candidate.description}</p>
                  
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

          {filteredCandidates.length === 0 && (
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
            <DialogTitle className="font-heading">{selectedCandidate?.displayName}</DialogTitle>
            {user?.role === 'admin' && (
              <p className="text-sm text-muted-foreground">{selectedCandidate?.name}</p>
            )}
            <DialogDescription>{selectedCandidate?.label}</DialogDescription>
            <Badge variant="outline" className="mt-1 text-xs w-fit">
              ID: {selectedCandidate?.uniqueIdentifier}
            </Badge>
          </DialogHeader>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Profile Details */}
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Professional Summary</h4>
                <p className="text-sm text-muted-foreground">{selectedCandidate?.description}</p>
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
            
            {/* Right Column - Redacted Resume */}
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Resume Preview</h4>
                <div className="border rounded-lg max-h-96 overflow-y-auto bg-background">
                  {selectedCandidate && (
                    <RedactedResume 
                      candidate={{
                        displayName: selectedCandidate.displayName,
                        label: selectedCandidate.label,
                        location: selectedCandidate.location,
                        experience: selectedCandidate.experience,
                        education: selectedCandidate.education,
                        skills: selectedCandidate.skills
                      }} 
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
};

export default CandidateSearch;