import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import LoaderScreen from '../components/LoaderScreen';
import { normalizeLinkedInUrl, isValidLinkedInUrl, LINKEDIN_ERROR } from '@/lib/linkedin';

// /signup/complete — the recruiter OAuth completion step.
//
// Google sign-in gives us a verified session but no public.users row and
// none of the vetting fields (LinkedIn, company). The FAILED first attempt
// at Google auth auto-created users rows from bare sessions, which leaked
// candidate sessions into the recruiter table; the hard rule ever since:
// a public.users row is ONLY created through an explicit completion step
// that goes through /api/recruiter-signup.
//
// Both the recruiter "Continue with Google" buttons (Create Account AND
// Sign In tabs) land here. On mount we branch on what already exists:
//   no session                          -> /signup?mode=signin
//   users row, status approved or null  -> /start-here (returning recruiter)
//   users row, status pending           -> /signup/pending
//   users row, status rejected          -> /signup/rejected
//   session but NO users row            -> render the completion form
//
// A candidate using Google on /apply never lands here, so candidate
// sessions can't create recruiter rows. The server additionally blocks
// emails that already have a candidate profile (409 candidateConflict).

export default function SignUpComplete() {
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [sessionUser, setSessionUser] = useState<{ id: string; email: string } | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [company, setCompany] = useState('');
  const [jobPostingUrl, setJobPostingUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The OAuth PKCE code exchange can still be in flight on first paint;
      // getSession() after a short settle covers both direct visits and
      // the redirect back from Google.
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        await new Promise(r => setTimeout(r, 800));
        session = (await supabase.auth.getSession()).data.session;
      }
      if (cancelled) return;

      if (!session?.user?.email) {
        navigate('/signup?mode=signin', { replace: true });
        return;
      }

      // Existing recruiter? Route by status instead of re-collecting info.
      const { data: existing } = await supabase
        .from('users')
        .select('id, recruiter_status')
        .eq('id', session.user.id)
        .maybeSingle();
      if (cancelled) return;

      if (existing) {
        const s = (existing as any).recruiter_status;
        if (s === 'pending') navigate('/signup/pending', { replace: true });
        else if (s === 'rejected') navigate('/signup/rejected', { replace: true });
        else navigate('/start-here', { replace: true });
        return;
      }

      // New recruiter — prefill names from Google metadata, editable below.
      const meta: any = session.user.user_metadata || {};
      const full = (meta.full_name || meta.name || '').trim();
      const guessFirst = meta.given_name || meta.first_name || (full ? full.split(' ')[0] : '');
      const guessLast = meta.family_name || meta.last_name || (full ? full.split(' ').slice(1).join(' ') : '');
      setFirstName(guessFirst);
      setLastName(guessLast);
      setSessionUser({ id: session.user.id, email: session.user.email });
      setChecking(false);
    })().catch(err => {
      console.error('[SignUpComplete] session check failed:', err);
      navigate('/signup?mode=signin', { replace: true });
    });
    return () => { cancelled = true; };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser) return;
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    if (!isValidLinkedInUrl(linkedinUrl)) {
      setError(LINKEDIN_ERROR);
      return;
    }
    if (!company.trim()) {
      setError('Company is required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/recruiter-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authUserId: sessionUser.id,
          email: sessionUser.email.toLowerCase(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          linkedin_url: normalizeLinkedInUrl(linkedinUrl),
          company: company.trim(),
          job_posting_url: jobPostingUrl.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Signup failed (${res.status})`);
      navigate('/signup/pending', { replace: true });
    } catch (err: any) {
      console.error('[SignUpComplete] submit error:', err);
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) return <LoaderScreen />;

  return (
    <div className="min-h-screen bg-[#f8f8f8] flex flex-col items-center px-6 py-12">
      <div className="mb-10 self-start sm:self-center">
        <span className="font-bold text-lg text-gray-900 tracking-tight">SFC Talent</span>
      </div>
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Almost there</h1>
        <p className="text-sm text-gray-500 mb-6">
          You're signed in as <span className="font-medium text-gray-700">{sessionUser?.email}</span>.
          A few details so we can verify you as a recruiter. Approval usually takes 1 to 2 business days.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1.5">First name</label>
              <input
                type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#008037] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1.5">Last name</label>
              <input
                type="text" value={lastName} onChange={e => setLastName(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#008037] focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1.5">Company</label>
            <input
              type="text" value={company} onChange={e => setCompany(e.target.value)} required placeholder="Acme Capital"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#008037] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1.5">LinkedIn profile URL</label>
            <input
              type="text" value={linkedinUrl}
              onChange={e => setLinkedinUrl(e.target.value)}
              onBlur={() => setLinkedinUrl(normalizeLinkedInUrl(linkedinUrl))}
              required placeholder="linkedin.com/in/janesmith"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#008037] focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">We use this for vetting only. Never shared with candidates.</p>
          </div>

          <div>
            <label className="block text-sm text-gray-700 mb-1.5">
              Link to a live job posting <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text" value={jobPostingUrl} onChange={e => setJobPostingUrl(e.target.value)}
              placeholder="https://yourcompany.com/careers/role"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#008037] focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">A role you're hiring for, or your careers page. Helps us approve you faster.</p>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">{error}</p>
          )}

          <button
            type="submit" disabled={submitting}
            className="w-full bg-[#008037] hover:bg-[#006a2d] disabled:opacity-60 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors mt-1"
          >
            {submitting ? 'Submitting application…' : 'Submit application'}
          </button>
        </form>

        <button
          type="button"
          onClick={async () => { await supabase.auth.signOut().catch(() => {}); navigate('/signup', { replace: true }); }}
          className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-4"
        >
          Not you? Sign out
        </button>
      </div>
    </div>
  );
}
