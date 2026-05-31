import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import LoaderScreen from '../components/LoaderScreen';

// Browser-side LinkedIn URL validation — must contain `linkedin.com/in/`.
// Server (api/recruiter-signup) re-validates the same pattern.
const LINKEDIN_PATTERN = /linkedin\.com\/in\//i;

const SignUp = () => {
  // ── Signup tab state (existing) ─────────────────────────────────────────
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [company, setCompany] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Sign-in tab state (new) ──────────────────────────────────────────────
  // Separate from the signup fields so toggling tabs doesn't reset the
  // signup form data.
  const [signinEmail, setSigninEmail] = useState('');
  const [signinPassword, setSigninPassword] = useState('');
  const [signinShowPassword, setSigninShowPassword] = useState(false);
  const [signinLoading, setSigninLoading] = useState(false);
  const [signinError, setSigninError] = useState<string | null>(null);

  // ── Auth tab (Create Account / Sign In), mirrors CandidateApply pattern ─
  // Initial value honors ?mode=signin so the landing's "Recruiter login"
  // and the verify-email return can deep-link straight to the Sign In tab.
  // Default (no param, or any non-'signin' value) = 'signup'.
  const [authTab, setAuthTab] = useState<'signup' | 'signin'>(() => {
    if (typeof window === 'undefined') return 'signup';
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'signin' ? 'signin' : 'signup';
  });

  const { login, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // If they hit /signup while already signed in as an approved recruiter,
    // bounce them to the app. Pending/rejected statuses are handled by
    // ProtectedRoute redirects elsewhere; not relevant on this public route.
    if (user && (user.recruiter_status === 'approved' || user.recruiter_status == null)) {
      navigate('/start-here', { replace: true });
    }
  }, [user, navigate]);

  if (isLoading) return <LoaderScreen />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation. Server re-validates everything.
    if (!LINKEDIN_PATTERN.test(linkedinUrl.trim())) {
      setError('Please enter a valid LinkedIn profile URL (must contain linkedin.com/in/)');
      return;
    }
    if (!company.trim()) {
      setError('Company is required.');
      return;
    }

    setLocalLoading(true);
    try {
      // 1. Create the auth user.
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { first_name: firstName.trim(), last_name: lastName.trim() },
          // After the recruiter clicks the email verification link, land
          // them back on /signup with the Sign In tab pre-selected.
          // Previously this was unset → Supabase used the project Site
          // URL (app root), which gave a Home-page flash before the user
          // figured out where to sign in.
          emailRedirectTo: 'https://sfc-recruiter-portal.vercel.app/signup?mode=signin',
        },
      });
      if (signUpError) throw new Error(signUpError.message);

      const authUserId = signUpData.user?.id;
      if (!authUserId) throw new Error('Sign-up succeeded but no user id was returned. Try again.');

      // 2. Insert public.users + fire admin notify + applicant confirmation
      //    emails via service-role API. Server enforces LinkedIn regex
      //    again, sets role_id=recruiter, recruiter_status='pending'.
      const apiRes = await fetch('/api/recruiter-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authUserId,
          email: email.trim().toLowerCase(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          linkedin_url: linkedinUrl.trim(),
          company: company.trim(),
        }),
      });
      const apiBody = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok) throw new Error(apiBody.error || `Signup API failed (${apiRes.status})`);

      // 3. Sign out the unverified session so they don't end up half-authed
      //    on /signup/pending. They'll sign in once approved.
      await supabase.auth.signOut().catch(() => {});

      // 4. Land on the pending page.
      navigate('/signup/pending', { replace: true });
    } catch (err: any) {
      console.error('[SignUp] submit error:', err);
      setError(err?.message || 'Something went wrong. Please try again.');
      toast({
        title: 'Signup failed',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLocalLoading(false);
    }
  };

  // ── Sign In handler ───────────────────────────────────────────────────
  // Recruiter auth path: AuthContext.login → supabase.auth.signInWithPassword.
  // On success the useEffect above watching `user` will navigate
  // approved recruiters to /start-here; ProtectedRoute on any other
  // authed route handles pending → /signup/pending and rejected →
  // /signup/rejected.
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigninError(null);
    setSigninLoading(true);
    try {
      const ok = await login(signinEmail.trim().toLowerCase(), signinPassword);
      if (!ok) {
        setSigninError('Invalid email or password.');
      }
      // navigate() is fired by the useEffect once AuthContext fetches
      // the user profile. If we navigate here too we race the effect.
    } finally {
      setSigninLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — form ── */}
      <div className="w-full lg:w-[480px] xl:w-[540px] flex flex-col bg-[#f8f8f8] px-10 py-12 shrink-0">
        <div className="mb-10">
          <span className="font-bold text-lg text-gray-900 tracking-tight">SFC Talent</span>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto lg:mx-0">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">
            {authTab === 'signup' ? 'Apply as a recruiter' : 'Welcome back'}
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            {authTab === 'signup'
              ? 'We vet every recruiter to keep quality high. Approval usually takes 1–2 business days.'
              : 'Sign in to your recruiter account.'}
          </p>

          {/* Tab toggle — same pattern as /apply auth screen */}
          <div className="flex border-b border-gray-200 mb-6">
            {(['signup', 'signin'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setAuthTab(tab);
                  setError(null);
                  setSigninError(null);
                }}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  authTab === tab
                    ? 'border-b-2 border-emerald-600 text-emerald-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'signup' ? 'Create Account' : 'Sign In'}
              </button>
            ))}
          </div>

          {authTab === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={signinEmail}
                  onChange={e => setSigninEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={signinShowPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={signinPassword}
                    onChange={e => setSigninPassword(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setSigninShowPassword(v => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {signinShowPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {signinError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">{signinError}</p>
              )}

              <button
                type="submit"
                disabled={signinLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors mt-1"
              >
                {signinLoading ? 'Signing in…' : 'Sign in'}
              </button>

              <div className="flex items-center justify-between mt-2 text-xs">
                <Link to="/forgot-password?audience=recruiter" className="text-gray-400 hover:text-gray-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">First name</label>
                <input
                  type="text"
                  placeholder="Jane"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1.5">Last name</label>
                <input
                  type="text"
                  placeholder="Smith"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1.5">Work email</label>
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1.5">Company</label>
              <input
                type="text"
                placeholder="Acme Capital"
                value={company}
                onChange={e => setCompany(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1.5">LinkedIn profile URL</label>
              <input
                type="url"
                placeholder="https://www.linkedin.com/in/janesmith"
                value={linkedinUrl}
                onChange={e => setLinkedinUrl(e.target.value)}
                required
                pattern=".*linkedin\.com/in/.*"
                title="Must contain linkedin.com/in/"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">We use this for vetting only — never shared with candidates.</p>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">{error}</p>
            )}

            <button
              type="submit"
              disabled={localLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors mt-1"
            >
              {localLoading ? 'Submitting application…' : 'Submit application'}
            </button>
          </form>
          )}
          {/* End authTab ternary */}

          <p className="text-sm text-center text-gray-500 mt-5">
            {authTab === 'signup' ? (
              <>
                Have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthTab('signin'); setError(null); setSigninError(null); }}
                  className="text-emerald-600 hover:underline font-medium"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Need to apply?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthTab('signup'); setError(null); setSigninError(null); }}
                  className="text-emerald-600 hover:underline font-medium"
                >
                  Create account
                </button>
              </>
            )}
          </p>
        </div>

        <p className="text-xs text-gray-400 mt-10 leading-relaxed max-w-sm mx-auto lg:mx-0">
          By continuing, you agree to SFC Talent's{' '}
          <a href="https://strategicfinancecareers.com" className="underline hover:text-gray-600">Terms of Service</a>
          {' '}and{' '}
          <a href="https://strategicfinancecareers.com" className="underline hover:text-gray-600">Privacy Policy</a>.
        </p>
      </div>

      {/* ── Right panel — testimonial ── */}
      <div className="hidden lg:flex flex-1 bg-white items-center justify-center px-16">
        <div className="max-w-md">
          <div className="text-gray-200 text-6xl font-serif leading-none mb-6 select-none">"</div>
          <blockquote className="text-2xl font-medium text-gray-900 leading-snug mb-6">
            The most efficient way I've found quality finance talent. The candidates are pre-vetted and actually responsive.
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
              MR
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Michael R.</p>
              <p className="text-xs text-gray-400">VP Finance, Series B startup</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
