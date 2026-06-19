import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus, LogIn, Loader2, CheckCircle2, X, ChevronLeft,
  User, Mail, FileText, Settings as SettingsIcon, Menu,
  LogOut, KeyRound, Eye, Upload,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { authedFetch } from '@/integrations/supabase/authedFetch';
import AnonymousCandidateCard from '@/components/AnonymousCandidateCard';
import ProfileForm from '@/pages/dashboard/ProfileForm';
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
  education?: string;
  highest_education_level?: string | null;
  primary_background?: string | null;
  secondary_backgrounds?: string[] | null;
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
  skills?: string[];
  resume_full_url?: string;
  work_authorized_us?: boolean;
  requires_sponsorship?: boolean;
  status?: 'pending' | 'active' | 'rejected' | 'inactive' | 'deleted';
  // Phase B: candidate's resumes from the new candidate_resumes table,
  // returned by /api/candidate-profile GET. Up to 2; one is_default.
  resumes?: ResumeRow[];
}

interface ResumeRow {
  id: string;
  label: string;
  storage_path: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
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
type TabKey = 'profile' | 'recruiter-view' | 'introductions' | 'resume' | 'settings';

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

  // Refresh the candidate row after a mutation — used by both the
  // Profile tab's ProfileForm (after a successful Save) and the
  // Resume tab (after upload/update/delete). Cheap — same bearer-gated
  // GET the dashboard mount uses; re-seeds candidate + skills so every
  // tab reflects the canonical row.
  const refreshCandidate = async () => {
    try {
      const r = await authedFetch(`/api/candidate-profile?email=${encodeURIComponent(candidate.email.toLowerCase())}`);
      if (!r.ok) return;
      const { candidate: c } = await r.json();
      setCandidate(c);
      setSkills((c.skills || []) as string[]);
    } catch (err) {
      console.warn('[Dashboard] refreshCandidate failed:', err);
    }
  };

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const TABS: { key: TabKey; label: string; icon: typeof User; badge?: number }[] = [
    { key: 'profile',        label: 'Profile',        icon: User },
    { key: 'recruiter-view', label: 'Recruiter View', icon: Eye },
    { key: 'introductions',  label: 'Introductions',  icon: Mail,        badge: pendingCount },
    { key: 'resume',         label: 'Resume',         icon: FileText },
    { key: 'settings',       label: 'Settings',       icon: SettingsIcon },
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
          {/* Real name shown here in the sidebar corner — this is the
              candidate's OWN authenticated dashboard, so showing the
              real identity is correct (the anonymized display_name
              lives in the Profile tab header and the Recruiter View
              tab). */}
          {candidate.name && (
            <p
              className="mt-2 truncate text-sm font-semibold"
              style={{ color: INK }}
              title={candidate.name}
            >
              {candidate.name}
            </p>
          )}
          <p
            className="mt-1 truncate"
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
        {/* Center cluster: brand + real name underneath. Real name in
            the corner of the mobile top bar mirrors the sidebar
            treatment on desktop. */}
        <div className="flex flex-col items-center min-w-0">
          <span className="font-bold text-base tracking-tight">SFC Talent</span>
          {candidate.name && (
            <span className="text-[11px] font-semibold truncate max-w-[180px]" style={{ color: 'rgba(14,14,13,.7)' }} title={candidate.name}>
              {candidate.name}
            </span>
          )}
        </div>
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
        {/* Recruiter View needs the full dossier width so
            AnonymousCandidateCard's lg:flex-row layout (main column +
            Candidate Snapshot rail) renders side-by-side at a
            comfortable width — matches the /apply review-step
            treatment of the same component. Other tabs keep the
            narrower reading-width container. */}
        <div className={`${tab === 'recruiter-view' ? 'max-w-5xl' : 'max-w-3xl'} mx-auto px-4 sm:px-8 py-8 space-y-6`}>
          <StatusBanner status={candidate.status} />

          {tab === 'profile' && (
            <ProfileForm candidate={candidate} skills={skills} onSaved={refreshCandidate} />
          )}
          {tab === 'recruiter-view' && (
            <RecruiterViewTab candidate={candidate} skills={skills} />
          )}
          {tab === 'introductions' && (
            canHaveIntros ? (
              <IntroductionsTab
                candidateId={candidate.id}
                intros={intros}
                setIntros={setIntros}
                resumes={candidate.resumes || []}
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
            <ResumeTab candidate={candidate} onRefresh={refreshCandidate} />
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

// ─── Introductions tab ──────────────────────────────────────────────────────

function IntroductionsTab({
  candidateId,
  intros,
  setIntros,
  resumes,
}: {
  candidateId: string;
  intros: IntroRequest[] | null;
  setIntros: React.Dispatch<React.SetStateAction<IntroRequest[] | null>>;
  resumes: ResumeRow[];
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _cid = candidateId;
  const [responding, setResponding] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  // Phase B: when the candidate accepts an intro AND has more than one
  // resume, we show a chooser before finalizing. pickerFor holds the
  // introId of the request awaiting a pick; null means no chooser
  // open. Single-resume / no-resume candidates skip the chooser and
  // the accept finalizes one-click (matching the email-link flow).
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const finalize = async (introId: string, accept: boolean, resumeId?: string | null) => {
    setResponding(introId);
    const params = new URLSearchParams({
      introId,
      response: accept ? 'yes' : 'no',
    });
    if (accept && resumeId) params.set('resumeId', resumeId);
    await fetch(`/api/respond-to-intro?${params.toString()}`).catch(() => {});
    setIntros(prev => prev?.map(i => i.id === introId ? { ...i, status: accept ? 'approved' : 'rejected' } : i) ?? null);
    setConfirmed(introId);
    setResponding(null);
    setPickerFor(null);
    setTimeout(() => setConfirmed(null), 4000);
  };

  const respond = (introId: string, accept: boolean) => {
    if (!accept) return finalize(introId, false);
    // Accept path: route through the resume picker when the candidate
    // has > 1 resume; auto-pick the only / default resume otherwise.
    if (resumes.length > 1) {
      setPickerFor(introId);
      return Promise.resolve();
    }
    const auto = resumes.length === 1
      ? resumes[0].id
      : (resumes.find(r => r.is_default)?.id ?? null);
    return finalize(introId, true, auto);
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

      {/* Phase B resume picker. Renders inside the same card when an
          accept is pending and the candidate has > 1 resume. Picking
          a row calls finalize(introId, true, resumeId); cancelling
          leaves the intro in 'pending' so the candidate can choose
          again later. */}
      {pickerFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(14,14,13,.45)' }}
          onClick={() => setPickerFor(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full"
            onClick={e => e.stopPropagation()}
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}
          >
            <h3 className="text-lg font-semibold mb-1" style={{ color: INK }}>Choose a resume to send</h3>
            <p className="text-xs mb-4" style={{ color: 'rgba(14,14,13,.6)' }}>
              The recruiter will receive the resume you pick. You can change your default any time from the Resume tab.
            </p>
            <div className="space-y-2">
              {resumes.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => finalize(pickerFor, true, r.id)}
                  disabled={responding === pickerFor}
                  className="w-full text-left p-3 rounded-xl border transition-colors disabled:opacity-60"
                  style={{ borderColor: 'rgba(14,14,13,.12)', background: 'white' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = BRAND)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(14,14,13,.12)')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: INK }}>{r.label}</p>
                      {r.is_default && (
                        <p className="text-[10px] font-bold mt-0.5" style={{ color: BRAND, letterSpacing: '0.08em' }}>DEFAULT</p>
                      )}
                    </div>
                    <span className="text-xs shrink-0" style={{ color: 'rgba(14,14,13,.5)' }}>Use this →</span>
                  </div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPickerFor(null)}
              className="mt-4 text-xs font-medium hover:underline"
              style={{ color: 'rgba(14,14,13,.55)' }}
            >
              Cancel — don't send anything yet
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Resume tab ─────────────────────────────────────────────────────────────

// File→base64 utility used by upload + replace. Strips the data URL
// prefix so the API gets pure base64 (matches submit-candidate.ts).
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const MAX_RESUME_MB = 5;

function ResumeTab({ candidate, onRefresh }: { candidate: CandidateRow; onRefresh: () => Promise<void> }) {
  const resumes = candidate.resumes || [];
  const atCap = resumes.length >= 2;

  // Per-row + global busy state. We deliberately gate at the action
  // level (one mutation at a time per row) rather than disabling the
  // whole tab — keeps the UI responsive when, e.g., View is fast.
  const [busy, setBusy] = useState<string>(''); // composite key like "delete:<id>" / "upload"
  const [error, setError] = useState<string>('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<ResumeRow | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<ResumeRow | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replaceReparse, setReplaceReparse] = useState(false);
  const [reparseSuggestions, setReparseSuggestions] = useState<any | null>(null);

  const fileInputUploadRef = useRef<HTMLInputElement>(null);
  const fileInputReplaceRef = useRef<HTMLInputElement>(null);

  const setBusyAction = (key: string) => { setBusy(key); setError(''); };
  const clearBusy = () => setBusy('');

  // ── View: fetch a signed URL from /api/get-candidate-resume-url ──
  const handleView = async (r: ResumeRow) => {
    setBusyAction(`view:${r.id}`);
    try {
      const res = await authedFetch(`/api/get-candidate-resume-url?id=${encodeURIComponent(r.id)}`);
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        setError(detail?.error || 'Could not generate a download link. Please try again.');
        return;
      }
      const { url } = await res.json();
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      clearBusy();
    }
  };

  // ── Set as default ──────────────────────────────────────────────
  const handleSetDefault = async (r: ResumeRow) => {
    if (r.is_default) return;
    setBusyAction(`default:${r.id}`);
    try {
      const res = await authedFetch('/api/update-candidate-resume', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, isDefault: true }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        setError(detail?.error || 'Could not set as default. Please try again.');
        return;
      }
      await onRefresh();
    } finally {
      clearBusy();
    }
  };

  // ── Rename label inline ─────────────────────────────────────────
  const startRename = (r: ResumeRow) => { setRenamingId(r.id); setRenameValue(r.label); setError(''); };
  const cancelRename = () => { setRenamingId(null); setRenameValue(''); };
  const handleRename = async (r: ResumeRow) => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === r.label) { cancelRename(); return; }
    setBusyAction(`rename:${r.id}`);
    try {
      const res = await authedFetch('/api/update-candidate-resume', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, label: trimmed }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        setError(detail?.error || 'Could not rename. Please try a different label.');
        return;
      }
      cancelRename();
      await onRefresh();
    } finally {
      clearBusy();
    }
  };

  // ── Delete (with last-resume warning surfaced by the endpoint) ──
  const handleDelete = async (r: ResumeRow) => {
    setBusyAction(`delete:${r.id}`);
    try {
      const res = await authedFetch('/api/delete-candidate-resume', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        setError(detail?.error || 'Could not delete. Please try again.');
        return;
      }
      setConfirmDelete(null);
      await onRefresh();
    } finally {
      clearBusy();
    }
  };

  // ── Upload another (POST /api/upload-candidate-resume) ──────────
  const handleUpload = async () => {
    if (!uploadFile || !uploadLabel.trim()) {
      setError('Pick a PDF and give it a label.');
      return;
    }
    if (uploadFile.size > MAX_RESUME_MB * 1024 * 1024) {
      setError(`Resume too large (${(uploadFile.size / 1024 / 1024).toFixed(1)} MB; max ${MAX_RESUME_MB} MB).`);
      return;
    }
    setBusyAction('upload');
    try {
      const resumeBase64 = await readFileAsBase64(uploadFile);
      const res = await authedFetch('/api/upload-candidate-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateId: candidate.id,
          resumeBase64,
          fileName: uploadFile.name,
          label: uploadLabel.trim(),
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        setError(detail?.error || 'Upload failed. Please try again.');
        return;
      }
      setShowUpload(false);
      setUploadFile(null);
      setUploadLabel('');
      if (fileInputUploadRef.current) fileInputUploadRef.current.value = '';
      await onRefresh();
    } finally {
      clearBusy();
    }
  };

  // ── Replace file (PATCH /api/update-candidate-resume) ───────────
  const openReplace = (r: ResumeRow) => {
    setReplaceTarget(r);
    setReplaceFile(null);
    setReplaceReparse(false);
    setReparseSuggestions(null);
    setError('');
  };
  const closeReplace = () => {
    setReplaceTarget(null);
    setReplaceFile(null);
    setReplaceReparse(false);
    setReparseSuggestions(null);
    if (fileInputReplaceRef.current) fileInputReplaceRef.current.value = '';
  };
  const handleReplace = async () => {
    if (!replaceTarget || !replaceFile) {
      setError('Pick a replacement PDF.');
      return;
    }
    if (replaceFile.size > MAX_RESUME_MB * 1024 * 1024) {
      setError(`Resume too large (${(replaceFile.size / 1024 / 1024).toFixed(1)} MB; max ${MAX_RESUME_MB} MB).`);
      return;
    }
    setBusyAction(`replace:${replaceTarget.id}`);
    try {
      const replaceBase64 = await readFileAsBase64(replaceFile);
      const res = await authedFetch('/api/update-candidate-resume', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: replaceTarget.id,
          replaceBase64,
          replaceFileName: replaceFile.name,
          // reparse only makes sense for the default; the endpoint also
          // enforces this server-side and silently ignores reparse on
          // non-default rows.
          ...(replaceTarget.is_default && replaceReparse ? { reparse: true } : {}),
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        setError(detail?.error || 'Replace failed. Please try again.');
        return;
      }
      const body = await res.json().catch(() => ({}));
      // If reparse was requested AND the endpoint ran the parser, show
      // the suggestions to the candidate. The endpoint NEVER auto-
      // applies; this is purely a surface for "want to update your
      // profile fields from this new resume?" The actual profile
      // edits happen back through the wizard so they can be reviewed
      // — we just deep-link there pre-filled with the parsed values.
      if (body?.parsed && !body.parsed.parseError) {
        setReparseSuggestions(body.parsed);
        await onRefresh();
        return; // leave the dialog open showing suggestions
      }
      closeReplace();
      await onRefresh();
    } finally {
      clearBusy();
    }
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <Card
      title="Resumes"
      action={
        !atCap ? (
          <button
            type="button"
            onClick={() => { setShowUpload(true); setError(''); }}
            className="text-sm font-semibold transition-colors"
            style={{ color: BRAND }}
            onMouseEnter={e => (e.currentTarget.style.color = BRAND_HOVER)}
            onMouseLeave={e => (e.currentTarget.style.color = BRAND)}
          >
            Upload another
          </button>
        ) : (
          <span className="text-xs" style={{ color: 'rgba(14,14,13,.5)' }}>2 of 2 — delete one to add another</span>
        )
      }
    >
      {error && (
        <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(220,38,38,.06)', color: '#991b1b' }}>
          {error}
        </p>
      )}

      {resumes.length === 0 && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: 'rgba(14,14,13,.7)' }}>
            You don't have a resume on file yet. Recruiters can request introductions but will see "no resume available" until you upload one.
          </p>
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            style={{ background: BRAND }}
            onMouseEnter={e => (e.currentTarget.style.background = BRAND_HOVER)}
            onMouseLeave={e => (e.currentTarget.style.background = BRAND)}
          >
            <Upload className="w-3.5 h-3.5" /> Upload your first resume
          </button>
        </div>
      )}

      <div className="space-y-3">
        {resumes.map(r => {
          const filename = (r.storage_path || '').split('/').pop() || '';
          return (
            <div
              key={r.id}
              className="border rounded-xl p-4 space-y-3"
              style={{ borderColor: 'rgba(14,14,13,.1)', background: r.is_default ? 'rgba(0,128,55,.04)' : 'white' }}
            >
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 shrink-0 mt-0.5" style={{ color: r.is_default ? BRAND : 'rgba(14,14,13,.5)' }} />
                <div className="min-w-0 flex-1">
                  {renamingId === r.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        maxLength={40}
                        autoFocus
                        className="text-sm font-semibold flex-1 px-2 py-1 border rounded"
                        style={{ borderColor: 'rgba(14,14,13,.2)' }}
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(r); if (e.key === 'Escape') cancelRename(); }}
                      />
                      <button onClick={() => handleRename(r)} disabled={busy === `rename:${r.id}`} className="text-xs font-semibold" style={{ color: BRAND }}>Save</button>
                      <button onClick={cancelRename} className="text-xs" style={{ color: 'rgba(14,14,13,.5)' }}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate" style={{ color: INK }}>{r.label}</p>
                      {r.is_default && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,128,55,.12)', color: BRAND, letterSpacing: '0.06em' }}>DEFAULT</span>
                      )}
                      <button type="button" onClick={() => startRename(r)} className="text-xs hover:underline" style={{ color: 'rgba(14,14,13,.5)' }}>Rename</button>
                    </div>
                  )}
                  {filename && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(14,14,13,.5)' }} title={filename}>{filename}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleView(r)}
                  disabled={busy === `view:${r.id}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50 disabled:opacity-60"
                  style={{ borderColor: 'rgba(14,14,13,.15)', color: INK }}
                >
                  {busy === `view:${r.id}` ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
                  View
                </button>
                <button
                  type="button"
                  onClick={() => openReplace(r)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50"
                  style={{ borderColor: 'rgba(14,14,13,.15)', color: INK }}
                >
                  Replace
                </button>
                {!r.is_default && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(r)}
                    disabled={busy === `default:${r.id}`}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-60"
                    style={{ borderColor: 'rgba(0,128,55,.3)', color: BRAND }}
                  >
                    {busy === `default:${r.id}` ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
                    Set as default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setConfirmDelete(r); setError(''); }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ml-auto hover:bg-red-50"
                  style={{ borderColor: 'rgba(220,38,38,.25)', color: '#b91c1c' }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Upload dialog ───────────────────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(14,14,13,.45)' }} onClick={() => setShowUpload(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()} style={{ boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <h3 className="text-lg font-semibold mb-1" style={{ color: INK }}>Upload another resume</h3>
            <p className="text-xs mb-4" style={{ color: 'rgba(14,14,13,.6)' }}>Add a second resume. You'll pick which one to send when you accept each introduction.</p>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'rgba(14,14,13,.7)' }}>Label</label>
            <input
              type="text"
              value={uploadLabel}
              onChange={e => setUploadLabel(e.target.value)}
              placeholder="e.g. Strategy resume"
              maxLength={40}
              className="w-full px-3 py-2 border rounded-lg text-sm mb-3"
              style={{ borderColor: 'rgba(14,14,13,.2)' }}
            />
            <input
              ref={fileInputUploadRef}
              type="file"
              accept=".pdf"
              onChange={e => setUploadFile(e.target.files?.[0] || null)}
              className="text-xs mb-4"
            />
            <p className="text-xs mb-4" style={{ color: 'rgba(14,14,13,.5)' }}>PDF only. Up to {MAX_RESUME_MB} MB.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowUpload(false)} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ color: 'rgba(14,14,13,.6)' }}>Cancel</button>
              <button
                onClick={handleUpload}
                disabled={busy === 'upload' || !uploadFile || !uploadLabel.trim()}
                className="text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60"
                style={{ background: BRAND }}
              >
                {busy === 'upload' ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : null}
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Replace dialog ──────────────────────────────────────── */}
      {replaceTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(14,14,13,.45)' }} onClick={closeReplace}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()} style={{ boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <h3 className="text-lg font-semibold mb-1" style={{ color: INK }}>Replace "{replaceTarget.label}"</h3>
            <p className="text-xs mb-4" style={{ color: 'rgba(14,14,13,.6)' }}>The old file will be removed once the new one uploads successfully.</p>
            {!reparseSuggestions && (
              <>
                <input
                  ref={fileInputReplaceRef}
                  type="file"
                  accept=".pdf"
                  onChange={e => setReplaceFile(e.target.files?.[0] || null)}
                  className="text-xs mb-3"
                />
                {replaceTarget.is_default && (
                  <label className="flex items-start gap-2 mb-4 text-xs cursor-pointer" style={{ color: 'rgba(14,14,13,.75)' }}>
                    <input
                      type="checkbox"
                      checked={replaceReparse}
                      onChange={e => setReplaceReparse(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Also re-parse my profile from this resume?
                      <span className="block mt-0.5" style={{ color: 'rgba(14,14,13,.5)' }}>
                        We'll suggest updates to your role, education, skills and bio. Nothing is changed until you confirm.
                      </span>
                    </span>
                  </label>
                )}
                <div className="flex gap-2 justify-end">
                  <button onClick={closeReplace} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ color: 'rgba(14,14,13,.6)' }}>Cancel</button>
                  <button
                    onClick={handleReplace}
                    disabled={busy.startsWith('replace:') || !replaceFile}
                    className="text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60"
                    style={{ background: BRAND }}
                  >
                    {busy.startsWith('replace:') ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : null}
                    Replace file
                  </button>
                </div>
              </>
            )}
            {reparseSuggestions && (
              <div className="space-y-3">
                <p className="text-xs" style={{ color: 'rgba(14,14,13,.7)' }}>
                  Your resume was replaced. Suggested profile updates from the new file:
                </p>
                <div className="text-xs space-y-1.5 p-3 rounded-lg" style={{ background: 'rgba(0,128,55,.04)', border: '1px solid rgba(0,128,55,.2)' }}>
                  {reparseSuggestions.currentRole && <p><strong>Current role:</strong> {reparseSuggestions.currentRole}</p>}
                  {reparseSuggestions.location && <p><strong>Location:</strong> {reparseSuggestions.location}</p>}
                  {reparseSuggestions.education && <p><strong>Education:</strong> {reparseSuggestions.education}</p>}
                  {Array.isArray(reparseSuggestions.skills) && reparseSuggestions.skills.length > 0 && (
                    <p><strong>Skills:</strong> {reparseSuggestions.skills.join(', ')}</p>
                  )}
                  {reparseSuggestions.bio && <p className="mt-2 italic">"{reparseSuggestions.bio}"</p>}
                </div>
                <p className="text-xs" style={{ color: 'rgba(14,14,13,.55)' }}>
                  Nothing was changed automatically. To apply these, edit your profile and review each field.
                </p>
                <div className="flex gap-2 justify-end">
                  <button onClick={closeReplace} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ color: 'rgba(14,14,13,.6)' }}>Close</button>
                  <Link
                    to="/apply?edit=1&tab=review"
                    onClick={closeReplace}
                    className="text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors inline-block"
                    style={{ background: BRAND }}
                  >
                    Edit profile to apply
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Delete-confirm dialog ───────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(14,14,13,.45)' }} onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()} style={{ boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <h3 className="text-lg font-semibold mb-1" style={{ color: INK }}>Delete "{confirmDelete.label}"?</h3>
            <p className="text-xs mb-4" style={{ color: 'rgba(14,14,13,.65)' }}>
              {resumes.length === 1
                ? 'This is your last resume. Recruiters will see "no resume available" on any new introduction you accept until you upload another.'
                : confirmDelete.is_default
                  ? "This is currently your default. We'll promote your other resume to default and recruiters will receive it on new introductions."
                  : 'This file will be removed permanently.'}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ color: 'rgba(14,14,13,.6)' }}>Cancel</button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={busy === `delete:${confirmDelete.id}`}
                className="text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60"
                style={{ background: '#b91c1c' }}
              >
                {busy === `delete:${confirmDelete.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : null}
                Delete
              </button>
            </div>
          </div>
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

// ─── Recruiter View tab ─────────────────────────────────────────────────────
// Renders the candidate's anonymized profile EXACTLY as recruiters see
// it on /browse, by reusing the same AnonymousCandidateCard component
// in mode='preview'. The intake wizard's review step uses the same
// component the same way — so what the candidate sees here, the
// recruiter sees there, by construction. No lookalike, no drift.
//
// preview mode is the right choice (vs recruiter mode) because:
//   - It suppresses the "Why This Candidate Stands Out" AI insight
//     section entirely (no fetch, no skeleton).
//   - It never shows the SFC Take (admin-curated content the candidate
//     shouldn't see anyway).
//   - It hides the Request Introduction CTA, which would be nonsensical
//     for the candidate themselves.
//
// Data shape: feed from current candidate state. The fields the card
// needs to render a faithful preview (education,
// highest_education_level, primary_background, secondary_backgrounds)
// are returned by the candidate-profile GET. Sensitive fields the
// preview never needs (phone, work_authorized_us, requires_sponsorship)
// stay deliberately OUT of the GET.

function RecruiterViewTab({
  candidate,
  skills,
}: {
  candidate: CandidateRow;
  skills: string[];
}) {
  // No separate intro line above the card — AnonymousCandidateCard
  // already renders its own "This is what recruiters will see — your
  // real name and contact details stay hidden until you accept an
  // introduction." banner at the top in preview mode. Keeping both
  // looked duplicated, so this tab now defers entirely to the card's
  // built-in banner.
  return (
    <div
      className="border rounded-2xl overflow-hidden bg-white"
      style={{ borderColor: 'rgba(14,14,13,.08)' }}
    >
      <AnonymousCandidateCard
        mode="preview"
        candidate={{
          id: candidate.id,
          label: candidate.label || 'Finance Professional',
          display_name: candidate.display_name || candidate.label || 'Finance Professional',
          location: candidate.location || 'United States',
          experience: typeof candidate.experience === 'number' ? candidate.experience : 0,
          // Now sourced from the candidate-profile GET (added back to
          // the SELECT in this same change). These columns are already
          // surfaced in the recruiter-facing anonymized card so
          // returning them to the candidate about themselves is the
          // same exposure surface — no new PII channel.
          education: candidate.education || 'Not specified',
          highest_education_level: candidate.highest_education_level || null,
          profile_description: candidate.profile_description || null,
          primary_background: candidate.primary_background || null,
          secondary_backgrounds: candidate.secondary_backgrounds || null,
          open_to_opportunities: candidate.open_to_opportunities ?? null,
          // Phase 1.6: pass industries through so the candidate's own
          // Recruiter View tab mirrors what recruiters see on /browse.
          // The candidate-profile GET already returns this column
          // (CandidateRow.industries), it just wasn't being threaded
          // into the card prop object before.
          industries: candidate.industries || null,
          // Stages the candidate has WORKED at — added with the
          // company_stage_experience build. Mirrors the recruiter
          // browse card so the candidate sees the same row on their
          // self-preview tab. Cast through any because CandidateRow
          // hasn't been re-typed for this column yet (the
          // candidate-profile GET returns it; useCandidates also
          // selects it for the recruiter side).
          company_stage_experience: (candidate as any).company_stage_experience || null,
          // The card expects { id, skill } objects; the dashboard
          // keeps skills as flat strings. Index works fine as a key.
          skills: skills.map((s, i) => ({ id: i, skill: s })),
        }}
      />
    </div>
  );
}
