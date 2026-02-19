import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
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