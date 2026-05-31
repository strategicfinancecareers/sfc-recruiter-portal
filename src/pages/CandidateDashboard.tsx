import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus, LogIn, Loader2, CheckCircle2, X, ChevronLeft,
  User, Mail, FileText, Settings as SettingsIcon, Menu,
  LogOut, KeyRound, ExternalLink,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { authedFetch } from '@/integrations/supabase/authedFetch';
import '@fontsource-variable/newsreader';
import '@fontsource-variable/manrope';
import '@fontsource-variable/geist-mono';

// ─────────────────────────────────────────────────────────────────────────────
// Candidate dashboard — professional theme (cream / Newsreader / brand-green)
// matches /apply value-panel and the AuthShellProfessional auth surfaces.
//
// Layout: persistent left sidebar with 4 tabs (Profile, Introductions,
// Resume, Settings). On <860px the sidebar collapses behind a top bar
// hamburger and slides over the content.
//
// Anonymity note: this is the candidate's OWN authenticated dashboard.
// Real name / email / etc. are shown. The recruiter-facing anonymized
// view (display_name only until intro is approved) lives elsewhere in
// AnonymousCandidateCard.
//
// Session model: this page does its own supabase.auth.getSession() check
// — AuthContext.user is intentionally null for candidates (BUG 3 fix
// closes the candidate-leak-to-public.users vector).
// ─────────────────────────────────────────────────────────────────────────────

// ─── Theme tokens ────────────────────────────────────────────────────────────
const CREAM = '#f4f1ea';
const INK = '#0e0e0d';
const BRAND = '#008037';
const BRAND_HOVER = '#006a2d';
const SERIF = '"Newsreader Variable", "Newsreader", Georgia, serif';
const SANS = '"Manrope Variable", "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const MONO = '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CandidateRow {
  id: string;
  name: string;
  display_name?: string;
  email: string;
  phone?: string;
  label?: string;
  location?: string;
  experience?: number;
  profile_description?: string;
  open_to_opportunities?: boolean;
  // Legacy singular (deprecated mirror)
  work_preference?: string;
  // Post-rework canonical multi-select
  work_preferences?: string[];
  target_salary?: string;
  linkedin_url?: string;
  preferred_cities?: string[];
  preferred_cities_other?: string;
  target_roles?: string[];
  target_company_stages?: string[];
  industries?: string[];
  industries_other?: string;
  new_areas?: string[];
  primary_background?: string;
  secondary_backgrounds?: string[];
  skills?: string[];
  resume_full_url?: string;
  work_authorized_us?: boolean;
  requires_sponsorship?: boolean;
  status?: 'pending' | 'active' | 'rejected' | 'inactive' | 'deleted';
}

interface IntroRequest {
  id: string;
  created_at: string;
  status: string;
  jobs?: {
    title: string | null;
    company: string | null;
    salary_range: string | null;
    job_description_url?: string | null;
  } | null;
  requester?: {
    first_name: string | null;
    last_name: string | null;
    company: string | null;
  } | null;
}

type DashView = 'loading' | 'landing' | 'signin' | 'dashboard';
type TabKey = 'profile' | 'introductions' | 'resume' | 'settings';

// ─── Main export ─────────────────────────────────────────────────────────────

export default function CandidateDashboard() {
  const [view, setView] = useState<DashView>('loading');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [signinLoading, setSigninLoading] = useState(false);
  const [signinError, setSigninError] = useState('');
  const [candidate, setCandidate] = useState<CandidateRow | null>(null);
  const [skills, setSkills] = useState<string[]>([]);

  // ── Session check on mount ─ unchanged from prior implementation ──────────
  // refreshSession() reconciles against the auth server so a stale local
  // session doesn't win after a different user verifies in this browser.
  // 'loading' state hides both landing AND dashboard until the candidate-
  // profile fetch resolves, eliminating the post-/apply submit flash.
  useEffect(() => {
    (async () => {
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) {
        console.warn('[CandidateDashboard] refreshSession error:', refreshErr.message);
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        setView('landing');
        return;
      }
      const email = session.user.email;
      setEmailInput(email);
      setSigninLoading(true);
      try {
        const res = await authedFetch(`/api/candidate-profile?email=${encodeURIComponent(email.toLowerCase())}`);
        if (res.ok) {
          const { candidate: c } = await res.json();
          const extracted: string[] = (c.skills || []) as string[];
          setCandidate(c as CandidateRow);
          setSkills(extracted);
          setView('dashboard');
        } else if (res.status === 404) {
          window.location.href = '/apply';
        } else {
          console.error('[CandidateDashboard] profile fetch returned', res.status);
          setView('landing');
        }
      } catch (err) {
        console.error('[CandidateDashboard] profile fetch threw:', err);
        setView('landing');
      } finally {
        setSigninLoading(false);
      }
    })().catch(err => {
      console.error('[CandidateDashboard] session check error:', err);
      setView('landing');
    });
  }, []);

  // ── Sign-in handler ──────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigninLoading(true);
    setSigninError('');
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: emailInput.toLowerCase().trim(),
        password: passwordInput,
      });
      if (authError) {
        setSigninError('Invalid email or password.');
        return;
      }
      // Sign-in just succeeded above, so authedFetch will attach the
      // fresh session's access token automatically.
      const res = await authedFetch(`/api/candidate-profile?email=${encodeURIComponent(emailInput.toLowerCase().trim())}`);
      if (res.status === 404) {
        window.location.href = '/apply';
        return;
      }
      if (!res.ok) {
        setSigninError('Something went wrong, please try again.');
        return;
      }
      const { candidate: c } = await res.json();
      const extracted: string[] = (c.skills || []) as string[];
      setCandidate(c as CandidateRow);
      setSkills(extracted);
      setView('dashboard');
    } catch (err: any) {
      console.error('[CandidateDashboard] sign-in error:', err);
      setSigninError('Something went wrong, please try again.');
    } finally {
      setSigninLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCandidate(null);
    setSkills([]);
    setEmailInput('');
    setPasswordInput('');
    setSigninError('');
    setView('landing');
  };

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: CREAM, color: INK, fontFamily: SANS }}
      >
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'rgba(14,14,13,.35)' }} />
      </div>
    );
  }

  // ── LANDING (themed) ─────────────────────────────────────────────────────
  if (view === 'landing') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 py-16"
        style={{ background: CREAM, color: INK, fontFamily: SANS }}
      >
        <p className="font-bold text-lg tracking-tight mb-10" style={{ color: INK }}>SFC Talent</p>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xl">
          <div className="flex-1 bg-white border rounded-2xl p-8 flex flex-col" style={{ borderColor: 'rgba(14,14,13,.08)' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(0,128,55,.08)' }}>
              <UserPlus className="w-5 h-5" style={{ color: BRAND }} />
            </div>
            <p style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(14,14,13,.55)' }} className="mb-2">New here?</p>
            <h2 className="text-lg font-semibold mb-2" style={{ color: INK }}>Create your anonymous finance profile</h2>
            <div className="flex-1" />
            <button
              onClick={() => { window.location.href = '/apply'; }}
              className="w-full mt-6 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
              style={{ background: BRAND }}
              onMouseEnter={e => (e.currentTarget.style.background = BRAND_HOVER)}
              onMouseLeave={e => (e.currentTarget.style.background = BRAND)}
            >
              Join the Network
            </button>
          </div>
          <div className="flex-1 bg-white border rounded-2xl p-8 flex flex-col" style={{ borderColor: 'rgba(14,14,13,.08)' }}>
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <LogIn className="w-5 h-5" style={{ color: 'rgba(14,14,13,.6)' }} />
            </div>
            <p style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(14,14,13,.55)' }} className="mb-2">Already applied?</p>
            <h2 className="text-lg font-semibold mb-2" style={{ color: INK }}>Access your profile dashboard</h2>
            <div className="flex-1" />
            <button
              onClick={() => setView('signin')}
              className="w-full mt-6 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors text-white"
              style={{ background: INK }}
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── SIGN IN (themed) ─────────────────────────────────────────────────────
  if (view === 'signin') {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: CREAM, color: INK, fontFamily: SANS }}
      >
        <div className="bg-white border rounded-2xl p-10 w-full max-w-sm" style={{ borderColor: 'rgba(14,14,13,.08)' }}>
          <button
            onClick={() => { setSigninError(''); setView('landing'); }}
            className="flex items-center gap-1.5 text-sm mb-7 transition-colors"
            style={{ color: 'rgba(14,14,13,.55)' }}
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <p className="font-bold text-lg tracking-tight mb-5">SFC Talent</p>
          <h1 className="text-2xl font-semibold mb-1" style={{ fontFamily: SERIF, fontWeight: 500 }}>Sign in</h1>
          <p className="text-sm mb-7" style={{ color: 'rgba(14,14,13,.55)' }}>Access your candidate dashboard</p>
          <form onSubmit={handleSignIn} className="space-y-3">
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              className="w-full border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2"
              style={{ borderColor: 'rgba(14,14,13,.15)', color: INK, ['--tw-ring-color' as any]: BRAND }}
            />
            <input
              type="password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2"
              style={{ borderColor: 'rgba(14,14,13,.15)', color: INK, ['--tw-ring-color' as any]: BRAND }}
            />
            {signinError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 leading-relaxed">
                {signinError}
              </p>
            )}
            <button
              type="submit"
              disabled={signinLoading}
              className="w-full flex items-center justify-center gap-2 disabled:opacity-60 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
              style={{ background: BRAND }}
              onMouseEnter={e => !signinLoading && (e.currentTarget.style.background = BRAND_HOVER)}
              onMouseLeave={e => !signinLoading && (e.currentTarget.style.background = BRAND)}
            >
              {signinLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign In
            </button>
            <p className="text-xs text-center pt-2" style={{ color: 'rgba(14,14,13,.55)' }}>
              Forgot your password?{' '}
              <Link to="/forgot-password?audience=professional" className="underline font-medium" style={{ color: BRAND }}>
                Reset it
              </Link>
            </p>
          </form>
        </div>
      </div>
    );
  }

  // ── DASHBOARD ────────────────────────────────────────────────────────────
  return (
    <Dashboard
      candidate={candidate!}
      skills={skills}
      onSignOut={handleSignOut}
      onUpdate={c => { setCandidate(c); if (c.skills) setSkills(c.skills); }}
    />
  );
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CITY_OPTIONS = [
  'New York', 'San Francisco / Bay Area', 'Los Angeles', 'Chicago',
  'Boston', 'Austin', 'Miami', 'Seattle', 'Denver', 'Washington D.C.',
  'Open to relocation', 'No preference',
];

const ROLE_OPTIONS = [
  'Strategic Finance', 'Corporate Development', 'FP&A', 'Strategy & Operations',
  'Finance Manager / Director', 'VP Finance / CFO', 'Chief of Staff',
];

const COMP_OPTIONS = [
  { value: 'under-70k', label: 'Under $70,000' },
  { value: '70k-100k',  label: '$70,000 – $100,000' },
  { value: '100k-150k', label: '$100,000 – $150,000' },
  { value: '150k-200k', label: '$150,000 – $200,000' },
  { value: '200k-300k', label: '$200,000 – $300,000' },
  { value: '300k-plus', label: '$300,000+' },
];

// ─── Status banner ──────────────────────────────────────────────────────────

function StatusBanner({ status }: { status?: string }) {
  if (status === 'active') return null;

  const base = 'rounded-xl border px-5 py-4';
  if (status === 'pending') {
    return (
      <div className={`${base} border-amber-200 bg-amber-50`}>
        <p className="text-sm font-semibold text-amber-900">⏳ Your profile is under review</p>
        <p className="text-sm text-amber-800 mt-1 leading-relaxed">
          Our team manually vets every candidate. We'll email you the moment your profile is approved (usually within 1–2 business days). You can still review and edit your details below.
        </p>
      </div>
    );
  }
  if (status === 'rejected') {
    return (
      <div className={`${base} border-red-200 bg-red-50`}>
        <p className="text-sm font-semibold text-red-900">Application not accepted</p>
        <p className="text-sm text-red-800 mt-1 leading-relaxed">
          Your application wasn't accepted at this time. If you'd like to know more or appeal,
          email us at <a href="mailto:talent@strategicfinancecareers.com" className="underline font-medium">talent@strategicfinancecareers.com</a>.
        </p>
      </div>
    );
  }
  if (status === 'inactive') {
    return (
      <div className={`${base} border-gray-200 bg-gray-50`}>
        <p className="text-sm font-semibold text-gray-900">⏸ Profile paused</p>
        <p className="text-sm text-gray-700 mt-1 leading-relaxed">
          Your profile is paused and not visible to recruiters. Email{' '}
          <a href="mailto:talent@strategicfinancecareers.com" className="underline font-medium">talent@strategicfinancecareers.com</a>{' '}
          to reactivate it.
        </p>
      </div>
    );
  }
  if (status === 'deleted') {
    return (
      <div className={`${base} border-gray-200 bg-gray-50`}>
        <p className="text-sm font-semibold text-gray-900">Account not found</p>
        <p className="text-sm text-gray-700 mt-1">
          We couldn't find an active profile for your account. Please contact{' '}
          <a href="mailto:talent@strategicfinancecareers.com" className="underline font-medium">talent@strategicfinancecareers.com</a>.
        </p>
      </div>
    );
  }
  return null;
}

// ─── Dashboard shell (sidebar + tabbed content) ─────────────────────────────

function Dashboard({
  candidate: initialCandidate,
  skills: initialSkills,
  onSignOut,
  onUpdate,
}: {
  candidate: CandidateRow;
  skills: string[];
  onSignOut: () => void;
  onUpdate: (c: CandidateRow) => void;
}) {
  const [candidate, setCandidate] = useState(initialCandidate);
  const [skills, setSkills] = useState(initialSkills);
  // Keep local state in sync if the parent re-fetches/replaces the
  // candidate (initial mount captures via useState; this propagates
  // later updates). Without this, a status change pushed from the
  // parent would never reach the Dashboard subtree.
  useEffect(() => { setCandidate(initialCandidate); }, [initialCandidate]);
  useEffect(() => { setSkills(initialSkills); }, [initialSkills]);

  const [tab, setTab] = useState<TabKey>('profile');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Intros are loaded once for the badge count and the Introductions tab.
  const [intros, setIntros] = useState<IntroRequest[] | null>(null);
  useEffect(() => {
    fetch(`/api/candidate-intros?candidateId=${encodeURIComponent(candidate.id)}`)
      .then(r => r.json())
      .then(data => setIntros(data.requests || []))
      .catch(() => setIntros([]));
  }, [candidate.id]);

  const pendingCount = intros?.filter(i => i.status === 'pending').length ?? 0;
  const canHaveIntros = candidate.status === 'active';

  const updateCandidate = (next: CandidateRow) => {
    setCandidate(next);
    onUpdate(next);
  };
  const updateSkills = (next: string[]) => {
    setSkills(next);
    onUpdate({ ...candidate, skills: next });
  };

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const TABS: { key: TabKey; label: string; icon: typeof User; badge?: number }[] = [
    { key: 'profile',       label: 'Profile',       icon: User },
    { key: 'introductions', label: 'Introductions', icon: Mail,        badge: pendingCount },
    { key: 'resume',        label: 'Resume',        icon: FileText },
    { key: 'settings',      label: 'Settings',      icon: SettingsIcon },
  ];

  const NavItem = ({ t }: { t: typeof TABS[number] }) => {
    const active = tab === t.key;
    const Icon = t.icon;
    return (
      <button
        onClick={() => { setTab(t.key); setMobileNavOpen(false); }}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
        style={{
          background: active ? 'rgba(0,128,55,.08)' : 'transparent',
          color: active ? BRAND : 'rgba(14,14,13,.75)',
        }}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="flex-1">{t.label}</span>
        {t.badge ? (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
            style={{ background: BRAND }}
          >
            {t.badge}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ background: CREAM, color: INK, fontFamily: SANS }}
    >
      {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
      <aside
        className="hidden min-[860px]:flex w-[260px] shrink-0 flex-col bg-white border-r"
        style={{ borderColor: 'rgba(14,14,13,.08)' }}
      >
        <div className="px-6 py-6 border-b" style={{ borderColor: 'rgba(14,14,13,.06)' }}>
          <span className="font-bold text-lg tracking-tight">SFC Talent</span>
          <p
            className="mt-2 truncate"
            style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(14,14,13,.55)' }}
            title={candidate.display_name || candidate.label || candidate.name}
          >
            {candidate.display_name || candidate.label || candidate.name}
          </p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {TABS.map(t => <NavItem key={t.key} t={t} />)}
        </nav>
        <div className="px-3 py-4 border-t" style={{ borderColor: 'rgba(14,14,13,.06)' }}>
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left hover:bg-gray-50"
            style={{ color: 'rgba(14,14,13,.65)' }}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar + slide-over nav ───────────────────────────── */}
      <div className="min-[860px]:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b flex items-center justify-between px-4 py-3" style={{ borderColor: 'rgba(14,14,13,.08)' }}>
        <button
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-50"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-bold text-base tracking-tight">SFC Talent</span>
        <button
          onClick={onSignOut}
          className="text-xs font-medium"
          style={{ color: 'rgba(14,14,13,.6)' }}
        >
          Sign out
        </button>
      </div>
      {mobileNavOpen && (
        <div className="min-[860px]:hidden fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/40" onClick={() => setMobileNavOpen(false)} />
          <div className="w-[260px] bg-white flex flex-col">
            <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'rgba(14,14,13,.06)' }}>
              <span className="font-bold text-lg tracking-tight">SFC Talent</span>
              <button onClick={() => setMobileNavOpen(false)} aria-label="Close menu" className="p-1.5 -mr-1.5 rounded-lg hover:bg-gray-50">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {TABS.map(t => <NavItem key={t.key} t={t} />)}
            </nav>
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 pt-[57px] min-[860px]:pt-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 space-y-6">
          <StatusBanner status={candidate.status} />

          {tab === 'profile' && (
            <ProfileTab
              candidate={candidate}
              skills={skills}
              onUpdateCandidate={updateCandidate}
              onUpdateSkills={updateSkills}
            />
          )}
          {tab === 'introductions' && (
            canHaveIntros ? (
              <IntroductionsTab
                candidateId={candidate.id}
                intros={intros}
                setIntros={setIntros}
              />
            ) : (
              <Card title="Introductions">
                <p className="text-sm" style={{ color: 'rgba(14,14,13,.65)' }}>
                  Introductions become available once your profile is approved.
                </p>
              </Card>
            )
          )}
          {tab === 'resume' && (
            <ResumeTab candidate={candidate} />
          )}
          {tab === 'settings' && (
            <SettingsTab candidate={candidate} onSignOut={onSignOut} />
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Shared themed Card ─────────────────────────────────────────────────────

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border rounded-2xl p-6" style={{ borderColor: 'rgba(14,14,13,.08)' }}>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2
          style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(14,14,13,.55)' }}
        >
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Profile tab ────────────────────────────────────────────────────────────

function ProfileTab({
  candidate,
  skills,
  onUpdateCandidate,
  onUpdateSkills,
}: {
  candidate: CandidateRow;
  skills: string[];
  onUpdateCandidate: (c: CandidateRow) => void;
  onUpdateSkills: (s: string[]) => void;
}) {
  const [showEdit, setShowEdit] = useState(false);

  // Pre-fill the edit form from the canonical post-rework fields, falling
  // back to the deprecated singular mirror when only that was written.
  // Centralizing this here (and re-running it via the openEdit reset and
  // the candidate-changed useEffect below) is the fix for bug #1.8 —
  // previously the form initializers read candidate.work_preference
  // (singular) which is null for candidates submitted via the new wizard,
  // so the form started blank.
  const seedWorkPref = () =>
    (candidate.work_preferences && candidate.work_preferences[0])
    || candidate.work_preference
    || '';

  const [editBio, setEditBio] = useState(candidate.profile_description || '');
  const [editWorkPref, setEditWorkPref] = useState(seedWorkPref());
  const [editTargetComp, setEditTargetComp] = useState(candidate.target_salary || '');
  const [editAvail, setEditAvail] = useState<'active' | 'inactive'>(candidate.open_to_opportunities ? 'active' : 'inactive');
  const [editCities, setEditCities] = useState<string[]>(candidate.preferred_cities ?? []);
  const [editRoles, setEditRoles] = useState<string[]>(candidate.target_roles ?? []);
  const [editLinkedin, setEditLinkedin] = useState(candidate.linkedin_url || '');
  const [editSkills, setEditSkills] = useState<string[]>(skills);
  const [skillInput, setSkillInput] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const [editError, setEditError] = useState('');

  // Resync when the candidate prop changes (e.g., after a save round-trip
  // refreshes the parent state). Only resyncs when the form is NOT open,
  // so we don't overwrite the user's in-progress edits.
  useEffect(() => {
    if (showEdit) return;
    setEditBio(candidate.profile_description || '');
    setEditWorkPref(seedWorkPref());
    setEditTargetComp(candidate.target_salary || '');
    setEditAvail(candidate.open_to_opportunities ? 'active' : 'inactive');
    setEditCities(candidate.preferred_cities ?? []);
    setEditRoles(candidate.target_roles ?? []);
    setEditLinkedin(candidate.linkedin_url || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate]);
  useEffect(() => {
    if (!showEdit) setEditSkills(skills);
  }, [skills, showEdit]);

  const openEdit = () => {
    setEditBio(candidate.profile_description || '');
    setEditWorkPref(seedWorkPref());
    setEditTargetComp(candidate.target_salary || '');
    setEditAvail(candidate.open_to_opportunities ? 'active' : 'inactive');
    setEditCities(candidate.preferred_cities ?? []);
    setEditRoles(candidate.target_roles ?? []);
    setEditLinkedin(candidate.linkedin_url || '');
    setEditSkills(skills);
    setEditError('');
    setShowEdit(true);
  };

  const toggleCity = (c: string) =>
    setEditCities(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleRole = (r: string) =>
    setEditRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);

  const addSkill = () => {
    const t = skillInput.trim();
    if (t && !editSkills.includes(t)) setEditSkills(prev => [...prev, t]);
    setSkillInput('');
  };
  const removeSkill = (s: string) => setEditSkills(prev => prev.filter(x => x !== s));

  const saveEdit = async () => {
    setEditSaving(true);
    setEditError('');
    try {
      const res = await authedFetch('/api/candidate-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: candidate.id,
          profile_description: editBio,
          work_preference: editWorkPref,
          target_salary: editTargetComp,
          open_to_opportunities: editAvail === 'active',
          preferred_cities: editCities,
          target_roles: editRoles,
          linkedin_url: editLinkedin,
          skills: editSkills,
        }),
      });
      if (!res.ok) {
        setEditError('Could not save changes — please try again.');
        return;
      }
      const updated: CandidateRow = {
        ...candidate,
        profile_description: editBio,
        work_preference: editWorkPref,
        target_salary: editTargetComp,
        open_to_opportunities: editAvail === 'active',
        preferred_cities: editCities,
        target_roles: editRoles,
        linkedin_url: editLinkedin,
      };
      onUpdateCandidate(updated);
      onUpdateSkills(editSkills);
      setEditSaved(true);
      setTimeout(() => { setEditSaved(false); setShowEdit(false); }, 1500);
    } finally {
      setEditSaving(false);
    }
  };

  const bio = candidate.profile_description || '';
  const displaySkills = showEdit ? editSkills : skills;
  const workPrefDisplay = (candidate.work_preferences && candidate.work_preferences.join(', '))
    || candidate.work_preference;

  // ─ Themed UI helpers ─
  const inputCls = 'w-full border rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2';
  const inputStyle = { borderColor: 'rgba(14,14,13,.15)', color: INK, ['--tw-ring-color' as any]: BRAND } as React.CSSProperties;
  const labelStyle = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'rgba(14,14,13,.55)' };

  return (
    <Card
      title="Your Profile"
      action={
        !showEdit ? (
          <button
            onClick={openEdit}
            className="text-sm font-semibold transition-colors"
            style={{ color: BRAND }}
            onMouseEnter={e => (e.currentTarget.style.color = BRAND_HOVER)}
            onMouseLeave={e => (e.currentTarget.style.color = BRAND)}
          >
            Edit Profile
          </button>
        ) : (
          <button
            onClick={() => { setShowEdit(false); setEditError(''); }}
            className="text-sm font-medium"
            style={{ color: 'rgba(14,14,13,.55)' }}
          >
            Cancel
          </button>
        )
      }
    >
      {/* ── Read-only view ── */}
      {!showEdit && (
        <div className="space-y-4">
          <div>
            <p
              className="text-2xl"
              style={{ fontFamily: SERIF, fontWeight: 500, letterSpacing: '-0.01em', color: INK }}
            >
              {candidate.label || 'Finance Professional'}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {candidate.location && <span className="text-sm" style={{ color: 'rgba(14,14,13,.6)' }}>{candidate.location}</span>}
              {candidate.experience != null && <span className="text-sm" style={{ color: 'rgba(14,14,13,.6)' }}>{candidate.experience} yrs exp</span>}
              {workPrefDisplay && <span className="text-sm" style={{ color: 'rgba(14,14,13,.6)' }}>{workPrefDisplay}</span>}
              {candidate.open_to_opportunities != null && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: candidate.open_to_opportunities ? 'rgba(0,128,55,.1)' : 'rgba(14,14,13,.06)',
                    color: candidate.open_to_opportunities ? BRAND : 'rgba(14,14,13,.55)',
                  }}
                >
                  {candidate.open_to_opportunities ? '🟢 Actively Looking' : '⏸ Not Active'}
                </span>
              )}
            </div>
          </div>
          {bio && <p className="text-sm leading-relaxed" style={{ color: 'rgba(14,14,13,.75)' }}>{bio}</p>}
          {displaySkills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {displaySkills.map(s => (
                <span
                  key={s}
                  className="px-2.5 py-1 rounded-full text-xs font-medium border"
                  style={{ background: 'rgba(0,128,55,.06)', color: BRAND, borderColor: 'rgba(0,128,55,.18)' }}
                >
                  {s}
                </span>
              ))}
            </div>
          )}
          <div className="space-y-1 pt-2">
            {candidate.target_salary && (
              <p className="text-xs" style={{ color: 'rgba(14,14,13,.5)' }}>Target comp: {COMP_OPTIONS.find(o => o.value === candidate.target_salary)?.label ?? candidate.target_salary}</p>
            )}
            {candidate.preferred_cities && candidate.preferred_cities.length > 0 && (
              <p className="text-xs" style={{ color: 'rgba(14,14,13,.5)' }}>Cities: {candidate.preferred_cities.join(', ')}</p>
            )}
            {candidate.target_roles && candidate.target_roles.length > 0 && (
              <p className="text-xs" style={{ color: 'rgba(14,14,13,.5)' }}>Target roles: {candidate.target_roles.join(', ')}</p>
            )}
            {candidate.industries && candidate.industries.length > 0 && (
              <p className="text-xs" style={{ color: 'rgba(14,14,13,.5)' }}>Industries: {candidate.industries.join(', ')}</p>
            )}
            {candidate.linkedin_url && (
              <a
                href={candidate.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium hover:underline pt-1"
                style={{ color: BRAND }}
              >
                LinkedIn <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Edit form ── */}
      {showEdit && (
        <div className="space-y-5">
          <div>
            <label className="block mb-1.5" style={labelStyle}>Professional Bio</label>
            <textarea
              value={editBio}
              onChange={e => setEditBio(e.target.value)}
              rows={4}
              className={`${inputCls} resize-none leading-relaxed`}
              style={inputStyle}
              placeholder="Describe your background and what you're looking for…"
            />
          </div>

          <div>
            <label className="block mb-1.5" style={labelStyle}>Work Preference</label>
            <select
              value={editWorkPref}
              onChange={e => setEditWorkPref(e.target.value)}
              className={inputCls}
              style={inputStyle}
            >
              <option value="">Select…</option>
              {['Remote', 'Hybrid', 'In-Office'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div>
            <label className="block mb-1.5" style={labelStyle}>Target Total Compensation</label>
            <select
              value={editTargetComp}
              onChange={e => setEditTargetComp(e.target.value)}
              className={inputCls}
              style={inputStyle}
            >
              <option value="">Select…</option>
              {COMP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block mb-2" style={labelStyle}>Availability</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { val: 'active',   emoji: '🟢', label: 'Actively Looking', desc: "Open to new opportunities" },
                { val: 'inactive', emoji: '⏸️', label: 'Not Active',       desc: "Not looking right now" },
              ] as const).map(opt => {
                const sel = editAvail === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setEditAvail(opt.val)}
                    className="p-3 border-2 rounded-xl text-left transition-all"
                    style={{
                      borderColor: sel ? BRAND : 'rgba(14,14,13,.12)',
                      background: sel ? 'rgba(0,128,55,.06)' : '#fff',
                    }}
                  >
                    <div className="text-lg mb-1">{opt.emoji}</div>
                    <p className="text-xs font-semibold leading-tight" style={{ color: sel ? BRAND : INK }}>{opt.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(14,14,13,.5)' }}>{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block mb-2" style={labelStyle}>Preferred Cities</label>
            <div className="flex flex-wrap gap-2">
              {CITY_OPTIONS.map(c => {
                const sel = editCities.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCity(c)}
                    className="px-3 py-1.5 rounded-full text-xs border font-medium transition-all"
                    style={{
                      background: sel ? BRAND : '#fff',
                      color: sel ? '#fff' : INK,
                      borderColor: sel ? BRAND : 'rgba(14,14,13,.18)',
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block mb-2" style={labelStyle}>Target Roles</label>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map(r => {
                const sel = editRoles.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleRole(r)}
                    className="px-3 py-1.5 rounded-full text-xs border font-medium transition-all"
                    style={{
                      background: sel ? BRAND : '#fff',
                      color: sel ? '#fff' : INK,
                      borderColor: sel ? BRAND : 'rgba(14,14,13,.18)',
                    }}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block mb-1.5" style={labelStyle}>LinkedIn URL</label>
            <input
              type="url"
              value={editLinkedin}
              onChange={e => setEditLinkedin(e.target.value)}
              placeholder="https://linkedin.com/in/yourname"
              className={inputCls}
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block mb-1.5" style={labelStyle}>Skills</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                placeholder="e.g. Financial Modeling, SQL…"
                className={`${inputCls} flex-1`}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={addSkill}
                className="px-3 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
                style={{ borderColor: 'rgba(14,14,13,.15)', color: 'rgba(14,14,13,.7)' }}
              >
                Add
              </button>
            </div>
            {editSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {editSkills.map(s => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border"
                    style={{ background: 'rgba(0,128,55,.06)', color: BRAND, borderColor: 'rgba(0,128,55,.18)' }}
                  >
                    {s}
                    <button type="button" onClick={() => removeSkill(s)} className="hover:text-red-500 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {editError && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">{editError}</p>
          )}
          <div className="flex items-center gap-3 pt-1">
            {editSaved && (
              <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: BRAND }}>
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
            <button
              onClick={saveEdit}
              disabled={editSaving}
              className="flex items-center gap-2 disabled:opacity-60 text-white rounded-lg px-5 py-2 text-sm font-semibold transition-colors"
              style={{ background: BRAND }}
              onMouseEnter={e => !editSaving && (e.currentTarget.style.background = BRAND_HOVER)}
              onMouseLeave={e => !editSaving && (e.currentTarget.style.background = BRAND)}
            >
              {editSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Introductions tab ──────────────────────────────────────────────────────

function IntroductionsTab({
  candidateId,
  intros,
  setIntros,
}: {
  candidateId: string;
  intros: IntroRequest[] | null;
  setIntros: React.Dispatch<React.SetStateAction<IntroRequest[] | null>>;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _cid = candidateId;
  const [responding, setResponding] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const respond = async (introId: string, accept: boolean) => {
    setResponding(introId);
    await fetch(`/api/respond-to-intro?introId=${introId}&response=${accept ? 'yes' : 'no'}`).catch(() => {});
    setIntros(prev => prev?.map(i => i.id === introId ? { ...i, status: accept ? 'approved' : 'rejected' } : i) ?? null);
    setConfirmed(introId);
    setResponding(null);
    setTimeout(() => setConfirmed(null), 4000);
  };

  const pendingCount = intros?.filter(i => i.status === 'pending').length ?? 0;

  return (
    <Card
      title="Introduction Requests"
      action={
        pendingCount > 0 ? (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: BRAND }}>
            {pendingCount} pending
          </span>
        ) : undefined
      }
    >
      {intros === null && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'rgba(14,14,13,.25)' }} />
        </div>
      )}

      {intros !== null && intros.length === 0 && (
        <p className="text-sm py-4 text-center" style={{ color: 'rgba(14,14,13,.5)' }}>No requests yet</p>
      )}

      {intros !== null && intros.length > 0 && (
        <div className="space-y-3">
          {intros.map(req => {
            const job = req.jobs;
            const statusStyles: Record<string, { bg: string; color: string; border: string }> = {
              pending:  { bg: 'rgba(245,158,11,.08)', color: '#92400e', border: 'rgba(245,158,11,.25)' },
              approved: { bg: 'rgba(0,128,55,.08)',   color: BRAND,      border: 'rgba(0,128,55,.25)' },
              rejected: { bg: 'rgba(14,14,13,.04)',   color: 'rgba(14,14,13,.5)', border: 'rgba(14,14,13,.1)' },
            };
            const statusLabels: Record<string, string> = {
              pending: 'Awaiting your response',
              approved: 'Introduction made',
              rejected: 'Passed',
            };
            const sc = statusStyles[req.status] ?? statusStyles.pending;
            const sl = statusLabels[req.status] ?? 'Pending';

            // Full reveal — recruiters are vetted, so the candidate sees who's
            // asking before accepting (no anonymity in this direction).
            const requester = req.requester;
            const recruiterName = requester
              ? [requester.first_name, requester.last_name].filter(Boolean).join(' ').trim()
              : '';
            const recruiterCompany = requester?.company || '';

            return (
              <div key={req.id} className="border rounded-xl p-4" style={{ borderColor: 'rgba(14,14,13,.08)' }}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: INK }}>
                      {job?.title || 'Finance Role'}{job?.company ? ` — ${job.company}` : ''}
                    </p>
                    {job?.salary_range && (
                      <p className="text-xs font-medium mt-0.5" style={{ color: BRAND }}>{job.salary_range}</p>
                    )}
                  </div>
                  <p className="text-xs shrink-0 whitespace-nowrap" style={{ color: 'rgba(14,14,13,.45)' }}>
                    {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>

                {(recruiterName || recruiterCompany || job?.job_description_url) && (
                  <div className="mb-2 text-xs leading-relaxed space-y-0.5" style={{ color: 'rgba(14,14,13,.65)' }}>
                    {recruiterName && (
                      <p>
                        <span style={{ color: 'rgba(14,14,13,.45)' }}>From: </span>
                        <span className="font-medium" style={{ color: INK }}>{recruiterName}</span>
                        {recruiterCompany && (
                          <span style={{ color: 'rgba(14,14,13,.55)' }}> at {recruiterCompany}</span>
                        )}
                      </p>
                    )}
                    {job?.job_description_url && (
                      <p>
                        <a
                          href={job.job_description_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline"
                          style={{ color: BRAND }}
                        >
                          View job description ↗
                        </a>
                      </p>
                    )}
                  </div>
                )}

                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
                  style={{ background: sc.bg, color: sc.color, borderColor: sc.border }}
                >
                  {sl}
                </span>

                {req.status === 'pending' && (
                  confirmed === req.id ? (
                    <div className="mt-3 flex items-center gap-1.5 text-sm font-medium" style={{ color: BRAND }}>
                      <CheckCircle2 className="w-4 h-4" /> Response recorded
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => respond(req.id, true)}
                        disabled={responding === req.id}
                        className="flex items-center gap-1.5 disabled:opacity-60 text-white rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors"
                        style={{ background: BRAND }}
                        onMouseEnter={e => responding !== req.id && (e.currentTarget.style.background = BRAND_HOVER)}
                        onMouseLeave={e => responding !== req.id && (e.currentTarget.style.background = BRAND)}
                      >
                        {responding === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓'} Accept
                      </button>
                      <button
                        onClick={() => respond(req.id, false)}
                        disabled={responding === req.id}
                        className="flex items-center gap-1.5 disabled:opacity-60 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors hover:bg-gray-50"
                        style={{ background: '#fff', color: 'rgba(14,14,13,.7)', border: '1px solid rgba(14,14,13,.15)' }}
                      >
                        <X className="w-3 h-3" /> Decline
                      </button>
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Resume tab ─────────────────────────────────────────────────────────────

function ResumeTab({ candidate }: { candidate: CandidateRow }) {
  // resume_full_url stores a Supabase Storage PATH (not a URL — the bucket
  // is private). Recruiters get signed URLs through /api/get-resume-url
  // after intro approval; that endpoint doesn't yet have a candidate-self
  // path. Until then we just surface the filename so the candidate can
  // confirm something is on file.
  const path = candidate.resume_full_url || '';
  const filename = path ? path.split('/').pop() : '';

  return (
    <Card title="Resume">
      {filename ? (
        <div className="space-y-3">
          <div
            className="flex items-start gap-3 p-4 rounded-xl border"
            style={{ borderColor: 'rgba(14,14,13,.1)', background: 'rgba(0,128,55,.04)' }}
          >
            <FileText className="w-5 h-5 shrink-0 mt-0.5" style={{ color: BRAND }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate" style={{ color: INK }} title={filename}>{filename}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(14,14,13,.55)' }}>On file with SFC Talent</p>
            </div>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(14,14,13,.55)' }}>
            To replace your resume, email{' '}
            <a href="mailto:talent@strategicfinancecareers.com" className="underline font-medium" style={{ color: BRAND }}>
              talent@strategicfinancecareers.com
            </a>
            . Self-serve replace is coming soon.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: 'rgba(14,14,13,.7)' }}>
            We don't have a resume on file for your profile yet.
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'rgba(14,14,13,.55)' }}>
            Self-serve upload is coming soon. In the meantime, email your resume to{' '}
            <a href="mailto:talent@strategicfinancecareers.com" className="underline font-medium" style={{ color: BRAND }}>
              talent@strategicfinancecareers.com
            </a>
            .
          </p>
        </div>
      )}
    </Card>
  );
}

// ─── Settings tab ───────────────────────────────────────────────────────────

function SettingsTab({
  candidate,
  onSignOut,
}: {
  candidate: CandidateRow;
  onSignOut: () => void;
}) {
  const rowStyle = { borderColor: 'rgba(14,14,13,.08)' };
  const labelStyle = { fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: 'rgba(14,14,13,.55)' };

  return (
    <div className="space-y-6">
      <Card title="Account">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4 pb-4 border-b" style={rowStyle}>
            <div className="min-w-0">
              <p style={labelStyle} className="mb-1">Email</p>
              <p className="text-sm truncate" style={{ color: INK }} title={candidate.email}>{candidate.email}</p>
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 pb-4 border-b" style={rowStyle}>
            <div className="min-w-0">
              <p style={labelStyle} className="mb-1">Password</p>
              <p className="text-sm" style={{ color: 'rgba(14,14,13,.65)' }}>
                We'll email you a secure link to set a new password.
              </p>
            </div>
            <Link
              to="/forgot-password?audience=professional"
              className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold rounded-lg px-3 py-2 border transition-colors hover:bg-gray-50"
              style={{ borderColor: 'rgba(14,14,13,.15)', color: INK }}
            >
              <KeyRound className="w-3.5 h-3.5" /> Change password
            </Link>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p style={labelStyle} className="mb-1">Session</p>
              <p className="text-sm" style={{ color: 'rgba(14,14,13,.65)' }}>
                Sign out of this device. You can sign back in any time.
              </p>
            </div>
            <button
              onClick={onSignOut}
              className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold rounded-lg px-3 py-2 border transition-colors hover:bg-gray-50"
              style={{ borderColor: 'rgba(14,14,13,.15)', color: INK }}
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
