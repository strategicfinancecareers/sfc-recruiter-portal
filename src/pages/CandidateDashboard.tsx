import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';
import {
  Loader2, Shield, CheckCircle2, MapPin, Bell, Clock, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className="mr-2 shrink-0">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

// ─── Constants ────────────────────────────────────────────────────────────────

const CORE_FINANCE = new Set([
  'strategic finance','fp&a','fpa','m&a','corporate development','capital raising',
  'private equity','investment banking','equity research','financial modeling','financial modelling',
  'valuation','dcf','lbo','budgeting','forecasting','budgeting & forecasting','treasury',
  'corporate finance','portfolio management','credit analysis','risk management',
  'investor relations','mergers & acquisitions','due diligence','capital markets',
  'leveraged buyout','discounted cash flow','financial analysis','corporate strategy',
  'business development','restructuring',
]);

const WORK_PREFS = ['Remote', 'Hybrid', 'In-Office'];

const COMP_OPTIONS = [
  'Under $70k', '$70k–$100k', '$100k–$150k',
  '$150k–$200k', '$200k–$300k', '$300k+',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractBio(pd?: string) {
  return pd?.split('\n\n')[0] || '';
}

function extractMeta(pd?: string) {
  const meta = pd?.split('\n\n').slice(1).join(' ') || '';
  const get = (key: string) => meta.match(new RegExp(key + ': ([^.]+)\\.?'))?.[1]?.trim() || '';
  return {
    jobSearchStatus: get('Job search status'),
    targetComp: get('Target comp'),
    workPreference: get('Work preference'),
    preferredCities: get('Preferred cities')
      ? get('Preferred cities').split(',').map((s: string) => s.trim()).filter(Boolean)
      : [] as string[],
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CandidateRow {
  id: string;
  name: string;
  email: string;
  phone?: string;
  label?: string;
  location?: string;
  experience?: number;
  education?: string;
  highest_education_level?: string;
  profile_description?: string;
  open_to_opportunities?: boolean;
  primary_background?: string;
  secondary_backgrounds?: string[];
  created_at?: string;
}

interface SkillRow {
  skill_id: string;
  skills: { skill: string } | null;
}

interface IntroJob {
  title: string | null;
  company: string | null;
  salary_range: string | null;
}

interface IntroRequest {
  id: string;
  created_at: string;
  status: string;
  notes?: string;
  jobs?: IntroJob | null;
}

// ─── Google Sign-In Screen ────────────────────────────────────────────────────

function GoogleSignInScreen() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://sfc-recruiter-portal.vercel.app/candidate-dashboard',
      },
    });
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <span className="font-bold text-2xl text-gray-900 tracking-tight">SFC Talent</span>
        <div className="mt-8 mb-6">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
            <Shield className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Your Dashboard</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Sign in with the Google account you used when applying
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center bg-[#0F6E56] hover:bg-[#0a5942] text-white rounded-lg px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-60"
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
            : <GoogleIcon />}
          Continue with Google
        </button>
        <p className="text-xs text-gray-400 mt-4 leading-relaxed">
          Don't have a profile yet?{' '}
          <a href="https://sfc-recruiter-portal.vercel.app/apply" className="text-emerald-600 hover:underline">
            Apply at sfc-recruiter-portal.vercel.app/apply
          </a>
        </p>
      </div>
    </div>
  );
}

// ─── Profile Preview — matches recruiter view exactly ─────────────────────────

function ProfilePreview({ candidate, skills }: { candidate: CandidateRow; skills: string[] }) {
  const bio = extractBio(candidate.profile_description);
  const meta = extractMeta(candidate.profile_description);
  const coreSkills = skills.filter(s => CORE_FINANCE.has(s.toLowerCase()));
  const techSkills = skills.filter(s => !CORE_FINANCE.has(s.toLowerCase()));

  // Executive summary chips — same as recruiter portal
  const chips: string[] = [];
  if (candidate.experience) chips.push(`${candidate.experience} yrs exp`);
  if (candidate.highest_education_level || candidate.education)
    chips.push(candidate.highest_education_level || candidate.education || '');
  if (candidate.primary_background) chips.push(candidate.primary_background);
  if (meta.workPreference) chips.push(meta.workPreference);
  if (candidate.open_to_opportunities) chips.push('Open to opportunities');

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-4 border-b border-gray-100">
        <div className="flex items-start gap-3 flex-wrap mb-2">
          <h3 className="font-semibold text-gray-900 text-base leading-tight">
            {candidate.label || 'Finance Professional'}
          </h3>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
            candidate.open_to_opportunities
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${candidate.open_to_opportunities ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            {candidate.open_to_opportunities ? 'Open to opportunities' : 'Not looking'}
          </span>
        </div>
        <p className="text-xs text-gray-400 flex items-center gap-1 mb-3">
          <MapPin className="w-3 h-3" />{candidate.location || 'United States'}
        </p>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map(c => (
              <span key={c} className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{c}</span>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Professional Summary */}
        {bio && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Professional Summary</p>
            <p className="text-sm text-gray-700 leading-relaxed">{bio}</p>
          </div>
        )}

        {/* Core Expertise */}
        {coreSkills.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Core Expertise</p>
            <div className="flex flex-wrap gap-1.5">
              {coreSkills.map(s => (
                <span key={s} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-medium">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Technical Skills */}
        {techSkills.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Technical Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {techSkills.map(s => (
                <span key={s} className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Candidate Snapshot — same rows as recruiter portal */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Candidate Snapshot</p>
          <div className="space-y-2.5">
            {[
              { icon: '📍', label: 'Location', value: candidate.location },
              { icon: '💼', label: 'Experience', value: candidate.experience ? `${candidate.experience} years` : null },
              { icon: '🏢', label: 'Work Preference', value: meta.workPreference || null },
              { icon: '💰', label: 'Target Comp', value: meta.targetComp || null },
              { icon: '🏙️', label: 'Preferred Cities', value: meta.preferredCities.length ? meta.preferredCities.join(', ') : null },
              { icon: '📊', label: 'Primary Background', value: candidate.primary_background || null },
              {
                icon: '📋', label: 'Secondary Background',
                value: Array.isArray(candidate.secondary_backgrounds) && candidate.secondary_backgrounds.length > 0
                  ? candidate.secondary_backgrounds.join(' · ')
                  : null,
              },
              { icon: '✅', label: 'Availability', value: candidate.open_to_opportunities ? 'Open to opportunities' : 'Not looking' },
            ].filter(r => r.value).map(r => (
              <div key={r.label} className="flex items-start gap-2 text-xs">
                <span className="w-5 text-center shrink-0 mt-0.5">{r.icon}</span>
                <span className="text-gray-400 w-32 shrink-0">{r.label}</span>
                <span className="text-gray-700 font-medium leading-snug">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-400 pt-1 border-t border-gray-100">
          <Shield className="w-3 h-3 shrink-0" />
          Your name and contact info are hidden from recruiters
        </div>
      </div>
    </div>
  );
}

// ─── Edit Profile Section ─────────────────────────────────────────────────────

function EditSection({
  candidate,
  onSaved,
}: {
  candidate: CandidateRow;
  onSaved: (updated: Partial<CandidateRow>) => void;
}) {
  const meta = extractMeta(candidate.profile_description);
  const bio = extractBio(candidate.profile_description);

  // FIX 4: availability — initialise from DB, update immediately on click
  const [availability, setAvailability] = useState<'active' | 'not-active'>(
    candidate.open_to_opportunities ? 'active' : 'not-active'
  );
  const [availSaving, setAvailSaving] = useState(false);

  // FIX 5: commitment — pre-checked (they agreed during intake)
  const [committed, setCommitted] = useState(true);
  const [showCommitWarning, setShowCommitWarning] = useState(false);

  // Other fields
  const [workPref, setWorkPref] = useState(meta.workPreference || '');
  const [targetComp, setTargetComp] = useState(meta.targetComp || '');

  // FIX 3: bio editable, pre-filled
  const [editBio, setEditBio] = useState(bio);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // FIX 4: immediate availability update
  const handleAvailabilityChange = async (val: 'active' | 'not-active') => {
    setAvailability(val);
    setAvailSaving(true);
    try {
      await supabase
        .from('candidates')
        .update({ open_to_opportunities: val === 'active' } as any)
        .eq('id', candidate.id);
      onSaved({ open_to_opportunities: val === 'active' });
    } finally {
      setAvailSaving(false);
    }
  };

  const handleSave = async () => {
    // FIX 5: warn if unchecked
    if (!committed) {
      setShowCommitWarning(true);
      return;
    }
    setShowCommitWarning(false);
    setSaving(true);
    setError('');
    try {
      // FIX 3: update bio + meta via save API (preserves metadata structure)
      const res = await fetch('/api/save-candidate-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: candidate.email,
          bio: editBio,
          workPreference: workPref,
          targetComp,
          openToOpportunities: availability === 'active',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
      onSaved({ open_to_opportunities: availability === 'active' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
      <h2 className="font-semibold text-gray-900">Edit Profile</h2>

      {/* FIX 4: Availability cards */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">
          Availability Status
          {availSaving && <Loader2 className="w-3 h-3 animate-spin inline ml-2 text-gray-400" />}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { val: 'active' as const, emoji: '🟢', label: 'Actively Looking', desc: "I'm open to new opportunities right now" },
            { val: 'not-active' as const, emoji: '⏸️', label: 'Not Active', desc: 'Please hide my profile for now' },
          ].map(opt => (
            <button
              key={opt.val}
              type="button"
              onClick={() => handleAvailabilityChange(opt.val)}
              className={`p-4 border-2 rounded-xl text-left transition-all ${
                availability === opt.val
                  ? opt.val === 'active' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-400 bg-gray-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="text-xl mb-2">{opt.emoji}</div>
              <p className={`text-sm font-semibold leading-tight ${
                availability === opt.val
                  ? opt.val === 'active' ? 'text-emerald-800' : 'text-gray-800'
                  : 'text-gray-700'
              }`}>{opt.label}</p>
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

      {/* FIX 5: Commitment checkbox */}
      <div className={`p-4 border rounded-xl ${showCommitWarning ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={committed}
            onChange={e => {
              setCommitted(e.target.checked);
              if (e.target.checked) setShowCommitWarning(false);
            }}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 shrink-0"
          />
          <div>
            <p className="text-sm font-medium text-gray-700 leading-snug">
              ✓ I commit to responding to all introduction requests within 48 hours
            </p>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              Non-responses will result in your profile being deprioritized. Repeated non-responses may result in removal from the platform.
            </p>
          </div>
        </label>
        {showCommitWarning && (
          <div className="mt-3 flex items-start gap-2 text-xs text-amber-700">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Candidates who don't respond will be deprioritized and may be hidden from the platform.</span>
          </div>
        )}
      </div>

      {/* Work preference */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Work Preference</p>
        <div className="flex gap-2 flex-wrap">
          {WORK_PREFS.map(wp => (
            <button
              key={wp}
              type="button"
              onClick={() => setWorkPref(p => p === wp ? '' : wp)}
              className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                workPref === wp
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400'
              }`}
            >
              {wp}
            </button>
          ))}
        </div>
      </div>

      {/* Target comp */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Target Total Compensation</p>
        <select
          value={targetComp}
          onChange={e => setTargetComp(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Select…</option>
          {COMP_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      {/* FIX 3: Bio textarea — editable, NOT grayed out */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Professional Bio</p>
        <textarea
          value={editBio}
          onChange={e => setEditBio(e.target.value)}
          rows={5}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed"
          placeholder="Describe your background and what you're looking for…"
        />
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {saved && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Profile saved successfully!
        </div>
      )}

      <Button
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : 'Save Changes'}
      </Button>
    </div>
  );
}

// ─── Intro Requests Section ───────────────────────────────────────────────────

function IntroRequestsSection({ candidateId }: { candidateId: string }) {
  const [intros, setIntros] = useState<IntroRequest[] | null>(null);

  useEffect(() => {
    // FIX 6: query with job details
    supabase
      .from('introduction_requests')
      .select('*, jobs(title, company, salary_range)')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setIntros((data as IntroRequest[]) || []));
  }, [candidateId]);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <Bell className="w-4 h-4 text-gray-400" />
        <h2 className="font-semibold text-gray-900">Introduction Requests</h2>
      </div>

      {intros === null ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      ) : intros.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-600 font-medium">No introduction requests yet.</p>
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed max-w-xs mx-auto">
            You'll be notified by email when a recruiter is interested in connecting.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {intros.map(req => {
            const job = req.jobs;
            const statusMap: Record<string, { label: string; cls: string }> = {
              approved: { label: 'Accepted', cls: 'bg-emerald-100 text-emerald-700' },
              rejected: { label: 'Declined', cls: 'bg-gray-100 text-gray-500' },
              pending:  { label: 'Pending',  cls: 'bg-amber-100  text-amber-700'  },
            };
            const s = statusMap[req.status] ?? { label: req.status || 'Pending', cls: 'bg-amber-100 text-amber-700' };

            return (
              <div key={req.id} className="flex items-start justify-between gap-3 p-4 bg-gray-50 rounded-xl">
                <div className="min-w-0">
                  {job?.title && (
                    <p className="text-sm font-semibold text-gray-800 leading-snug">
                      {job.title}{job.company ? ` — ${job.company}` : ''}
                    </p>
                  )}
                  {!job?.title && (
                    <p className="text-sm font-medium text-gray-700">Introduction Request</p>
                  )}
                  {job?.salary_range && (
                    <p className="text-xs text-emerald-700 font-medium mt-0.5">{job.salary_range}</p>
                  )}
                  {req.notes && (
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">{req.notes}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 whitespace-nowrap ${s.cls}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function CandidateDashboard() {
  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = loading
  const [candidate, setCandidate] = useState<CandidateRow | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [noProfile, setNoProfile] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Check session on mount + listen for OAuth callback
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch candidate when session arrives
  useEffect(() => {
    if (!session?.user?.email) return;
    const email = session.user.email.toLowerCase();
    setLoadingProfile(true);
    setNoProfile(false);

    supabase
      .from('candidates')
      .select('*, candidate_skills(skill_id, skills(skill))')
      .eq('email', email)
      .or('status.eq.active,status.is.null')
      .maybeSingle()
      .then(({ data: cand }) => {
        if (!cand) { setNoProfile(true); setLoadingProfile(false); return; }
        const extractedSkills: string[] = ((cand as any).candidate_skills as SkillRow[] || [])
          .map((r: SkillRow) => r.skills?.skill || '')
          .filter(Boolean);
        setCandidate(cand as CandidateRow);
        setSkills(extractedSkills);
        setLoadingProfile(false);
      });
  }, [session?.user?.email]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setCandidate(null);
    setNoProfile(false);
  };

  // Still determining session
  if (session === undefined || loadingProfile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // No session → Google sign-in screen
  if (!session) return <GoogleSignInScreen />;

  // Session exists but no matching candidate
  if (noProfile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center">
          <span className="font-bold text-2xl text-gray-900 tracking-tight">SFC Talent</span>
          <div className="mt-8 mb-6">
            <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-7 h-7 text-amber-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">No profile found</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              No profile found for <strong>{session.user.email}</strong>. Make sure you signed in with the same Google account you used when applying.
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut} className="w-full">
            Sign out and try again
          </Button>
        </div>
      </div>
    );
  }

  if (!candidate) return null;

  const memberSince = candidate.created_at
    ? new Date(candidate.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg text-gray-900 tracking-tight">SFC Talent</span>
            <span className="text-gray-200 select-none">|</span>
            <span className="text-sm text-gray-500">My Dashboard</span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Hi, {candidate.name?.split(' ')[0] || 'there'} 👋
          </h1>
          {memberSince && (
            <p className="text-sm text-gray-400 mt-0.5">Member since {memberSince}</p>
          )}
        </div>

        {/* Section 1 — Profile Preview */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            How Recruiters See Your Profile
          </p>
          <ProfilePreview candidate={candidate} skills={skills} />
        </div>

        {/* Section 2 — Edit Profile */}
        <EditSection
          candidate={candidate}
          onSaved={updates => setCandidate(c => c ? { ...c, ...updates } : c)}
        />

        {/* Section 3 — Introduction Requests */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Activity</p>
          <IntroRequestsSection candidateId={candidate.id} />
        </div>

        {/* Section 4 — Help */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 text-center">
          <p className="text-sm text-gray-500">
            Need help?{' '}
            <a
              href="mailto:talent@strategicfinancecareers.com"
              className="text-emerald-600 hover:underline font-medium"
            >
              talent@strategicfinancecareers.com
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}
