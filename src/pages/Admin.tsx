
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, Users, UserPlus, Eye, Settings, Mail, UserX, X } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  role_id: string;
  created_at: string;
  has_accepted_terms: boolean;
  is_active?: boolean;
}

interface Candidate {
  id: string;
  name: string;
  display_name: string;
  email: string;
  phone?: string;
  label: string;
  profile_description?: string;
  location: string;
  experience: number;
  education: string;
  highest_education_level?: string;
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
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [introductions, setIntroductions] = useState<IntroductionRequest[]>(mockIntroductions);
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState<User | null>(null);
  const [showRoleChangeConfirm, setShowRoleChangeConfirm] = useState<boolean>(false);
  const [showReactivateConfirm, setShowReactivateConfirm] = useState<User | null>(null);
  const [newRoleId, setNewRoleId] = useState<string>('');

  // Form state for candidate
  const [candidateForm, setCandidateForm] = useState({
    name: '',
    email: '',
    label: '',
    description: '',
    location: '',
    experience: '',
    education: '',
    highestEducationLevel: '',
    openToOpportunities: true,
  });
  
  // Skills management state
  const [availableSkills, setAvailableSkills] = useState<Array<{ id: string; skill: string }>>([]);
  const [selectedSkills, setSelectedSkills] = useState<Array<{ id: string; skill: string }>>([]);
  const [skillInput, setSkillInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Candidate | null>(null);

  // Fetch users and candidates data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch roles first
        const { data: rolesData, error: rolesError } = await supabase
          .from('roles')
          .select('*');

        if (rolesError) throw rolesError;
        
        // Fetch users with roles
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select(`
            *,
            roles(id, name)
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

        setRoles(rolesData || []);

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

  const handleRoleChangeRequest = () => {
    if (!editingUser || !newRoleId || newRoleId === editingUser.role_id) return;
    setShowRoleChangeConfirm(true);
  };

  const updateUserRole = async () => {
    if (!editingUser || !newRoleId) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ role_id: newRoleId })
        .eq('id', editingUser.id);

      if (error) throw error;

      // Update local state
      setUsers(prev => prev.map(user => 
        user.id === editingUser.id 
          ? { 
              ...user, 
              role_id: newRoleId,
              role: roles.find(role => role.id === newRoleId)?.name || 'unknown'
            }
          : user
      ));

      toast({
        title: "Role updated",
        description: `${editingUser.first_name} ${editingUser.last_name}'s role has been updated successfully.`,
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    } finally {
      setEditingUser(null);
      setNewRoleId('');
      setShowRoleChangeConfirm(false);
    }
  };

  const deactivateUser = async () => {
    if (!showDeactivateConfirm) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', showDeactivateConfirm.id);

      if (error) throw error;

      // Update local state to show user as deactivated
      setUsers(prev => prev.map(user => 
        user.id === showDeactivateConfirm.id 
          ? { ...user, is_active: false }
          : user
      ));

      toast({
        title: "User deactivated",
        description: `${showDeactivateConfirm.first_name} ${showDeactivateConfirm.last_name} has been deactivated and can no longer log in.`,
      });
    } catch (error) {
      console.error('Error deactivating user:', error);
      toast({
        title: "Error",
        description: "Failed to deactivate user",
        variant: "destructive",
      });
    } finally {
      setShowDeactivateConfirm(null);
    }
  };

  const reactivateUser = async () => {
    if (!showReactivateConfirm) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: true })
        .eq('id', showReactivateConfirm.id);

      if (error) throw error;

      // Update local state to show user as active
      setUsers(prev => prev.map(user => 
        user.id === showReactivateConfirm.id 
          ? { ...user, is_active: true }
          : user
      ));

      toast({
        title: "User reactivated",
        description: `${showReactivateConfirm.first_name} ${showReactivateConfirm.last_name} has been reactivated and can now log in.`,
      });
    } catch (error) {
      console.error('Error reactivating user:', error);
      toast({
        title: "Error",
        description: "Failed to reactivate user",
        variant: "destructive",
      });
    } finally {
      setShowReactivateConfirm(null);
    }
  };

  // Fetch all skills on component mount
  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const { data: skillsData, error } = await supabase
          .from('skills')
          .select('*')
          .order('skill');
        
        if (error) throw error;
        setAvailableSkills(skillsData || []);
      } catch (error) {
        console.error('Error fetching skills:', error);
      }
    };

    fetchSkills();
  }, []);

  const resetCandidateForm = () => {
    setCandidateForm({
      name: '',
      email: '',
      label: '',
      description: '',
      location: '',
      experience: '',
      education: '',
      highestEducationLevel: '',
      openToOpportunities: true,
    });
    setSelectedSkills([]);
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
        highestEducationLevel: candidate.highest_education_level || '',
        openToOpportunities: candidate.open_to_opportunities,
      });
      setSelectedSkills(candidate.skills || []);
    } else {
      resetCandidateForm();
    }
    setShowCandidateForm(true);
  };

  const handleCandidateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingCandidate) {
        // Update existing candidate
        const { error: candidateError } = await supabase
          .from('candidates')
          .update({
            name: candidateForm.name,
            display_name: candidateForm.name,
            email: candidateForm.email,
            label: candidateForm.label,
            profile_description: candidateForm.description,
            location: candidateForm.location,
            experience: parseInt(candidateForm.experience),
            education: candidateForm.education,
            highest_education_level: candidateForm.highestEducationLevel,
            open_to_opportunities: candidateForm.openToOpportunities,
          })
          .eq('id', editingCandidate.id);

        if (candidateError) throw candidateError;

        // Delete existing skills
        await supabase
          .from('candidate_skills')
          .delete()
          .eq('candidate_id', editingCandidate.id);

        // Add new skills
        if (selectedSkills.length > 0) {
          const { error: skillsError } = await supabase
            .from('candidate_skills')
            .insert(
              selectedSkills.map(skill => ({
                candidate_id: editingCandidate.id,
                skill_id: skill.id
              }))
            );

          if (skillsError) throw skillsError;
        }

        // Update local state
        setCandidates(prev => prev.map(c => 
          c.id === editingCandidate.id 
            ? {
                ...c,
                name: candidateForm.name,
                display_name: candidateForm.name,
                email: candidateForm.email,
                label: candidateForm.label,
                profile_description: candidateForm.description,
                location: candidateForm.location,
                experience: parseInt(candidateForm.experience),
                education: candidateForm.education,
                open_to_opportunities: candidateForm.openToOpportunities,
                skills: selectedSkills,
                updated_at: new Date().toISOString()
              }
            : c
        ));

        toast({
          title: "Candidate updated",
          description: "Candidate information has been updated successfully.",
        });
      } else {
        // Create new candidate
        const { data: newCandidate, error: candidateError } = await supabase
          .from('candidates')
          .insert({
            name: candidateForm.name,
            display_name: candidateForm.name,
            email: candidateForm.email,
            label: candidateForm.label,
            profile_description: candidateForm.description,
            location: candidateForm.location,
            experience: parseInt(candidateForm.experience),
            education: candidateForm.education,
            highest_education_level: candidateForm.highestEducationLevel,
            open_to_opportunities: candidateForm.openToOpportunities,
          })
          .select()
          .single();

        if (candidateError) throw candidateError;

        // Add skills if any
        if (selectedSkills.length > 0 && newCandidate) {
          const { error: skillsError } = await supabase
            .from('candidate_skills')
            .insert(
              selectedSkills.map(skill => ({
                candidate_id: newCandidate.id,
                skill_id: skill.id
              }))
            );

          if (skillsError) throw skillsError;
        }

        // Add to local state
        setCandidates(prev => [...prev, {
          ...newCandidate,
          skills: selectedSkills
        }]);

        toast({
          title: "Candidate added",
          description: "New candidate has been added successfully.",
        });
      }
    } catch (error) {
      console.error('Error saving candidate:', error);
      toast({
        title: "Error",
        description: "Failed to save candidate information",
        variant: "destructive",
      });
    }
    
    setShowCandidateForm(false);
    resetCandidateForm();
  };

  const handleDeleteCandidate = async (candidate: Candidate) => {
    try {
      const { error } = await supabase
        .from('candidates')
        .delete()
        .eq('id', candidate.id);

      if (error) throw error;

      setCandidates(prev => prev.filter(c => c.id !== candidate.id));
      setShowDeleteConfirm(null);

      toast({
        title: "Candidate deleted",
        description: "Candidate has been permanently removed from the system.",
      });
    } catch (error) {
      console.error('Error deleting candidate:', error);
      toast({
        title: "Error",
        description: "Failed to delete candidate",
        variant: "destructive",
      });
    }
  };

  const handleSkillInputKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      await addSkillFromInput();
    }
  };

  const addSkillFromInput = async () => {
    const trimmedInput = skillInput.trim().toLowerCase();
    if (!trimmedInput) return;

    // Check if skill already exists in available skills
    const existingSkill = availableSkills.find(skill => 
      skill.skill.toLowerCase() === trimmedInput
    );

    if (existingSkill) {
      // Add existing skill if not already selected
      if (!selectedSkills.find(s => s.id === existingSkill.id)) {
        setSelectedSkills(prev => [...prev, existingSkill]);
      }
    } else {
      // Create new skill
      try {
        const { data: newSkill, error } = await supabase
          .from('skills')
          .insert({ skill: skillInput.trim() })
          .select()
          .single();

        if (error) throw error;

        setAvailableSkills(prev => [...prev, newSkill]);
        setSelectedSkills(prev => [...prev, newSkill]);

        toast({
          title: "New skill created",
          description: `"${skillInput.trim()}" has been added to the skills database.`,
        });
      } catch (error) {
        console.error('Error creating skill:', error);
        toast({
          title: "Error",
          description: "Failed to create new skill",
          variant: "destructive",
        });
      }
    }

    setSkillInput('');
  };

  const removeSkill = (skillId: string) => {
    setSelectedSkills(prev => prev.filter(skill => skill.id !== skillId));
  };

  const getFilteredSkills = () => {
    if (!skillInput) return [];
    return availableSkills.filter(skill => 
      skill.skill.toLowerCase().includes(skillInput.toLowerCase()) &&
      !selectedSkills.find(s => s.id === skill.id)
    );
  };

  const addExistingSkill = (skill: { id: string; skill: string }) => {
    if (!selectedSkills.find(s => s.id === skill.id)) {
      setSelectedSkills(prev => [...prev, skill]);
    }
    setSkillInput('');
  };

  const toggleCandidateOpportunities = async (candidateId: string) => {
    try {
      const candidate = candidates.find(c => c.id === candidateId);
      if (!candidate) return;

      const newStatus = !candidate.open_to_opportunities;

      // Update in database
      const { error } = await supabase
        .from('candidates')
        .update({ open_to_opportunities: newStatus })
        .eq('id', candidateId);

      if (error) throw error;

      // Update local state
      setCandidates(prev => prev.map(c =>
        c.id === candidateId
          ? { 
              ...c, 
              open_to_opportunities: newStatus,
              updated_at: new Date().toISOString()
            }
          : c
      ));

      toast({
        title: "Status updated",
        description: `${candidate.name} is now ${newStatus ? 'open to opportunities' : 'not available'}.`,
      });
    } catch (error) {
      console.error('Error updating candidate status:', error);
      toast({
        title: "Error",
        description: "Failed to update candidate status",
        variant: "destructive",
      });
    }
  };


  const toggleUserStatus = (userId: string) => {
    // This would require implementing a status field in the database
    toast({
      title: "Feature not implemented",
      description: "User status management requires additional database setup",
      variant: "destructive",
    });
  };

  const handleUserEdit = (user: User) => {
    setEditingUser(user);
    setNewRoleId(user.role_id);
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
                          {candidate.highest_education_level && (
                            <div>
                              <span className="text-sm font-medium">Education Level:</span>
                              <p className="text-sm text-gray-600">{candidate.highest_education_level}</p>
                            </div>
                          )}
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
                
                {/* Current User Section */}
                {user && (
                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-3 text-primary">Your Account</h3>
                    {(() => {
                      const currentUser = users.find(u => u.id === user.id);
                      if (!currentUser) return null;
                      
                      return (
                        <Card className="border-primary bg-primary/5">
                          <CardContent className="pt-6">
                            <div className="flex justify-between items-center">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold">
                                    {currentUser.first_name} {currentUser.last_name}
                                  </h3>
                                  <Badge variant="outline" className="text-xs">
                                    You
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600">{currentUser.email}</p>
                                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                  <span>Joined: {new Date(currentUser.created_at).toLocaleDateString()}</span>
                                  <span>Terms accepted: {currentUser.has_accepted_terms ? 'Yes' : 'No'}</span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge variant="secondary">
                                  {currentUser.role}
                                </Badge>
                                <Badge className={`${currentUser.is_active === false ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"} pointer-events-none`}>
                                  {currentUser.is_active === false ? 'Inactive' : 'Active'}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })()}
                  </div>
                )}
                
                {/* Other Users Section */}
                <div>
                  <h3 className="text-lg font-medium mb-3">Other Users</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {users.filter(userItem => userItem.id !== user?.id).map((userItem) => (
                      <Card 
                        key={userItem.id} 
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleUserEdit(userItem)}
                      >
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">
                                  {userItem.first_name} {userItem.last_name}
                                </h3>
                              </div>
                              <p className="text-sm text-gray-600">{userItem.email}</p>
                              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                <span>Joined: {new Date(userItem.created_at).toLocaleDateString()}</span>
                                <span>Terms accepted: {userItem.has_accepted_terms ? 'Yes' : 'No'}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="secondary">
                                {userItem.role}
                              </Badge>
                              <Badge className={`${userItem.is_active === false ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"} pointer-events-none`}>
                                {userItem.is_active === false ? 'Inactive' : 'Active'}
                              </Badge>
                              <Settings className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
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
                  <Label htmlFor="education">Education Details *</Label>
                  <Input
                    id="education"
                    value={candidateForm.education}
                    onChange={(e) => setCandidateForm(prev => ({ ...prev, education: e.target.value }))}
                    placeholder="e.g., BS Computer Science, MBA Finance"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="highestEducationLevel">Highest Education Level</Label>
                  <Select
                    value={candidateForm.highestEducationLevel}
                    onValueChange={(value) => setCandidateForm(prev => ({ ...prev, highestEducationLevel: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select highest education level" />
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
                  <Label htmlFor="skills">Skills</Label>
                  <div className="space-y-3">
                    {/* Selected Skills */}
                    {selectedSkills.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedSkills.map((skill) => (
                          <Badge key={skill.id} variant="secondary" className="text-xs flex items-center gap-1">
                            {skill.skill}
                            <X 
                              className="h-3 w-3 cursor-pointer hover:text-destructive" 
                              onClick={() => removeSkill(skill.id)}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {/* Skill Input */}
                    <div className="relative">
                      <Input
                        placeholder="Type a skill and press Enter or comma to add..."
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={handleSkillInputKeyDown}
                      />
                      
                      {/* Dropdown for matching skills */}
                      {skillInput && getFilteredSkills().length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-background border rounded-md shadow-lg z-50 max-h-32 overflow-y-auto">
                          {getFilteredSkills().slice(0, 5).map((skill) => (
                            <div
                              key={skill.id}
                              className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                              onClick={() => addExistingSkill(skill)}
                            >
                              {skill.skill}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      Type a skill name and press Enter or comma to add. If the skill exists, it will show in the dropdown.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="openToOpportunities"
                    checked={candidateForm.openToOpportunities}
                    onCheckedChange={(checked) => setCandidateForm(prev => ({ ...prev, openToOpportunities: checked }))}
                  />
                  <Label htmlFor="openToOpportunities">Open to opportunities</Label>
                </div>

                <DialogFooter className="flex justify-between">
                  <div>
                    {editingCandidate && (
                      <Button 
                        type="button" 
                        variant="destructive"
                        onClick={() => {
                          setShowDeleteConfirm(editingCandidate);
                          setShowCandidateForm(false);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Candidate
                      </Button>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button type="button" variant="outline" onClick={() => setShowCandidateForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingCandidate ? 'Update Candidate' : 'Add Candidate'}
                    </Button>
                  </div>
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

        {/* User Edit Dialog */}
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User: {editingUser?.first_name} {editingUser?.last_name}</DialogTitle>
              <DialogDescription>
                Update user role and manage account status
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div>
                <Label htmlFor="userRole">User Role</Label>
                <Select value={newRoleId} onValueChange={setNewRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="border-t pt-4">
                <Label className="text-destructive">Danger Zone</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  {editingUser?.is_active === false 
                    ? "This user's account is currently deactivated"
                    : "This action will deactivate the user's account"
                  }
                </p>
                {editingUser?.is_active === false ? (
                  <Button 
                    variant="default" 
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      setShowReactivateConfirm(editingUser);
                      setEditingUser(null);
                    }}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Reactivate User
                  </Button>
                ) : (
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={() => {
                      setShowDeactivateConfirm(editingUser);
                      setEditingUser(null);
                    }}
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Deactivate User
                  </Button>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button onClick={handleRoleChangeRequest} disabled={!newRoleId || newRoleId === editingUser?.role_id}>
                Update Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Role Change Confirmation Dialog */}
        <AlertDialog open={showRoleChangeConfirm} onOpenChange={setShowRoleChangeConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to change {editingUser?.first_name} {editingUser?.last_name}'s role to "{roles.find(r => r.id === newRoleId)?.name}"?
                This will immediately update their permissions in the system.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowRoleChangeConfirm(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={updateUserRole}>
                Yes, Update Role
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Deactivate User Confirmation Dialog */}
        <AlertDialog open={!!showDeactivateConfirm} onOpenChange={() => setShowDeactivateConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">Deactivate User Account</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to deactivate {showDeactivateConfirm?.first_name} {showDeactivateConfirm?.last_name}'s account? 
                This action will prevent them from accessing the system and cannot be easily undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={deactivateUser}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Yes, Deactivate User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reactivate User Confirmation Dialog */}
        <AlertDialog open={!!showReactivateConfirm} onOpenChange={() => setShowReactivateConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-green-600">Reactivate User Account</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to reactivate {showReactivateConfirm?.first_name} {showReactivateConfirm?.last_name}'s account? 
                This will allow them to access the system again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={reactivateUser}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                Yes, Reactivate User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Candidate Confirmation Dialog */}
        <AlertDialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">Delete Candidate</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to permanently delete {showDeleteConfirm?.name}? 
                This action cannot be undone and will remove all associated data including skills and any introduction requests.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => showDeleteConfirm && handleDeleteCandidate(showDeleteConfirm)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Yes, Delete Candidate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </div>
    );
};

export default Admin;
