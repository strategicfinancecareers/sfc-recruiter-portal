import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// ─── Set-new-password shared logic ────────────────────────────────────────────
//
// This component owns EVERY fragile part of the password-recovery flow so
// the two audience-themed wrapper pages (ResetPasswordProfessional,
// ResetPasswordRecruiter) only have to render their layout shell and pass
// `audience` in. Do not duplicate this logic anywhere.
//
// How the flow works:
//   1. The reset email Supabase sent contains a link like
//        https://app.example.com/reset-password#access_token=...&refresh_token=...&type=recovery&...
//      (Supabase puts the recovery token in the URL hash, not the search.)
//   2. The Supabase client is configured with detectSessionInUrl: true
//      (the default), so on page load it auto-parses the hash, exchanges
//      the recovery token for a session, fires onAuthStateChange with
//      event 'PASSWORD_RECOVERY', and stores the session in localStorage.
//   3. We check getSession() on mount. If a session exists → render the
//      new-password form. If not → assume the token expired or the user
//      hit the URL directly with no hash → show the "expired" state.
//   4. Submit calls supabase.auth.updateUser({ password }). On success
//      the session's password is now the new one; we route the user to
//      the audience-correct dashboard.
//
// Edge cases handled:
//   - Recovery link expired / invalid / consumed already → "Invalid or
//     expired link" panel with a link back to the right sign-in page.
//   - Missing token (user typed URL directly) → same panel.
//   - Password too short / mismatched confirm → inline validation.
//   - updateUser network error → inline error message, form re-enabled.

export type ResetAudience = 'professional' | 'recruiter';

interface Props {
  audience: ResetAudience;
}

type Phase = 'checking-session' | 'ready' | 'no-session' | 'submitting' | 'success' | 'error';

// Per-audience copy + post-success destination + back-to-signin URL.
// Centralised here so wrapper pages stay JSX-only and audience-specific
// strings don't drift between them.
const AUDIENCE: Record<ResetAudience, {
  signInPath: string;
  signInLabel: string;
  postSuccessPath: string;
  postSuccessLabel: string;
}> = {
  professional: {
    signInPath: '/apply?mode=signin',
    signInLabel: 'Back to professional sign in',
    postSuccessPath: '/candidate-dashboard',
    postSuccessLabel: 'Go to your dashboard',
  },
  recruiter: {
    signInPath: '/signup?mode=signin',
    signInLabel: 'Back to recruiter sign in',
    postSuccessPath: '/start-here',
    postSuccessLabel: 'Go to the recruiter portal',
  },
};

const MIN_PASSWORD_LENGTH = 8;

export default function SetNewPasswordForm({ audience }: Props) {
  const aud = AUDIENCE[audience];

  const [phase, setPhase] = useState<Phase>('checking-session');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // On mount: confirm Supabase established a recovery session from the
  // URL hash. detectSessionInUrl is true by default (verified — the
  // project's client.ts does not override it), so the hash is parsed
  // automatically.
  //
  // Timing race: detectSessionInUrl runs synchronously enough that
  // getSession() usually returns the recovery session by the time this
  // effect runs, but it's not guaranteed. If getSession() returns null
  // we DON'T immediately flip to 'no-session' — instead we also subscribe
  // to onAuthStateChange and wait for either PASSWORD_RECOVERY,
  // SIGNED_IN, or TOKEN_REFRESHED to fire. If nothing fires within a
  // short grace window, *then* we conclude the link is invalid.
  //
  // This eliminates the "shows expired then never recovers even though
  // the session lands a tick later" failure mode.
  useEffect(() => {
    let resolved = false;        // set once we transition out of 'checking-session'
    let graceTimer: number | undefined;

    const markReady = () => {
      if (resolved) return;
      resolved = true;
      if (graceTimer !== undefined) window.clearTimeout(graceTimer);
      setPhase('ready');
    };

    const markNoSession = () => {
      if (resolved) return;
      resolved = true;
      if (graceTimer !== undefined) window.clearTimeout(graceTimer);
      setPhase('no-session');
    };

    // Subscribe BEFORE the initial getSession() so we don't miss a
    // PASSWORD_RECOVERY / SIGNED_IN event that fires between mount and
    // the getSession() callback resolving.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) markReady();
      } else if (event === 'SIGNED_OUT') {
        // If the user explicitly signed out (unlikely here), the form is
        // unusable — surface the expired panel.
        markNoSession();
      }
    });

    // Initial probe.
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (resolved) return;
        if (!error && data?.session) {
          markReady();
          return;
        }
        // No session yet — give the auto-detector a 1.5s grace window
        // for the URL-hash exchange to complete and fire the listener
        // above. Empirically this is well over the typical timing; the
        // long ceiling is for slow devices / cold cache.
        graceTimer = window.setTimeout(markNoSession, 1500);
      } catch (err) {
        if (resolved) return;
        console.error('[SetNewPasswordForm] session check failed:', err);
        graceTimer = window.setTimeout(markNoSession, 1500);
      }
    })();

    return () => {
      // Clean up both the listener and the pending timer so unmount
      // can't leak either.
      subscription.unsubscribe();
      if (graceTimer !== undefined) window.clearTimeout(graceTimer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setPhase('submitting');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        // Common cases: session expired between page load and submit, or
        // password rejected by the server (length, breached-password
        // policy, etc.). Surface the message and let the user retry.
        setErrorMessage(error.message || 'Could not update password. Please try again.');
        setPhase('error');
        return;
      }
      setPhase('success');
    } catch (err: any) {
      console.error('[SetNewPasswordForm] updateUser threw:', err);
      setErrorMessage(err?.message || 'Unexpected error. Please try again.');
      setPhase('error');
    }
  };

  const handleGoToDashboard = () => {
    // Full navigation rather than React Router navigate(), so the dashboard
    // routes mount fresh with the updated session (no stale AuthContext or
    // candidate-dashboard state). Matches the pattern used elsewhere
    // (CandidateApply uses window.location.href post-submit too).
    window.location.href = aud.postSuccessPath;
  };

  // ── Render states ────────────────────────────────────────────────────────

  if (phase === 'checking-session') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
        <Loader2 className="w-4 h-4 animate-spin" />
        Verifying your reset link…
      </div>
    );
  }

  if (phase === 'no-session') {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold mb-1">Invalid or expired reset link</p>
            <p className="leading-relaxed">
              This password reset link is no longer valid. Reset links expire after about an hour
              and can only be used once. Request a fresh one to continue.
            </p>
          </div>
        </div>
        <Link
          to={`/forgot-password?audience=${audience}`}
          className="block text-center text-sm font-semibold text-emerald-700 hover:underline"
        >
          Request a new reset email →
        </Link>
        <Link
          to={aud.signInPath}
          className="block text-center text-sm text-gray-500 hover:text-gray-700"
        >
          {aud.signInLabel}
        </Link>
      </div>
    );
  }

  if (phase === 'success') {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 p-4 rounded-lg border border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-900">
            <p className="font-semibold mb-1">Password updated</p>
            <p className="leading-relaxed">
              Your new password is now active. You're signed in.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleGoToDashboard}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          {aud.postSuccessLabel}
        </button>
      </div>
    );
  }

  // 'ready' | 'submitting' | 'error' — render the form
  const busy = phase === 'submitting';
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-700 mb-1.5">New password</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoFocus
            className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-700 mb-1.5">Confirm new password</label>
        <input
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder="Re-enter the new password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      {errorMessage && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        {busy ? 'Updating…' : 'Update password'}
      </button>

      <p className="text-xs text-center text-gray-500">
        <Link to={aud.signInPath} className="hover:underline">
          {aud.signInLabel}
        </Link>
      </p>
    </form>
  );
}
