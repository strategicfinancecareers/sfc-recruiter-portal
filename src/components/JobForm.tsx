import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface JobFormData {
  title: string;
  company: string;
  location: string;
  type: 'full-time' | 'part-time' | 'contract' | 'remote';
  salaryRange: string;
  jobDescriptionUrl: string;
  description: string;
  requirements: string;
}

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

interface JobFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobCreated?: (job: Job) => void;
  editingJob?: Job | null;
}

export function JobForm({ open, onOpenChange, onJobCreated, editingJob }: JobFormProps) {
  const { toast } = useToast();
  const { session } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [showImport, setShowImport] = useState(!editingJob);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState('');

const [formData, setFormData] = useState<JobFormData>({
  title: editingJob?.title || '',
  company: editingJob?.company || '',
  location: editingJob?.location || '',
  type: editingJob?.type || 'full-time',
  salaryRange: editingJob?.salary_range || '',
  jobDescriptionUrl: editingJob?.job_description_url || '',
  description: editingJob?.description || '',
  requirements: editingJob?.requirements || '',
});

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
};

  const handleImport = async () => {
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError('');
    setImportSuccess(false);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
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
          system: 'You are a job posting parser. Extract job details from the provided URL content and return ONLY a JSON object with these exact fields: title, company, location, type (must be one of: full-time, part-time, contract, remote), salary_range, description, requirements. If a field cannot be determined, use null. Return only valid JSON, no other text.',
          messages: [{ role: 'user', content: `Parse this job posting URL and extract the job details: ${importUrl}` }],
        }),
      });

      if (!response.ok) throw new Error('API request failed');

      const data = await response.json();
      const text = data.content?.[0]?.text ?? '';
      const parsed = JSON.parse(text);
      const validTypes = ['full-time', 'part-time', 'contract', 'remote'];

      setFormData(prev => ({
        ...prev,
        title: parsed.title || prev.title,
        company: parsed.company || prev.company,
        location: parsed.location || prev.location,
        type: validTypes.includes(parsed.type) ? parsed.type as JobFormData['type'] : prev.type,
        salaryRange: parsed.salary_range || prev.salaryRange,
        description: parsed.description || prev.description,
        requirements: parsed.requirements || prev.requirements,
      }));

      setImportSuccess(true);
      setShowImport(false);
    } catch {
      setImportError("Couldn't read that URL. Please fill in the details manually.");
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    
    setSubmitting(true);
    
    try {
      console.log('[JobForm] handleSubmit start', { editing: !!editingJob });
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

      console.time('[JobForm] upsert');
      if (editingJob) {
        const { data, error } = await supabase
          .from('jobs')
          .update(jobData)
          .eq('id', editingJob.id)
          .select()
          .single();

        if (error) throw error;
        console.timeEnd('[JobForm] upsert');

        toast({
          title: "Job updated",
          description: "The job posting has been successfully updated.",
        });

        onJobCreated?.(data as unknown as Job);
      } else {
        const { data, error } = await supabase
          .from('jobs')
          .insert([jobData])
          .select()
          .single();

        if (error) throw error;
        console.timeEnd('[JobForm] upsert');

        toast({
          title: "Job created",
          description: "New job posting has been created successfully.",
        });

        onJobCreated?.(data as unknown as Job);
      }
      
      onOpenChange(false);
      resetForm();
      console.log('[JobForm] handleSubmit success');
    } catch (error) {
      console.error('Error saving job:', error);
      toast({
        title: "Error",
        description: "Failed to save job posting.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      console.log('[JobForm] handleSubmit finally');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingJob ? 'Edit Job' : 'Create New Job'}</DialogTitle>
          <DialogDescription>
            {editingJob ? 'Update the job posting details' : 'Fill in the details for your job posting'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* URL Import */}
          {showImport && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <p className="text-sm font-semibold text-gray-900 mb-0.5">Import from job posting</p>
              <p className="text-xs text-gray-500 mb-3">
                Paste a link from LinkedIn, Greenhouse, Lever, Workday, Indeed, Glassdoor, BambooHR, Rippling, Ashby, or JazzHR to auto-fill this form
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Paste job posting URL..."
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={handleImport}
                  disabled={importing || !importUrl.trim()}
                >
                  {importing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Reading...
                    </>
                  ) : 'Import'}
                </Button>
              </div>
              {importError && (
                <p className="text-xs text-red-600 mt-2">{importError}</p>
              )}
              <button
                type="button"
                onClick={() => setShowImport(false)}
                className="text-xs text-gray-400 hover:text-gray-600 mt-2 underline"
              >
                Skip, fill manually
              </button>
            </div>
          )}

          {importSuccess && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              Job details imported! Review and edit below before saving.
            </div>
          )}

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
                onValueChange={(value: JobFormData['type']) => setFormData(prev => ({ ...prev, type: value }))}
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingJob ? 'Update Job' : 'Create Job'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}