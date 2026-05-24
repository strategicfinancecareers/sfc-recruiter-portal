import { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2, Upload, Loader2, ChevronRight, ChevronLeft,
  X, Plus, Shield, MessageCircle, RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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

type Screen = 'landing' | 'auth' | 'form' | 'disqualified' | 'success';

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

function LandingSection({ onStart }: { onStart: () => void }) {
  const s2 = useFadeIn(); const s3 = useFadeIn(); const s4 = useFadeIn();
  const s5 = useFadeIn(); const s6 = useFadeIn();
  const doubled = [...LANDING_LOGOS, ...LANDING_LOGOS];

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#FFFFFF', color: '#0A0A0A' }}>
      <style>{LANDING_CSS}</style>

      {/* ── Nav ── */}
      <nav style={{ padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F3F4F6' }}>
        <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em', color: '#0A0A0A' }}>SFC Talent</span>
        <button
          onClick={onStart}
          style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 500, color: '#374151', cursor: 'pointer' }}
        >
          Join the Network
        </button>
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

          <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>
            Takes 5 minutes · 100% free · Fully anonymous
          </p>
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
        <p style={{ fontSize: 13, color: '#9CA3AF' }}>
          Already have a profile?{' '}
          <a href="/candidate-dashboard" style={{ color: '#9CA3AF', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Access your dashboard →
          </a>
        </p>
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

  const canProceedStep5 = form.jobSearchStatus && form.workPreference;

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
    return <LandingSection onStart={() => setScreen('auth')} />;
  }

  if (screen === 'auth') {
    return (
      <div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <span className="font-bold text-xl text-gray-900 tracking-tight">SFC Talent</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Get started</h1>
          <p className="text-sm text-gray-500 mb-6">Join the private finance talent network</p>

          {/* Google SSO */}
          <button
            type="button"
            onClick={() => supabase.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo: 'https://sfc-recruiter-portal.vercel.app/candidate-dashboard' },
            })}
            className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-4"
          >
            <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#f8f8f8] px-3 text-gray-400">or</span>
            </div>
          </div>

          {/* Continue with email (no account needed) */}
          <button
            type="button"
            onClick={() => { setScreen('form'); setStep(1); }}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            Continue with email
          </button>

          <p className="text-xs text-gray-400 text-center mt-5 leading-relaxed">
            By continuing, you agree to our{' '}
            <a href="https://strategicfinancecareers.com" className="underline hover:text-gray-600">Terms of Service</a>
            {' '}and{' '}
            <a href="https://strategicfinancecareers.com" className="underline hover:text-gray-600">Privacy Policy</a>.
          </p>

          <button
            type="button"
            onClick={() => setScreen('landing')}
            className="mt-4 w-full text-xs text-gray-400 hover:text-gray-600 transition-colors text-center"
          >
            ← Back
          </button>
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
              Your profile is live and recruiters can now find you.
            </p>
          </div>

          {/* Google SSO — access dashboard */}
          <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-5 mb-5">
            <p className="text-sm font-semibold text-emerald-900 mb-1">Sign in with Google to access your dashboard:</p>
            <p className="text-xs text-emerald-700 mb-4">
              Manage your profile, update availability, and track introduction requests.
            </p>
            <button
              type="button"
              onClick={() => supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: 'https://sfc-recruiter-portal.vercel.app/candidate-dashboard' },
              })}
              className="w-full flex items-center justify-center bg-[#0F6E56] hover:bg-[#0a5942] text-white rounded-lg px-6 py-3 text-sm font-semibold transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className="mr-2 shrink-0">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="white" fillOpacity="0.9"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="white" fillOpacity="0.9"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="white" fillOpacity="0.9"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="white" fillOpacity="0.9"/>
              </svg>
              Continue with Google
            </button>
            <p className="text-xs text-emerald-600 mt-3 text-center">
              Use the same Google account as the email you applied with
            </p>
          </div>

          {/* Email preview mockup */}
          <p className="text-sm text-gray-500 text-center mb-4">
            When a recruiter is interested, you'll get an email like this:
          </p>
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-6 shadow-sm">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
            </div>
            <div className="p-5 bg-white text-sm space-y-2">
              <div className="text-gray-500 text-xs border-b border-gray-100 pb-3 mb-3">
                <p><span className="font-semibold text-gray-700">From:</span> SFC Talent &lt;noreply@strategicfinancecareers.com&gt;</p>
                <p><span className="font-semibold text-gray-700">Subject:</span> New opportunity: VP Finance at [Company]</p>
              </div>
              <p className="text-gray-800">Hi {form.firstName || '[First Name]'},</p>
              <p className="text-gray-600 leading-relaxed text-xs">
                A company is interested in connecting with you about a <strong>VP Finance</strong> role
                offering <strong>$180k–$220k</strong> total comp. You have 48 hours to respond.
              </p>
              <div className="flex gap-3 pt-2">
                <span className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-default">✅ YES</span>
                <span className="inline-block px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold cursor-default">❌ NO</span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <Button
              variant="outline"
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
                <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-xs text-blue-700 leading-relaxed">
                    We want to provide a great experience to both sides. Clear availability signals help recruiters move fast and respect your time.
                  </p>
                </div>
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
