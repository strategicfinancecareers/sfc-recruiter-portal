import { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2, Upload, Loader2, ChevronRight, ChevronLeft,
  X, Plus, RefreshCw, Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

// Newsreader needed for the right-side value panel heading on the auth
// screen so the /apply page matches the landing's serif identity. Other
// landing tokens (cream / ink / brand green) are inlined via style /
// Tailwind on the relevant elements; no new CSS file required.
// (These import side-effects are deduped per-build by Vite if the same
// packages are already imported elsewhere in the app, e.g. Home.tsx.)
import '@fontsource-variable/newsreader';

import AnonymousCandidateCard from '@/components/AnonymousCandidateCard';

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
  'Other',
];
// Sentinel for the industries "Other" picker — selecting this reveals
// the free-text input that lands in candidates.industries_other.
const SECTOR_OTHER = 'Other';

const TARGET_ROLES = [
  'Strategic Finance',
  'Corporate Development',
  'Strategy & Operations',
  'FP&A',
  'Chief of Staff',
  'Finance Manager / Director',
  'VP Finance / CFO',
];

// New areas of interest (finance specializations the candidate wants to
// move INTO). Multi-select → candidates.new_areas[].
const NEW_AREAS = [
  'Strategic Finance',
  'Corporate Development / M&A',
  'FP&A leadership',
  'Investor Relations',
  'Treasury / Capital Markets',
  'Business Operations / Chief of Staff',
  'Revenue Operations',
  'Data & Analytics (finance)',
  'Startup CFO / first finance hire',
  'Fund finance / portfolio finance',
];

// Company-stage experience (which company stages the candidate has
// worked at). Multi-select → candidates.target_company_stages[].
const COMPANY_STAGES = [
  'Pre-seed / Seed',
  'Series A',
  'Series B',
  'Series C+',
  'Pre-IPO / Late-stage private',
  'Public company (small-mid cap)',
  'Public company (large cap / Fortune 500)',
  'PE-backed',
  'Bootstrapped / Founder-owned',
  'Government / Non-profit',
];

const PREFERRED_CITIES = [
  'New York', 'San Francisco / Bay Area', 'Los Angeles', 'Chicago',
  'Boston', 'Austin', 'Miami', 'Seattle', 'Denver', 'Washington D.C.',
  'Open to relocation', 'No preference',
  'Other',
];
// Sentinel for the cities "Other" picker — selecting reveals free-text.
const CITY_OTHER = 'Other';

// Under-$70k removed per spec (the comp question now lives only on the
// Future Job Preferences tab; the global disqualifier on it is gone).
const COMP_OPTIONS = [
  { value: '70k-100k', label: '$70k – $100k' },
  { value: '100k-150k', label: '$100k – $150k' },
  { value: '150k-200k', label: '$150k – $200k' },
  { value: '200k-300k', label: '$200k – $300k' },
  { value: '300k-plus', label: '$300k+' },
];

const AVAILABILITY_OPTIONS = [
  {
    value: 'Actively Looking',
    emoji: '🟢',
    label: 'Actively Looking',
    desc: "I'm open to new opportunities right now",
  },
  {
    value: 'Not Active',
    emoji: '⏸️',
    label: 'Not Active',
    desc: "I'm not looking right now but want to stay in the network",
  },
];

const WORK_PREFERENCES = [
  { value: 'Remote', label: '🏠 Remote', desc: 'Fully remote only' },
  { value: 'Hybrid', label: '🏢 Hybrid', desc: 'Mix of remote and in-office' },
  { value: 'In-Office', label: '🏙️ In-Office', desc: 'Prefer to be in office' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 'landing' | 'auth' | 'verify-email' | 'form' | 'disqualified' | 'success';

// Form-rework field grouping (matches the new 6-tab wizard).
// One comp field total (targetComp on the Future Job Preferences tab).
// workPreferences is an array (was string). Industries collected on the
// Professional Experience tab. Work-auth two-question pair at the end.
interface FormState {
  // Tab 1 — Contact Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedin: string;
  committed: boolean;

  // Tab 2 — Professional Experience
  primaryBackground: string;
  secondaryBackgrounds: string[];
  detailedExperience: string[];
  experience: string;              // years bucket: under2 / 2to5 / 5to10 / 10plus
  industries: string[];            // moved from old Step 4; → candidates.industries[]
  industriesOther: string;         // free text when 'Other' is in industries[]
  companyStages: string[];         // NEW → candidates.target_company_stages[]
  newAreas: string[];              // NEW → candidates.new_areas[]

  // Tab 3 — Resume Upload (resume only)
  resumeFile: File | null;
  resumeBase64: string;
  resumeParsed: any | null;
  parseWarning: boolean;
  // Parsed-resume fallout (still surfaced + editable on the review tab,
  // but we keep the fields here so /api/parse-resume can populate them).
  currentRole: string;
  location: string;
  yearsExperience: string;
  education: string;
  educationLevel: string;
  skills: string[];
  bio: string;

  // Tab 4 — Future Job Preferences
  jobSearchStatus: string;
  targetComp: string;              // ONLY comp field; lives here
  workPreferences: string[];       // multi-select
  preferredCities: string[];
  preferredCitiesOther: string;    // free text when 'Other' is in preferredCities[]
  targetRoles: string[];

  // Tab 5 — Work Authorization
  // null = unanswered; the validator requires both to be non-null before
  // the user can move forward. Two-question pair, no filtering on values.
  workAuthorizedUs: boolean | null;
  requiresSponsorship: boolean | null;
}

const INITIAL_FORM: FormState = {
  // Tab 1
  firstName: '', lastName: '', email: '', phone: '', linkedin: '', committed: false,
  // Tab 2
  primaryBackground: '', secondaryBackgrounds: [], detailedExperience: [], experience: '',
  industries: [], industriesOther: '',
  companyStages: [], newAreas: [],
  // Tab 3
  resumeFile: null, resumeBase64: '', resumeParsed: null, parseWarning: false,
  currentRole: '', location: '', yearsExperience: '', education: '',
  educationLevel: '', skills: [], bio: '',
  // Tab 4
  jobSearchStatus: '', targetComp: '',
  workPreferences: [], preferredCities: [], preferredCitiesOther: '', targetRoles: [],
  // Tab 5
  workAuthorizedUs: null, requiresSponsorship: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Only the "<2 years experience" gate remains — the comp lower bound is
// gone (under-70k removed from the option list entirely).
function isDisqualified(form: FormState): boolean {
  return form.experience === 'under2';
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

// ─── Landing sub-components ───────────────────────────────────────────────────

const LANDING_LOGOS = [
  'Goldman Sachs', 'McKinsey', 'Stripe', 'Blackstone', 'Google',
  'KKR', 'JP Morgan', 'Bain', 'BCG', 'Sequoia', 'Citadel',
  'Andreessen Horowitz', 'Two Sigma', 'Apollo',
];

const LANDING_CSS = `
@keyframes sfc-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
@keyframes sfc-float { 0%,100% { transform: rotate(2deg) translateY(0); } 50% { transform: rotate(2deg) translateY(-3px); } }
.sfc-marquee-track { display:flex; width:max-content; animation: sfc-marquee 30s linear infinite; }
.sfc-marquee-track:hover { animation-play-state: paused; }
.sfc-float-card { animation: sfc-float 4s ease-in-out infinite; }
.sfc-fade { opacity:0; transform:translateY(12px); transition: opacity 0.5s ease, transform 0.5s ease; }
.sfc-fade.visible { opacity:1; transform:translateY(0); }
`;

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.classList.add('visible'); obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function LandingSection({ onStart, onSignIn }: { onStart: () => void; onSignIn: () => void }) {
  const s2 = useFadeIn(); const s3 = useFadeIn(); const s4 = useFadeIn();
  const s5 = useFadeIn(); const s6 = useFadeIn();
  const doubled = [...LANDING_LOGOS, ...LANDING_LOGOS];

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#FFFFFF', color: '#0A0A0A' }}>
      <style>{LANDING_CSS}</style>

      {/* ── Nav ── */}
      <nav style={{ padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6' }}>
        <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em', color: '#0A0A0A' }}>SFC Talent</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onSignIn}
            style={{ background: 'none', border: 'none', padding: '8px 16px', fontSize: 14, fontWeight: 500, color: '#6B7280', cursor: 'pointer' }}
          >
            Sign in
          </button>
          <button
            onClick={onStart}
            style={{ background: '#0F6E56', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 500, color: 'white', cursor: 'pointer' }}
          >
            Join the Network
          </button>
        </div>
      </nav>

      {/* ── SECTION 1: HERO ── */}
      <section style={{ minHeight: 'calc(100vh - 65px)', display: 'flex', alignItems: 'center', padding: '80px 40px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Left */}
        <div style={{ flex: 1, maxWidth: 580 }}>
          {/* Badge */}
          <div style={{ display: 'inline-block', marginBottom: 28, padding: '6px 14px', background: '#F0FDF4', border: '1px solid #D1FAE5', borderRadius: 100 }}>
            <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.05em', color: '#065F46', textTransform: 'uppercase' }}>
              Private Network · By Application Only
            </span>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: 600, lineHeight: 1.1, marginBottom: 24, color: '#0A0A0A', letterSpacing: '-0.02em' }}>
            Stay <span style={{ color: '#0F6E56' }}>Anonymous</span>.<br />
            Get Introduced to<br />
            <span style={{ color: '#0F6E56' }}>Top Finance Teams</span>.
          </h1>

          {/* Sub */}
          <p style={{ fontSize: 18, fontWeight: 400, color: '#6B7280', lineHeight: 1.6, maxWidth: 520, marginBottom: 40 }}>
            A curated private network for strategic finance professionals. No recruiters. No spam. Just selective introductions.
          </p>

          {/* CTA */}
          <button
            onClick={onStart}
            style={{
              background: '#0F6E56', color: 'white', border: 'none', borderRadius: 8,
              padding: '14px 32px', fontSize: 15, fontWeight: 500, cursor: 'pointer',
              transition: 'background 0.2s ease, transform 0.2s ease', marginBottom: 16,
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = '#0A5C47'; (e.target as HTMLElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = '#0F6E56'; (e.target as HTMLElement).style.transform = 'translateY(0)'; }}
          >
            Join the Network
          </button>

          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4, marginBottom: 20 }}>
            Takes 5 minutes · 100% free · Fully anonymous
          </p>

          <button
            onClick={onSignIn}
            style={{
              background: 'none', border: '1px solid #E5E7EB', borderRadius: 8,
              padding: '12px 28px', fontSize: 14, fontWeight: 500, color: '#374151',
              cursor: 'pointer', transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#9CA3AF'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; }}
          >
            Already have a profile? Sign in →
          </button>
        </div>

        {/* Right — floating dark card (desktop) */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }} className="hidden lg:flex">
          <div
            className="sfc-float-card"
            style={{
              background: '#0F172A', borderRadius: 16, padding: 28, width: 280,
              border: '1px solid #1E293B',
            }}
          >
            {/* Anonymous badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#052E16', border: '1px solid #166534', borderRadius: 100, padding: '4px 10px', marginBottom: 20 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
              <span style={{ fontSize: 11, color: '#86EFAC', fontWeight: 500, letterSpacing: '0.04em' }}>ANONYMOUS</span>
            </div>

            {/* Avatar + role */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#134E4A', display: 'flex', alignItems: 'center', justifyContent: 'center', filter: 'blur(2px)', flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#5EEAD4' }}>SF</span>
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 500, color: '#F1F5F9', lineHeight: 1.3, margin: 0 }}>VP Finance · Fintech</p>
                <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0', fontWeight: 400 }}>8 yrs experience</p>
              </div>
            </div>

            {/* Skill chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
              {['Strategic Finance', 'FP&A', 'M&A'].map(s => (
                <span key={s} style={{ background: '#1E293B', color: '#E2E8F0', borderRadius: 100, padding: '4px 10px', fontSize: 12, fontWeight: 500 }}>{s}</span>
              ))}
            </div>

            {/* Lock footer */}
            <div style={{ borderTop: '1px solid #1E293B', paddingTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <span style={{ fontSize: 12, color: '#64748B' }}>Identity protected</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: LOGO MARQUEE ── */}
      <section ref={s2} className="sfc-fade" style={{ background: '#F9FAFB', padding: '48px 0', overflow: 'hidden' }}>
        <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 24 }}>
          Professionals from
        </p>
        <div className="sfc-marquee-track">
          {doubled.map((name, i) => (
            <span
              key={i}
              style={{ margin: '0 36px', fontSize: 15, fontWeight: 600, color: '#D1D5DB', letterSpacing: '0.02em', whiteSpace: 'nowrap', cursor: 'default', transition: 'color 0.2s' }}
              onMouseEnter={e => ((e.target as HTMLElement).style.color = '#6B7280')}
              onMouseLeave={e => ((e.target as HTMLElement).style.color = '#D1D5DB')}
            >
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* ── SECTION 3: VALUE PROPS ── */}
      <section ref={s3} className="sfc-fade" style={{ background: '#FFFFFF', padding: '96px 40px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 16 }}>Why SFC Talent</p>
          <h2 style={{ fontSize: 40, fontWeight: 600, color: '#0A0A0A', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 16 }}>Built for serious finance professionals.</h2>
          <p style={{ fontSize: 18, color: '#6B7280', marginBottom: 64 }}>Not a job board. Not a recruiter. A private introduction network.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {[
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                ),
                title: 'You stay anonymous',
                body: 'Your name, employer, and contact details are never revealed to recruiters without your explicit consent.',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                  </svg>
                ),
                title: 'Curated, not broadcast',
                body: 'Every introduction is reviewed and selective. You won\'t be mass-applied to roles or spammed by recruiters.',
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
                  </svg>
                ),
                title: 'You control every intro',
                body: 'Accept or decline any introduction request within 48 hours. No pressure, no obligation, no awkward calls.',
              },
            ].map(card => (
              <div
                key={card.title}
                style={{
                  background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12,
                  padding: 32, textAlign: 'left', transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = '#0F6E56')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB')}
              >
                <div style={{ marginBottom: 16 }}>{card.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: '#0A0A0A', marginBottom: 12 }}>{card.title}</h3>
                <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: HOW IT WORKS ── */}
      <section ref={s4} className="sfc-fade" style={{ background: '#F9FAFB', padding: '96px 40px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 16, textAlign: 'center' }}>How it works</p>
          <h2 style={{ fontSize: 40, fontWeight: 600, color: '#0A0A0A', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 64, textAlign: 'center' }}>From anonymous to introduced in days.</h2>

          <div style={{ position: 'relative', paddingLeft: 48 }}>
            {/* Vertical line */}
            <div style={{ position: 'absolute', left: 14, top: 14, bottom: 14, width: 1, background: '#E5E7EB' }} />

            {[
              { n: '1', title: 'Create your anonymous profile', body: 'Upload your resume. Our AI extracts your experience, skills, and background — no manual entry.', delay: 0 },
              { n: '2', title: 'Get discovered by top companies', body: 'Recruiters browse anonymous profiles. They see your role, experience, and skills — never your identity.', delay: 100 },
              { n: '3', title: 'Receive curated introduction requests', body: 'When a company is interested, you get a direct message. One tap to accept or decline.', delay: 200 },
              { n: '4', title: 'Connect on your terms', body: 'Only if you accept does your contact information get shared. You stay in full control throughout.', delay: 300 },
            ].map(step => (
              <TimelineStep key={step.n} step={step} />
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 5: PRIVACY STATEMENT ── */}
      <section ref={s5} className="sfc-fade" style={{ background: '#0A0A0A', padding: '80px 40px', textAlign: 'center' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <h2 style={{ fontSize: 36, fontWeight: 600, color: '#FFFFFF', letterSpacing: '-0.02em', marginBottom: 24 }}>Your privacy is the product.</h2>
          <p style={{ fontSize: 16, color: '#9CA3AF', lineHeight: 1.7, marginBottom: 56 }}>
            Many candidates in our network are currently employed and exploring discreetly. We built SFC Talent around the principle that your career information belongs to you — not to recruiters, not to job boards, and not to us.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 64, flexWrap: 'wrap' }}>
            {[
              { stat: '100%', label: 'Anonymous by default' },
              { stat: '0', label: 'Recruiter cold calls' },
              { stat: '48hr', label: 'Response window' },
            ].map(({ stat, label }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 28, fontWeight: 600, color: '#FFFFFF', margin: '0 0 4px' }}>{stat}</p>
                <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 6: FINAL CTA ── */}
      <section ref={s6} className="sfc-fade" style={{ background: '#FFFFFF', padding: '96px 40px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 48, fontWeight: 600, color: '#0A0A0A', letterSpacing: '-0.02em', marginBottom: 20 }}>Ready to be discovered?</h2>
        <p style={{ fontSize: 18, color: '#6B7280', marginBottom: 40, maxWidth: 560, margin: '0 auto 40px' }}>
          Join a network of strategic finance professionals being approached by top companies.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
          <button
            onClick={onStart}
            style={{
              background: '#0F6E56', color: 'white', border: 'none', borderRadius: 8,
              padding: '14px 32px', fontSize: 15, fontWeight: 500, cursor: 'pointer',
              transition: 'background 0.2s ease, transform 0.2s ease',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = '#0A5C47'; (e.target as HTMLElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = '#0F6E56'; (e.target as HTMLElement).style.transform = 'translateY(0)'; }}
          >
            Join the Network
          </button>
          <a
            href="#how-it-works"
            onClick={e => { e.preventDefault(); s4.current?.scrollIntoView({ behavior: 'smooth' }); }}
            style={{
              background: 'transparent', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8,
              padding: '14px 32px', fontSize: 15, fontWeight: 500, cursor: 'pointer',
              textDecoration: 'none', display: 'inline-block', transition: 'border-color 0.2s',
            }}
          >
            Learn how it works
          </a>
        </div>
        <button
          onClick={onSignIn}
          style={{
            background: 'none', border: '1px solid #E5E7EB', borderRadius: 8,
            padding: '12px 28px', fontSize: 14, fontWeight: 500, color: '#374151',
            cursor: 'pointer', transition: 'border-color 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#9CA3AF'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; }}
        >
          Already have a profile? Sign in →
        </button>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#FFFFFF', borderTop: '1px solid #F3F4F6', padding: '32px 40px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
          © 2025 SFC Talent · strategicfinancecareers.com · talent@strategicfinancecareers.com
        </p>
      </footer>
    </div>
  );
}

function TimelineStep({ step }: { step: { n: string; title: string; body: string; delay: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setTimeout(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; }, step.delay);
        obs.disconnect();
      }
    }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [step.delay]);

  return (
    <div
      ref={ref}
      style={{ display: 'flex', gap: 24, marginBottom: 48, opacity: 0, transform: 'translateY(12px)', transition: 'opacity 0.4s ease, transform 0.4s ease' }}
    >
      <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: '#0F6E56', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, marginTop: 2 }}>
        {step.n}
      </div>
      <div>
        <h3 style={{ fontSize: 17, fontWeight: 600, color: '#0A0A0A', marginBottom: 8, marginTop: 4 }}>{step.title}</h3>
        <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.6, margin: 0 }}>{step.body}</p>
      </div>
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({ firstName }: { firstName: string }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3">Application submitted ✓</h2>
        <p className="text-gray-500 leading-relaxed mb-8">
          {firstName ? `Thanks, ${firstName}. ` : ''}Your profile is <strong>under review</strong>. We manually vet every candidate — we'll email you once it's approved (usually within 1–2 business days).
        </p>

        {/* Dashboard access box */}
        <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-6 mb-4 text-left">
          <p className="text-sm font-semibold text-emerald-900 mb-1">Your dashboard</p>
          <p className="text-xs text-emerald-700 mb-4 leading-relaxed">
            Access your dashboard anytime at{' '}
            <span className="font-medium">sfc-recruiter-portal.vercel.app/candidate-dashboard</span>
          </p>
          <a
            href="/candidate-dashboard"
            className="w-full flex items-center justify-center bg-[#0F6E56] hover:bg-[#0a5942] text-white rounded-lg px-6 py-3 text-sm font-semibold transition-colors"
          >
            Go to Dashboard →
          </a>
        </div>
        <p className="text-xs text-gray-400">Bookmark this page — you'll use your email to sign in</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;

export default function CandidateApply() {
  // Landing for the marketing surface now lives at "/" (src/pages/Home.tsx).
  // /apply opens directly on the auth screen (signup tab by default), so
  // hitting this route from the new home page lands on the form, not on
  // the embedded LandingSection. The LandingSection component is still in
  // this file for the unlikely case anyone navigates back to 'landing'
  // via setScreen, but the initial state skips it.
  const [screen, setScreen] = useState<Screen>('auth');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [parsing, setParsing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth state
  // Initial tab honors ?mode=signin in the URL so the landing's
  // "Professional login" link can deep-link returning users straight to
  // the Sign-in tab. Anything else (including absence of the param)
  // keeps the existing default of 'signup'. Read synchronously at
  // first render via initialState — no useEffect needed.
  const [authTab, setAuthTab] = useState<'signup' | 'signin'>(() => {
    if (typeof window === 'undefined') return 'signup';
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'signin' ? 'signin' : 'signup';
  });
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const set = (field: keyof FormState, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  // ── Route a confirmed session: check profile, go to dashboard or form ─────────
  const routeConfirmedSession = async (email: string) => {
    set('email', email);
    const profileRes = await fetch(`/api/candidate-profile?email=${encodeURIComponent(email.toLowerCase())}`);
    if (profileRes.ok) {
      window.location.href = '/candidate-dashboard';
    } else {
      setScreen('form');
      setStep(1);
    }
  };

  // ── Session-leak guard ───────────────────────────────────────────────────────
  // If user A is signed in and clicks user B's verification link in the same
  // browser, Supabase's localStorage session for A can "win" over the
  // verification URL processing. Detect verification params in the URL on
  // mount and sign out any existing local session FIRST so Supabase
  // reconciles the verification token cleanly. Local-scope signOut only
  // clears localStorage — the verification token itself stays valid.
  // This runs ONCE at mount and ONLY when verification params are present —
  // it never fires on plain dashboard/apply navigation.
  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash || '' : '';
    const search = typeof window !== 'undefined' ? window.location.search || '' : '';
    const verificationRegex = /(access_token=|refresh_token=|token_hash=|type=(signup|recovery|magiclink|invite|email_change))/;
    const hasVerificationParams = verificationRegex.test(hash) || verificationRegex.test(search);

    if (!hasVerificationParams) return;

    (async () => {
      const { data: { session: existing } } = await supabase.auth.getSession();
      if (existing?.user?.email) {
        console.log('[CandidateApply] verification URL detected — clearing existing local session for', existing.user.email);
        await supabase.auth.signOut({ scope: 'local' });
      }
    })().catch(err => console.error('[CandidateApply] session-leak guard error:', err));
  }, []);

  // ── Only listen for email confirmation while on verify-email screen ───────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, _session) => {
      if (
        (event === 'SIGNED_IN' || event === 'USER_UPDATED') &&
        screen === 'verify-email'
      ) {
        // FIX 2 — defensive: never trust the cached session. Refresh against
        // the server so we route based on the freshest confirmed identity.
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
        if (refreshErr) {
          console.warn('[CandidateApply] refreshSession error:', refreshErr.message);
        }
        const freshSession = refreshed?.session ?? (await supabase.auth.getSession()).data.session;
        if (!freshSession?.user?.email_confirmed_at) return;

        const email = freshSession.user.email ?? authEmail;
        await routeConfirmedSession(email);
      }
    });
    return () => subscription.unsubscribe();
  }, [screen, authEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ─────────────────────────────────────────────────────────────────

  const detailOptions = DETAILED_EXPERIENCE_MAP[form.primaryBackground] ?? [];
  // Secondary backgrounds = all categories except primary
  const secondaryOptions = PRIMARY_BACKGROUNDS.filter(b => b.value !== form.primaryBackground);

  // ── Validation (per the new 6-tab order) ──────────────────────────────────
  //   1) Contact Information
  //   2) Professional Experience
  //   3) Resume Upload
  //   4) Future Job Preferences
  //   5) Work Authorization
  //   6) Review
  // Forward navigation is gated by these. Back is always free, and tabs
  // are clickable for any step the user has at least one of the gates
  // satisfied for (see canVisitStep below).

  const canProceedStep1 =
    !!(form.firstName && form.lastName && form.email && form.phone.trim().length >= 7 && form.linkedin.trim() && form.committed);

  const canProceedStep2 =
    !!(form.primaryBackground && form.detailedExperience.length > 0 && form.experience);

  const canProceedStep3 = form.resumeParsed !== null;

  // Tab 4: comp is now mandatory here (only place it's asked); work
  // preferences must be at least one selected (multi-select); job-status
  // (Active/Not Active) remains required.
  const canProceedStep4 =
    !!(form.jobSearchStatus && form.targetComp && form.workPreferences.length > 0);

  // Tab 5: both work-auth questions must be answered (yes/no on each).
  const canProceedStep5 =
    form.workAuthorizedUs !== null && form.requiresSponsorship !== null;

  const canProceed = [null, canProceedStep1, canProceedStep2, canProceedStep3, canProceedStep4, canProceedStep5, true][step];

  // Tab bar click-to-navigate: a user can always visit an earlier step,
  // and can visit a later step only if every step before it is valid.
  // Step 6 (Review) requires every prior validator to be true.
  const stepValidators = [null, canProceedStep1, canProceedStep2, canProceedStep3, canProceedStep4, canProceedStep5] as const;
  const canVisitStep = (target: number): boolean => {
    if (target <= step) return true;          // backward / current always ok
    for (let i = 1; i < target; i++) {
      if (!stepValidators[i]) return false;
    }
    return true;
  };

  // ── Navigation ──────────────────────────────────────────────────────────────

  const handleNext = () => {
    // Disqualifier check moved to Tab 2 (where the years-experience radio
    // now lives). Comp no longer triggers any disqualifier — under-70k
    // was removed from the option list.
    if (step === 2 && isDisqualified(form)) {
      setScreen('disqualified');
      return;
    }
    if (step < TOTAL_STEPS) setStep(s => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(s => s - 1);
    // /apply no longer owns the landing surface — back from step 1 goes
    // to the canonical front door at "/".
    else window.location.href = '/';
  };

  const handleStepClick = (target: number) => {
    if (canVisitStep(target)) setStep(target);
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
          // Identity / contact
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          linkedin: form.linkedin || null,
          // Parsed-resume / review fields
          currentRole: form.currentRole,
          location: form.location,
          yearsExperience: Number(form.yearsExperience) || 0,
          education: form.education,
          educationLevel: form.educationLevel,
          bio: form.bio,
          skills: form.skills,
          // Professional experience (industries moved here; new fields added)
          industries: form.industries,
          industriesOther: form.industriesOther || null,
          companyStages: form.companyStages,
          newAreas: form.newAreas,
          primaryBackground: form.primaryBackground,
          secondaryBackgrounds: form.secondaryBackgrounds,
          detailedExperience: form.detailedExperience,
          // Future Job Preferences (single comp source of truth)
          jobSearchStatus: form.jobSearchStatus,
          targetComp: form.targetComp,
          workPreferences: form.workPreferences,
          preferredCities: form.preferredCities,
          preferredCitiesOther: form.preferredCitiesOther || null,
          targetRoles: form.targetRoles,
          // Work authorization (two questions, store-only)
          workAuthorizedUs: form.workAuthorizedUs,
          requiresSponsorship: form.requiresSponsorship,
          // Resume
          resumeBase64: form.resumeBase64 || null,
          resumeFileName: form.resumeFile?.name || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Submission failed');
      }

      setScreen('success');
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Landing ─────────────────────────────────────────────────────────────────

  // "Join the Network" → create account first
  const handleStart = () => { setAuthTab('signup'); setAuthError(''); setScreen('auth'); };

  // "Already have a profile?" → sign in tab
  const handleSignIn = () => { setAuthTab('signin'); setAuthError(''); setScreen('auth'); };

  if (screen === 'landing') {
    return <LandingSection onStart={handleStart} onSignIn={handleSignIn} />;
  }

  // ── Verify Email ─────────────────────────────────────────────────────────────

  if (screen === 'verify-email') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">Check your inbox</h1>
          <p className="text-gray-600 mb-2 leading-relaxed">
            We sent a verification link to <strong>{authEmail}</strong>. Click it to verify your account and continue.
          </p>
          <p className="text-sm text-gray-400 mb-8">
            Once verified, you'll be brought back here to complete your profile.
          </p>

          <button
            onClick={async () => {
              // Refresh first so we don't act on a stale cached session
              // (e.g. user A's session from another tab).
              await supabase.auth.refreshSession().catch(() => {});
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user?.email_confirmed_at) {
                await routeConfirmedSession(session.user.email ?? authEmail);
              } else {
                setAuthError('Email not verified yet. Please click the link in your inbox.');
                // show error below button
              }
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors mb-4"
          >
            Already verified? Continue →
          </button>

          {authError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-4">{authError}</p>
          )}

          <button
            onClick={async () => {
              setAuthError('');
              const { error } = await supabase.auth.resend({ type: 'signup', email: authEmail });
              if (error) setAuthError(error.message);
              else setAuthError('Verification email resent!');
            }}
            className="text-sm text-emerald-600 hover:text-emerald-700 underline"
          >
            Resend email
          </button>
        </div>
      </div>
    );
  }

  // ── Auth (Create Account / Sign In) ─────────────────────────────────────────

  if (screen === 'auth') {
    return (
      // Split-screen shell mirrors src/pages/SignUp.tsx so the /apply
      // (professional) and /signup (recruiter) pages read as a matched
      // pair. Left panel layout/spacing/responsive break match SignUp.tsx
      // exactly. Right panel uses the landing tokens (cream / ink / brand
      // green / Newsreader) so the professional side stays visually
      // anchored to the marketing surface at "/".
      <div className="min-h-screen flex">
        {/* ── Left panel — form (mirrors SignUp.tsx) ── */}
        <div className="w-full min-[860px]:w-[480px] xl:w-[540px] flex flex-col bg-[#f8f8f8] px-10 py-12 shrink-0">
          {/* Top row: brand + Back. SignUp.tsx omits the Back button; we keep
              it because /apply is the only auth route that's typically
              reached from "/" (not from a return visit), so a quick
              escape hatch is useful. */}
          <div className="mb-10 flex items-center justify-between">
            <span className="font-bold text-lg text-gray-900 tracking-tight">SFC Talent</span>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto min-[860px]:mx-0">
            {/* Heading mirrors SignUp.tsx's "Apply as a recruiter" */}
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Join as a professional</h1>
            <p className="text-sm text-gray-500 mb-6">Stay anonymous until you choose to say yes. Free, no recruiter spam — usually takes 5 minutes.</p>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-8">
            {(['signup', 'signin'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setAuthTab(tab); setAuthError(''); }}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  authTab === tab
                    ? 'border-b-2 border-emerald-600 text-emerald-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'signup' ? 'Create Account' : 'Sign In'}
              </button>
            ))}
          </div>

          {authTab === 'signup' ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setAuthError('');
                if (authPassword !== authConfirmPassword) {
                  setAuthError('Passwords do not match.');
                  return;
                }
                if (authPassword.length < 8) {
                  setAuthError('Password must be at least 8 characters.');
                  return;
                }
                setAuthLoading(true);
                try {
                  const { error } = await supabase.auth.signUp({
                    email: authEmail,
                    password: authPassword,
                    options: { emailRedirectTo: 'https://sfc-recruiter-portal.vercel.app/apply' },
                  });
                  if (error) {
                    if (error.message.toLowerCase().includes('already registered')) {
                      setAuthError('Account already exists. Sign in instead.');
                      setAuthTab('signin');
                    } else {
                      setAuthError(error.message);
                    }
                    return;
                  }
                  // Don't go to form yet — wait for email verification
                  setScreen('verify-email');
                } finally {
                  setAuthLoading(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  value={authConfirmPassword}
                  onChange={e => setAuthConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              {authError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">{authError}</p>
              )}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                {authLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Account
              </button>
            </form>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setAuthError('');
                setAuthLoading(true);
                try {
                  const { error } = await supabase.auth.signInWithPassword({
                    email: authEmail,
                    password: authPassword,
                  });
                  if (error) {
                    setAuthError('Invalid email or password.');
                    return;
                  }
                  // Check if candidate profile exists
                  const profileRes = await fetch(`/api/candidate-profile?email=${encodeURIComponent(authEmail.toLowerCase().trim())}`);
                  if (profileRes.ok) {
                    window.location.href = '/candidate-dashboard';
                  } else {
                    // Auth succeeded but no profile yet — go to intake form
                    set('email', authEmail);
                    setScreen('form');
                    setStep(1);
                  }
                } finally {
                  setAuthLoading(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              {authError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">{authError}</p>
              )}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                {authLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign In
              </button>
            </form>
          )}

          {/* Terms footer mirrors SignUp.tsx */}
          <p className="text-xs text-gray-400 mt-10 leading-relaxed max-w-sm mx-auto min-[860px]:mx-0">
            By continuing, you agree to SFC Talent&rsquo;s{' '}
            <a href="https://strategicfinancecareers.com" className="underline hover:text-gray-600">Terms of Service</a>
            {' '}and{' '}
            <a href="https://strategicfinancecareers.com" className="underline hover:text-gray-600">Privacy Policy</a>.
          </p>
        </div>
        {/* End left panel inner */}
        </div>
        {/* End left panel */}

        {/* ── Right panel — professional-framed value panel (landing tokens) ── */}
        <div
          className="hidden min-[860px]:flex flex-1 items-center justify-center px-16"
          style={{ background: '#f4f1ea', color: '#0e0e0d' }}
        >
          <div className="max-w-md w-full">
            <p
              className="mb-7"
              style={{
                fontFamily: '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace',
                fontSize: '10.5px',
                fontWeight: 500,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'rgba(14,14,13,.55)',
              }}
            >
              For professionals
            </p>

            <h2
              className="leading-tight tracking-tight mb-5"
              style={{
                fontFamily: '"Newsreader Variable", "Newsreader", Georgia, serif',
                fontWeight: 500,
                fontSize: 'clamp(28px, 3vw, 38px)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
              }}
            >
              Stay{' '}
              <em style={{ fontStyle: 'italic', color: '#008037', fontWeight: 400 }}>anonymous</em>.
              <br />Stay open.
            </h2>

            <p className="mb-9" style={{ color: 'rgba(14,14,13,.65)', fontSize: '15px', lineHeight: 1.6, maxWidth: '38ch' }}>
              Get warm introductions from top firms — without your employer or network ever knowing.
            </p>

            <ul className="space-y-4">
              {[
                'Profile stays hidden until you approve an intro',
                'Free — no recruiter spam, ever',
                '~5-minute form to join',
                'Pass on anything that doesn’t fit, no questions asked',
              ].map(line => (
                <li key={line} className="flex items-start gap-3" style={{ fontSize: '14px', color: '#0e0e0d' }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 22, height: 22, flex: 'none',
                      borderRadius: 4,
                      background: 'rgba(0,128,55,.1)',
                      border: '1px solid rgba(0,128,55,.25)',
                      display: 'inline-grid',
                      placeItems: 'center',
                      color: '#008037',
                      marginTop: 1,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                      <path d="M5 12l5 5L20 6" />
                    </svg>
                  </span>
                  <span style={{ lineHeight: 1.5 }}>{line}</span>
                </li>
              ))}
            </ul>

            <p
              className="mt-10"
              style={{
                fontFamily: '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace',
                fontSize: '10.5px',
                fontWeight: 500,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'rgba(14,14,13,.45)',
              }}
            >
              SFC Talent — Strategic Finance Careers
            </p>
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
    return <SuccessScreen firstName={form.firstName} />;
  }

  // ── Multi-step Form ──────────────────────────────────────────────────────────

  // Step labels for the clickable tab bar. Order matches the validators.
  // Long form for >=md screens, short form below — never truncates to
  // single letters at narrow widths.
  const STEP_LABELS_LONG = [
    'Contact Information',
    'Professional Experience',
    'Resume Upload',
    'Future Job Preferences',
    'Work Authorization',
    'Review your profile',
  ];
  const STEP_LABELS_SHORT = [
    'Contact',
    'Experience',
    'Resume',
    'Preferences',
    'Work Auth',
    'Review',
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg text-gray-900 tracking-tight">SFC Talent</span>
        <span className="text-sm text-gray-400">Step {step} of {TOTAL_STEPS}</span>
      </div>

      {/* Clickable step bar. Earlier steps always navigable; later steps
          unlocked once every previous validator passes. */}
      <div className="border-b border-gray-100 bg-gray-50/50">
        <div className="max-w-5xl mx-auto px-6 md:px-8 overflow-x-auto">
          <div className="flex items-stretch gap-1 py-2 min-w-max">
            {STEP_LABELS_LONG.map((longLabel, idx) => {
              const shortLabel = STEP_LABELS_SHORT[idx];
              const n = idx + 1;
              const active = n === step;
              const visitable = canVisitStep(n);
              const completed = stepValidators[n] === true && n < step;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleStepClick(n)}
                  disabled={!visitable}
                  className={[
                    'flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
                    active
                      ? 'bg-emerald-600 text-white'
                      : visitable
                        ? 'text-gray-700 hover:bg-gray-100'
                        : 'text-gray-300 cursor-not-allowed',
                  ].join(' ')}
                  aria-current={active ? 'step' : undefined}
                  title={longLabel}
                >
                  <span className={[
                    'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold',
                    active ? 'bg-white text-emerald-700' :
                    completed ? 'bg-emerald-100 text-emerald-700' :
                    'bg-gray-200 text-gray-600',
                  ].join(' ')}>
                    {completed ? '✓' : n}
                  </span>
                  {/* Long label on md+ (where ~1024px container has room
                      for all 6); short label below md (still readable,
                      never single-letter). overflow-x-auto handles any
                      remaining overflow without clipping. */}
                  <span className="hidden md:inline">{longLabel}</span>
                  <span className="md:hidden">{shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="h-1 bg-gray-100">
          <div className="h-1 bg-emerald-500 transition-all duration-500"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      {/* Outer container — widened to max-w-5xl (~1024px) per spec so
          long step-bar labels render without truncation and the Review
          step has room for its two-column layout. Single-column steps
          (1-5) cap their content at max-w-xl inside this container so
          forms don't feel too sparse. */}
      <div className="max-w-5xl mx-auto px-6 md:px-8 py-10">

        {/* ── Tab 1: Contact Information ───────────────────────────────── */}
        {step === 1 && (
          <div className="max-w-xl mx-auto">
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
                <Label>Email address <span className="text-red-500">*</span></Label>
                <Input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="you@example.com" className="mt-2" />
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
                <Label>LinkedIn profile URL <span className="text-red-500">*</span></Label>
                <Input value={form.linkedin} onChange={e => set('linkedin', e.target.value)}
                  placeholder="https://linkedin.com/in/janesmith" className="mt-2" />
                <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                  🔒 Never shown to recruiters — used for internal vetting only.
                </p>
              </div>

              <div className="p-4 border border-gray-200 rounded-xl bg-gray-50">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.committed}
                    onChange={e => set('committed', e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600" />
                  <div>
                    <p className="text-sm text-gray-700 font-medium leading-snug">
                      I commit to responding to all introduction requests within 48 hours via email or text.
                    </p>
                    <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                      Non-responses will result in your profile being deprioritized. Repeated non-responses may result in removal from the platform.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 2: Professional Experience ───────────────────────────── */}
        {step === 2 && (
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Professional Experience</h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              Tell us about your background and what you've worked on.
            </p>

            <div className="space-y-7">
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

              <div>
                <Label className="text-sm font-semibold text-gray-800">
                  Company-stage experience
                  <span className="ml-2 text-xs font-normal text-gray-400">Select all you've worked at</span>
                </Label>
                <ChipGrid options={COMPANY_STAGES} selected={form.companyStages} onChange={v => set('companyStages', v)} />
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-800">Industries / sectors</Label>
                <p className="text-xs text-gray-400 mt-0.5">Select all that apply</p>
                <CheckboxGrid options={SECTORS} selected={form.industries} onChange={v => set('industries', v)} />
                {form.industries.includes(SECTOR_OTHER) && (
                  <Input
                    value={form.industriesOther}
                    onChange={e => set('industriesOther', e.target.value)}
                    placeholder="Tell us which industry"
                    className="mt-3"
                  />
                )}
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-800">
                  New areas you'd like to move into
                  <span className="ml-2 text-xs font-normal text-gray-400">Optional — multi-select</span>
                </Label>
                <ChipGrid options={NEW_AREAS} selected={form.newAreas} onChange={v => set('newAreas', v)} />
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 3: Resume Upload (resume only) ──────────────────────── */}
        {step === 3 && (
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Your Resume</h2>
            <p className="text-gray-500 mb-8 text-sm">
              We'll use AI to extract your profile automatically. PDF format required.
            </p>

            {form.parseWarning && form.resumeParsed && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                <span className="text-amber-500 text-base shrink-0 mt-0.5">⚠️</span>
                <p className="text-sm text-amber-800">
                  We couldn't automatically parse your resume — no worries. You can fix any details on the final Review tab.
                </p>
              </div>
            )}

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

            {form.resumeParsed && (
              <div className={`flex items-center gap-3 p-4 border rounded-lg ${
                form.parseWarning ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
              }`}>
                {form.parseWarning
                  ? <span className="text-amber-500 shrink-0">⚠️</span>
                  : <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                }
                <div>
                  <p className={`text-sm font-semibold ${form.parseWarning ? 'text-amber-800' : 'text-emerald-800'}`}>
                    {form.parseWarning ? 'Resume uploaded — fill details on the Review tab' : 'Resume parsed successfully!'}
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
            )}
          </div>
        )}

        {/* ── Tab 4: Future Job Preferences ───────────────────────────── */}
        {step === 4 && (
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Future Job Preferences</h2>
            <p className="text-gray-500 mb-8 text-sm">Help us match you with the right opportunities.</p>

            <div className="space-y-6">
              <div>
                <Label>What's your current availability? <span className="text-red-500">*</span></Label>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {AVAILABILITY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set('jobSearchStatus', opt.value)}
                      className={`p-4 border-2 rounded-xl text-left transition-all ${
                        form.jobSearchStatus === opt.value
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xl mb-2">{opt.emoji}</div>
                      <p className={`text-sm font-semibold leading-tight ${form.jobSearchStatus === opt.value ? 'text-emerald-800' : 'text-gray-800'}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 leading-snug">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>What is your total cash compensation target? <span className="text-red-500">*</span></Label>
                <RadioGroup name="targetComp" value={form.targetComp} onChange={v => set('targetComp', v)}
                  options={COMP_OPTIONS} />
              </div>

              <div>
                <Label>Work preference <span className="text-red-500">*</span><span className="ml-2 text-xs font-normal text-gray-400">Select all that apply</span></Label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {WORK_PREFERENCES.map(wp => {
                    const selected = form.workPreferences.includes(wp.value);
                    return (
                      <button key={wp.value} type="button"
                        onClick={() => {
                          const next = selected
                            ? form.workPreferences.filter(v => v !== wp.value)
                            : [...form.workPreferences, wp.value];
                          set('workPreferences', next);
                        }}
                        className={`flex flex-col items-center gap-1 p-4 border-2 rounded-xl transition-all text-center ${
                          selected
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}>
                        <span className="text-xl">{wp.label.split(' ')[0]}</span>
                        <span className={`text-xs font-semibold ${selected ? 'text-emerald-800' : 'text-gray-700'}`}>
                          {wp.label.split(' ').slice(1).join(' ')}
                        </span>
                        <span className="text-xs text-gray-400 leading-tight">{wp.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Which cities would you consider?
                  <span className="ml-2 text-xs font-normal text-gray-400">Select all that apply</span>
                </Label>
                <ChipGrid options={PREFERRED_CITIES} selected={form.preferredCities}
                  onChange={v => set('preferredCities', v)} />
                {form.preferredCities.includes(CITY_OTHER) && (
                  <Input
                    value={form.preferredCitiesOther}
                    onChange={e => set('preferredCitiesOther', e.target.value)}
                    placeholder="Tell us which city or region"
                    className="mt-3"
                  />
                )}
              </div>

              <div>
                <Label>Target roles (select all that apply)</Label>
                <ChipGrid options={TARGET_ROLES} selected={form.targetRoles}
                  onChange={v => set('targetRoles', v)} />
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 5: Work Authorization ──────────────────────────────── */}
        {step === 5 && (
          <div className="max-w-xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Work Authorization</h2>
            <p className="text-gray-500 mb-8 text-sm leading-relaxed">
              Two standard questions — we collect these as-is and never filter introductions on your answer.
            </p>

            <div className="space-y-6">
              <div>
                <Label className="text-sm font-semibold text-gray-800">
                  Are you legally authorized to work in the United States? <span className="text-red-500">*</span>
                </Label>
                <div className="space-y-2 mt-3">
                  {[
                    { value: true,  label: 'Yes' },
                    { value: false, label: 'No' },
                  ].map(opt => (
                    <label key={String(opt.value)} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      form.workAuthorizedUs === opt.value ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="radio"
                        name="workAuthorizedUs"
                        checked={form.workAuthorizedUs === opt.value}
                        onChange={() => set('workAuthorizedUs', opt.value)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        form.workAuthorizedUs === opt.value ? 'border-emerald-500' : 'border-gray-300'
                      }`}>
                        {form.workAuthorizedUs === opt.value && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </div>
                      <span className="text-sm font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-800">
                  Will you now or in the future require sponsorship for employment visa status (e.g. H-1B)? <span className="text-red-500">*</span>
                </Label>
                <div className="space-y-2 mt-3">
                  {[
                    { value: true,  label: 'Yes' },
                    { value: false, label: 'No' },
                  ].map(opt => (
                    <label key={String(opt.value)} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      form.requiresSponsorship === opt.value ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="radio"
                        name="requiresSponsorship"
                        checked={form.requiresSponsorship === opt.value}
                        onChange={() => set('requiresSponsorship', opt.value)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        form.requiresSponsorship === opt.value ? 'border-emerald-500' : 'border-gray-300'
                      }`}>
                        {form.requiresSponsorship === opt.value && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </div>
                      <span className="text-sm font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 6: Review your profile ─────────────────────────────── */}
        {step === 6 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Review your profile</h2>
            <p className="text-gray-500 mb-6 text-sm">
              This is exactly what recruiters will see (your real name, contact info, and resume stay hidden until you accept an introduction).
              Edit any parsed details on the left if anything looks wrong.
            </p>

            {/* Two-column at lg+: left = editable details, right = live
                recruiter-view preview. Stacks vertically on smaller screens
                (md and below) — editor first, preview second. */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6 items-start">

              <div className="space-y-5 border border-gray-200 rounded-xl p-5 bg-gray-50">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Profile details (edit if needed)
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Current / most recent role</Label>
                  <Input value={form.currentRole} onChange={e => set('currentRole', e.target.value)}
                    placeholder="e.g. Senior Finance Manager" className="mt-2" />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={form.location} onChange={e => set('location', e.target.value)}
                    placeholder="e.g. New York, NY" className="mt-2" />
                </div>
                <div>
                  <Label>Years of experience</Label>
                  <Input type="number" min={0} max={50} value={form.yearsExperience}
                    onChange={e => set('yearsExperience', e.target.value)}
                    placeholder="e.g. 5" className="mt-2" />
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
              </div>

              <div>
                <Label>Education (degree + field)</Label>
                <Input value={form.education} onChange={e => set('education', e.target.value)}
                  placeholder="e.g. MBA, Finance" className="mt-2" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Your anonymous bio <span className="text-xs font-normal text-gray-400">(AI-generated, editable)</span></Label>
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
                <textarea
                  value={form.bio}
                  onChange={e => set('bio', e.target.value)}
                  rows={5}
                  placeholder="Your anonymous bio. You can edit it here."
                  className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-3 text-sm text-gray-700 leading-relaxed bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                />
              </div>

              <div>
                <Label>Skills</Label>
                <p className="text-xs text-gray-400 mt-0.5">Press Enter to add each skill</p>
                <SkillsInput skills={form.skills} onChange={v => set('skills', v)} />
              </div>
              </div>
              {/* End left column (editor) */}

              {/* Right column — live recruiter-view preview. Sticky on lg+
                  so the card stays visible while the user scrolls the
                  editor on the left. */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Recruiter view
                </p>
                <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm lg:sticky lg:top-4">
                  <AnonymousCandidateCard
                    mode="preview"
                    candidate={{
                      label: (form.currentRole || form.primaryBackground || 'Finance Professional'),
                      display_name: (form.currentRole || form.primaryBackground || 'Finance Professional'),
                      location: form.location || 'United States',
                      experience: Number(form.yearsExperience) || 0,
                      education: form.education || 'Not specified',
                      highest_education_level: form.educationLevel || null,
                      profile_description: form.bio || null,
                      primary_background: form.primaryBackground || null,
                      secondary_backgrounds: form.secondaryBackgrounds,
                      open_to_opportunities: form.jobSearchStatus === 'Actively Looking',
                      skills: form.skills.map((s, i) => ({ id: i, skill: s })),
                    }}
                  />
                </div>
              </div>
            </div>
            {/* End two-column grid */}

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 mt-6">
              <strong>Note:</strong> Your profile will be reviewed by our team before going live.
              We'll email you at <strong>{form.email}</strong> once it's approved.
            </div>
            {submitError && (
              <p className="text-sm text-red-600 p-3 bg-red-50 rounded-lg mt-4">{submitError}</p>
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
