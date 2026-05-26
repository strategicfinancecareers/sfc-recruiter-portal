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
  candidate_skills?: { skills: { skill: string } | null }[];
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
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user?.email) return;
      const email = session.user.email;
      setEmailInput(email);
      setSigninLoading(true);
      try {
        const res = await fetch(`/api/candidate-profile?email=${encodeURIComponent(email.toLowerCase())}`);
        if (res.ok) {
          const { candidate: c } = await res.json();
          const extracted: string[] = (c.candidate_skills || [])
            .map((r: { skills: { skill: string } | null }) => r.skills?.skill || '')
            .filter(Boolean);
          setCandidate(c as CandidateRow);
          setSkills(extracted);
          setView('dashboard');
        }
      } finally {
        setSigninLoading(false);
      }
    });
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
        setSigninError('No profile found. Please apply first at /apply.');
        return;
      }
      if (!res.ok) {
        setSigninError('Something went wrong, please try again.');
        return;
      }
      const { candidate: c } = await res.json();
      const extracted: string[] = (c.candidate_skills || [])
        .map((r: { skills: { skill: string } | null }) => r.skills?.skill || '')
        .filter(Boolean);
      setCandidate(c as CandidateRow);
      setSkills(extracted);
      setView('dashboard');
    } catch {
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

// ─── Dashboard component ──────────────────────────────────────────────────────

function Dashboard({
  candidate: initialCandidate,
  skills,
  onSignOut,
  onUpdate,
}: {
  candidate: CandidateRow;
  skills: string[];
  onSignOut: () => void;
  onUpdate: (c: CandidateRow) => void;
}) {
  const [candidate, setCandidate] = useState(initialCandidate);
  const [availSaving, setAvailSaving] = useState(false);
  const [availSaved, setAvailSaved] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editBio, setEditBio] = useState(candidate.profile_description?.split('\n\n')[0] || '');
  const [editWorkPref, setEditWorkPref] = useState(candidate.work_preference || '');
  const [editSaving, setEditSaving] = useState(false);
  const [editSaved, setEditSaved] = useState(false);

  const [intros, setIntros] = useState<IntroRequest[] | null>(null);
  const [responding, setResponding] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  // Fetch intros on mount
  useEffect(() => {
    fetch(`/api/candidate-intros?candidateId=${encodeURIComponent(candidate.id)}`)
      .then(r => r.json())
      .then(data => setIntros(data.requests || []))
      .catch(() => setIntros([]));
  }, [candidate.id]);

  // Availability toggle
  const toggleAvail = async (val: boolean) => {
    setAvailSaving(true);
    const res = await fetch('/api/candidate-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: candidate.id, open_to_opportunities: val }),
    });
    if (res.ok) {
      const updated = { ...candidate, open_to_opportunities: val };
      setCandidate(updated);
      onUpdate(updated);
      setAvailSaved(true);
      setTimeout(() => setAvailSaved(false), 2000);
    }
    setAvailSaving(false);
  };

  // Save profile edits
  const saveEdit = async () => {
    setEditSaving(true);
    const res = await fetch('/api/candidate-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: candidate.id,
        profile_description: editBio,
        work_preference: editWorkPref,
      }),
    });
    if (res.ok) {
      const updated = { ...candidate, profile_description: editBio, work_preference: editWorkPref };
      setCandidate(updated);
      onUpdate(updated);
      setEditSaved(true);
      setTimeout(() => { setEditSaved(false); setShowEdit(false); }, 1500);
    }
    setEditSaving(false);
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

  const bio = candidate.profile_description?.split('\n\n')[0] || '';
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

        {/* ── Section 1: Availability ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Availability</h2>
          <div className="flex gap-3">
            <button
              onClick={() => toggleAvail(true)}
              disabled={availSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                candidate.open_to_opportunities
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${candidate.open_to_opportunities ? 'bg-white' : 'bg-gray-400'}`} />
              Actively Looking
            </button>
            <button
              onClick={() => toggleAvail(false)}
              disabled={availSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                !candidate.open_to_opportunities
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              ⏸ Not Active
            </button>
          </div>
          {availSaving && <p className="text-xs text-gray-400 mt-2">Saving…</p>}
          {availSaved && <p className="text-xs text-emerald-600 mt-2">✓ Saved</p>}
        </div>

        {/* ── Section 2: Profile ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Your Profile</h2>
            <button
              onClick={() => setShowEdit(v => !v)}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
            >
              {showEdit ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>

          {/* Read-only view */}
          {!showEdit && (
            <div className="space-y-3">
              <div>
                <p className="text-base font-semibold text-gray-900">{candidate.label || 'Finance Professional'}</p>
                {(candidate.location || candidate.experience) && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {[candidate.location, candidate.experience ? `${candidate.experience} yrs exp` : ''].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              {bio && <p className="text-sm text-gray-600 leading-relaxed">{bio}</p>}
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {skills.map(s => (
                    <span key={s} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Edit form */}
          {showEdit && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Bio</label>
                <textarea
                  value={editBio}
                  onChange={e => setEditBio(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed"
                  placeholder="Describe your background and what you're looking for…"
                />
              </div>
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

        {/* ── Section 3: Introduction Requests ── */}
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

      </div>
    </div>
  );
}
