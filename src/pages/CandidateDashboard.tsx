import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Inbox, Settings, LogOut, Loader2, CheckCircle2, X } from 'lucide-react';

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

const COMP_OPTIONS = [
  'Under $70k','$70k–$100k','$100k–$150k','$150k–$200k','$200k–$300k','$300k+',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractBio(pd?: string) { return pd?.split('\n\n')[0] || ''; }

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

function profileStrength(c: CandidateRow, skills: string[], meta: ReturnType<typeof extractMeta>) {
  const checks = [
    !!extractBio(c.profile_description),
    skills.length > 3,
    !!c.location,
    !!c.experience,
    !!(c.highest_education_level || c.education),
    !!meta.workPreference,
    c.open_to_opportunities !== undefined,
  ];
  const score = checks.filter(Boolean).length;
  return { score, total: checks.length, pct: Math.round((score / checks.length) * 100) };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CandidateRow {
  id: string; name: string; email: string; phone?: string; label?: string;
  location?: string; experience?: number; education?: string;
  highest_education_level?: string; profile_description?: string;
  open_to_opportunities?: boolean; primary_background?: string;
  secondary_backgrounds?: string[]; created_at?: string;
  linkedin_url?: string; target_salary?: string; work_preference?: string;
}

interface SkillRow { skills: { skill: string } | null; }

interface IntroRequest {
  id: string; created_at: string; status: string; notes?: string;
  jobs?: { title: string | null; company: string | null; salary_range: string | null } | null;
}

type NavPage = 'profile' | 'opportunities' | 'settings';

// ─── Google Sign-In Screen ────────────────────────────────────────────────────

const GoogleIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

function GoogleSignInScreen() {
  const [loading, setLoading] = useState(false);
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-6">
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-10 w-full max-w-sm text-center shadow-sm">
        <span className="font-semibold text-[15px] text-[#0A0A0A] tracking-tight">SFC Talent</span>
        <h1 className="text-xl font-semibold text-[#0A0A0A] mt-6 mb-1">Access Your Dashboard</h1>
        <p className="text-sm text-[#6B7280] mb-7 leading-relaxed">
          Sign in with the Google account you used when applying
        </p>
        <button
          onClick={async () => { setLoading(true); await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://sfc-recruiter-portal.vercel.app/candidate-dashboard' } }); }}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-white border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon size={16} />}
          Continue with Google
        </button>
        <p className="text-xs text-[#9CA3AF] mt-5 leading-relaxed">
          Applied with a different email?{' '}
          <a href="mailto:talent@strategicfinancecareers.com" className="text-[#0F6E56] hover:underline">
            Contact talent@strategicfinancecareers.com
          </a>
        </p>
      </div>
    </div>
  );
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

function ProfilePage({ candidate, skills, onUpdate }: {
  candidate: CandidateRow; skills: string[];
  onUpdate: (u: Partial<CandidateRow>) => void;
}) {
  const meta = extractMeta(candidate.profile_description);
  const bio = extractBio(candidate.profile_description);
  const strength = profileStrength(candidate, skills, meta);
  const coreSkills = skills.filter(s => CORE_FINANCE.has(s.toLowerCase()));
  const techSkills = skills.filter(s => !CORE_FINANCE.has(s.toLowerCase()));
  const memberSince = candidate.created_at
    ? new Date(candidate.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';

  // Edit state
  const [editBio, setEditBio] = useState(bio);
  const [workPref, setWorkPref] = useState(meta.workPreference || candidate.work_preference || '');
  const [targetComp, setTargetComp] = useState(meta.targetComp || candidate.target_salary || '');
  const [linkedIn, setLinkedIn] = useState(candidate.linkedin_url || '');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const metaParts = [`Job search status: ${candidate.open_to_opportunities ? 'Actively looking' : 'Not active'}.`];
      if (workPref) metaParts.push(`Work preference: ${workPref}.`);
      if (targetComp) metaParts.push(`Target comp: ${targetComp}.`);
      if (meta.preferredCities.length) metaParts.push(`Preferred cities: ${meta.preferredCities.join(', ')}.`);
      const newPd = editBio + (metaParts.length ? '\n\n' + metaParts.join(' ') : '');

      await (supabase as any).from('candidates').update({
        profile_description: newPd,
        ...(linkedIn ? { linkedin_url: linkedIn } : {}),
      }).eq('id', candidate.id);

      onUpdate({ profile_description: newPd, linkedin_url: linkedIn });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const chips: string[] = [];
  if (candidate.experience) chips.push(`${candidate.experience} yrs`);
  if (candidate.highest_education_level || candidate.education)
    chips.push(candidate.highest_education_level || candidate.education || '');
  if (candidate.location) chips.push(candidate.location);
  if (meta.workPreference || workPref) chips.push(meta.workPreference || workPref);

  const promptText = !bio ? 'Add a professional bio' :
    skills.length <= 3 ? 'Add more skills to improve visibility' :
    !meta.workPreference ? 'Set your work preference' : '';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#0A0A0A]">Hi, {candidate.name?.split(' ')[0] || 'there'} 👋</h1>
          {memberSince && <p className="text-[13px] text-[#9CA3AF] mt-0.5">Member since {memberSince}</p>}
        </div>
      </div>

      {/* Profile strength */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl px-6 py-4 flex items-center gap-6">
        <div className="shrink-0">
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1">Profile Strength</p>
          <p className="text-2xl font-bold text-[#0A0A0A]">{strength.pct}%</p>
        </div>
        <div className="flex-1">
          <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
            <div className="h-2 rounded-full bg-[#0F6E56] transition-all" style={{ width: `${strength.pct}%` }} />
          </div>
        </div>
        {promptText && (
          <p className="text-[13px] text-[#6B7280] shrink-0 max-w-[180px] leading-snug">{promptText}</p>
        )}
      </div>

      {/* Anonymous profile preview */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-[0.08em] mb-4">How Recruiters See You</p>

        <div className="flex items-start gap-3 flex-wrap mb-3">
          <h3 className="text-[18px] font-bold text-[#0A0A0A]">{candidate.label || 'Finance Professional'}</h3>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${candidate.open_to_opportunities ? 'bg-[#F0FDF4] text-[#065F46]' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${candidate.open_to_opportunities ? 'bg-[#0F6E56]' : 'bg-[#9CA3AF]'}`} />
            {candidate.open_to_opportunities ? 'Open to opportunities' : 'Not looking'}
          </span>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {chips.map(c => (
              <span key={c} className="px-2.5 py-1 bg-[#F3F4F6] text-[#374151] rounded-full text-xs font-medium">{c}</span>
            ))}
          </div>
        )}

        {bio && (
          <div className="mb-4">
            <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">Professional Summary</p>
            <p className="text-sm text-[#374151] leading-relaxed">{bio}</p>
          </div>
        )}

        {coreSkills.length > 0 && (
          <div className="mb-3">
            <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">Core Expertise</p>
            <div className="flex flex-wrap gap-1.5">
              {coreSkills.map(s => (
                <span key={s} className="px-2.5 py-1 bg-[#F0FDF4] text-[#0F6E56] border border-[#D1FAE5] rounded-full text-xs font-medium">{s}</span>
              ))}
            </div>
          </div>
        )}

        {techSkills.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">Technical Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {techSkills.map(s => (
                <span key={s} className="px-2.5 py-1 bg-[#F3F4F6] text-[#6B7280] rounded-full text-xs font-medium">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Edit profile */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
        <h2 className="text-[15px] font-semibold text-[#0A0A0A] mb-5">Edit Your Profile</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1.5">Professional Bio</label>
            <textarea
              value={editBio}
              onChange={e => setEditBio(e.target.value)}
              rows={4}
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-[#0A0A0A] bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56] resize-none leading-relaxed"
              placeholder="Describe your background and what you're looking for…"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1.5">Work Preference</label>
              <select
                value={workPref}
                onChange={e => setWorkPref(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-[#0A0A0A] bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              >
                <option value="">Select…</option>
                {['Remote', 'Hybrid', 'In-Office'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1.5">Target Compensation</label>
              <select
                value={targetComp}
                onChange={e => setTargetComp(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-[#0A0A0A] bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
              >
                <option value="">Select…</option>
                {COMP_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1.5">LinkedIn URL</label>
            <input
              type="url"
              value={linkedIn}
              onChange={e => setLinkedIn(e.target.value)}
              placeholder="https://linkedin.com/in/yourprofile"
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-[#0A0A0A] bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            {savedFlash && (
              <span className="flex items-center gap-1.5 text-sm text-[#0F6E56] font-medium">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#0a5942] disabled:opacity-60 text-white rounded-lg px-5 py-2 text-sm font-semibold transition-colors"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Opportunities Page ───────────────────────────────────────────────────────

function OpportunitiesPage({ candidateId }: { candidateId: string }) {
  const [intros, setIntros] = useState<IntroRequest[] | null>(null);
  const [responding, setResponding] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  useEffect(() => {
    console.log('[OpportunitiesPage] Fetching intros for candidateId:', candidateId);
    fetch(`/api/candidate-intros?candidateId=${encodeURIComponent(candidateId)}`)
      .then(async r => {
        const data = await r.json();
        console.log('[OpportunitiesPage] API response status:', r.status, '| data:', data);
        if (!r.ok) {
          console.error('[candidate-intros] API error:', data);
          setIntros([]);
          return;
        }
        setIntros((data.requests as IntroRequest[]) || []);
      })
      .catch(err => { console.error('[candidate-intros] fetch error:', err); setIntros([]); });
  }, [candidateId]);

  const respond = async (introId: string, accept: boolean) => {
    setResponding(introId);
    try {
      // Use the service-role API endpoint — the anon Supabase client cannot
      // update introduction_requests due to RLS (candidate_id ≠ auth.uid())
      await fetch(`/api/respond-to-intro?introId=${introId}&response=${accept ? 'yes' : 'no'}`);
    } catch (e) {
      console.error('[respond]', e);
    }
    setIntros(prev => prev?.map(i => i.id === introId ? { ...i, status: accept ? 'approved' : 'rejected' } : i) || null);
    setConfirmed(introId);
    setResponding(null);
    setTimeout(() => setConfirmed(null), 4000);
  };

  if (intros === null) return (
    <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-[#9CA3AF]" /></div>
  );

  const pending = intros.filter(i => i.status === 'pending').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-[22px] font-semibold text-[#0A0A0A]">Introduction Requests</h1>
        {intros.length > 0 && (
          <span className="bg-[#F3F4F6] text-[#374151] text-xs font-semibold px-2.5 py-1 rounded-full">{intros.length}</span>
        )}
      </div>

      {intros.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F3F4F6] flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-6 h-6 text-[#D1D5DB]" />
          </div>
          <p className="text-[15px] font-semibold text-[#0A0A0A] mb-2">No introduction requests yet</p>
          <p className="text-sm text-[#6B7280] max-w-xs mx-auto leading-relaxed mb-4">
            When a recruiter is interested in your profile, you'll receive an email and a notification here.
          </p>
          <p className="text-xs text-[#9CA3AF] max-w-xs mx-auto leading-relaxed">
            💡 Make sure your profile is complete and you're set to <strong>Active</strong> to get discovered.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {intros.map(req => {
            const job = req.jobs;
            const statusMap: Record<string, { label: string; cls: string }> = {
              pending:  { label: 'Awaiting your response', cls: 'bg-[#FEF3C7] text-[#92400E]' },
              approved: { label: 'Introduction made',      cls: 'bg-[#F0FDF4] text-[#065F46]'  },
              rejected: { label: 'You passed',             cls: 'bg-[#F3F4F6] text-[#6B7280]'  },
            };
            const s = statusMap[req.status] ?? statusMap['pending'];

            return (
              <div key={req.id} className="bg-white border border-[#E5E7EB] rounded-xl p-6">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <p className="text-[15px] font-semibold text-[#0A0A0A] leading-snug">
                      {job?.title || 'Finance Role'}{job?.company ? ` — ${job.company}` : ''}
                    </p>
                    {job?.salary_range && (
                      <p className="text-sm text-[#0F6E56] font-medium mt-0.5">{job.salary_range}</p>
                    )}
                  </div>
                  <p className="text-[13px] text-[#9CA3AF] shrink-0 whitespace-nowrap">
                    {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${s.cls}`}>
                  {s.label}
                </span>

                {req.status === 'pending' && (
                  confirmed === req.id ? (
                    <div className="mt-4 flex items-center gap-2 text-sm text-[#0F6E56] font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Response recorded. The recruiter has been notified.
                    </div>
                  ) : (
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => respond(req.id, true)}
                        disabled={responding === req.id}
                        className="flex items-center gap-1.5 bg-[#0F6E56] hover:bg-[#0a5942] disabled:opacity-60 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                      >
                        {responding === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '✓'} Accept
                      </button>
                      <button
                        onClick={() => respond(req.id, false)}
                        disabled={responding === req.id}
                        className="flex items-center gap-1.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] disabled:opacity-60 text-[#374151] rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                      >
                        <X className="w-3.5 h-3.5" /> Decline
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
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────

function SettingsPage({ candidate, onSignOut }: { candidate: CandidateRow; onSignOut: () => void }) {
  const [phone, setPhone] = useState(candidate.phone || '');
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const saveContact = async () => {
    setSaving(true);
    await (supabase as any).from('candidates').update({ phone }).eq('id', candidate.id);
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const deleteProfile = async () => {
    setDeleting(true);
    await (supabase as any).from('candidates').update({ status: 'deleted' }).eq('id', candidate.id);
    await supabase.auth.signOut();
    window.location.href = '/apply';
  };

  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-semibold text-[#0A0A0A]">Settings</h1>

      {/* Contact info */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
        <h2 className="text-[15px] font-semibold text-[#0A0A0A] mb-4">Contact Info</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1.5">Email</label>
            <input
              type="email"
              value={candidate.email}
              readOnly
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-[#6B7280] bg-[#F9FAFB] cursor-not-allowed"
            />
            <p className="text-xs text-[#9CA3AF] mt-1">This is how we contact you</p>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#6B7280] uppercase tracking-wider mb-1.5">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-[#0A0A0A] bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6E56]"
            />
          </div>
          <div className="flex items-center gap-3">
            {savedFlash && (
              <span className="flex items-center gap-1.5 text-sm text-[#0F6E56] font-medium">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            )}
            <button
              onClick={saveContact}
              disabled={saving}
              className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#0a5942] disabled:opacity-60 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Update
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
        <h2 className="text-[15px] font-semibold text-[#0A0A0A] mb-4">Notifications</h2>
        <div className="space-y-3 opacity-50 pointer-events-none">
          {[
            { label: 'Email notifications', value: true, note: 'ON' },
            { label: 'SMS notifications', value: false, note: 'Coming soon' },
          ].map(n => (
            <div key={n.label} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-[#0A0A0A]">{n.label}</p>
                <p className="text-xs text-[#9CA3AF]">{n.note}</p>
              </div>
              <div className={`w-10 h-6 rounded-full ${n.value ? 'bg-[#0F6E56]' : 'bg-[#E5E7EB]'} relative`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${n.value ? 'right-1' : 'left-1'}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Account */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
        <h2 className="text-[15px] font-semibold text-[#0A0A0A] mb-4">Account</h2>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
        >
          Delete My Profile
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
            <h3 className="text-[17px] font-semibold text-[#0A0A0A] mb-2">Delete your profile?</h3>
            <p className="text-sm text-[#6B7280] leading-relaxed mb-6">
              This will permanently remove your profile from SFC Talent and you will no longer be discoverable by recruiters.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteProfile}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard Layout ─────────────────────────────────────────────────────────

function DashboardLayout({ candidate, skills, onSignOut, onUpdate }: {
  candidate: CandidateRow;
  skills: string[];
  onSignOut: () => void;
  onUpdate: (u: Partial<CandidateRow>) => void;
}) {
  const [page, setPage] = useState<NavPage>('profile');
  const [intros, setIntros] = useState<IntroRequest[]>([]);
  const [availSaving, setAvailSaving] = useState(false);
  const [availSaved, setAvailSaved] = useState(false);
  const [open, setOpen] = useState(!!candidate.open_to_opportunities);

  // Load intros for sidebar badge count
  useEffect(() => {
    console.log('[DashboardLayout] Fetching intros for candidateId:', candidate.id);
    fetch(`/api/candidate-intros?candidateId=${encodeURIComponent(candidate.id)}`)
      .then(async r => {
        const data = await r.json();
        if (r.ok) setIntros((data.requests as IntroRequest[]) || []);
      })
      .catch(() => {});
  }, [candidate.id]);

  const pendingCount = intros.filter(i => i.status === 'pending').length;

  const toggleAvail = async (val: boolean) => {
    setOpen(val);
    setAvailSaving(true);
    await (supabase as any).from('candidates').update({ open_to_opportunities: val }).eq('id', candidate.id);
    onUpdate({ open_to_opportunities: val });
    setAvailSaving(false);
    setAvailSaved(true);
    setTimeout(() => setAvailSaved(false), 1500);
  };

  const navItems: { id: NavPage; label: string; Icon: React.ElementType }[] = [
    { id: 'profile',       label: 'My Profile',    Icon: User   },
    { id: 'opportunities', label: 'Opportunities',  Icon: Inbox  },
    { id: 'settings',      label: 'Settings',       Icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-[#F9FAFB]">
      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden md:flex w-[240px] shrink-0 bg-[#0A0A0A] flex-col fixed top-0 left-0 h-full z-20">
        <div className="px-4 pt-6 pb-2">
          <p className="text-white text-[15px] font-semibold tracking-tight">SFC Talent</p>
          <p className="text-[#6B7280] text-[12px] mt-0.5 truncate">{candidate.label || 'Finance Professional'}</p>
        </div>

        {/* Nav */}
        <nav className="mt-8 px-2 space-y-0.5 flex-1">
          {navItems.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors relative ${
                page === id ? 'bg-[#1A1A1A] text-white' : 'text-[#6B7280] hover:bg-[#111111] hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {id === 'opportunities' && pendingCount > 0 && (
                <span className="ml-auto w-5 h-5 rounded-full bg-[#0F6E56] text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-4 pb-6 mt-auto">
          {/* Availability toggle */}
          <div className="mb-4">
            <p className="text-[11px] text-[#6B7280] uppercase tracking-wider mb-2">Availability</p>
            <div className="flex gap-1.5">
              <button
                onClick={() => toggleAvail(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${open ? 'bg-[#0F6E56] text-white' : 'bg-[#1A1A1A] text-[#6B7280] hover:bg-[#222]'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />Active
              </button>
              <button
                onClick={() => toggleAvail(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!open ? 'bg-[#374151] text-white' : 'bg-[#1A1A1A] text-[#6B7280] hover:bg-[#222]'}`}
              >
                ⏸ Paused
              </button>
            </div>
            {availSaving && <p className="text-[11px] text-[#6B7280] mt-1.5">Saving…</p>}
            {availSaved && <p className="text-[11px] text-[#0F6E56] mt-1.5">✓ Saved</p>}
          </div>

          <div className="border-t border-[#1A1A1A] pt-4">
            <button
              onClick={onSignOut}
              className="flex items-center gap-2 text-[#6B7280] hover:text-white text-[13px] font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 md:ml-[240px] min-h-screen">
        <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
          {page === 'profile' && (
            <ProfilePage candidate={candidate} skills={skills} onUpdate={onUpdate} />
          )}
          {page === 'opportunities' && (
            <OpportunitiesPage candidateId={candidate.id} />
          )}
          {page === 'settings' && (
            <SettingsPage candidate={candidate} onSignOut={onSignOut} />
          )}
        </div>
      </main>

      {/* ── Bottom tab bar (mobile) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0A0A0A] border-t border-[#1A1A1A] flex z-20">
        {navItems.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-medium transition-colors relative ${
              page === id ? 'text-white' : 'text-[#6B7280]'
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
            {id === 'opportunities' && pendingCount > 0 && (
              <span className="absolute top-2 right-[calc(50%-14px)] w-4 h-4 rounded-full bg-[#0F6E56] text-white text-[9px] font-bold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

type View = 'loading' | 'signin' | 'dashboard' | 'no-profile';

export default function CandidateDashboard() {
  const [view, setView] = useState<View>('loading');
  const [candidate, setCandidate] = useState<CandidateRow | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [userEmail, setUserEmail] = useState<string>('');
  // Prevent double-fetch when getSession + onAuthStateChange(SIGNED_IN) both fire on load
  const fetchInProgress = useRef(false);

  const fetchCandidateByEmail = useCallback(async (email: string) => {
    if (fetchInProgress.current) return;
    fetchInProgress.current = true;
    setUserEmail(email);

    console.log('[CandidateDashboard] fetchCandidateByEmail:', email);

    try {
      const response = await fetch(`/api/candidate-profile?email=${encodeURIComponent(email.toLowerCase().trim())}`);

      console.log('[CandidateDashboard] /api/candidate-profile status:', response.status);

      if (response.status === 404) {
        setView('no-profile');
        return;
      }

      if (!response.ok) {
        console.error('[CandidateDashboard] API error:', response.status);
        setView('no-profile');
        return;
      }

      const { candidate } = await response.json();
      console.log('[CandidateDashboard] candidate id:', candidate?.id);

      const extracted: string[] = ((candidate.candidate_skills as SkillRow[]) || [])
        .map((r: SkillRow) => r.skills?.skill || '').filter(Boolean);
      setCandidate(candidate as CandidateRow);
      setSkills(extracted);
      setView('dashboard');

      // Send welcome email on first dashboard sign-in (idempotent — API skips if already sent)
      fetch('/api/send-candidate-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() }),
      }).catch(() => {});
    } catch (err) {
      console.error('[CandidateDashboard] fetch error:', err);
      setView('no-profile');
    } finally {
      fetchInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    // Single mount effect: check existing session first, then listen for new sign-ins.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        fetchCandidateByEmail(session.user.email);
      } else {
        setView('signin');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.email) {
        // fires on fresh OAuth redirect; fetchInProgress guard prevents double-call
        fetchCandidateByEmail(session.user.email);
      }
      if (event === 'SIGNED_OUT') {
        fetchInProgress.current = false;
        setView('signin');
        setCandidate(null);
        setSkills([]);
        setUserEmail('');
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchCandidateByEmail]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // SIGNED_OUT event handles state reset above
  };

  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#9CA3AF]" />
      </div>
    );
  }

  if (view === 'signin') return <GoogleSignInScreen />;

  if (view === 'no-profile') {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center px-6">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-10 w-full max-w-sm text-center shadow-sm">
          <p className="font-semibold text-[15px] text-[#0A0A0A]">SFC Talent</p>
          <h1 className="text-xl font-semibold text-[#0A0A0A] mt-5 mb-2">Looks like you haven't applied yet</h1>
          <p className="text-sm text-[#6B7280] leading-relaxed mb-4">
            No profile found for <strong>{userEmail}</strong>.
          </p>
          <p className="text-sm text-[#6B7280] leading-relaxed mb-6">
            Complete your application to join the network. Or sign out and try a different Google account.
          </p>
          <a
            href="/apply"
            className="block w-full text-center bg-[#0F6E56] hover:bg-[#0a5942] text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors mb-3"
          >
            Complete Your Application →
          </a>
          <button
            onClick={handleSignOut}
            className="w-full bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
          >
            Sign out and try a different account
          </button>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      candidate={candidate!}
      skills={skills}
      onSignOut={handleSignOut}
      onUpdate={u => setCandidate(c => c ? { ...c, ...u } : c)}
    />
  );
}
