import { createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react';

// In-progress NEW-job draft, hoisted above <Outlet /> in Layout so it
// survives recruiter-sidebar navigation (the cause of bug #1.15: form
// state held in route components died when React Router unmounted
// Jobs.tsx / CandidateSearch.tsx on tab switch). Both job-creation
// surfaces — Jobs.tsx's inline form and the shared JobForm dialog
// rendered from CandidateSearch.tsx — read/write the same draft so a
// recruiter can start filling out a posting on one surface and find
// their work intact on the other.
//
// EDIT-existing-job state is deliberately NOT in this context — that
// path is per-row, ephemeral, and seeded from the row being edited.
// Mixing it with the new-job draft would let an in-flight edit
// overwrite a separate new-job draft (and vice versa). Edit-mode
// callers keep their own local state and leave this context alone.
//
// No localStorage layer in this pass: the bug is "switch sidebar
// tabs", which the in-memory context fully covers. A full page
// reload / tab close still discards the draft (acceptable per spec).

export type JobFormData = {
  title: string;
  company: string;
  location: string;
  type: 'full-time' | 'part-time' | 'contract' | 'remote';
  salaryRange: string;
  jobDescriptionUrl: string;
  description: string;
  requirements: string;
};

export const EMPTY_JOB_FORM: JobFormData = {
  title: '',
  company: '',
  location: '',
  type: 'full-time',
  salaryRange: '',
  jobDescriptionUrl: '',
  description: '',
  requirements: '',
};

export type JobDraftValue = {
  formData: JobFormData;
  setFormData: Dispatch<SetStateAction<JobFormData>>;
  importStep: 'import' | 'form';
  setImportStep: Dispatch<SetStateAction<'import' | 'form'>>;
  importUrl: string;
  setImportUrl: Dispatch<SetStateAction<string>>;
  importSuccess: boolean;
  setImportSuccess: Dispatch<SetStateAction<boolean>>;
  importError: string;
  setImportError: Dispatch<SetStateAction<string>>;
  // Single reset entry point. Callers fire it on successful submit
  // AND on explicit Cancel (the same trigger points the old local
  // resetForm() fired at). It must NOT be called on mere navigate-
  // away — that's the bug. Navigate-away never fires Dialog's
  // onOpenChange callback (the component is simply destroyed by
  // React Router), so the existing onOpenChange-keyed reset is
  // safe to leave in place as long as we don't add extra resets.
  resetDraft: () => void;
};

const JobDraftContext = createContext<JobDraftValue | null>(null);

export function JobDraftProvider({ children }: { children: ReactNode }) {
  const [formData, setFormData] = useState<JobFormData>(EMPTY_JOB_FORM);
  const [importStep, setImportStep] = useState<'import' | 'form'>('import');
  const [importUrl, setImportUrl] = useState('');
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState('');

  const resetDraft = () => {
    setFormData(EMPTY_JOB_FORM);
    setImportStep('import');
    setImportUrl('');
    setImportSuccess(false);
    setImportError('');
  };

  return (
    <JobDraftContext.Provider
      value={{
        formData, setFormData,
        importStep, setImportStep,
        importUrl, setImportUrl,
        importSuccess, setImportSuccess,
        importError, setImportError,
        resetDraft,
      }}
    >
      {children}
    </JobDraftContext.Provider>
  );
}

export function useJobDraft(): JobDraftValue {
  const ctx = useContext(JobDraftContext);
  if (!ctx) {
    throw new Error('useJobDraft must be used inside <JobDraftProvider> (mounted in Layout.tsx)');
  }
  return ctx;
}
