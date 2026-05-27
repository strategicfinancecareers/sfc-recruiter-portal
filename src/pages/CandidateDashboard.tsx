import { useState, useEffect } from 'react';
import { UserPlus, LogIn, Loader2, CheckCircle2, X, ChevronLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CandidateRow {
  id: string;
  name: string;
  display_name?: string;
  email: string;
  label?: string;
  location?: string;
  experience?: number;
  profile_description?: string;
  open_to_opportunities?: boolean;
  work_preference?: string;
  target_salary?: string;
  linkedin_url?: string;
  preferred_cities?: string[];
  target_roles?: string[];
  skills?: string[];
  status?: 'pending' | 'active' | 'rejected' | 'inactive' | 'deleted';
}

interface IntroRequest {
  id: string;
  created_at: string;
  status: string;
  jobs?: { title: string | null; company: string | null; salary_range: string | null } | null;
}

type DashView = 'landing' | 'signin' | 'dashboard';

// ─── Main export ──────────────────────────────────────────────────────────────

export default function CandidateDashboard() {
  const [view, setView] = useState<DashView>('landing');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [signinLoading, setSigninLoading] = useState(false);
  const [signinError, setSigninError] = useState('');
  const [candidate, setCandidate] = useState<CandidateRow | null>(null);
  const [skills, setSkills] = useState<string[]>([]);

  // ── Session check on mount ───────────────────────────────────────────────────
  // Always derive the email from a freshly-refreshed session (validated
  // against the auth server), never from the cached localStorage session.
  // This prevents the "stale user A session wins after user B verifies"
  // bug — refreshSession reconciles whatever the auth server actually
  // considers the current session.
  useEffect(() => {
    (async () => {
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr) {
        console.warn('[CandidateDashboard] refreshSession error:', refreshErr.message);
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) return;
      const email = session.user.email;
      setEmailInput(email);
      setSigninLoading(true);
      try {
        const res = await fetch(`/api/candidate-profile?email=${encodeURIComponent(email.toLowerCase())}`);
        if (res.ok) {
          const { candidate: c } = await res.json();
          const extracted: string[] = (c.skills || []) as string[];
          setCandidate(c as CandidateRow);
          setSkills(extracted);
          setView('dashboard');
        } else if (res.status === 404) {
          // Authenticated but no profile yet — send to intake form
          window.location.href = '/apply';
        }
        // On 500 or other errors, stay on landing (don't show confusing errors on mount)
      } finally {
        setSigninLoading(false);
      }
    })().catch(err => console.error('[CandidateDashboard] session check error:', err));
  }, []);

  // ── Sign-in handler ──────────────────────────────────────────────────────────
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
      const res = await fetch(`/api/candidate-profile?email=${encodeURIComponent(emailInput.toLowerCase().trim())}`);
      if (res.status === 404) {
        // Account exists but no profile yet — send them to complete the intake form
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

  const handleSignOut = () => {
    supabase.auth.signOut();
    setCandidate(null);
    setSkills([]);
    setEmailInput('');
    setPasswordInput('');
    setSigninError('');
    setView('landing');
  };

  // ── LANDING ──────────────────────────────────────────────────────────────────
  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 py-16">
        <p className="font-semibold text-base text-gray-900 tracking-tight mb-10">SFC Talent</p>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xl">

          {/* Join card */}
          <div className="flex-1 bg-white border border-gray-200 rounded-2xl p-8 flex flex-col shadow-sm">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <UserPlus className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">New here?</p>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Create your anonymous finance profile</h2>
            <div className="flex-1" />
            <button
              onClick={() => { window.location.href = '/apply'; }}
              className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
            >
              Join the Network
            </button>
          </div>

          {/* Return card */}
          <div className="flex-1 bg-white border border-gray-200 rounded-2xl p-8 flex flex-col shadow-sm">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <LogIn className="w-5 h-5 text-gray-600" />
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Already applied?</p>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Access your profile dashboard</h2>
            <div className="flex-1" />
            <button
              onClick={() => setView('signin')}
              className="w-full mt-6 bg-gray-900 hover:bg-gray-800 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
            >
              Sign In
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ── SIGN IN ──────────────────────────────────────────────────────────────────
  if (view === 'signin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-10 w-full max-w-sm shadow-sm">
          <button
            onClick={() => { setSigninError(''); setView('landing'); }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-7 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <p className="font-semibold text-sm text-gray-900 mb-5">SFC Talent</p>
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Sign in</h1>
          <p className="text-sm text-gray-500 mb-7">Access your candidate dashboard</p>
          <form onSubmit={handleSignIn} className="space-y-3">
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <input
              type="password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {signinError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 leading-relaxed">
                {signinError}
              </p>
            )}
            <button
              type="submit"
              disabled={signinLoading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
            >
              {signinLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── DASHBOARD ─────────────────────────────────────────────────────────────────
  return <Dashboard candidate={candidate!} skills={skills} onSignOut={handleSignOut} onUpdate={setCandidate} />;
}

// ─── Constants ────────────────────────────────────────────────────────────────

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
  { value: 'under-70k',   label: 'Under $70,000' },
  { value: '70k-100k',   label: '$70,000 – $100,000' },
  { value: '100k-150k',  label: '$100,000 – $150,000' },
  { value: '150k-200k',  label: '$150,000 – $200,000' },
  { value: '200k-300k',  label: '$200,000 – $300,000' },
  { value: '300k-plus',  label: '$300,000+' },
];

// ─── Status banner ────────────────────────────────────────────────────────────
// Shown at the top of the candidate dashboard. Frames the rest of the page
// based on where the candidate is in the approval lifecycle.

function StatusBanner({ status }: { status?: string }) {
  if (status === 'active') return null;

  if (status === 'pending') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
        <p className="text-sm font-semibold text-amber-900">⏳ Your profile is under review</p>
        <p className="text-sm text-amber-800 mt-1 leading-relaxed">
          Our team manually vets every candidate. We'll email you the moment your profile is approved (usually within 1–2 business days). You can still review and edit your details below.
        </p>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
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
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
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
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
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

// ─── Dashboard component ──────────────────────────────────────────────────────

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

  const [showEdit, setShowEdit] = useState(false);
  // Edit form state — pre-filled from candidate
  const [editBio, setEditBio] = useState(candidate.profile_description || '');
  const [editWorkPref, setEditWorkPref] = useState(candidate.work_preference || '');
  const [editTargetComp, setEditTargetComp] = useState(candidate.target_salary || '');
  const [editAvail, setEditAvail] = useState<'active' | 'inactive'>(candidate.open_to_opportunities ? 'active' : 'inactive');
  const [editCities, setEditCities] = useState<string[]>(candidate.preferred_cities ?? []);
  const [editRoles, setEditRoles] = useState<string[]>(candidate.target_roles ?? []);
  const [editLinkedin, setEditLinkedin] = useState(candidate.linkedin_url || '');
  const [editSkills, setEditSkills] = useState<string[]>(initialSkills);
  const [skillInput, setSkillInput] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const [editError, setEditError] = useState('');

  const [intros, setIntros] = useState<IntroRequest[] | null>(null);
  const [responding, setResponding] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  // Fetch intros on mount
  useEffect(() => {
    console.log('Fetching intros for candidate:', candidate.id);
    fetch(`/api/candidate-intros?candidateId=${encodeURIComponent(candidate.id)}`)
      .then(r => r.json())
      .then(data => setIntros(data.requests || []))
      .catch(() => setIntros([]));
  }, [candidate.id]);

  // Reset edit form when toggling open
  const openEdit = () => {
    setEditBio(candidate.profile_description || '');
    setEditWorkPref(candidate.work_preference || '');
    setEditTargetComp(candidate.target_salary || '');
    setEditAvail(candidate.open_to_opportunities ? 'active' : 'inactive');
    setEditCities(candidate.preferred_cities ?? []);
    setEditRoles(candidate.target_roles ?? []);
    setEditLinkedin(candidate.linkedin_url || '');
    setEditError('');
    setShowEdit(true);
  };

  // Chip toggle helpers
  const toggleCity = (c: string) =>
    setEditCities(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleRole = (r: string) =>
    setEditRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);

  // Skill tag helpers
  const addSkill = () => {
    const t = skillInput.trim();
    if (t && !editSkills.includes(t)) setEditSkills(prev => [...prev, t]);
    setSkillInput('');
  };
  const removeSkill = (s: string) => setEditSkills(prev => prev.filter(x => x !== s));

  // Save all edits
  const saveEdit = async () => {
    setEditSaving(true);
    setEditError('');
    try {
      const res = await fetch('/api/candidate-profile', {
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
        const data = await res.json().catch(() => ({}));
        setEditError(data.error || 'Save failed. Please try again.');
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
      setCandidate(updated);
      onUpdate(updated);
      setEditSaved(true);
      setTimeout(() => { setEditSaved(false); setShowEdit(false); }, 1500);
    } finally {
      setEditSaving(false);
    }
  };

  // Respond to intro
  const respond = async (introId: string, accept: boolean) => {
    setResponding(introId);
    await fetch(`/api/respond-to-intro?introId=${introId}&response=${accept ? 'yes' : 'no'}`).catch(() => {});
    setIntros(prev => prev?.map(i => i.id === introId ? { ...i, status: accept ? 'approved' : 'rejected' } : i) ?? null);
    setConfirmed(introId);
    setResponding(null);
    setTimeout(() => setConfirmed(null), 4000);
  };

  const bio = candidate.profile_description || '';
  const displaySkills = showEdit ? editSkills : initialSkills;
  const pendingCount = intros?.filter(i => i.status === 'pending').length ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-gray-900 text-sm">SFC Talent</span>
        <span className="text-sm text-gray-600 font-medium">{candidate.display_name || candidate.label || candidate.name}</span>
        <button onClick={onSignOut} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
          Sign Out
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        <StatusBanner status={candidate.status} />

        {/* ── Section 1: Profile (read-only + edit toggle) ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Your Profile</h2>
            {!showEdit ? (
              <button
                onClick={openEdit}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
              >
                Edit Profile
              </button>
            ) : (
              <button
                onClick={() => { setShowEdit(false); setEditError(''); }}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {/* ── Read-only view ── */}
          {!showEdit && (
            <div className="space-y-3">
              <div>
                <p className="text-base font-semibold text-gray-900">{candidate.label || 'Finance Professional'}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  {candidate.location && <span className="text-sm text-gray-500">{candidate.location}</span>}
                  {candidate.experience != null && <span className="text-sm text-gray-500">{candidate.experience} yrs exp</span>}
                  {candidate.work_preference && <span className="text-sm text-gray-500">{candidate.work_preference}</span>}
                  {candidate.open_to_opportunities != null && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${candidate.open_to_opportunities ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {candidate.open_to_opportunities ? '🟢 Actively Looking' : '⏸ Not Active'}
                    </span>
                  )}
                </div>
              </div>
              {bio && <p className="text-sm text-gray-600 leading-relaxed">{bio}</p>}
              {displaySkills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {displaySkills.map(s => (
                    <span key={s} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-medium">{s}</span>
                  ))}
                </div>
              )}
              {candidate.target_salary && (
                <p className="text-xs text-gray-400">Target comp: {COMP_OPTIONS.find(o => o.value === candidate.target_salary)?.label ?? candidate.target_salary}</p>
              )}
              {candidate.preferred_cities && candidate.preferred_cities.length > 0 && (
                <p className="text-xs text-gray-400">Cities: {candidate.preferred_cities.join(', ')}</p>
              )}
              {candidate.target_roles && candidate.target_roles.length > 0 && (
                <p className="text-xs text-gray-400">Target roles: {candidate.target_roles.join(', ')}</p>
              )}
              {candidate.linkedin_url && (
                <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline">
                  LinkedIn →
                </a>
              )}
            </div>
          )}

          {/* ── Full edit form ── */}
          {showEdit && (
            <div className="space-y-5">

              {/* 1. Bio */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Professional Bio</label>
                <textarea
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed"
                  placeholder="Describe your background and what you're looking for…"
                />
              </div>

              {/* 2. Work Preference */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Work Preference</label>
                <select
                  value={editWorkPref}
                  onChange={e => setEditWorkPref(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select…</option>
                  {['Remote', 'Hybrid', 'In-Office'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              {/* 3. Target Comp */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Target Total Compensation</label>
                <select
                  value={editTargetComp}
                  onChange={e => setEditTargetComp(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select…</option>
                  {COMP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* 4. Availability */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Availability</label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { val: 'active',   emoji: '🟢', label: 'Actively Looking',  desc: "Open to new opportunities" },
                    { val: 'inactive', emoji: '⏸️', label: 'Not Active',        desc: "Not looking right now" },
                  ] as const).map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setEditAvail(opt.val)}
                      className={`p-3 border-2 rounded-xl text-left transition-all ${
                        editAvail === opt.val
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="text-lg mb-1">{opt.emoji}</div>
                      <p className={`text-xs font-semibold leading-tight ${editAvail === opt.val ? 'text-emerald-800' : 'text-gray-700'}`}>{opt.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Preferred Cities */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Preferred Cities</label>
                <div className="flex flex-wrap gap-2">
                  {CITY_OPTIONS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCity(c)}
                      className={`px-3 py-1.5 rounded-full text-xs border font-medium transition-all ${
                        editCities.includes(c)
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. Target Roles */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Target Roles</label>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRole(r)}
                      className={`px-3 py-1.5 rounded-full text-xs border font-medium transition-all ${
                        editRoles.includes(r)
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* 7. LinkedIn URL */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">LinkedIn URL</label>
                <input
                  type="url"
                  value={editLinkedin}
                  onChange={e => setEditLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/yourname"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* 8. Skills */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Skills</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                    placeholder="e.g. Financial Modeling, SQL…"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={addSkill}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 font-medium"
                  >
                    Add
                  </button>
                </div>
                {editSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {editSkills.map(s => (
                      <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-medium">
                        {s}
                        <button type="button" onClick={() => removeSkill(s)} className="hover:text-red-500 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Save / error */}
              {editError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">{editError}</p>
              )}
              <div className="flex items-center gap-3 pt-1">
                {editSaved && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                    <CheckCircle2 className="w-4 h-4" /> Saved
                  </span>
                )}
                <button
                  onClick={saveEdit}
                  disabled={editSaving}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg px-5 py-2 text-sm font-semibold transition-colors"
                >
                  {editSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Section 2: Introduction Requests (only for active candidates — pending/rejected/inactive can't have intros) ── */}
        {candidate.status === 'active' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Introduction Requests</h2>
            {pendingCount > 0 && (
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount} pending</span>
            )}
          </div>

          {intros === null && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          )}

          {intros !== null && intros.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No requests yet</p>
          )}

          {intros !== null && intros.length > 0 && (
            <div className="space-y-3">
              {intros.map(req => {
                const job = req.jobs;
                const statusStyles: Record<string, string> = {
                  pending:  'bg-amber-50 text-amber-700 border border-amber-100',
                  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
                  rejected: 'bg-gray-100 text-gray-500',
                };
                const statusLabels: Record<string, string> = {
                  pending: 'Awaiting your response',
                  approved: 'Introduction made',
                  rejected: 'Passed',
                };
                const sc = statusStyles[req.status] ?? statusStyles.pending;
                const sl = statusLabels[req.status] ?? 'Pending';

                return (
                  <div key={req.id} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {job?.title || 'Finance Role'}{job?.company ? ` — ${job.company}` : ''}
                        </p>
                        {job?.salary_range && (
                          <p className="text-xs text-emerald-600 font-medium mt-0.5">{job.salary_range}</p>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                        {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>

                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${sc}`}>
                      {sl}
                    </span>

                    {req.status === 'pending' && (
                      confirmed === req.id ? (
                        <div className="mt-3 flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                          <CheckCircle2 className="w-4 h-4" /> Response recorded
                        </div>
                      ) : (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => respond(req.id, true)}
                            disabled={responding === req.id}
                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors"
                          >
                            {responding === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓'} Accept
                          </button>
                          <button
                            onClick={() => respond(req.id, false)}
                            disabled={responding === req.id}
                            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-60 text-gray-700 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors"
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
        </div>
        )}

      </div>
    </div>
  );
}
