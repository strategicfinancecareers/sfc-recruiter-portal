import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, MapPin, DollarSign, Clock, Loader2, CheckCircle2 } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import LoaderScreen from "@/components/LoaderScreen";

interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: 'full-time' | 'part-time' | 'contract' | 'remote';
  salary_range: string | null;
  job_description_url?: string | null;
  description: string | null;
  requirements: string | null;
  created_at: string;
  status: 'active' | 'paused' | 'closed';
  user_id: string;
}

const Jobs = () => {
  const { toast } = useToast();
  const { user, session } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<Job | null>(null);

  // Import step state: 'import' = step 1 (URL only), 'form' = step 2 (full form)
  const [importStep, setImportStep] = useState<'import' | 'form'>('import');
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState('');

// Form state
const [formData, setFormData] = useState({
  title: '',
  company: '',
  location: '',
  type: 'full-time' as Job['type'],
  salaryRange: '',
  jobDescriptionUrl: '',
  description: '',
  requirements: '',
});

  // Fetch jobs from database
  const fetchJobs = async () => {
    if (!session?.user || !user) return;
    
    try {
      let query = supabase
        .from('jobs')
        .select('*');

      // If user is not admin, only show their own jobs
      if (user.role !== 'admin') {
        query = query.eq('user_id', session.user.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setJobs((data as unknown as Job[]) || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast({
        title: "Error",
        description: "Failed to load job postings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [session, user]);

const resetForm = () => {
  setFormData({
    title: '',
    company: '',
    location: '',
    type: 'full-time',
    salaryRange: '',
    jobDescriptionUrl: '',
    description: '',
    requirements: '',
  });
  setEditingJob(null);
  setImportStep('import');
  setImportUrl('');
  setImportSuccess(false);
  setImportError('');
};

const handleOpenForm = (job?: Job) => {
  if (job) {
    setEditingJob(job);
    setFormData({
      title: job.title,
      company: job.company,
      location: job.location,
      type: job.type,
      salaryRange: job.salary_range || '',
      jobDescriptionUrl: job.job_description_url || '',
      description: job.description || '',
      requirements: job.requirements || '',
    });
    setImportStep('form');
  } else {
    resetForm();
  }
  setShowJobForm(true);
};

const handleImport = async () => {
  if (!importUrl.trim()) return;
  setImporting(true);
  setImportError('');

  try {
    // Step 1: Fetch and clean page content via serverless proxy
    const proxyRes = await fetch(`/api/fetch-job?url=${encodeURIComponent(importUrl)}`);
    if (!proxyRes.ok) throw new Error('Failed to fetch URL');
    const proxyData = await proxyRes.json();
    const cleanText = proxyData.text ?? '';

    // Step 2: Pass cleaned text to Claude
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: 'Extract job details and return ONLY valid JSON with fields: title, company, location, type (full-time/part-time/contract/remote), salary_range, description, requirements. Use null for unknown fields.',
        messages: [{ role: 'user', content: `Extract job details from this job posting text and return ONLY valid JSON with fields: title, company, location, type (full-time/part-time/contract/remote), salary_range, description, requirements. Use null for unknown fields. Job posting text: ${cleanText}` }],
      }),
    });

    if (!claudeRes.ok) throw new Error('Claude API error');

    const claudeData = await claudeRes.json();
    const parsed = JSON.parse(claudeData.content?.[0]?.text ?? '{}');
    const validTypes = ['full-time', 'part-time', 'contract', 'remote'];

    setFormData({
      title: parsed.title || '',
      company: parsed.company || '',
      location: parsed.location || '',
      type: validTypes.includes(parsed.type) ? parsed.type as Job['type'] : 'full-time',
      salaryRange: parsed.salary_range || '',
      jobDescriptionUrl: importUrl,
      description: parsed.description || '',
      requirements: parsed.requirements || '',
    });
    setImportSuccess(true);
    setImportStep('form');
  } catch {
    setImportError("Couldn't read that URL — please fill in manually.");
    setImportStep('form');
  } finally {
    setImporting(false);
  }
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    
    setSubmitting(true);
    
    try {
  console.log('[Jobs] handleSubmit start', { editing: !!editingJob });
  const jobData = {
    title: formData.title,
    company: formData.company,
    location: formData.location,
    type: formData.type,
    salary_range: formData.salaryRange || null,
    job_description_url: formData.jobDescriptionUrl || null,
    description: formData.description || null,
    requirements: formData.requirements || null,
    user_id: session.user.id,
  };

      console.time('[Jobs] upsert');
      if (editingJob) {
        const { error } = await supabase
          .from('jobs')
          .update(jobData)
          .eq('id', editingJob.id);

        if (error) throw error;

        toast({
          title: "Job updated",
          description: "The job posting has been successfully updated.",
        });
      } else {
        const { error } = await supabase
          .from('jobs')
          .insert([jobData]);

        if (error) throw error;

        toast({
          title: "Job created",
          description: "New job posting has been created successfully.",
        });
      }
      console.timeEnd('[Jobs] upsert');
      
      console.time('[Jobs] fetchJobs');
      await fetchJobs();
      console.timeEnd('[Jobs] fetchJobs');

      setShowJobForm(false);
      resetForm();
      console.log('[Jobs] handleSubmit success');
    } catch (error) {
      console.error('Error saving job:', error);
      toast({
        title: "Error",
        description: "Failed to save job posting.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      console.log('[Jobs] handleSubmit finally');
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      await fetchJobs();
      setShowDeleteDialog(null);
      toast({
        title: "Job deleted",
        description: "The job posting has been removed.",
      });
    } catch (error) {
      console.error('Error deleting job:', error);
      toast({
        title: "Error",
        description: "Failed to delete job posting.",
        variant: "destructive",
      });
    }
  };

  const toggleJobStatus = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    const newStatus = job.status === 'active' ? 'paused' : 'active';

    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', jobId);

      if (error) throw error;

      await fetchJobs();
      toast({
        title: "Status updated",
        description: `Job posting is now ${newStatus}.`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update job status.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: Job['type']) => {
    switch (type) {
      case 'remote':
        return '🌐';
      case 'part-time':
        return '⏱️';
      case 'contract':
        return '📋';
      default:
        return '🏢';
    }
  };

  if (loading) {
    return <LoaderScreen />;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Job Opportunities</h1>
            <p className="text-gray-600">Manage your current job postings</p>
          </div>
          <Button onClick={() => handleOpenForm()} disabled={!session?.user}>
            <Plus className="mr-2 h-4 w-4" />
            Add Job
          </Button>
        </div>

        {/* Jobs List */}
        <div className="space-y-4">
          {jobs.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Plus className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No job postings yet</h3>
                <p className="text-gray-600 mb-4">Create your first job posting to start attracting candidates.</p>
                <Button onClick={() => handleOpenForm()} disabled={!session?.user}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Job Posting
                </Button>
              </CardContent>
            </Card>
          ) : (
            jobs.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-lg">{getTypeIcon(job.type)}</span>
                        <CardTitle className="text-xl">{job.title}</CardTitle>
                        <Badge className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </div>
                      <CardDescription className="text-lg font-medium text-blue-600">
                        {job.company}
                      </CardDescription>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleJobStatus(job.id)}
                      >
                        {job.status === 'active' ? 'Pause' : 'Activate'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenForm(job)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1" />
                      {job.location}
                    </div>
                    {job.salary_range && (
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-1" />
                        {job.salary_range}
                      </div>
                    )}
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      Created {new Date(job.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
{job.description && (
  <p className="text-gray-700">{job.description}</p>
)}

{job.job_description_url && (
  <div>
    <Button variant="link" size="sm" asChild>
      <a href={job.job_description_url} target="_blank" rel="noopener noreferrer">
        View full job description
      </a>
    </Button>
  </div>
)}
                  {job.requirements && (
                    <div>
                      <h4 className="font-medium mb-2">Requirements:</h4>
                      <div className="flex flex-wrap gap-1">
                        {job.requirements.split(',').map((req, index) => (
                          <Badge key={index} variant="secondary">
                            {req.trim()}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Job Form Dialog */}
        <Dialog open={showJobForm} onOpenChange={(o) => { if (!o) resetForm(); setShowJobForm(o); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">

            {/* Step 1: URL import only */}
            {importStep === 'import' && (
              <>
                <DialogHeader>
                  <DialogTitle>Create a Job Posting</DialogTitle>
                  <DialogDescription>
                    Import from an existing posting or fill in manually
                  </DialogDescription>
                </DialogHeader>
                <div className="py-6 space-y-4">
                  <Input
                    placeholder="Paste a job URL from LinkedIn, Greenhouse, Lever, Workday, Indeed, Glassdoor, BambooHR, Rippling, Ashby, or JazzHR..."
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                  />
                  <Button
                    type="button"
                    onClick={handleImport}
                    disabled={importing || !importUrl.trim()}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    size="lg"
                  >
                    {importing ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reading job posting...</>
                    ) : 'Import Job'}
                  </Button>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => { setImportError(''); setImportStep('form'); }}
                      className="text-sm text-gray-400 hover:text-gray-600 underline"
                    >
                      Skip — fill in manually →
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Full form */}
            {importStep === 'form' && (
              <>
                <DialogHeader>
                  <DialogTitle>{editingJob ? 'Edit Job' : 'Create a Job Posting'}</DialogTitle>
                  <DialogDescription>
                    {editingJob ? 'Update the job posting details' : 'Review and edit the details below'}
                  </DialogDescription>
                </DialogHeader>

                {importSuccess && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    Imported successfully — review and edit below
                  </div>
                )}
                {importError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {importError}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="title">Job Title *</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="company">Company *</Label>
                      <Input
                        id="company"
                        value={formData.company}
                        onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="location">Location *</Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="e.g., San Francisco, CA or Remote"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="type">Job Type *</Label>
                      <Select
                        value={formData.type}
                        onValueChange={(value: Job['type']) => setFormData(prev => ({ ...prev, type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full-time">Full-time</SelectItem>
                          <SelectItem value="part-time">Part-time</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                          <SelectItem value="remote">Remote</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="salaryRange">Salary Range</Label>
                    <Input
                      id="salaryRange"
                      value={formData.salaryRange}
                      onChange={(e) => setFormData(prev => ({ ...prev, salaryRange: e.target.value }))}
                      placeholder="e.g., $80k - $120k"
                    />
                  </div>

                  <div>
                    <Label htmlFor="jobDescriptionUrl">Job Description URL</Label>
                    <Input
                      id="jobDescriptionUrl"
                      type="url"
                      placeholder="https://example.com/job-description"
                      value={formData.jobDescriptionUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, jobDescriptionUrl: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Job Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={4}
                      placeholder="Describe the role and responsibilities..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="requirements">Requirements (comma-separated)</Label>
                    <Textarea
                      id="requirements"
                      value={formData.requirements}
                      onChange={(e) => setFormData(prev => ({ ...prev, requirements: e.target.value }))}
                      placeholder="e.g., React, TypeScript, 3+ years experience"
                      rows={3}
                    />
                  </div>

                  {editingJob && (
                    <div className="border-t pt-4 mt-6">
                      <h3 className="text-lg font-medium text-red-600 mb-2">Danger Zone</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Once you delete this job posting, there is no going back. Please be certain.
                      </p>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setShowDeleteDialog(editingJob)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Job Posting
                      </Button>
                    </div>
                  )}

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setShowJobForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingJob ? 'Update Job' : 'Create Job'}
                    </Button>
                  </DialogFooter>
                </form>
              </>
            )}

          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Job Posting</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{showDeleteDialog?.title}" at {showDeleteDialog?.company}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => showDeleteDialog && handleDelete(showDeleteDialog.id)}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Jobs;