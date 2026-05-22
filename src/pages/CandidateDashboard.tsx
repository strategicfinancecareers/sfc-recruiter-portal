import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  User, Briefcase, MapPin, GraduationCap, Mail, Phone,
  Edit2, Save, X, Loader2, CheckCircle2, Shield, LogOut,
  Trash2, ChevronDown, ChevronUp, Bell, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ─── Supabase client (anon key — safe for frontend) ──────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface Candidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  label?: string;
  location?: string;
  experience?: number;
  education?: string;
  profile_description?: string;
  open_to_opportunities?: boolean;
  created_at?: string;
}

interface Skill {
  skill: string;
}

interface IntroRequest {
  id: string;
  created_at: string;
  status: string;
  notes?: string;
}

const JOB_SEARCH_OPTIONS = [
  'Actively looking',
  'Open to opportunities',
  'Not looking right now',
];

const WORK_PREF_OPTIONS = ['Remote', 'Hybrid', 'On-site', 'Flexible'];

const TARGET_COMP_OPTIONS = [
  '$70k–$100k', '$100k–$130k', '$130k–$160k',
  '$160k–$200k', '$200k–$250k', '$250k+',
];

const US_CITIES = [
  'New York', 'San Francisco', 'Los Angeles', 'Chicago', 'Boston',
  'Seattle', 'Austin', 'Miami', 'Denver', 'Atlanta', 'Dallas', 'Washington D.C.',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractBio(profileDescription?: string): string {
  if (!profileDescription) return '';
  return profileDescription.split('\n\n')[0] || '';
}

function extractMetaLine(profileDescription?: string): string {
  if (!profileDescription) return '';
  const parts = profileDescription.split('\n\n');
  return parts.slice(1).join(' ').trim();
}

function parseMeta(metaLine: string) {
  const get = (key: string) => {
    const re = new RegExp(key + ': ([^.]+)\\.?');
    return metaLine.match(re)?.[1]?.trim() || '';
  };
  return {
    jobSearchStatus: get('Job search status'),
    targetComp: get('Target comp'),
    workPreference: get('Work preference'),
    preferredCities: get('Preferred cities')
      ? get('Preferred cities').split(',').map(s => s.trim()).filter(Boolean)
      : [],
  };
}

// ─── Loading screen ───────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Loading your dashboard…</p>
      </div>
    </div>
  );
}

// ─── Magic link gate ──────────────────────────────────────────────────────────
function MagicLinkGate({ onSent }: { onSent: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/candidate-dashboard` },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    onSent(email.trim());
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
            <Shield className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Candidate Dashboard</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Enter your email to receive a secure sign-in link. No password required.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="magic-email" className="text-sm font-medium text-gray-700">Email address</Label>
            <Input
              id="magic-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              className="mt-1"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleSend}
            disabled={loading || !email.trim()}
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending…</> : 'Send sign-in link'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MagicLinkSent({ email }: { email: string }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
          <Mail className="w-7 h-7 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Check your inbox</h2>
        <p className="text-gray-500 leading-relaxed">
          We sent a sign-in link to <strong className="text-gray-700">{email}</strong>.
          Click the link in that email to open your dashboard.
        </p>
        <p className="text-sm text-gray-400 mt-4">The link expires in 1 hour.</p>
      </div>
    </div>
  );
}

// ─── Profile Preview Card ─────────────────────────────────────────────────────
function ProfilePreview({ candidate, skills }: { candidate: Candidate; skills: Skill[] }) {
  const bio = extractBio(candidate.profile_description);
  const meta = parseMeta(extractMetaLine(candidate.profile_description));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg leading-tight">{candidate.label || 'Finance Professional'}</h3>
          <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />{candidate.location || 'United States'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-full text-xs font-medium text-emerald-700">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {candidate.open_to_opportunities ? 'Open to opportunities' : 'Not looking'}
        </div>
      </div>

      {bio && (
        <p className="text-sm text-gray-600 leading-relaxed mb-4 line-clamp-3">{bio}</p>
      )}

      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {skills.slice(0, 8).map(s => (
            <span key={s.skill} className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
              {s.skill}
            </span>
          ))}
          {skills.length > 8 && (
            <span className="px-2.5 py-1 bg-gray-100 text-gray-400 rounded-full text-xs">+{skills.length - 8} more</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
        {candidate.experience != null && (
          <div className="flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5" />
            {candidate.experience}+ years experience
          </div>
        )}
        {candidate.education && (
          <div className="flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5" />
            {candidate.education.length > 22 ? candidate.education.slice(0, 22) + '…' : candidate.education}
          </div>
        )}
        {meta.workPreference && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {meta.workPreference}
          </div>
        )}
        {meta.targetComp && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">$</span>
            {meta.targetComp}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
        <Shield className="w-3.5 h-3.5" />
        Your name and contact info are hidden from recruiters
      </div>
    </div>
  );
}

// ─── Edit Profile Form ────────────────────────────────────────────────────────
function EditProfileForm({
  candidate,
  skills,
  token,
  onSaved,
  onCancel,
}: {
  candidate: Candidate;
  skills: Skill[];
  token: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const bio = extractBio(candidate.profile_description);
  const meta = parseMeta(extractMetaLine(candidate.profile_description));

  const [form, setForm] = useState({
    bio,
    currentRole: candidate.label || '',
    location: candidate.location || '',
    email: candidate.email || '',
    phone: candidate.phone || '',
    jobSearchStatus: meta.jobSearchStatus || '',
    targetComp: meta.targetComp || '',
    workPreference: meta.workPreference || '',
    preferredCities: meta.preferredCities || [] as string[],
    openToOpportunities: candidate.open_to_opportunities ?? true,
  });
  const [skillList, setSkillList] = useState<string[]>(skills.map(s => s.skill));
  const [newSkill, setNewSkill] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleCity = (city: string) => {
    setForm(f => ({
      ...f,
      preferredCities: f.preferredCities.includes(city)
        ? f.preferredCities.filter(c => c !== city)
        : [...f.preferredCities, city],
    }));
  };

  const addSkill = () => {
    const trimmed = newSkill.trim();
    if (!trimmed || skillList.includes(trimmed)) return;
    setSkillList(prev => [...prev, trimmed]);
    setNewSkill('');
  };

  const removeSkill = (skill: string) => setSkillList(prev => prev.filter(s => s !== skill));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/update-candidate-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, skills: skillList }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bio */}
      <div>
        <Label className="text-sm font-semibold text-gray-700">Professional Summary</Label>
        <textarea
          className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none min-h-[100px]"
          value={form.bio}
          onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
          placeholder="Describe your background and what you're looking for…"
        />
      </div>

      {/* Role + Location */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-semibold text-gray-700">Current Role / Title</Label>
          <Input
            className="mt-1"
            value={form.currentRole}
            onChange={e => setForm(f => ({ ...f, currentRole: e.target.value }))}
            placeholder="e.g. Senior FP&A Manager"
          />
        </div>
        <div>
          <Label className="text-sm font-semibold text-gray-700">Location</Label>
          <Input
            className="mt-1"
            value={form.location}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            placeholder="e.g. New York, NY"
          />
        </div>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-semibold text-gray-700">Email</Label>
          <Input
            className="mt-1"
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-sm font-semibold text-gray-700">Phone</Label>
          <Input
            className="mt-1"
            type="tel"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="+1 (555) 000-0000"
          />
        </div>
      </div>

      {/* Availability */}
      <div>
        <Label className="text-sm font-semibold text-gray-700">Job Search Status</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {JOB_SEARCH_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setForm(f => ({ ...f, jobSearchStatus: f.jobSearchStatus === opt ? '' : opt }))}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                form.jobSearchStatus === opt
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm font-semibold text-gray-700">Target Compensation</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {TARGET_COMP_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setForm(f => ({ ...f, targetComp: f.targetComp === opt ? '' : opt }))}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                form.targetComp === opt
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm font-semibold text-gray-700">Work Preference</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {WORK_PREF_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setForm(f => ({ ...f, workPreference: f.workPreference === opt ? '' : opt }))}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                form.workPreference === opt
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm font-semibold text-gray-700">Preferred Cities</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {US_CITIES.map(city => (
            <button
              key={city}
              type="button"
              onClick={() => toggleCity(city)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                form.preferredCities.includes(city)
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-400'
              }`}
            >
              {city}
            </button>
          ))}
        </div>
      </div>

      {/* Open to opportunities toggle */}
      <div className="flex items-center justify-between py-3 border-t border-gray-100">
        <div>
          <p className="text-sm font-semibold text-gray-700">Open to opportunities</p>
          <p className="text-xs text-gray-400 mt-0.5">Controls whether your profile appears in recruiter searches</p>
        </div>
        <button
          type="button"
          onClick={() => setForm(f => ({ ...f, openToOpportunities: !f.openToOpportunities }))}
          className={`relative w-11 h-6 rounded-full transition-colors ${form.openToOpportunities ? 'bg-emerald-500' : 'bg-gray-200'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.openToOpportunities ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      {/* Skills */}
      <div>
        <Label className="text-sm font-semibold text-gray-700">Skills</Label>
        <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
          {skillList.map(skill => (
            <span key={skill} className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
              {skill}
              <button type="button" onClick={() => removeSkill(skill)} className="text-gray-400 hover:text-red-500 ml-0.5">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newSkill}
            onChange={e => setNewSkill(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
            placeholder="Add a skill…"
            className="text-sm"
          />
          <Button type="button" variant="outline" size="sm" onClick={addSkill} className="shrink-0">Add</Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex gap-3 pt-2">
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function CandidateDashboard() {
  const [authState, setAuthState] = useState<'loading' | 'gate' | 'sent' | 'authed'>('loading');
  const [sentEmail, setSentEmail] = useState('');
  const [token, setToken] = useState('');

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [introRequests, setIntroRequests] = useState<IntroRequest[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'profile' | 'activity' | 'settings'>('profile');
  const [editing, setEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Expand/collapse profile preview
  const [previewExpanded, setPreviewExpanded] = useState(true);

  // ── Handle auth state ───────────────────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.access_token) {
        setToken(session.access_token);
        setAuthState('authed');
      } else if (authState !== 'sent') {
        setAuthState('gate');
      }
    });

    // Also check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        setToken(session.access_token);
        setAuthState('authed');
      } else {
        setAuthState('gate');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Load candidate data ─────────────────────────────────────────────────────
  const loadData = useCallback(async (tok: string) => {
    setDataLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser(tok);
      if (!user?.email) return;

      const { data: cand } = await supabase
        .from('candidates')
        .select('*')
        .eq('email', user.email)
        .single();

      if (cand) {
        setCandidate(cand);

        // Load skills
        const { data: cs } = await supabase
          .from('candidate_skills')
          .select('skill_id, skills(skill)')
          .eq('candidate_id', cand.id);
        if (cs) {
          setSkills(cs.map((row: any) => ({ skill: row.skills?.skill || '' })).filter(s => s.skill));
        }

        // Load intro requests (if table exists)
        try {
          const { data: reqs } = await supabase
            .from('introduction_requests')
            .select('id, created_at, status, notes')
            .eq('candidate_id', cand.id)
            .order('created_at', { ascending: false })
            .limit(20);
          if (reqs) setIntroRequests(reqs);
        } catch {
          // Table may not exist yet
        }
      }
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authState === 'authed' && token) {
      loadData(token);
    }
  }, [authState, token, loadData]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuthState('gate');
    setToken('');
    setCandidate(null);
  };

  const handleSaved = async () => {
    setEditing(false);
    setSaveSuccess(true);
    await loadData(token);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/delete-candidate-profile', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete');
      await supabase.auth.signOut();
      setAuthState('gate');
      setCandidate(null);
      setDeleteConfirm(false);
    } catch (err: any) {
      console.error(err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Render states ───────────────────────────────────────────────────────────
  if (authState === 'loading') return <LoadingScreen />;
  if (authState === 'gate') return <MagicLinkGate onSent={email => { setSentEmail(email); setAuthState('sent'); }} />;
  if (authState === 'sent') return <MagicLinkSent email={sentEmail} />;

  if (dataLoading || !candidate) {
    return <LoadingScreen />;
  }

  // ── Authenticated dashboard ─────────────────────────────────────────────────
  const memberSince = candidate.created_at
    ? new Date(candidate.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg text-gray-900 tracking-tight">SFC Talent</span>
            <span className="text-gray-300">|</span>
            <span className="text-sm text-gray-500">My Dashboard</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Hi, {candidate.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">Member since {memberSince}</p>
        </div>

        {/* Save success toast */}
        {saveSuccess && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Profile updated successfully!
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
          {(['profile', 'activity', 'settings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setEditing(false); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Profile Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            {/* Profile preview collapsible */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <button
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setPreviewExpanded(e => !e)}
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold text-gray-700 text-sm">How recruiters see your profile</span>
                </div>
                {previewExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {previewExpanded && (
                <div className="px-6 pb-6">
                  <ProfilePreview candidate={candidate} skills={skills} />
                </div>
              )}
            </div>

            {/* Edit form */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-gray-900">Profile Details</h2>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                )}
              </div>

              {editing ? (
                <EditProfileForm
                  candidate={candidate}
                  skills={skills}
                  token={token}
                  onSaved={handleSaved}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <div className="space-y-3 text-sm">
                  {[
                    { icon: User, label: 'Name', value: candidate.name },
                    { icon: Briefcase, label: 'Role', value: candidate.label },
                    { icon: MapPin, label: 'Location', value: candidate.location },
                    { icon: Mail, label: 'Email', value: candidate.email },
                    { icon: Phone, label: 'Phone', value: candidate.phone || '—' },
                    { icon: GraduationCap, label: 'Education', value: candidate.education },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                      <Icon className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />
                      <span className="text-gray-400 w-20 shrink-0">{label}</span>
                      <span className="text-gray-700">{value || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Activity Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'activity' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Bell className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Introduction Requests</h2>
            </div>

            {introRequests.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm">No introduction requests yet.</p>
                <p className="text-gray-400 text-xs mt-1">When a recruiter wants to connect, you'll see it here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {introRequests.map(req => (
                  <div key={req.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Introduction Request</p>
                      {req.notes && <p className="text-xs text-gray-500 mt-0.5">{req.notes}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
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
        )}

        {/* ── Settings Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-1">Account</h2>
              <p className="text-sm text-gray-500 mb-5">{candidate.email}</p>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-3 border-t border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Sign in link</p>
                    <p className="text-xs text-gray-400 mt-0.5">Request a new magic link to your email</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await supabase.auth.signInWithOtp({
                        email: candidate.email,
                        options: { emailRedirectTo: `${window.location.origin}/candidate-dashboard` },
                      });
                    }}
                  >
                    Send link
                  </Button>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Sign out</p>
                    <p className="text-xs text-gray-400 mt-0.5">Sign out of this device</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleSignOut}>
                    <LogOut className="w-3.5 h-3.5 mr-1.5" />
                    Sign out
                  </Button>
                </div>
              </div>
            </div>

            {/* Danger zone */}
            <div className="bg-white rounded-2xl border border-red-100 p-6 shadow-sm">
              <h2 className="font-semibold text-red-600 mb-1">Danger Zone</h2>
              <p className="text-sm text-gray-500 mb-5">
                Permanently remove your profile and all associated data from SFC Talent.
              </p>

              {!deleteConfirm ? (
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => setDeleteConfirm(true)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete my profile
                </Button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-red-800 mb-1">Are you sure?</p>
                  <p className="text-xs text-red-600 mb-4">
                    This will permanently delete your profile, skills, and account. This cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      className="bg-red-600 hover:bg-red-700 text-white"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleteLoading}
                    >
                      {deleteLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Deleting…</> : 'Yes, delete everything'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(false)} disabled={deleteLoading}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
