import { createContext, useContext, useState, useEffect, type ReactNode, type Dispatch, type SetStateAction } from 'react';

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
// localStorage layer (tester feedback, Aug 2026): the in-memory context
// only survives sidebar navigation — a reload / tab close / browser quit
// discarded an in-progress JD. The draft (form fields + import-step
// state) is now mirrored to localStorage (debounced) and restored on
// mount, so leaving the browser mid-draft no longer loses the work.
// resetDraft() clears the mirror, so successful submit / explicit
// Cancel behave exactly as before.

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

// localStorage persistence for the new-job draft. Versioned key so a
// future JobFormData shape change can bump the suffix instead of
// migrating. Import error/success flags are deliberately NOT persisted —
// restoring a stale error banner after a reload would be confusing.
const DRAFT_STORAGE_KEY = 'sfc-job-draft-v1';

type StoredDraft = {
  formData: JobFormData;
  importStep: 'import' | 'form';
  importUrl: string;
};

function loadStoredDraft(): StoredDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.formData !== 'object') return null;
    // Merge over EMPTY_JOB_FORM so a draft stored before a new field was
    // added still hydrates every key.
    return {
      formData: { ...EMPTY_JOB_FORM, ...parsed.formData },
      importStep: parsed.importStep === 'form' ? 'form' : 'import',
      importUrl: typeof parsed.importUrl === 'string' ? parsed.importUrl : '',
    };
  } catch {
    return null;
  }
}

export function JobDraftProvider({ children }: { children: ReactNode }) {
  // Lazy initializers restore any stored draft synchronously on first
  // render — no flash of an empty form before a useEffect fills it in.
  const [formData, setFormData] = useState<JobFormData>(() => loadStoredDraft()?.formData ?? EMPTY_JOB_FORM);
  const [importStep, setImportStep] = useState<'import' | 'form'>(() => loadStoredDraft()?.importStep ?? 'import');
  const [importUrl, setImportUrl] = useState(() => loadStoredDraft()?.importUrl ?? '');
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState('');

  // Debounced mirror to localStorage. Skips writing when the draft is
  // pristine (identical to the empty state) so we don't create a stored
  // draft for a recruiter who never typed anything — and so resetDraft's
  // removeItem isn't immediately undone by this effect re-firing.
  useEffect(() => {
    const handle = setTimeout(() => {
      try {
        const pristine =
          JSON.stringify(formData) === JSON.stringify(EMPTY_JOB_FORM) &&
          importStep === 'import' && importUrl === '';
        if (pristine) {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        } else {
          localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ formData, importStep, importUrl } satisfies StoredDraft));
        }
      } catch {
        // Storage full / blocked (private mode) — in-memory draft still works.
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [formData, importStep, importUrl]);

  const resetDraft = () => {
    setFormData(EMPTY_JOB_FORM);
    setImportStep('import');
    setImportUrl('');
    setImportSuccess(false);
    setImportError('');
    try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* ignore */ }
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
