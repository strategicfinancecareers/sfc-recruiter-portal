import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Shield, CheckCircle2, MapPin, Briefcase, GraduationCap, Bell, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
      ? get('Preferred cities').split(',').map(s => s.trim()).filter(Boolean)
      : [],
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

interface IntroRequest {
  id: string;
  created_at: string;
  status: string;
  notes?: string;
}

// ─── Email Gate ───────────────────────────────────────────────────────────────

function EmailGate({ onFound }: {
  onFound: (candidate: CandidateRow, skills: string[], intros: IntroRequest[]) => void;
}) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAccess = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setLoading(true);
    setError('');

    try {
      const { data: cand, error: err } = await supabase
        .from('candidates')
        .select('*')
        .eq('email', trimmed)
        .maybeSingle();

      if (err || !cand) {
        setError('No profile found with that email. Please check the email you used when applying.');
        setLoading(false);
        return;
      }

      // Load skills
      const { data: cs } = await supabase
        .from('candidate_skills')
        .select('skill_id, skills(skill)')
        .eq('candidate_id', cand.id);

      const skills: string[] = (cs as SkillRow[] || [])
        .map(r => r.skills?.skill || '')
        .filter(Boolean);

      // Load intro requests
      let intros: IntroRequest[] = [];
      try {
        const { data: reqs } = await supabase
          .from('introduction_requests')
          .select('id, created_at, status, notes')
          .eq('candidate_id', cand.id)
          .order('created_at', { ascending: false })
          .limit(20);
        if (reqs) intros = reqs as IntroRequest[];
      } catch {
        // table may not exist yet
      }

      onFound(cand as CandidateRow, skills, intros);
    } catch (e: any) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <span className="font-bold text-2xl text-gray-900 tracking-tight">SFC Talent</span>
          <div className="mt-6 mb-2">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
              <Shield className="w-7 h-7 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Your Dashboard</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              Enter the email you used when applying to view and manage your profile.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAccess()}
            className="text-base py-3"
            autoFocus
          />
          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</p>
          )}
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-base"
            onClick={handleAccess}
            disabled={loading || !email.trim()}
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Looking up your profile…</> : 'Access Dashboard'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Preview (read-only, as recruiters see it) ────────────────────────

function ProfilePreview({ candidate, skills }: { candidate: CandidateRow; skills: string[] }) {
  const bio = extractBio(candidate.profile_description);
  const meta = extractMeta(candidate.profile_description);
  const coreSkills = skills.filter(s => CORE_FINANCE.has(s.toLowerCase()));
  const techSkills = skills.filter(s => !CORE_FINANCE.has(s.toLowerCase()));

  const chips: string[] = [];
  if (candidate.experience) chips.push(`${candidate.experience} yrs exp`);
  if (candidate.highest_education_level || candidate.education) chips.push(candidate.highest_education_level || candidate.education || '');
  if ((candidate as any).primary_background) chips.push((candidate as any).primary_background);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-4 border-b border-gray-50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h3 className="font-semibold text-gray-900 text-base leading-tight">
                {candidate.label || 'Finance Professional'}
              </h3>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                candidate.open_to_opportunities
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${candidate.open_to_opportunities ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                {candidate.open_to_opportunities ? 'Open to opportunities' : 'Not looking'}
              </span>
            </div>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <MapPin className="w-3 h-3" />{candidate.location || 'United States'}
            </p>
          </div>
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {chips.map(c => (
              <span key={c} className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{c}</span>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Bio */}
        {bio && (
          <p className="text-sm text-gray-600 leading-relaxed">{bio}</p>
        )}

        {/* Skills */}
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

        {/* Candidate Snapshot */}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Candidate Snapshot</p>
          <div className="space-y-2">
            {[
              { icon: '📍', label: 'Location', value: candidate.location },
              { icon: '💼', label: 'Experience', value: candidate.experience ? `${candidate.experience} years` : null },
              { icon: '🏢', label: 'Work Preference', value: meta.workPreference || null },
              { icon: '💰', label: 'Target Comp', value: meta.targetComp || null },
              { icon: '🏙️', label: 'Preferred Cities', value: meta.preferredCities.length ? meta.preferredCities.join(', ') : null },
              { icon: '✅', label: 'Availability', value: candidate.open_to_opportunities ? 'Open to opportunities' : null },
            ].filter(r => r.value).map(r => (
              <div key={r.label} className="flex items-center gap-2 text-xs">
                <span className="w-5 text-center">{r.icon}</span>
                <span className="text-gray-400 w-28 shrink-0">{r.label}</span>
                <span className="text-gray-700 font-medium">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-400 pt-1 border-t border-gray-100">
          <Shield className="w-3 h-3" />
          Your name and contact info are hidden from recruiters
        </div>
      </div>
    </div>
  );
}

// ─── Edit Profile Form ────────────────────────────────────────────────────────

function EditSection({
  candidate,
  onSaved,
}: {
  candidate: CandidateRow;
  onSaved: (updated: Partial<CandidateRow>) => void;
}) {
  const meta = extractMeta(candidate.profile_description);
  const bio = extractBio(candidate.profile_description);

  const [availability, setAvailability] = useState<'active' | 'not-active'>(
    candidate.open_to_opportunities ? 'active' : 'not-active'
  );
  const [committed, setCommitted] = useState(false);
  const [workPref, setWorkPref] = useState(meta.workPreference || '');
  const [targetComp, setTargetComp] = useState(meta.targetComp || '');
  const [editBio, setEditBio] = useState(bio);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
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
      setTimeout(() => setSaved(false), 3000);
      onSaved({ open_to_opportunities: availability === 'active' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">
      <h2 className="font-semibold text-gray-900 text-base">Edit Profile</h2>

      {/* Availability status */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Availability Status</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setAvailability('active')}
            className={`p-4 border-2 rounded-xl text-left transition-all ${
              availability === 'active'
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-xl mb-1">🟢</div>
            <p className={`text-sm font-semibold ${availability === 'active' ? 'text-emerald-800' : 'text-gray-700'}`}>
              Actively Looking
            </p>
            <p className="text-xs text-gray-400 mt-0.5 leading-snug">
              I'm open to new opportunities right now
            </p>
          </button>
          <button
            type="button"
            onClick={() => setAvailability('not-active')}
            className={`p-4 border-2 rounded-xl text-left transition-all ${
              availability === 'not-active'
                ? 'border-gray-400 bg-gray-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="text-xl mb-1">⏸️</div>
            <p className={`text-sm font-semibold ${availability === 'not-active' ? 'text-gray-800' : 'text-gray-700'}`}>
              Not Active
            </p>
            <p className="text-xs text-gray-400 mt-0.5 leading-snug">
              Please hide my profile for now
            </p>
          </button>
        </div>

        <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <p className="text-xs text-blue-700 leading-relaxed">
            We want to provide a great experience to both sides. Clear availability signals help recruiters move fast and respect your time.
          </p>
        </div>
      </div>

      {/* Commitment checkbox */}
      <div className="p-4 border border-gray-200 rounded-xl bg-gray-50">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={committed}
            onChange={e => setCommitted(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600"
          />
          <div>
            <p className="text-sm text-gray-700 font-medium leading-snug">
              I commit to responding to introduction requests within 48 hours via email or text.
            </p>
            <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
              Candidates who don't respond will be gradually deprioritized and may eventually be hidden from the platform. We do this to ensure recruiters always get a timely response.
            </p>
          </div>
        </label>
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
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Select…</option>
          {COMP_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      {/* Bio */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Professional Bio</p>
        <textarea
          value={editBio}
          onChange={e => setEditBio(e.target.value)}
          rows={4}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
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
        disabled={saving || !committed}
      >
        {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : 'Save Changes'}
      </Button>
      {!committed && (
        <p className="text-xs text-center text-gray-400">Check the commitment box above to save</p>
      )}
    </div>
  );
}

// ─── Introduction Requests ────────────────────────────────────────────────────

function IntroRequests({ candidateId }: { candidateId: string }) {
  const [intros, setIntros] = useState<IntroRequest[] | null>(null);

  // load on mount
  useState(() => {
    supabase
      .from('introduction_requests')
      .select('id, created_at, status, notes')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setIntros((data as IntroRequest[]) || []));
  });

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
          <p className="text-sm text-gray-500">No introduction requests yet.</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-xs mx-auto">
            You'll be notified by email when a recruiter is interested in connecting.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {intros.map(req => (
            <div key={req.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm font-medium text-gray-800">Introduction Request</p>
                {req.notes && <p className="text-xs text-gray-500 mt-0.5">{req.notes}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ml-3 ${
                req.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                req.status === 'declined' ? 'bg-gray-100 text-gray-500' :
                'bg-amber-100 text-amber-700'
              }`}>
                {req.status || 'Pending'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function CandidateDashboard() {
  const [candidate, setCandidate] = useState<CandidateRow | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [intros, setIntros] = useState<IntroRequest[]>([]);

  if (!candidate) {
    return (
      <EmailGate
        onFound={(cand, sk, ir) => {
          setCandidate(cand);
          setSkills(sk);
          setIntros(ir);
        }}
      />
    );
  }

  const memberSince = candidate.created_at
    ? new Date(candidate.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg text-gray-900 tracking-tight">SFC Talent</span>
            <span className="text-gray-200 select-none">|</span>
            <span className="text-sm text-gray-500">My Dashboard</span>
          </div>
          <button
            onClick={() => setCandidate(null)}
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

        {/* Section 1: Profile Preview */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            How Recruiters See Your Profile
          </p>
          <ProfilePreview candidate={candidate} skills={skills} />
        </div>

        {/* Section 2: Edit Profile */}
        <EditSection
          candidate={candidate}
          onSaved={updates => setCandidate(c => c ? { ...c, ...updates } : c)}
        />

        {/* Section 3: Introduction Requests */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Activity
          </p>
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Bell className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Introduction Requests</h2>
            </div>
            {intros.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">No introduction requests yet.</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-xs mx-auto">
                  You'll be notified by email when a recruiter is interested in connecting.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {intros.map(req => (
                  <div key={req.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Introduction Request</p>
                      {req.notes && <p className="text-xs text-gray-500 mt-0.5">{req.notes}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ml-3 ${
                      req.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                      req.status === 'declined' ? 'bg-gray-100 text-gray-500' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {req.status || 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Quick Links */}
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
