import { useState, useRef } from 'react';
import { CheckCircle2, Upload, Loader2, ChevronRight, ChevronLeft, X, Plus, Shield, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 'landing' | 'form' | 'disqualified' | 'success';

interface FormState {
  // Step 1 – Qualification
  email: string;
  phone: string;
  background: string;
  experience: string;
  targetComp: string;
  // Step 2 – Contact
  firstName: string;
  lastName: string;
  linkedin: string;
  committed: boolean;
  // Step 3 – Resume
  resumeFile: File | null;
  resumeText: string;
  resumeParsed: any | null;
  resumeBase64: string;
  // Step 4 – Review & Edit
  currentRole: string;
  location: string;
  yearsExperience: string;
  education: string;
  educationLevel: string;
  skills: string[];
  bio: string;
  sectors: string[];
  // Step 5 – Availability
  jobSearchStatus: string;
  targetCompStep5: string;
  preferredLocations: string[];
  targetRoles: string[];
  openToRelocation: boolean;
}

const INITIAL_FORM: FormState = {
  email: '', phone: '', background: '', experience: '', targetComp: '',
  firstName: '', lastName: '', linkedin: '', committed: false,
  resumeFile: null, resumeText: '', resumeParsed: null, resumeBase64: '',
  currentRole: '', location: '', yearsExperience: '', education: '',
  educationLevel: '', skills: [], bio: '', sectors: [],
  jobSearchStatus: '', targetCompStep5: '', preferredLocations: [],
  targetRoles: [], openToRelocation: false,
};

const SECTORS = [
  'Fintech', 'Consumer/CPG', 'SaaS/Technology', 'Healthcare',
  'Real Estate', 'Private Equity', 'Investment Banking', 'Consulting',
  'Energy', 'Media', 'Marketplace', 'Financial Services',
];

const TARGET_ROLES = [
  'FP&A', 'Corp Dev / M&A', 'Investor Relations', 'Treasury',
  'Accounting / Controller', 'Business Finance / BizOps',
  'Private Equity', 'Venture Capital', 'Investment Banking',
  'Strategy & Operations', 'CFO / VP Finance', 'Other',
];

const LOCATIONS = [
  'New York, NY', 'San Francisco, CA', 'Los Angeles, CA', 'Chicago, IL',
  'Boston, MA', 'Austin, TX', 'Seattle, WA', 'Miami, FL',
  'Remote', 'Open to relocation',
];

const COMP_OPTIONS = [
  { value: 'under-70k', label: 'Under $70k' },
  { value: '70k-100k', label: '$70k – $100k' },
  { value: '100k-150k', label: '$100k – $150k' },
  { value: '150k-200k', label: '$150k – $200k' },
  { value: '200k-300k', label: '$200k – $300k' },
  { value: '300k-plus', label: '$300k+' },
];

const JOB_STATUSES = [
  'Actively looking — open to the right opportunity now',
  'Passively exploring — not urgently searching',
  'Just networking — not actively seeking',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDisqualified(form: FormState): boolean {
  if (form.background === 'no') return true;
  if (form.experience === 'under2') return true;
  if (form.targetComp === 'under-70k') return true;
  return false;
}

function extractTextFromPDF(buffer: ArrayBuffer): string {
  // Simple byte-level text extraction from PDF
  const bytes = new Uint8Array(buffer);
  let text = '';
  for (let i = 0; i < bytes.length - 1; i++) {
    const c = bytes[i];
    if (c >= 32 && c < 127) {
      text += String.fromCharCode(c);
    } else if (c === 10 || c === 13) {
      text += ' ';
    }
  }
  // Remove repeated spaces
  return text.replace(/\s{3,}/g, ' ').trim();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RadioGroup({ name, options, value, onChange }: {
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2 mt-2">
      {options.map(opt => (
        <label
          key={opt.value}
          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
            value === opt.value
              ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="sr-only"
          />
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
            value === opt.value ? 'border-emerald-500' : 'border-gray-300'
          }`}>
            {value === opt.value && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
          </div>
          <span className="text-sm font-medium">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

function CheckboxGrid({ options, selected, onChange }: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(s => s !== val) : [...selected, val]);
  };
  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      {options.map(opt => (
        <label
          key={opt}
          className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer text-sm transition-all ${
            selected.includes(opt)
              ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
              : 'border-gray-200 hover:border-gray-300 text-gray-700'
          }`}
        >
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => toggle(opt)}
            className="sr-only"
          />
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
            selected.includes(opt) ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
          }`}>
            {selected.includes(opt) && <CheckCircle2 className="w-3 h-3 text-white" />}
          </div>
          {opt}
        </label>
      ))}
    </div>
  );
}

function SkillsInput({ skills, onChange }: { skills: string[]; onChange: (s: string[]) => void }) {
  const [inputVal, setInputVal] = useState('');
  const add = () => {
    const trimmed = inputVal.trim();
    if (trimmed && !skills.includes(trimmed)) onChange([...skills, trimmed]);
    setInputVal('');
  };
  return (
    <div>
      <div className="flex gap-2 mt-2">
        <Input
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="e.g. Financial Modeling, LBO, SQL..."
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {skills.map(s => (
          <span
            key={s}
            className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-sm"
          >
            {s}
            <button type="button" onClick={() => onChange(skills.filter(x => x !== s))}>
              <X className="w-3 h-3 hover:text-red-500" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;

export default function CandidateApply() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (field: keyof FormState, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  // ── Navigation ──────────────────────────────────────────────────────────────

  const canProceedStep1 = form.background && form.experience && form.targetComp && form.email;
  const canProceedStep2 = form.firstName && form.lastName && form.committed;
  const canProceedStep3 = form.resumeParsed !== null;
  const canProceedStep4 = form.currentRole && form.location && form.yearsExperience;
  const canProceedStep5 = form.jobSearchStatus && form.targetCompStep5;

  const canProceed = [
    null,
    canProceedStep1,
    canProceedStep2,
    canProceedStep3,
    canProceedStep4,
    canProceedStep5,
    true, // Step 6 preview — always can submit
  ][step];

  const handleNext = () => {
    if (step === 1) {
      if (isDisqualified(form)) {
        setScreen('disqualified');
        return;
      }
      // Pre-fill targetCompStep5 from step 1
      if (!form.targetCompStep5) set('targetCompStep5', form.targetComp);
    }
    if (step < TOTAL_STEPS) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(s => s - 1);
    else setScreen('landing');
  };

  // ── Resume Upload & Parse ───────────────────────────────────────────────────

  const handleResumeUpload = async (file: File) => {
    set('resumeFile', file);
    setParsing(true);
    setParseError('');

    try {
      // Extract text: try readAsText first, then byte fallback
      let text = '';
      try {
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve((e.target?.result as string) || '');
          reader.onerror = reject;
          reader.readAsText(file);
        });
      } catch {
        text = '';
      }

      if (text.length < 100) {
        // Fallback: byte-level extraction
        const buffer = await file.arrayBuffer();
        text = extractTextFromPDF(buffer);
      }

      // Get base64 for later upload
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
          const result = e.target?.result as string;
          // Strip the data URL prefix
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      set('resumeBase64', base64);

      if (text.length < 50) {
        setParseError('Could not extract text from your PDF. Please try a text-based PDF or paste your resume text below.');
        setParsing(false);
        return;
      }

      // Parse via API
      const res = await fetch('/api/parse-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Parse failed');
      }

      const parsed = await res.json();
      set('resumeParsed', parsed);

      // Pre-fill review fields
      if (parsed.currentRole) set('currentRole', parsed.currentRole);
      if (parsed.location) set('location', parsed.location);
      if (parsed.yearsExperience != null) set('yearsExperience', String(parsed.yearsExperience));
      if (parsed.education) set('education', parsed.education);
      if (parsed.educationLevel) set('educationLevel', parsed.educationLevel);
      if (parsed.bio) set('bio', parsed.bio);
      if (Array.isArray(parsed.skills) && parsed.skills.length > 0) set('skills', parsed.skills);
      if (Array.isArray(parsed.sectors) && parsed.sectors.length > 0) set('sectors', parsed.sectors);
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse resume. Please try again.');
    } finally {
      setParsing(false);
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/submit-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || null,
          linkedin: form.linkedin || null,
          currentRole: form.currentRole,
          location: form.location,
          yearsExperience: Number(form.yearsExperience) || 0,
          education: form.education,
          educationLevel: form.educationLevel,
          bio: form.bio,
          skills: form.skills,
          sectors: form.sectors,
          jobSearchStatus: form.jobSearchStatus,
          targetComp: form.targetCompStep5,
          preferredLocations: form.preferredLocations,
          targetRoles: form.targetRoles,
          openToRelocation: form.openToRelocation,
          resumeBase64: form.resumeBase64 || null,
          resumeFileName: form.resumeFile?.name || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Submission failed');
      }

      setScreen('success');
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Screens ─────────────────────────────────────────────────────────────────

  if (screen === 'landing') {
    return (
      <div className="min-h-screen bg-white">
        {/* Nav bar */}
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <span className="font-bold text-lg text-gray-900 tracking-tight">SFC Talent</span>
        </div>

        {/* Hero */}
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <span className="inline-block mb-5 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full uppercase">
            Finance & Investing Professionals
          </span>
          <h1 className="text-4xl font-bold text-gray-900 mb-5 leading-tight tracking-tight">
            Get Matched With Top Finance Roles — Privately
          </h1>
          <p className="text-lg text-gray-500 mb-10 leading-relaxed">
            Join SFC Talent to access exclusive opportunities at leading companies. Your identity stays
            anonymous until you choose to connect.
          </p>
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-3 text-base font-semibold"
            onClick={() => setScreen('form')}
          >
            Apply Now <ChevronRight className="ml-2 w-4 h-4" />
          </Button>
          <p className="text-sm text-gray-400 mt-4">Takes about 5 minutes · 100% free</p>
        </div>

        {/* Value props */}
        <div className="max-w-4xl mx-auto px-6 pb-20 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              icon: Shield,
              title: 'Completely Anonymous',
              desc: 'Your name, company, and contact info stay private until you approve an introduction.',
            },
            {
              icon: Users,
              title: 'Curated Opportunities',
              desc: 'Only top-tier companies actively seeking strategic finance talent reach out to you.',
            },
            {
              icon: Clock,
              title: 'Fast Process',
              desc: 'Most candidates hear back within 24 hours. No job boards, no cold applications.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-6 border border-gray-100 rounded-xl bg-gray-50">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (screen === 'disqualified') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl">👋</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Not Quite a Fit Right Now</h2>
          <p className="text-gray-500 mb-6 leading-relaxed">
            Thank you for your interest in SFC Talent. At the moment, our platform is focused on
            finance and investing professionals with at least 2 years of experience and a target
            compensation above $70k. We hope to expand our reach in the future.
          </p>
          <p className="text-gray-500 mb-8 text-sm">
            We've noted your interest — if our criteria expand, we may be in touch.
          </p>
          <Button
            variant="outline"
            onClick={() => { setScreen('form'); setStep(1); }}
            className="mr-3"
          >
            Go Back
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => window.location.href = 'https://strategicfinancecareers.com'}
          >
            Visit SFC
          </Button>
        </div>
      </div>
    );
  }

  if (screen === 'success') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            You're in, {form.firstName}!
          </h2>
          <p className="text-gray-500 mb-4 leading-relaxed">
            Your anonymous profile has been submitted for review. Our team will review it within
            1–2 business days.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            We'll reach out to <strong>{form.email}</strong> once your profile is live and when
            recruiters express interest.
          </p>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => window.location.href = 'https://strategicfinancecareers.com'}
          >
            Back to SFC
          </Button>
        </div>
      </div>
    );
  }

  // ── Multi-step Form ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg text-gray-900 tracking-tight">SFC Talent</span>
        <span className="text-sm text-gray-400">Step {step} of {TOTAL_STEPS}</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-1 bg-emerald-500 transition-all duration-500"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      <div className="max-w-lg mx-auto px-6 py-10">

        {/* ── Step 1: Qualification ── */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Quick Fit Check</h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              SFC Talent connects curated professionals with top companies. We're currently focused
              on finance and investing roles — here's a quick check to make sure we're a good match.
            </p>

            <div className="space-y-6">
              <div>
                <Label>Email address <span className="text-red-500">*</span></Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="you@example.com"
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Phone number <span className="text-gray-400 text-xs font-normal">(optional)</span></Label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Do you have a background in finance, accounting, or investing?</Label>
                <RadioGroup
                  name="background"
                  value={form.background}
                  onChange={v => set('background', v)}
                  options={[
                    { value: 'yes_finance', label: 'Yes — finance, accounting, FP&A, banking, PE, or similar' },
                    { value: 'adjacent', label: 'Adjacent — strategy, ops, or related field' },
                    { value: 'no', label: 'No — different background' },
                  ]}
                />
              </div>

              <div>
                <Label>Years of full-time professional experience?</Label>
                <RadioGroup
                  name="experience"
                  value={form.experience}
                  onChange={v => set('experience', v)}
                  options={[
                    { value: 'under2', label: 'Under 2 years' },
                    { value: '2to5', label: '2 – 5 years' },
                    { value: '5to10', label: '5 – 10 years' },
                    { value: '10plus', label: '10+ years' },
                  ]}
                />
              </div>

              <div>
                <Label>What is your total cash compensation target?</Label>
                <RadioGroup
                  name="targetComp"
                  value={form.targetComp}
                  onChange={v => set('targetComp', v)}
                  options={COMP_OPTIONS}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Contact Info ── */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Contact Information</h2>
            <p className="text-gray-500 mb-8 text-sm">
              This is kept private and only shared with your explicit consent.
            </p>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First name <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.firstName}
                    onChange={e => set('firstName', e.target.value)}
                    placeholder="Jane"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Last name <span className="text-red-500">*</span></Label>
                  <Input
                    value={form.lastName}
                    onChange={e => set('lastName', e.target.value)}
                    placeholder="Smith"
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label>LinkedIn profile URL <span className="text-gray-400 text-xs font-normal">(optional)</span></Label>
                <Input
                  value={form.linkedin}
                  onChange={e => set('linkedin', e.target.value)}
                  placeholder="https://linkedin.com/in/janesmith"
                  className="mt-2"
                />
              </div>

              <div>
                <Label className="block mb-1">Email address</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  className="mt-2 bg-gray-50"
                />
              </div>

              <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:border-emerald-300 transition-colors">
                <input
                  type="checkbox"
                  checked={form.committed}
                  onChange={e => set('committed', e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-sm text-gray-700">
                  I'm genuinely open to exploring new opportunities and can respond to introductions
                  within 48 hours.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* ── Step 3: Resume Upload ── */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Your Resume</h2>
            <p className="text-gray-500 mb-8 text-sm">
              We'll use AI to extract your profile automatically. PDF format works best.
            </p>

            {/* Upload area */}
            {!form.resumeParsed && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleResumeUpload(file);
                  }}
                />
                {parsing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    <p className="text-sm text-gray-500">Parsing your resume with AI…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="w-8 h-8 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Click to upload your resume</p>
                      <p className="text-xs text-gray-400 mt-1">PDF only · Max 10MB</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {parseError && (
              <p className="text-sm text-red-600 mt-3 p-3 bg-red-50 rounded-lg">{parseError}</p>
            )}

            {/* Success state */}
            {form.resumeParsed && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Resume parsed successfully!</p>
                    <p className="text-xs text-emerald-600">{form.resumeFile?.name}</p>
                  </div>
                  <button
                    className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline"
                    onClick={() => {
                      set('resumeParsed', null);
                      set('resumeFile', null);
                      set('resumeBase64', '');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    Change
                  </button>
                </div>

                {/* Preview of parsed data */}
                <div className="p-4 border border-gray-200 rounded-xl space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Extracted Profile</p>
                  {[
                    ['Role', form.resumeParsed.currentRole],
                    ['Location', form.resumeParsed.location],
                    ['Experience', form.resumeParsed.yearsExperience != null ? `${form.resumeParsed.yearsExperience} years` : ''],
                    ['Education', form.resumeParsed.education],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label} className="flex gap-2 text-sm">
                      <span className="text-gray-400 w-24 shrink-0">{label}</span>
                      <span className="text-gray-700 font-medium">{value}</span>
                    </div>
                  ))}
                  {Array.isArray(form.resumeParsed.skills) && form.resumeParsed.skills.length > 0 && (
                    <div className="flex gap-2 text-sm pt-1">
                      <span className="text-gray-400 w-24 shrink-0">Skills</span>
                      <div className="flex flex-wrap gap-1">
                        {form.resumeParsed.skills.slice(0, 6).map((s: string) => (
                          <span key={s} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">{s}</span>
                        ))}
                        {form.resumeParsed.skills.length > 6 && (
                          <span className="text-xs text-gray-400">+{form.resumeParsed.skills.length - 6} more</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Review & Edit ── */}
        {step === 4 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Your Profile</h2>
            <p className="text-gray-500 mb-8 text-sm">
              Edit anything that doesn't look right. This is what recruiters will see (anonymously).
            </p>

            <div className="space-y-5">
              <div>
                <Label>Current / most recent role <span className="text-red-500">*</span></Label>
                <Input
                  value={form.currentRole}
                  onChange={e => set('currentRole', e.target.value)}
                  placeholder="e.g. Senior Finance Manager"
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Location (city, state) <span className="text-red-500">*</span></Label>
                <Input
                  value={form.location}
                  onChange={e => set('location', e.target.value)}
                  placeholder="e.g. New York, NY"
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Years of experience <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={form.yearsExperience}
                  onChange={e => set('yearsExperience', e.target.value)}
                  placeholder="e.g. 5"
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Education (degree + field, no school name)</Label>
                <Input
                  value={form.education}
                  onChange={e => set('education', e.target.value)}
                  placeholder="e.g. MBA, Finance"
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Education level</Label>
                <RadioGroup
                  name="educationLevel"
                  value={form.educationLevel}
                  onChange={v => set('educationLevel', v)}
                  options={[
                    { value: 'Bachelors', label: "Bachelor's" },
                    { value: 'Masters', label: "Master's" },
                    { value: 'MBA', label: 'MBA' },
                    { value: 'PhD', label: 'PhD' },
                  ]}
                />
              </div>

              <div>
                <Label>Anonymous bio (2–3 sentences, no company/school names)</Label>
                <Textarea
                  value={form.bio}
                  onChange={e => set('bio', e.target.value)}
                  placeholder="A finance professional with 5+ years of experience in FP&A and strategic planning, known for building scalable models and driving cost efficiencies..."
                  rows={4}
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Skills</Label>
                <p className="text-xs text-gray-400 mt-0.5">Press Enter to add each skill</p>
                <SkillsInput skills={form.skills} onChange={v => set('skills', v)} />
              </div>

              <div>
                <Label>Industries / sectors (select all that apply)</Label>
                <CheckboxGrid
                  options={SECTORS}
                  selected={form.sectors}
                  onChange={v => set('sectors', v)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 5: Availability ── */}
        {step === 5 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Preferences</h2>
            <p className="text-gray-500 mb-8 text-sm">
              Help us match you with the right opportunities.
            </p>

            <div className="space-y-6">
              <div>
                <Label>Current job search status <span className="text-red-500">*</span></Label>
                <RadioGroup
                  name="jobSearchStatus"
                  value={form.jobSearchStatus}
                  onChange={v => set('jobSearchStatus', v)}
                  options={JOB_STATUSES.map(s => ({ value: s, label: s }))}
                />
              </div>

              <div>
                <Label>Target total cash compensation (base + bonus) <span className="text-red-500">*</span></Label>
                <RadioGroup
                  name="targetCompStep5"
                  value={form.targetCompStep5}
                  onChange={v => set('targetCompStep5', v)}
                  options={COMP_OPTIONS}
                />
              </div>

              <div>
                <Label>Preferred locations (select all that apply)</Label>
                <CheckboxGrid
                  options={LOCATIONS}
                  selected={form.preferredLocations}
                  onChange={v => set('preferredLocations', v)}
                />
              </div>

              <div>
                <Label>Target roles (select all that apply)</Label>
                <CheckboxGrid
                  options={TARGET_ROLES}
                  selected={form.targetRoles}
                  onChange={v => set('targetRoles', v)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 6: Preview ── */}
        {step === 6 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Anonymous Profile</h2>
            <p className="text-gray-500 mb-8 text-sm">
              This is exactly what recruiters will see. Your identity is fully protected.
            </p>

            {/* Anonymous profile card */}
            <div className="border border-gray-200 rounded-2xl p-6 bg-white shadow-sm mb-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {(form.currentRole || 'F')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-base">{form.currentRole || 'Finance Professional'}</p>
                  <p className="text-sm text-gray-500">{form.location || 'Location not set'} · {form.yearsExperience || '?'} yrs experience</p>
                  <p className="text-xs text-gray-400 mt-0.5">{form.educationLevel ? `${form.educationLevel} · ` : ''}{form.education}</p>
                </div>
              </div>

              {form.bio && (
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{form.bio}</p>
              )}

              {form.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {form.skills.map(s => (
                    <span key={s} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">{s}</span>
                  ))}
                </div>
              )}

              {form.sectors.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.sectors.map(s => (
                    <span key={s} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs">{s}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 mb-6">
              <strong>Note:</strong> Your profile will be reviewed by our team before going live. We'll
              email you at <strong>{form.email}</strong> once it's approved.
            </div>

            {submitError && (
              <p className="text-sm text-red-600 p-3 bg-red-50 rounded-lg mb-4">{submitError}</p>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3 mt-10">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={submitting}
            className="flex-1"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>

          {step < TOTAL_STEPS ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
              ) : (
                <>Submit Application <ChevronRight className="w-4 h-4 ml-1" /></>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
