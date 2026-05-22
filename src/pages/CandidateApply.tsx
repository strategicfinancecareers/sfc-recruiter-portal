import { useState, useRef } from 'react';
import {
  CheckCircle2, Upload, Loader2, ChevronRight, ChevronLeft,
  X, Plus, Shield, MessageCircle, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPANY_LOGOS = [
  'Goldman Sachs', 'McKinsey', 'Google', 'Meta', 'Stripe',
  'Blackstone', 'KKR', 'Citadel', 'JP Morgan', 'Bain', 'BCG', 'Sequoia',
];

const PRIMARY_BACKGROUNDS = [
  {
    value: 'Capital Markets & Investing',
    subtitle: 'Investment Banking, Private Equity, Venture Capital, Equity Research, Corporate Banking, Sales & Trading, Investor Relations',
  },
  {
    value: 'Corporate Finance & FP&A',
    subtitle: 'Strategic Finance, FP&A, Corporate Finance, Treasury, Commercial Finance, Business Finance, Corporate Development',
  },
  {
    value: 'Strategy & Operations',
    subtitle: 'Management Consulting, Business Operations, Strategy, Chief of Staff, Revenue Operations, Analytics',
  },
  {
    value: 'Accounting & Compliance',
    subtitle: 'Accounting, Audit, Tax, Bookkeeping, Payroll Operations, AP/AR, Compliance',
  },
];

const DETAILED_EXPERIENCE_MAP: Record<string, string[]> = {
  'Capital Markets & Investing': [
    'Investment Banking', 'Private Equity', 'Venture Capital', 'Equity Research',
    'Corporate Banking', 'M&A Advisory', 'Sales & Trading', 'Investor Relations',
  ],
  'Corporate Finance & FP&A': [
    'Strategic Finance', 'FP&A', 'Corporate Finance', 'Treasury',
    'Commercial Finance', 'Business Finance', 'Corporate Development',
  ],
  'Strategy & Operations': [
    'Management Consulting', 'Business Operations', 'Strategy', 'Chief of Staff',
    'Revenue Operations', 'Analytics', 'Data Analysis',
  ],
  'Accounting & Compliance': [
    'Accounting', 'Audit', 'Tax', 'Bookkeeping',
    'Payroll Operations', 'AP/AR', 'Compliance', 'Financial Reporting',
  ],
};

const SECTORS = [
  'Fintech', 'Consumer/CPG', 'SaaS/Technology', 'Healthcare',
  'Real Estate', 'Private Equity', 'Investment Banking', 'Consulting',
  'Energy', 'Media', 'Marketplace', 'Financial Services',
];

const TARGET_ROLES = [
  'Strategic Finance',
  'Corporate Development',
  'Strategy & Operations',
  'FP&A',
  'Chief of Staff',
  'Finance Manager / Director',
  'VP Finance / CFO',
];

const PREFERRED_CITIES = [
  'New York', 'San Francisco / Bay Area', 'Los Angeles', 'Chicago',
  'Boston', 'Austin', 'Miami', 'Seattle', 'Denver', 'Washington D.C.',
  'Open to relocation', 'No preference',
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

const WORK_PREFERENCES = [
  { value: 'Remote', label: '🏠 Remote', desc: 'Fully remote only' },
  { value: 'Hybrid', label: '🏢 Hybrid', desc: 'Mix of remote and in-office' },
  { value: 'In-Office', label: '🏙️ In-Office', desc: 'Prefer to be in office' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 'landing' | 'form' | 'disqualified' | 'success';

interface FormState {
  // Step 1 – Qualification
  email: string;
  primaryBackground: string;
  secondaryBackgrounds: string[];
  detailedExperience: string[];
  experience: string;
  targetComp: string;
  // Step 2 – Contact
  firstName: string;
  lastName: string;
  phone: string;
  linkedin: string;
  committed: boolean;
  // Step 3 – Resume
  resumeFile: File | null;
  resumeBase64: string;
  resumeParsed: any | null;
  parseWarning: boolean;
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
  workPreference: string;
  preferredCities: string[];
  targetRoles: string[];
}

const INITIAL_FORM: FormState = {
  email: '', primaryBackground: '', secondaryBackgrounds: [], detailedExperience: [],
  experience: '', targetComp: '',
  firstName: '', lastName: '', phone: '', linkedin: '', committed: false,
  resumeFile: null, resumeBase64: '', resumeParsed: null, parseWarning: false,
  currentRole: '', location: '', yearsExperience: '', education: '',
  educationLevel: '', skills: [], bio: '', sectors: [],
  jobSearchStatus: '', targetCompStep5: '', workPreference: '', preferredCities: [], targetRoles: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDisqualified(form: FormState): boolean {
  return form.experience === 'under2' || form.targetComp === 'under-70k';
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
        <label key={opt.value} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
          value === opt.value ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 hover:border-gray-300'
        }`}>
          <input type="radio" name={name} value={opt.value} checked={value === opt.value}
            onChange={() => onChange(opt.value)} className="sr-only" />
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

function ChipGrid({ options, selected, onChange }: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter(s => s !== val) : [...selected, val]);
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {options.map(opt => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className={`px-3 py-1.5 rounded-full text-sm border font-medium transition-all ${
            selected.includes(opt)
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
          }`}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function CheckboxGrid({ options, selected, onChange }: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter(s => s !== val) : [...selected, val]);
  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      {options.map(opt => (
        <label key={opt} className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer text-sm transition-all ${
          selected.includes(opt) ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 hover:border-gray-300 text-gray-700'
        }`}>
          <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} className="sr-only" />
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
    const t = inputVal.trim();
    if (t && !skills.includes(t)) onChange([...skills, t]);
    setInputVal('');
  };
  return (
    <div>
      <div className="flex gap-2 mt-2">
        <Input value={inputVal} onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="e.g. Financial Modeling, LBO, SQL..." className="flex-1" />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {skills.map(s => (
          <span key={s} className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-sm">
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

function LogoScroll() {
  const doubled = [...COMPANY_LOGOS, ...COMPANY_LOGOS];
  return (
    <div className="w-full overflow-hidden py-8 bg-gray-50 border-y border-gray-100">
      <style>{`
        @keyframes sfc-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .sfc-logo-track { display:flex; width:max-content; animation: sfc-scroll 28s linear infinite; }
        .sfc-logo-track:hover { animation-play-state: paused; }
      `}</style>
      <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">
        Trusted by professionals from
      </p>
      <div className="sfc-logo-track">
        {doubled.map((name, i) => (
          <span key={i} className="mx-8 text-sm font-semibold text-gray-400 whitespace-nowrap select-none">
            {name}
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
  const [regenerating, setRegenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (field: keyof FormState, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  // ── Derived ─────────────────────────────────────────────────────────────────

  const detailOptions = DETAILED_EXPERIENCE_MAP[form.primaryBackground] ?? [];
  // Secondary backgrounds = all categories except primary
  const secondaryOptions = PRIMARY_BACKGROUNDS.filter(b => b.value !== form.primaryBackground);

  // ── Validation ──────────────────────────────────────────────────────────────

  const canProceedStep1 =
    form.email &&
    form.primaryBackground &&
    form.detailedExperience.length > 0 &&
    form.experience &&
    form.targetComp;

  const canProceedStep2 =
    form.firstName && form.lastName && form.phone.trim().length >= 7 && form.committed;

  const canProceedStep3 = form.resumeParsed !== null;

  const canProceedStep4 = form.currentRole && form.location && form.yearsExperience;

  const canProceedStep5 = form.jobSearchStatus && form.targetCompStep5 && form.workPreference;

  const canProceed = [null, canProceedStep1, canProceedStep2, canProceedStep3, canProceedStep4, canProceedStep5, true][step];

  // ── Navigation ──────────────────────────────────────────────────────────────

  const handleNext = () => {
    if (step === 1) {
      if (isDisqualified(form)) { setScreen('disqualified'); return; }
      if (!form.targetCompStep5) set('targetCompStep5', form.targetComp);
    }
    if (step < TOTAL_STEPS) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(s => s - 1);
    else setScreen('landing');
  };

  // ── Resume Upload & Parse ───────────────────────────────────────────────────

  const callParseAPI = async (base64: string): Promise<any> => {
    const res = await fetch('/api/parse-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeBase64: base64, filename: form.resumeFile?.name }),
    });
    return res.json();
  };

  const applyParsed = (parsed: any) => {
    if (parsed.parseError) {
      set('parseWarning', true);
    } else {
      set('parseWarning', false);
      if (parsed.currentRole) set('currentRole', parsed.currentRole);
      if (parsed.location) set('location', parsed.location);
      if (parsed.yearsExperience != null) set('yearsExperience', String(parsed.yearsExperience));
      if (parsed.education) set('education', parsed.education);
      if (parsed.educationLevel) set('educationLevel', parsed.educationLevel);
      if (parsed.bio) set('bio', parsed.bio);
      if (Array.isArray(parsed.skills) && parsed.skills.length > 0) set('skills', parsed.skills);
      if (Array.isArray(parsed.sectors) && parsed.sectors.length > 0) set('sectors', parsed.sectors);
    }
    set('resumeParsed', parsed);
  };

  const handleResumeUpload = async (file: File) => {
    set('resumeFile', file);
    set('resumeParsed', null);
    set('parseWarning', false);
    setParsing(true);

    try {
      // Read as ArrayBuffer, convert to base64 — PDFs are binary, cannot use readAsText
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });

      // Safe base64 encoding that handles large files
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8.length; i += chunkSize) {
        binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      set('resumeBase64', base64);

      const parsed = await callParseAPI(base64);
      applyParsed(parsed);
    } catch (err: any) {
      console.warn('[resume upload] error:', err.message);
      set('parseWarning', true);
      set('resumeParsed', { parseError: true });
    } finally {
      setParsing(false);
    }
  };

  const handleRegenerateBio = async () => {
    if (!form.resumeBase64) return;
    setRegenerating(true);
    try {
      const parsed = await callParseAPI(form.resumeBase64);
      if (!parsed.parseError && parsed.bio) {
        set('bio', parsed.bio);
      }
    } catch (err: any) {
      console.warn('[regenerate bio] error:', err.message);
    } finally {
      setRegenerating(false);
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
          phone: form.phone,
          linkedin: form.linkedin || null,
          currentRole: form.currentRole,
          location: form.location,
          yearsExperience: Number(form.yearsExperience) || 0,
          education: form.education,
          educationLevel: form.educationLevel,
          bio: form.bio,
          skills: form.skills,
          sectors: form.sectors,
          primaryBackground: form.primaryBackground,
          secondaryBackgrounds: form.secondaryBackgrounds,
          detailedExperience: form.detailedExperience,
          jobSearchStatus: form.jobSearchStatus,
          targetComp: form.targetCompStep5,
          workPreference: form.workPreference,
          preferredCities: form.preferredCities,
          targetRoles: form.targetRoles,
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

  // ── Landing ─────────────────────────────────────────────────────────────────

  if (screen === 'landing') {
    return (
      <div className="min-h-screen bg-white">
        <div className="border-b px-6 py-4 flex items-center">
          <span className="font-bold text-lg text-gray-900 tracking-tight">SFC Talent</span>
        </div>

        <div className="max-w-2xl mx-auto px-6 pt-20 pb-14 text-center">
          <span className="inline-block mb-5 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full uppercase">
            Finance Professionals
          </span>
          <h1 className="text-4xl font-bold text-gray-900 mb-5 leading-tight tracking-tight">
            Get Matched With Top Finance Roles — Privately
          </h1>
          <p className="text-lg text-gray-500 mb-10 leading-relaxed">
            Join SFC Talent to access exclusive opportunities at leading companies. Your identity
            stays anonymous until you choose to connect.
          </p>
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-3 text-base font-semibold"
            onClick={() => { setScreen('form'); setStep(1); }}
          >
            Join Now <ChevronRight className="ml-2 w-4 h-4" />
          </Button>
          <p className="text-sm text-gray-400 mt-4">
            Takes about 5 minutes · 100% free · Fully anonymous
          </p>
        </div>

        <LogoScroll />

        <div className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: MessageCircle,
                step: '1',
                title: 'Curated opportunities delivered directly',
                desc: 'Recruiters send introduction requests straight to your inbox. No job boards, no cold outreach.',
              },
              {
                icon: Shield,
                step: '2',
                title: 'Your identity stays protected',
                desc: "Your profile is completely anonymous. Your name, employer, and contact details are never revealed without your consent.",
              },
              {
                icon: CheckCircle2,
                step: '3',
                title: 'You stay in control',
                desc: 'Accept or decline any opportunity within 48 hours. No pressure, no obligation.',
              },
            ].map(({ icon: Icon, step: s, title, desc }) => (
              <div key={s} className="p-6 border border-gray-100 rounded-xl bg-gray-50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">{s}</div>
                  <Icon className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 text-sm leading-snug">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Disqualified ─────────────────────────────────────────────────────────────

  if (screen === 'disqualified') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl">👋</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Not Quite a Fit Right Now</h2>
          <p className="text-gray-500 mb-6 leading-relaxed">
            Thank you for your interest in SFC Talent. At the moment, our platform focuses on
            finance professionals with at least 2 years of experience and a target compensation
            above $70k. We hope to expand our reach in the future.
          </p>
          <p className="text-gray-500 mb-8 text-sm">We've noted your interest — if our criteria expand, we may be in touch.</p>
          <Button variant="outline" onClick={() => { setScreen('form'); setStep(1); }} className="mr-3">Go Back</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => { window.location.href = 'https://strategicfinancecareers.com'; }}>
            Visit SFC
          </Button>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────────

  if (screen === 'success') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6 py-16">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">You're in! 🎉</h2>
            <p className="text-gray-500 leading-relaxed">
              Your profile is live and visible to recruiters right now.
              When a recruiter requests an introduction, you'll receive an email like this:
            </p>
          </div>

          {/* Email preview mockup */}
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-6 shadow-sm">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
            </div>
            <div className="p-5 bg-white text-sm space-y-2">
              <div className="flex gap-2 text-gray-500 text-xs border-b border-gray-100 pb-3 mb-3">
                <div>
                  <p><span className="font-semibold text-gray-700">From:</span> SFC Talent &lt;noreply@strategicfinancecareers.com&gt;</p>
                  <p><span className="font-semibold text-gray-700">Subject:</span> New opportunity: VP of Finance at [Company]</p>
                </div>
              </div>
              <p className="text-gray-800">Hi {form.firstName || '[First Name]'},</p>
              <p className="text-gray-600 leading-relaxed">
                A company is interested in connecting with you about a <strong>VP of Finance</strong> role.
                The position offers <strong>$180,000 – $220,000</strong> total compensation.
              </p>
              <div className="flex gap-3 pt-2">
                <span className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-default">
                  ✅ Yes, I'm interested
                </span>
                <span className="inline-block px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold cursor-default">
                  ❌ No thanks
                </span>
              </div>
              <p className="text-xs text-gray-400 pt-1">You have 48 hours to respond.</p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-6 text-sm text-emerald-800 leading-relaxed">
            <p className="font-semibold mb-1">📬 Check your inbox</p>
            <p className="text-emerald-700 text-xs">
              We sent a welcome email to <strong>{form.email}</strong> with a link to your candidate dashboard — where you can update your profile, manage availability, and track introduction requests.
            </p>
          </div>

          <div className="text-center">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => { window.location.href = 'https://strategicfinancecareers.com'; }}
            >
              Back to SFC
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Multi-step Form ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg text-gray-900 tracking-tight">SFC Talent</span>
        <span className="text-sm text-gray-400">Step {step} of {TOTAL_STEPS}</span>
      </div>
      <div className="h-1 bg-gray-100">
        <div className="h-1 bg-emerald-500 transition-all duration-500"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
      </div>

      <div className="max-w-lg mx-auto px-6 py-10">

        {/* ── Step 1: Qualification ── */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Quick Fit Check</h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              SFC Talent connects curated professionals with top companies. We're currently focused
              on finance roles — here's a quick check to make sure we're a good match.
            </p>

            <div className="space-y-7">

              {/* Email */}
              <div>
                <Label>Email address <span className="text-red-500">*</span></Label>
                <Input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="you@example.com" className="mt-2" />
              </div>

              {/* Part A: Primary background — large single-select cards */}
              <div>
                <Label className="text-sm font-semibold text-gray-800">
                  What best describes your primary background? <span className="text-red-500">*</span>
                </Label>
                <div className="space-y-3 mt-3">
                  {PRIMARY_BACKGROUNDS.map(bg => (
                    <button key={bg.value} type="button"
                      onClick={() => {
                        set('primaryBackground', bg.value);
                        set('detailedExperience', []);
                        set('secondaryBackgrounds', form.secondaryBackgrounds.filter(s => s !== bg.value));
                      }}
                      className={`w-full text-left p-4 border-2 rounded-xl transition-all ${
                        form.primaryBackground === bg.value
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          form.primaryBackground === bg.value ? 'border-emerald-500' : 'border-gray-300'
                        }`}>
                          {form.primaryBackground === bg.value && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                        </div>
                        <span className={`font-semibold text-sm ${form.primaryBackground === bg.value ? 'text-emerald-900' : 'text-gray-800'}`}>
                          {bg.value}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed ml-6">{bg.subtitle}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Part B: Secondary backgrounds (optional, shows other categories) */}
              {form.primaryBackground && (
                <div>
                  <Label className="text-sm font-semibold text-gray-800">
                    Any additional areas of experience?
                    <span className="ml-2 text-xs font-normal text-gray-400">Optional — select all that apply</span>
                  </Label>
                  <div className="space-y-2 mt-3">
                    {secondaryOptions.map(bg => (
                      <label key={bg.value} className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                        form.secondaryBackgrounds.includes(bg.value)
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <input type="checkbox" checked={form.secondaryBackgrounds.includes(bg.value)}
                          onChange={() => {
                            const next = form.secondaryBackgrounds.includes(bg.value)
                              ? form.secondaryBackgrounds.filter(s => s !== bg.value)
                              : [...form.secondaryBackgrounds, bg.value];
                            set('secondaryBackgrounds', next);
                          }} className="mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{bg.value}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{bg.subtitle}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Part C: Detailed experience chips from primary */}
              {form.primaryBackground && detailOptions.length > 0 && (
                <div>
                  <Label className="text-sm font-semibold text-gray-800">
                    Select all areas that apply to your experience: <span className="text-red-500">*</span>
                  </Label>
                  <ChipGrid
                    options={detailOptions}
                    selected={form.detailedExperience}
                    onChange={v => set('detailedExperience', v)}
                  />
                </div>
              )}

              {/* Experience */}
              <div>
                <Label>Years of full-time professional experience? <span className="text-red-500">*</span></Label>
                <RadioGroup name="experience" value={form.experience} onChange={v => set('experience', v)}
                  options={[
                    { value: 'under2', label: 'Under 2 years' },
                    { value: '2to5', label: '2 – 5 years' },
                    { value: '5to10', label: '5 – 10 years' },
                    { value: '10plus', label: '10+ years' },
                  ]} />
              </div>

              {/* Comp target */}
              <div>
                <Label>What is your total cash compensation target? <span className="text-red-500">*</span></Label>
                <RadioGroup name="targetComp" value={form.targetComp} onChange={v => set('targetComp', v)}
                  options={COMP_OPTIONS} />
              </div>

            </div>
          </div>
        )}

        {/* ── Step 2: Contact Info ── */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Contact Information</h2>
            <p className="text-gray-500 mb-8 text-sm">Kept private — only shared with your explicit consent.</p>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First name <span className="text-red-500">*</span></Label>
                  <Input value={form.firstName} onChange={e => set('firstName', e.target.value)}
                    placeholder="Jane" className="mt-2" />
                </div>
                <div>
                  <Label>Last name <span className="text-red-500">*</span></Label>
                  <Input value={form.lastName} onChange={e => set('lastName', e.target.value)}
                    placeholder="Smith" className="mt-2" />
                </div>
              </div>

              <div>
                <Label>Phone number <span className="text-red-500">*</span></Label>
                <Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="+1 (555) 000-0000" className="mt-2" />
                <p className="text-xs text-gray-500 mt-1.5">
                  Required — you must be reachable for introduction requests within 48 hours.
                </p>
              </div>

              <div>
                <Label>LinkedIn profile URL <span className="text-gray-400 text-xs font-normal">(optional)</span></Label>
                <Input value={form.linkedin} onChange={e => set('linkedin', e.target.value)}
                  placeholder="https://linkedin.com/in/janesmith" className="mt-2" />
              </div>

              <div>
                <Label>Email address</Label>
                <Input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  className="mt-2 bg-gray-50" />
              </div>

              <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:border-emerald-300 transition-colors">
                <input type="checkbox" checked={form.committed}
                  onChange={e => set('committed', e.target.checked)} className="mt-0.5" />
                <span className="text-sm text-gray-700">
                  I'm genuinely open to exploring new opportunities and can respond to introductions within 48 hours.
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
              We'll use AI to extract your profile automatically. PDF format required.
            </p>

            {/* Parse warning banner */}
            {form.parseWarning && form.resumeParsed && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                <span className="text-amber-500 text-base shrink-0 mt-0.5">⚠️</span>
                <p className="text-sm text-amber-800">
                  We couldn't automatically parse your resume — no worries! Please fill in your
                  details on the next step.
                </p>
              </div>
            )}

            {/* Upload area */}
            {!form.resumeParsed && (
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all">
                <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleResumeUpload(f); }} />
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

            {/* Uploaded state */}
            {form.resumeParsed && (
              <div className="space-y-4">
                <div className={`flex items-center gap-3 p-4 border rounded-lg ${
                  form.parseWarning ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
                }`}>
                  {form.parseWarning
                    ? <span className="text-amber-500 shrink-0">⚠️</span>
                    : <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  }
                  <div>
                    <p className={`text-sm font-semibold ${form.parseWarning ? 'text-amber-800' : 'text-emerald-800'}`}>
                      {form.parseWarning ? 'Resume uploaded — fill details manually' : 'Resume parsed successfully!'}
                    </p>
                    <p className={`text-xs ${form.parseWarning ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {form.resumeFile?.name}
                    </p>
                  </div>
                  <button className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline"
                    onClick={() => {
                      set('resumeParsed', null); set('resumeFile', null);
                      set('resumeBase64', ''); set('parseWarning', false);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}>
                    Change
                  </button>
                </div>

                {/* Parsed preview */}
                {!form.parseWarning && (
                  <div className="p-4 border border-gray-200 rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Extracted Profile</p>
                    {[
                      ['Role', form.resumeParsed.currentRole],
                      ['Location', form.resumeParsed.location],
                      ['Experience', form.resumeParsed.yearsExperience ? `${form.resumeParsed.yearsExperience} years` : ''],
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
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Review & Edit ── */}
        {step === 4 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Your Profile</h2>
            <p className="text-gray-500 mb-2 text-sm">
              Edit anything that doesn't look right. This is what recruiters will see (anonymously).
            </p>
            {form.parseWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-6 text-sm text-amber-800">
                Your resume couldn't be auto-parsed — please fill in your details below.
              </div>
            )}

            <div className="space-y-5 mt-6">

              <div>
                <Label>Current / most recent role <span className="text-red-500">*</span></Label>
                <Input value={form.currentRole} onChange={e => set('currentRole', e.target.value)}
                  placeholder="e.g. Senior Finance Manager" className="mt-2" />
              </div>

              <div>
                <Label>Location (city, state) <span className="text-red-500">*</span></Label>
                <Input value={form.location} onChange={e => set('location', e.target.value)}
                  placeholder="e.g. New York, NY" className="mt-2" />
              </div>

              <div>
                <Label>Years of experience <span className="text-red-500">*</span></Label>
                <Input type="number" min={0} max={50} value={form.yearsExperience}
                  onChange={e => set('yearsExperience', e.target.value)}
                  placeholder="e.g. 5" className="mt-2" />
              </div>

              <div>
                <Label>Education (degree + field, no school name)</Label>
                <Input value={form.education} onChange={e => set('education', e.target.value)}
                  placeholder="e.g. MBA, Finance" className="mt-2" />
              </div>

              <div>
                <Label>Education level</Label>
                <RadioGroup name="educationLevel" value={form.educationLevel}
                  onChange={v => set('educationLevel', v)}
                  options={[
                    { value: 'Bachelors', label: "Bachelor's" },
                    { value: 'Masters', label: "Master's" },
                    { value: 'MBA', label: 'MBA' },
                    { value: 'PhD', label: 'PhD' },
                  ]} />
              </div>

              {/* Bio — read-only AI-generated */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Your anonymous bio <span className="text-xs font-normal text-gray-400">(AI-generated)</span></Label>
                  {form.resumeBase64 && (
                    <button
                      type="button"
                      onClick={handleRegenerateBio}
                      disabled={regenerating}
                      className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50"
                    >
                      {regenerating
                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Regenerating…</>
                        : <><RefreshCw className="w-3 h-3" /> Regenerate</>
                      }
                    </button>
                  )}
                </div>
                {form.bio ? (
                  <div className="mt-2 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 leading-relaxed">
                    {form.bio}
                  </div>
                ) : (
                  <div className="mt-2 p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-sm text-gray-400 italic">
                    Your bio will be generated from your resume
                  </div>
                )}
              </div>

              <div>
                <Label>Skills</Label>
                <p className="text-xs text-gray-400 mt-0.5">Press Enter to add each skill</p>
                <SkillsInput skills={form.skills} onChange={v => set('skills', v)} />
              </div>

              <div>
                <Label>Industries / sectors (select all that apply)</Label>
                <CheckboxGrid options={SECTORS} selected={form.sectors} onChange={v => set('sectors', v)} />
              </div>

            </div>
          </div>
        )}

        {/* ── Step 5: Preferences ── */}
        {step === 5 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Preferences</h2>
            <p className="text-gray-500 mb-8 text-sm">Help us match you with the right opportunities.</p>

            <div className="space-y-6">

              <div>
                <Label>Current job search status <span className="text-red-500">*</span></Label>
                <RadioGroup name="jobSearchStatus" value={form.jobSearchStatus}
                  onChange={v => set('jobSearchStatus', v)}
                  options={JOB_STATUSES.map(s => ({ value: s, label: s }))} />
              </div>

              <div>
                <Label>Target total cash compensation (base + bonus) <span className="text-red-500">*</span></Label>
                <RadioGroup name="targetCompStep5" value={form.targetCompStep5}
                  onChange={v => set('targetCompStep5', v)}
                  options={COMP_OPTIONS} />
              </div>

              {/* Work preference — single select cards */}
              <div>
                <Label>Work preference <span className="text-red-500">*</span></Label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {WORK_PREFERENCES.map(wp => (
                    <button key={wp.value} type="button" onClick={() => set('workPreference', wp.value)}
                      className={`flex flex-col items-center gap-1 p-4 border-2 rounded-xl transition-all text-center ${
                        form.workPreference === wp.value
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}>
                      <span className="text-xl">{wp.label.split(' ')[0]}</span>
                      <span className={`text-xs font-semibold ${form.workPreference === wp.value ? 'text-emerald-800' : 'text-gray-700'}`}>
                        {wp.label.split(' ').slice(1).join(' ')}
                      </span>
                      <span className="text-xs text-gray-400 leading-tight">{wp.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred cities — chips */}
              <div>
                <Label>Which cities would you consider?
                  <span className="ml-2 text-xs font-normal text-gray-400">Select all that apply</span>
                </Label>
                <ChipGrid options={PREFERRED_CITIES} selected={form.preferredCities}
                  onChange={v => set('preferredCities', v)} />
              </div>

              <div>
                <Label>Target roles (select all that apply)</Label>
                <ChipGrid options={TARGET_ROLES} selected={form.targetRoles}
                  onChange={v => set('targetRoles', v)} />
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
              {form.bio
                ? <p className="text-sm text-gray-600 leading-relaxed mb-4">{form.bio}</p>
                : <p className="text-sm text-gray-400 italic mb-4">No bio generated</p>
              }
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
              <strong>Note:</strong> Your profile will be reviewed by our team before going live.
              We'll email you at <strong>{form.email}</strong> once it's approved.
            </div>

            {submitError && (
              <p className="text-sm text-red-600 p-3 bg-red-50 rounded-lg mb-4">{submitError}</p>
            )}
          </div>
        )}

        {/* Nav buttons */}
        <div className="flex gap-3 mt-10">
          <Button variant="outline" onClick={handleBack} disabled={submitting} className="flex-1">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>

          {step < TOTAL_STEPS ? (
            <Button onClick={handleNext} disabled={!canProceed}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40">
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
              {submitting
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
                : <>Submit <ChevronRight className="w-4 h-4 ml-1" /></>
              }
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
