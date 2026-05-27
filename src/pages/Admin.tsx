
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
import { Plus, Edit2, Trash2, Users, UserPlus, Eye, Settings, Mail, UserX, X, Check, Download, Loader2, ChevronRight, Briefcase, GraduationCap, MapPin, CheckCircle, XCircle, Pause, RotateCcw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import AdminIntroductionsTab from "@/components/admin/AdminIntroductionsTab";
import AdminRecruitersTab from "@/components/admin/AdminRecruitersTab";

import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import LoaderScreen from '@/components/LoaderScreen';

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
  email_confirmed_at?: string | null;
  able_to_login?: boolean;
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
  // Approval workflow (Batch 1 migration)
  status?: 'pending' | 'active' | 'rejected' | 'inactive' | 'deleted';
  target_roles?: string[];
  primary_background?: string;
  secondary_backgrounds?: string[];
  target_salary?: string;
  work_preference?: string;
  preferred_cities?: string[];
  linkedin_url?: string;
  resume_full_url?: string;
  rejection_reason?: string;
}

// (Old mock IntroductionRequest interface deleted — the real one lives in
// useIntroductionRequests and is consumed by AdminIntroductionsTab below.)


// (Old mockIntroductions removed — real data flows through useIntroductionRequests.)

const Admin = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [showCandidateForm, setShowCandidateForm] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState<User | null>(null);
  const [showRoleChangeConfirm, setShowRoleChangeConfirm] = useState<boolean>(false);
  const [showReactivateConfirm, setShowReactivateConfirm] = useState<User | null>(null);
  const [newRoleId, setNewRoleId] = useState<string>('');

  // Invite user state
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('recruiter');
  const [inviteLoading, setInviteLoading] = useState(false);

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

  // ── Batch 1.5 — candidate approval workflow state ─────────────────────────
  // Status filter for the Candidates tab list. Defaults to 'pending' so the
  // review queue is front-and-center when an admin opens the page.
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<
    'pending' | 'active' | 'rejected' | 'inactive' | 'all'
  >('pending');

  // Resume download (admin uses /api/get-resume-url with adminUserId).
  const [reviewDownloading, setReviewDownloading] = useState(false);
  const [reviewDownloadError, setReviewDownloadError] = useState<string | null>(null);

  // Pending-queue counts driving the tab badges. Candidates count is
  // derived from local state. Recruiters + Intros counts come from a
  // lightweight /api/admin-pending-counts call (one round-trip, refetch
  // after status-changing actions in either tab).
  const [pendingRecruiterCount, setPendingRecruiterCount] = useState<number>(0);
  const [pendingIntrosCount, setPendingIntrosCount] = useState<number>(0);

  // ── Batch 2 — review-action state ─────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    null | { kind: 'approve' | 'reactivate' | 'deactivate' | 'reconsider'; candidate: Candidate }
  >(null);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

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

        // Fetch candidates with skills.
        // LEFT join (no !inner) — pending applicants who haven't picked skills
        // would otherwise vanish from the admin list.
        const { data: candidatesData, error: candidatesError } = await supabase
          .from('candidates')
          .select(`
            *,
            candidate_skills(
              skill_id,
              skills(
                id,
                skill
              )
            )
          `)
          .order('created_at', { ascending: false });

        if (candidatesError) throw candidatesError;

// Transform users data
let transformedUsers = usersData?.map(user => ({
  ...user,
  role: user.roles?.name || 'unknown'
})) || [];

setRoles(rolesData || []);

// Fetch and merge verification status from edge function
try {
  const { data: statusData, error: statusError } = await supabase.functions.invoke('list-users-status');
  if (!statusError && statusData?.users) {
    const statusMap = new Map<string, any>(statusData.users.map((u: any) => [u.id as string, u]));
    transformedUsers = transformedUsers.map((u: any) => {
      const s = statusMap.get(u.id);
      return {
        ...u,
        email_confirmed_at: s?.email_confirmed_at ?? null,
        able_to_login: (u.is_active !== false) && !!(s?.email_confirmed_at),
      };
    });
  }
} catch (e) {
  console.warn('Could not load verification status', e);
}

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

  // Verification actions
  const handleResendVerification = async (target: User) => {
    try {
      const { error } = await supabase.functions.invoke('resend-verification', {
        body: { email: target.email, redirectTo: window.location.origin },
      });
      if (error) throw error as any;
      toast({ title: 'Verification email sent', description: `Resent to ${target.email}` });
    } catch (err: any) {
      console.error('Resend verification error', err);
      toast({ title: 'Failed to resend verification', description: err?.message || 'Unknown error', variant: 'destructive' });
    }
  };

  const handleConfirmUser = async (target: User) => {
    try {
      const { error } = await supabase.functions.invoke('confirm-user', {
        body: { user_id: target.id },
      });
      if (error) throw error as any;

      // Optimistically update local state
      setUsers(prev => prev.map(u => u.id === target.id ? { ...u, email_confirmed_at: new Date().toISOString() } : u));
      toast({ title: 'User confirmed', description: `${target.first_name} ${target.last_name} is now verified.` });
    } catch (err: any) {
      console.error('Confirm user error', err);
      toast({ title: 'Failed to confirm user', description: err?.message || 'Unknown error', variant: 'destructive' });
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

  // ── Candidate-status helpers (Batch 1.5) ───────────────────────────────────
  const candidateStatusOf = (c: Candidate): 'pending' | 'active' | 'rejected' | 'inactive' =>
    (c.status as any) || 'active';

  const filteredCandidates = candidates.filter(c => {
    if (candidateStatusFilter === 'all') return c.status !== 'deleted';
    return candidateStatusOf(c) === candidateStatusFilter;
  });

  const statusCount = (s: 'pending' | 'active' | 'rejected' | 'inactive') =>
    candidates.filter(c => candidateStatusOf(c) === s).length;

  const candidateStatusBadgeClass = (s: string): string => {
    switch (s) {
      case 'pending':  return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'active':   return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
      case 'inactive': return 'bg-gray-100 text-gray-600 border-gray-200';
      default:         return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const daysSince = (iso?: string) => {
    if (!iso) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  };

  // Refresh the recruiter + intros pending counts in one API call.
  // Called on mount + after either tab fires a status-changing action.
  // The candidates count comes from local state (already loaded).
  const refetchPendingCounts = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/admin-pending-counts?adminUserId=${encodeURIComponent(user.id)}`);
      if (!res.ok) return;
      const body = await res.json();
      setPendingRecruiterCount(body.recruiters ?? 0);
      setPendingIntrosCount(body.intros ?? 0);
    } catch (err) {
      console.error('[Admin] pending counts fetch failed:', err);
    }
  };
  useEffect(() => { refetchPendingCounts(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pending candidates count derived from already-loaded list.
  // Explicit equality — never treat NULL/undefined as pending; the
  // migration backfilled NULL → 'active' (grandfathered).
  const pendingCandidateCount = candidates.filter(c => c.status === 'pending').length;

  // Re-fetch just the candidates list (no users/roles roundtrip).
  // Called after a successful review action to update counts + drawer state.
  const refetchCandidates = async () => {
    const { data, error } = await supabase
      .from('candidates')
      .select(`
        *,
        candidate_skills(
          skill_id,
          skills(id, skill)
        )
      `)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[Admin] refetchCandidates error:', error);
      return;
    }
    const transformed = (data || []).map((c: any) => ({
      ...c,
      skills: c.candidate_skills?.map((cs: any) => ({ id: cs.skills.id, skill: cs.skills.skill })) || [],
    }));
    setCandidates(transformed);
  };

  // Send a review action to /api/review-candidate, then refetch + close drawer.
  // Refetch (rather than optimistic update) keeps the source of truth in one
  // place; the API is fast and admin actions aren't latency-sensitive.
  const submitReviewAction = async (
    candidate: Candidate,
    action: 'approve' | 'reject' | 'reactivate' | 'deactivate',
    rejectionReasonText?: string,
  ) => {
    if (!user?.id) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/review-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: candidate.id,
          adminUserId: user.id,
          action,
          ...(action === 'reject' ? { rejectionReason: rejectionReasonText || '' } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);

      const label = candidate.display_name || candidate.name;
      const verb: Record<string, string> = {
        approve: 'Approved', reject: 'Rejected', reactivate: 'Reactivated', deactivate: 'Marked inactive',
      };
      toast({
        title: `${verb[action]} ${label}`,
        description: body.emailSent
          ? `Notification email sent to candidate.`
          : `Status updated. Email not sent: ${body.emailError || 'unknown reason'}.`,
        variant: body.emailSent ? undefined : 'destructive',
      });

      await refetchCandidates();
      setSelectedCandidate(null);
      setConfirmAction(null);
      setRejectionDialogOpen(false);
      setRejectionReason('');
    } catch (err: any) {
      console.error('[Admin] review action failed:', err);
      toast({
        title: 'Action failed',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Resume download via /api/get-resume-url with adminUserId param (admin path).
  const handleAdminResumeDownload = async (candidateId: string) => {
    if (!user?.id) return;
    setReviewDownloading(true);
    setReviewDownloadError(null);
    try {
      const res = await fetch(
        `/api/get-resume-url?candidateId=${encodeURIComponent(candidateId)}&adminUserId=${encodeURIComponent(user.id)}`
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) throw new Error(body.error || `Failed (${res.status})`);
      window.open(body.url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      console.error('[Admin] resume download failed:', err);
      setReviewDownloadError(err?.message || 'Failed to generate download link');
    } finally {
      setReviewDownloading(false);
    }
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
    return <LoaderScreen />;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Manage users, candidates, and system settings</p>
        </div>

        <Tabs defaultValue="candidates" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="candidates" className="relative">
                Candidates
                {pendingCandidateCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-semibold leading-none">
                    {pendingCandidateCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="recruiters" className="relative">
                Recruiters
                {pendingRecruiterCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-semibold leading-none">
                    {pendingRecruiterCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="introductions" className="relative">
                Introductions
                {pendingIntrosCount > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-semibold leading-none">
                    {pendingIntrosCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="candidates">
              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold">Candidate Management</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Review pending applicants and manage approved candidates.
                    </p>
                  </div>
                  <Button onClick={() => handleOpenCandidateForm()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Candidate
                  </Button>
                </div>

                {/* Status filter sub-tabs */}
                <Tabs value={candidateStatusFilter} onValueChange={(v) => setCandidateStatusFilter(v as any)}>
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="pending">Pending ({statusCount('pending')})</TabsTrigger>
                    <TabsTrigger value="active">Active ({statusCount('active')})</TabsTrigger>
                    <TabsTrigger value="rejected">Rejected ({statusCount('rejected')})</TabsTrigger>
                    <TabsTrigger value="inactive">Inactive ({statusCount('inactive')})</TabsTrigger>
                    <TabsTrigger value="all">All ({candidates.filter(c => c.status !== 'deleted').length})</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Filtered list */}
                <div className="grid grid-cols-1 gap-3">
                  {filteredCandidates.length === 0 && (
                    <Card>
                      <CardContent className="py-10 text-center text-sm text-muted-foreground">
                        {candidateStatusFilter === 'pending'
                          ? 'No pending candidates 🎉'
                          : `No ${candidateStatusFilter === 'all' ? '' : candidateStatusFilter + ' '}candidates`}
                      </CardContent>
                    </Card>
                  )}
                  {filteredCandidates.map((candidate) => {
                    const cs = candidateStatusOf(candidate);
                    return (
                      <Card key={candidate.id}>
                        <CardContent className="py-4 px-5">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm text-gray-900 truncate">
                                  {candidate.name || candidate.display_name || candidate.label}
                                </p>
                                {candidate.display_name && candidate.display_name !== candidate.name && (
                                  <p className="text-xs text-muted-foreground truncate">{candidate.display_name}</p>
                                )}
                                <Badge variant="outline" className={`text-xs ${candidateStatusBadgeClass(cs)}`}>
                                  {cs}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {candidate.email} · {candidate.location || '—'}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Submitted {daysSince(candidate.created_at) === 0 ? 'today' : `${daysSince(candidate.created_at)}d ago`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  setReviewDownloadError(null);
                                  setSelectedCandidate(candidate);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                Review <ChevronRight className="ml-1 h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenCandidateForm(candidate)}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="recruiters">
              <AdminRecruitersTab onCountChange={refetchPendingCounts} />
            </TabsContent>

            <TabsContent value="users">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">User Management</h2>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Invite New User</CardTitle>
                    <CardDescription>Send an invite and assign a role. Only the Owner can assign the 'owner' role.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <Label htmlFor="invite-first-name">First name</Label>
                        <Input id="invite-first-name" value={inviteFirstName} onChange={(e) => setInviteFirstName(e.target.value)} placeholder="First name" />
                      </div>
                      <div>
                        <Label htmlFor="invite-last-name">Last name</Label>
                        <Input id="invite-last-name" value={inviteLastName} onChange={(e) => setInviteLastName(e.target.value)} placeholder="Last name" />
                      </div>
                      <div className="md:col-span-1">
                        <Label htmlFor="invite-email">Email</Label>
                        <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@example.com" />
                      </div>
                      <div>
                        <Label>Role</Label>
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {(user?.role === 'owner' ? roles : roles.filter((r) => r.name !== 'owner')).map((r) => (
                              <SelectItem key={r.id} value={r.name}>
                                {r.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Button
                        disabled={inviteLoading || !inviteFirstName || !inviteLastName || !inviteEmail}
                        onClick={async () => {
                          try {
                            setInviteLoading(true);
                            const { data, error } = await supabase.functions.invoke('create-admin-user', {
                              body: {
                                email: inviteEmail,
                                first_name: inviteFirstName,
                                last_name: inviteLastName,
                                role: inviteRole,
                                notify_intro_requests: false,
                              },
                            });
                            if (error) throw error as any;
                            toast({ title: 'User invited', description: `${inviteFirstName} ${inviteLastName} invited as ${inviteRole}.` });

                            // Refresh users list
                            const { data: usersData, error: usersError } = await supabase
                              .from('users')
                              .select(`
                                *,
                                roles(id, name)
                              `);
                            if (!usersError && usersData) {
const { data: usersData, error: usersError } = await supabase
  .from('users')
  .select(`
    *,
    roles(id, name)
  `);
if (!usersError && usersData) {
  let transformed = usersData.map((u: any) => ({
    ...u,
    role: u.roles?.name || 'unknown'
  }));
  try {
    const { data: statusData, error: statusError } = await supabase.functions.invoke('list-users-status');
    if (!statusError && statusData?.users) {
      const statusMap = new Map<string, any>(statusData.users.map((u: any) => [u.id as string, u]));
      transformed = transformed.map((u: any) => ({
        ...u,
        email_confirmed_at: statusMap.get(u.id)?.email_confirmed_at ?? null,
        able_to_login: (u.is_active !== false) && !!(statusMap.get(u.id)?.email_confirmed_at),
      }));
    }
  } catch {}
  setUsers(transformed);
}
                            }
                          } catch (err: any) {
                            console.error('Invite user error', err);
                            toast({ title: 'Failed to invite user', description: err?.message || 'Unknown error', variant: 'destructive' });
                          } finally {
                            setInviteLoading(false);
                          }
                        }}
                      >
                        {inviteLoading ? 'Inviting...' : 'Invite User'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
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
  <Badge className={`${currentUser.email_confirmed_at ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"} pointer-events-none`}>
    {currentUser.email_confirmed_at ? 'Verified' : 'Unverified'}
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
                
                {/* Other Users — split by role (Batch 1.5).
                    Candidates live in the `candidates` table, not public.users — they're in the Candidates tab. */}
                <div>
                  {(() => {
                    const otherUsers = users.filter(u => u.id !== user?.id);
                    const recruiters = otherUsers.filter(u => u.role === 'recruiter');
                    const owners = otherUsers.filter(u => u.role === 'owner');
                    const adminsList = otherUsers.filter(u => u.role === 'admin');
                    const renderUserCard = (userItem: User) => (
                      <Card
                        key={userItem.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => handleUserEdit(userItem)}
                      >
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{userItem.first_name} {userItem.last_name}</h3>
                              </div>
                              <p className="text-sm text-gray-600">{userItem.email}</p>
                              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                                <span>Joined: {new Date(userItem.created_at).toLocaleDateString()}</span>
                                <span>Terms accepted: {userItem.has_accepted_terms ? 'Yes' : 'No'}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="secondary">{userItem.role}</Badge>
                              <Badge className={`${userItem.email_confirmed_at ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"} pointer-events-none`}>
                                {userItem.email_confirmed_at ? 'Verified' : 'Unverified'}
                              </Badge>
                              <Badge className={`${userItem.is_active === false ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"} pointer-events-none`}>
                                {userItem.is_active === false ? 'Inactive' : 'Active'}
                              </Badge>
                              <Settings className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                    const renderList = (list: User[], emptyLabel: string) => (
                      list.length === 0
                        ? <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</CardContent></Card>
                        : <div className="grid grid-cols-1 gap-4">{list.map(renderUserCard)}</div>
                    );
                    return (
                      <>
                        <h3 className="text-lg font-medium mb-3">Other Users</h3>
                        <Tabs defaultValue="recruiters">
                          <TabsList className="grid w-full grid-cols-3 mb-4">
                            <TabsTrigger value="recruiters">Recruiters ({recruiters.length})</TabsTrigger>
                            <TabsTrigger value="owners">Owners ({owners.length})</TabsTrigger>
                            <TabsTrigger value="admins">Admins ({adminsList.length})</TabsTrigger>
                          </TabsList>
                          <TabsContent value="recruiters">{renderList(recruiters, 'No recruiters yet')}</TabsContent>
                          <TabsContent value="owners">{renderList(owners, 'No owners yet')}</TabsContent>
                          <TabsContent value="admins">{renderList(adminsList, 'No admins yet')}</TabsContent>
                        </Tabs>
                      </>
                    );
                  })()}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="introductions">
              <AdminIntroductionsTab onCountChange={refetchPendingCounts} />
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
                  <Label htmlFor="highestEducationLevel">Highest Education Level *</Label>
                  <Select
                    value={candidateForm.highestEducationLevel}
                    onValueChange={(value) => setCandidateForm(prev => ({ ...prev, highestEducationLevel: value }))}
                    required
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
                  <Label htmlFor="education">Education Details</Label>
                  <Input
                    id="education"
                    value={candidateForm.education}
                    onChange={(e) => setCandidateForm(prev => ({ ...prev, education: e.target.value }))}
                    placeholder="e.g., BS Computer Science, MBA Finance"
                  />
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

                {editingCandidate && (
                  <div className="border-t pt-6">
                    <Label className="text-destructive">Danger Zone</Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      This action will permanently delete the candidate and all associated data including skills and introduction requests. This cannot be undone.
                    </p>
                    <Button 
                      type="button" 
                      variant="destructive"
                      className="w-full"
                      onClick={() => {
                        setShowDeleteConfirm(editingCandidate);
                        setShowCandidateForm(false);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Candidate
                    </Button>
                  </div>
                )}

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

          {/* Candidate Review Drawer (Batch 1.5 — merged from former AdminPendingCandidates page) */}
          <Sheet
            open={!!selectedCandidate}
            onOpenChange={(open) => { if (!open) setSelectedCandidate(null); }}
          >
            <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
              {selectedCandidate && (() => {
                const cs = candidateStatusOf(selectedCandidate);
                return (
                  <>
                    <SheetHeader className="pb-4 border-b">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SheetTitle className="text-xl">{selectedCandidate.name || selectedCandidate.display_name || selectedCandidate.label}</SheetTitle>
                        <Badge variant="outline" className={candidateStatusBadgeClass(cs)}>{cs}</Badge>
                      </div>
                      <SheetDescription>
                        Submitted {selectedCandidate.created_at ? new Date(selectedCandidate.created_at).toLocaleDateString() : '—'}
                        {selectedCandidate.rejection_reason ? ` · Rejection reason: ${selectedCandidate.rejection_reason}` : ''}
                      </SheetDescription>
                    </SheetHeader>

                    <div className="py-4 space-y-5">
                      {/* Identity (admin-only) */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Identity (admin-only)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5 text-sm pt-0">
                          <div className="flex items-center gap-2">
                            <span className="w-20 text-muted-foreground">Name</span>
                            <span>{selectedCandidate.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <a href={`mailto:${selectedCandidate.email}`} className="text-primary hover:underline">{selectedCandidate.email}</a>
                          </div>
                          {selectedCandidate.phone && (
                            <div className="flex items-center gap-2">
                              <span className="w-20 text-muted-foreground">Phone</span>
                              <a href={`tel:${selectedCandidate.phone}`} className="text-primary hover:underline">{selectedCandidate.phone}</a>
                            </div>
                          )}
                          {selectedCandidate.linkedin_url && (
                            <div className="flex items-center gap-2">
                              <span className="w-20 text-muted-foreground">LinkedIn</span>
                              <a href={selectedCandidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">{selectedCandidate.linkedin_url}</a>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Anonymous profile (recruiter view) */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Anonymous Profile (recruiter view)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm pt-0">
                          <div>
                            <p className="font-semibold">{selectedCandidate.display_name}</p>
                            <p className="text-muted-foreground">{selectedCandidate.label}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" />{selectedCandidate.location || '—'}</div>
                            <div className="flex items-center gap-2"><Briefcase className="w-4 h-4 text-muted-foreground" />{selectedCandidate.experience} yrs</div>
                            <div className="flex items-center gap-2 col-span-2"><GraduationCap className="w-4 h-4 text-muted-foreground" />
                              {selectedCandidate.education}{selectedCandidate.highest_education_level ? ` (${selectedCandidate.highest_education_level})` : ''}
                            </div>
                          </div>
                          {selectedCandidate.profile_description && (
                            <div className="pt-2 border-t">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Bio</p>
                              <p className="whitespace-pre-line">{selectedCandidate.profile_description}</p>
                            </div>
                          )}
                          {selectedCandidate.primary_background && (
                            <div className="pt-2 border-t">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Background</p>
                              <p>{selectedCandidate.primary_background}</p>
                              {selectedCandidate.secondary_backgrounds && selectedCandidate.secondary_backgrounds.length > 0 && (
                                <p className="text-muted-foreground text-xs mt-1">Also: {selectedCandidate.secondary_backgrounds.join(', ')}</p>
                              )}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                            {selectedCandidate.target_salary && (<div><p className="uppercase tracking-wide text-muted-foreground">Target comp</p><p className="text-sm">{selectedCandidate.target_salary}</p></div>)}
                            {selectedCandidate.work_preference && (<div><p className="uppercase tracking-wide text-muted-foreground">Work pref</p><p className="text-sm">{selectedCandidate.work_preference}</p></div>)}
                            {selectedCandidate.target_roles && selectedCandidate.target_roles.length > 0 && (<div className="col-span-2"><p className="uppercase tracking-wide text-muted-foreground">Target roles</p><p className="text-sm">{selectedCandidate.target_roles.join(', ')}</p></div>)}
                            {selectedCandidate.preferred_cities && selectedCandidate.preferred_cities.length > 0 && (<div className="col-span-2"><p className="uppercase tracking-wide text-muted-foreground">Preferred cities</p><p className="text-sm">{selectedCandidate.preferred_cities.join(', ')}</p></div>)}
                          </div>
                          {selectedCandidate.skills && selectedCandidate.skills.length > 0 && (
                            <div className="pt-2 border-t">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Skills</p>
                              <div className="flex flex-wrap gap-1">
                                {selectedCandidate.skills.map(s => (<Badge key={s.id} variant="secondary" className="text-xs">{s.skill}</Badge>))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Resume */}
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Resume</CardTitle></CardHeader>
                        <CardContent className="pt-0">
                          {selectedCandidate.resume_full_url ? (
                            <>
                              <Button
                                onClick={() => handleAdminResumeDownload(selectedCandidate.id)}
                                disabled={reviewDownloading}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                {reviewDownloading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating link…</>) : (<><Download className="w-4 h-4 mr-2" />Download Resume</>)}
                              </Button>
                              {reviewDownloadError && (<p className="text-xs text-red-600 mt-2">{reviewDownloadError}</p>)}
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">No resume uploaded.</p>
                          )}
                        </CardContent>
                      </Card>

                      {/* SFC's Take placeholder */}
                      <Card className="border-dashed">
                        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">SFC's Take</CardTitle></CardHeader>
                        <CardContent className="pt-0 space-y-2 text-sm">
                          <p className="italic text-muted-foreground">Coming soon — Batch 2 will add AI-assisted reviewer notes here.</p>
                          <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                            <div><p className="uppercase tracking-wide text-muted-foreground">Take</p><p className="text-muted-foreground italic">(empty)</p></div>
                            <div><p className="uppercase tracking-wide text-muted-foreground">Role fit</p><p className="text-muted-foreground italic">(empty)</p></div>
                            <div><p className="uppercase tracking-wide text-muted-foreground">Strengths</p><p className="text-muted-foreground italic">(empty)</p></div>
                            <div><p className="uppercase tracking-wide text-muted-foreground">Considerations</p><p className="text-muted-foreground italic">(empty)</p></div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Action buttons — Batch 2 wired */}
                      {cs === 'pending' && (
                        <div className="flex gap-3">
                          <Button
                            variant="outline"
                            className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                            disabled={actionLoading}
                            onClick={() => { setRejectionReason(''); setRejectionDialogOpen(true); }}
                          >
                            <XCircle className="w-4 h-4 mr-2" /> Reject
                          </Button>
                          <Button
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={actionLoading}
                            onClick={() => setConfirmAction({ kind: 'approve', candidate: selectedCandidate })}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" /> Approve
                          </Button>
                        </div>
                      )}
                      {cs === 'active' && (
                        <Button
                          variant="outline"
                          className="w-full"
                          disabled={actionLoading}
                          onClick={() => setConfirmAction({ kind: 'deactivate', candidate: selectedCandidate })}
                        >
                          <Pause className="w-4 h-4 mr-2" /> Mark Inactive
                        </Button>
                      )}
                      {cs === 'rejected' && (
                        <Button
                          variant="outline"
                          className="w-full"
                          disabled={actionLoading}
                          onClick={() => setConfirmAction({ kind: 'reconsider', candidate: selectedCandidate })}
                        >
                          <RotateCcw className="w-4 h-4 mr-2" /> Reconsider & Approve
                        </Button>
                      )}
                      {cs === 'inactive' && (
                        <Button
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={actionLoading}
                          onClick={() => setConfirmAction({ kind: 'reactivate', candidate: selectedCandidate })}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" /> Reactivate
                        </Button>
                      )}
                      {(selectedCandidate.status === 'deleted') && (
                        <p className="text-sm text-muted-foreground italic text-center">This candidate has been deleted — no actions available.</p>
                      )}
                    </div>
                  </>
                );
              })()}
            </SheetContent>
          </Sheet>

          {/* ── Batch 2 — confirm dialogs for approve / reactivate / deactivate / reconsider ── */}
          <AlertDialog
            open={!!confirmAction}
            onOpenChange={(open) => { if (!open && !actionLoading) setConfirmAction(null); }}
          >
            <AlertDialogContent>
              {confirmAction && (() => {
                const c = confirmAction.candidate;
                const label = c.name || c.display_name;
                const cfg: Record<typeof confirmAction.kind, { title: string; body: string; action: 'approve' | 'reactivate' | 'deactivate'; cta: string; }> = {
                  approve: {
                    title: `Approve ${label}?`,
                    body: 'They\'ll get an email notification and become visible to recruiters.',
                    action: 'approve',
                    cta: 'Approve',
                  },
                  reconsider: {
                    title: `Reconsider and approve ${label}?`,
                    body: 'They\'ll get a welcome email and become visible to recruiters again. The previous rejection_reason will be cleared.',
                    action: 'approve',
                    cta: 'Approve',
                  },
                  reactivate: {
                    title: `Reactivate ${label}?`,
                    body: 'They\'ll get a welcome-back email and become visible to recruiters again.',
                    action: 'reactivate',
                    cta: 'Reactivate',
                  },
                  deactivate: {
                    title: `Mark ${label} inactive?`,
                    body: 'They\'ll be hidden from recruiters and will receive an email letting them know.',
                    action: 'deactivate',
                    cta: 'Mark Inactive',
                  },
                };
                const c2 = cfg[confirmAction.kind];
                return (
                  <>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{c2.title}</AlertDialogTitle>
                      <AlertDialogDescription>{c2.body}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        disabled={actionLoading}
                        onClick={(e) => { e.preventDefault(); submitReviewAction(c, c2.action); }}
                      >
                        {actionLoading
                          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Working…</>
                          : c2.cta}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </>
                );
              })()}
            </AlertDialogContent>
          </AlertDialog>

          {/* ── Batch 2 — rejection-reason dialog (only path that captures text) ── */}
          <Dialog
            open={rejectionDialogOpen}
            onOpenChange={(open) => { if (!open && !actionLoading) { setRejectionDialogOpen(false); setRejectionReason(''); } }}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Reject {selectedCandidate?.name || selectedCandidate?.display_name}</DialogTitle>
                <DialogDescription>
                  The candidate gets a generic email — the reason below is internal-only and never sent.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="rejection-reason">Reason (internal use only — not sent to candidate)</Label>
                <Textarea
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Insufficient experience for current openings"
                  rows={4}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={actionLoading}
                  onClick={() => { setRejectionDialogOpen(false); setRejectionReason(''); }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={actionLoading}
                  onClick={() => {
                    if (selectedCandidate) submitReviewAction(selectedCandidate, 'reject', rejectionReason);
                  }}
                >
                  {actionLoading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rejecting…</>
                    : <><XCircle className="w-4 h-4 mr-2" />Reject Candidate</>}
                </Button>
              </DialogFooter>
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
                    {(user?.role === 'owner' ? roles : roles.filter((role) => role.name !== 'owner')).map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(!editingUser?.email_confirmed_at) && (
                <div className="space-y-3">
                  <Label>Verification</Label>
                  <div className="grid grid-cols-1 gap-2">
                    <Button variant="outline" onClick={() => editingUser && handleResendVerification(editingUser)}>
                      <Mail className="mr-2 h-4 w-4" />
                      Resend verification email
                    </Button>
                    <Button onClick={() => editingUser && handleConfirmUser(editingUser)}>
                      <Check className="mr-2 h-4 w-4" />
                      Confirm user
                    </Button>
                  </div>
                </div>
              )}

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
