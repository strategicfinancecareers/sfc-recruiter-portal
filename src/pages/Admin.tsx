
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, Users, UserPlus, Eye, Settings, Mail } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  created_at: string;
  has_accepted_terms: boolean;
}

interface Candidate {
  id: string;
  name: string;
  display_name: string;
  email: string;
  label: string;
  profile_description?: string;
  location: string;
  experience: number;
  education: string;
  skills: Array<{ id: string; skill: string }>;
  open_to_opportunities: boolean;
  created_at: string;
  updated_at: string;
}

interface IntroductionRequest {
  id: string;
  recruiterId: string;
  recruiterName: string;
  candidateId: string;
  candidateName: string;
  candidateRole: string;
  status: 'pending' | 'accepted' | 'rejected';
  requestedAt: string;
  respondedAt?: string;
  emailSentAt?: string;
}


const mockIntroductions: IntroductionRequest[] = [
  {
    id: '1',
    recruiterId: '1',
    recruiterName: 'John Recruiter',
    candidateId: '1',
    candidateName: 'Sarah Johnson',
    candidateRole: 'Senior Full Stack Developer',
    status: 'accepted',
    requestedAt: '2024-01-15',
    respondedAt: '2024-01-16',
    emailSentAt: '2024-01-16',
  },
  {
    id: '2',
    recruiterId: '1',
    recruiterName: 'John Recruiter',
    candidateId: '2',
    candidateName: 'Michael Chen',
    candidateRole: 'DevOps Engineer',
    status: 'pending',
    requestedAt: '2024-01-14',
  },
];

const Admin = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [introductions, setIntroductions] = useState<IntroductionRequest[]>(mockIntroductions);
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state for candidate
  const [candidateForm, setCandidateForm] = useState({
    name: '',
    email: '',
    label: '',
    description: '',
    location: '',
    experience: '',
    education: '',
    skills: '',
    openToOpportunities: true,
  });

  // Fetch users and candidates data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch users with roles
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select(`
            *,
            roles(name)
          `);

        if (usersError) throw usersError;

        // Fetch candidates with skills
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
          `);

        if (candidatesError) throw candidatesError;

        // Transform users data
        const transformedUsers = usersData?.map(user => ({
          ...user,
          role: user.roles?.name || 'unknown'
        })) || [];

        // Transform candidates data to group skills
        const transformedCandidates = candidatesData?.map(candidate => ({
          ...candidate,
          skills: candidate.candidate_skills?.map((cs: any) => ({
            id: cs.skills.id,
            skill: cs.skills.skill
          })) || []
        })) || [];

        setUsers(transformedUsers);
        setCandidates(transformedCandidates);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "Error",
          description: "Failed to load admin data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  const resetCandidateForm = () => {
    setCandidateForm({
      name: '',
      email: '',
      label: '',
      description: '',
      location: '',
      experience: '',
      education: '',
      skills: '',
      openToOpportunities: true,
    });
    setEditingCandidate(null);
  };

  const handleOpenCandidateForm = (candidate?: Candidate) => {
    if (candidate) {
      setEditingCandidate(candidate);
      setCandidateForm({
        name: candidate.name,
        email: candidate.email,
        label: candidate.label,
        description: candidate.profile_description || '',
        location: candidate.location,
        experience: candidate.experience.toString(),
        education: candidate.education,
        skills: candidate.skills.map(s => s.skill).join(', '),
        openToOpportunities: candidate.open_to_opportunities,
      });
    } else {
      resetCandidateForm();
    }
    setShowCandidateForm(true);
  };

  const handleCandidateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // This is just for UI purposes - in a real app, you'd make API calls
    toast({
      title: "Feature not implemented",
      description: "Candidate editing requires backend API implementation",
      variant: "destructive",
    });
    
    setShowCandidateForm(false);
    resetCandidateForm();
  };

  const toggleCandidateOpportunities = (candidateId: string) => {
    setCandidates(prev => prev.map(candidate =>
      candidate.id === candidateId
        ? { 
            ...candidate, 
            open_to_opportunities: !candidate.open_to_opportunities,
            updated_at: new Date().toISOString()
          }
        : candidate
    ));
  };

  const deleteCandidate = (candidateId: string) => {
    setCandidates(prev => prev.filter(candidate => candidate.id !== candidateId));
    toast({
      title: "Candidate deleted",
      description: "Candidate has been removed from the system.",
    });
  };

  const toggleUserStatus = (userId: string) => {
    // This would require implementing a status field in the database
    toast({
      title: "Feature not implemented",
      description: "User status management requires additional database setup",
      variant: "destructive",
    });
  };

  const getStatusColor = (status: string | boolean) => {
    if (typeof status === 'boolean') {
      return status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    }
    switch (status) {
      case 'active':
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'inactive':
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="text-center">Loading admin data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Manage users, candidates, and system settings</p>
        </div>

        <Tabs defaultValue="candidates" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="candidates">Candidates</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="introductions">Introductions</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="candidates">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Candidate Management</h2>
                  <Button onClick={() => handleOpenCandidateForm()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Candidate
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {candidates.map((candidate) => (
                    <Card key={candidate.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{candidate.display_name}</CardTitle>
                            <p className="text-sm text-muted-foreground">Name: {candidate.name}</p>
                            <CardDescription className="text-primary font-medium">
                              {candidate.label}
                            </CardDescription>
                            <p className="text-sm text-muted-foreground mt-1">{candidate.email}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={getStatusColor(candidate.open_to_opportunities)}>
                              {candidate.open_to_opportunities ? 'Open to opportunities' : 'Not available'}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedCandidate(candidate)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenCandidateForm(candidate)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteCandidate(candidate.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                          <div>
                            <span className="text-sm font-medium">Location:</span>
                            <p className="text-sm text-gray-600">{candidate.location}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium">Experience:</span>
                            <p className="text-sm text-gray-600">{candidate.experience} years</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium">Education:</span>
                            <p className="text-sm text-gray-600">{candidate.education}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">Open to opportunities:</span>
                            <Switch
                              checked={candidate.open_to_opportunities}
                              onCheckedChange={() => toggleCandidateOpportunities(candidate.id)}
                            />
                          </div>
                        </div>
                        {candidate.profile_description && (
                          <p className="text-sm text-gray-600 mb-3">{candidate.profile_description}</p>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {candidate.skills.map((skill) => (
                            <Badge key={skill.id} variant="secondary" className="text-xs">
                              {skill.skill}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="users">
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">User Management</h2>
                
                <div className="grid grid-cols-1 gap-4">
                  {users.map((userItem) => (
                    <Card 
                      key={userItem.id} 
                      className={userItem.id === user?.id ? "border-primary bg-primary/5" : ""}
                    >
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">
                                {userItem.first_name} {userItem.last_name}
                              </h3>
                              {userItem.id === user?.id && (
                                <Badge variant="outline" className="text-xs">
                                  You
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{userItem.email}</p>
                            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                              <span>Role: {userItem.role}</span>
                              <span>Joined: {new Date(userItem.created_at).toLocaleDateString()}</span>
                              <span>Terms accepted: {userItem.has_accepted_terms ? 'Yes' : 'No'}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className="bg-green-100 text-green-800">
                              Active
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="introductions">
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Introduction Requests</h2>
                
                <div className="grid grid-cols-1 gap-4">
                  {introductions.map((intro) => (
                    <Card key={intro.id}>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold">{intro.candidateName}</h3>
                            <p className="text-sm text-blue-600">{intro.candidateRole}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              Requested by: {intro.recruiterName}
                            </p>
                            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                              <span>Requested: {new Date(intro.requestedAt).toLocaleDateString()}</span>
                              {intro.respondedAt && (
                                <span>Responded: {new Date(intro.respondedAt).toLocaleDateString()}</span>
                              )}
                              {intro.emailSentAt && (
                                <span>Email sent: {new Date(intro.emailSentAt).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge className={getStatusColor(intro.status)}>
                              {intro.status}
                            </Badge>
                            {intro.status === 'accepted' && !intro.emailSentAt && (
                              <Button size="sm" variant="outline">
                                <Mail className="mr-1 h-4 w-4" />
                                Send Intro Email
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">System Settings</h2>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Email Settings</CardTitle>
                    <CardDescription>Configure introduction email settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="ccEmail">CC Email Address</Label>
                      <Input
                        id="ccEmail"
                        type="email"
                        placeholder="zu@company.com"
                        defaultValue="zu@company.com"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Email address to CC on all introduction emails
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="emailTemplate">Introduction Email Template</Label>
                      <Textarea
                        id="emailTemplate"
                        rows={6}
                        defaultValue="Dear {candidate_name},

We have an exciting opportunity that might interest you. A recruiter from {company_name} would like to discuss the {job_title} position with you.

Job Description:
{job_description}

Are you interested in being introduced?

Best regards,
TalentConnect Team"
                      />
                    </div>
                    <Button>Save Email Settings</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Skills Management</CardTitle>
                    <CardDescription>Manage available skills for candidates</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label>Available Skills</Label>
                      <div className="flex flex-wrap gap-2">
                        {['React', 'Node.js', 'Python', 'Java', 'AWS', 'Docker', 'Kubernetes', 'TypeScript', 'Vue.js', 'Angular'].map((skill) => (
                          <Badge key={skill} variant="secondary" className="cursor-pointer">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex space-x-2 mt-4">
                        <Input placeholder="Add new skill" />
                        <Button>Add Skill</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Candidate Form Dialog */}
          <Dialog open={showCandidateForm} onOpenChange={setShowCandidateForm}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingCandidate ? 'Edit Candidate' : 'Add New Candidate'}</DialogTitle>
                <DialogDescription>
                  {editingCandidate ? 'Update candidate information' : 'Fill in the candidate details'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCandidateSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={candidateForm.name}
                      onChange={(e) => setCandidateForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={candidateForm.email}
                      onChange={(e) => setCandidateForm(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="label">Job Title/Label *</Label>
                  <Input
                    id="label"
                    value={candidateForm.label}
                    onChange={(e) => setCandidateForm(prev => ({ ...prev, label: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={candidateForm.description}
                    onChange={(e) => setCandidateForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="location">Location *</Label>
                    <Input
                      id="location"
                      value={candidateForm.location}
                      onChange={(e) => setCandidateForm(prev => ({ ...prev, location: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="experience">Years of Experience *</Label>
                    <Input
                      id="experience"
                      type="number"
                      value={candidateForm.experience}
                      onChange={(e) => setCandidateForm(prev => ({ ...prev, experience: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="education">Education Level *</Label>
                  <Select
                    value={candidateForm.education}
                    onValueChange={(value) => setCandidateForm(prev => ({ ...prev, education: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select education level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="High School">High School</SelectItem>
                      <SelectItem value="Associate">Associate</SelectItem>
                      <SelectItem value="Bachelor's">Bachelor's</SelectItem>
                      <SelectItem value="Master's">Master's</SelectItem>
                      <SelectItem value="PhD">PhD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="skills">Skills (comma-separated)</Label>
                  <Textarea
                    id="skills"
                    value={candidateForm.skills}
                    onChange={(e) => setCandidateForm(prev => ({ ...prev, skills: e.target.value }))}
                    placeholder="e.g., React, Node.js, TypeScript"
                    rows={2}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="openToOpportunities"
                    checked={candidateForm.openToOpportunities}
                    onCheckedChange={(checked) => setCandidateForm(prev => ({ ...prev, openToOpportunities: checked }))}
                  />
                  <Label htmlFor="openToOpportunities">Open to opportunities</Label>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowCandidateForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingCandidate ? 'Update Candidate' : 'Add Candidate'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Candidate Detail Dialog */}
          <Dialog open={!!selectedCandidate} onOpenChange={() => setSelectedCandidate(null)}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{selectedCandidate?.name}</DialogTitle>
                <DialogDescription>{selectedCandidate?.label}</DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-1">Email</h4>
                    <p className="text-sm text-gray-600">{selectedCandidate?.email}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Location</h4>
                    <p className="text-sm text-gray-600">{selectedCandidate?.location}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Experience</h4>
                    <p className="text-sm text-gray-600">{selectedCandidate?.experience} years</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Education</h4>
                    <p className="text-sm text-gray-600">{selectedCandidate?.education}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-sm text-gray-600">{selectedCandidate?.profile_description || 'No description available'}</p>
                </div>
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
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium mb-1">Created</h4>
                    <p className="text-gray-600">{selectedCandidate && new Date(selectedCandidate.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Last Updated</h4>
                    <p className="text-gray-600">{selectedCandidate && new Date(selectedCandidate.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
};

export default Admin;
