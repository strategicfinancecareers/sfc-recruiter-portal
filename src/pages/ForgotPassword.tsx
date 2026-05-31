import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AuthShellProfessional from '@/components/auth-shell/AuthShellProfessional';
import AuthShellRecruiter from '@/components/auth-shell/AuthShellRecruiter';

// /forgot-password?audience=professional|recruiter
//
// Themed by audience to match the corresponding reset-password page +
// upstream sign-in surface:
//   professional → AuthShellProfessional (cream / Newsreader / brand
//                  green) matching /reset-password and /apply.
//   recruiter    → AuthShellRecruiter (bg-[#f8f8f8] form + white
//                  testimonial) matching /recruiter/reset-password and
//                  /signup.
// Default (no param, or any other value) = recruiter.
//
// LOGIC IS UNCHANGED from the previous file: resetPasswordForEmail
// still branches redirectTo by audience to the right /reset-password
// page, Back to Sign In still routes per audience. Only the layout
// shell and the inner form/confirmation markup got reskinned.

type Audience = 'professional' | 'recruiter';

const ForgotPassword = () => {
  const [searchParams] = useSearchParams();
  const audience: Audience = searchParams.get('audience') === 'professional' ? 'professional' : 'recruiter';

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Per-audience redirect — Supabase puts the recovery token in the
      // hash of this URL when emailing the user. The corresponding
      // reset-password page handles updateUser via SetNewPasswordForm.
      const redirectPath = audience === 'professional' ? '/reset-password' : '/recruiter/reset-password';
      const redirectUrl = `${window.location.origin}${redirectPath}`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      setEmailSent(true);
      toast({
        title: "Reset email sent",
        description: "Check your inbox for password reset instructions.",
      });
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast({
        title: "Error sending reset email",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const backHref = audience === 'professional' ? '/apply?mode=signin' : '/signup?mode=signin';

  // ── Form interior (audience-agnostic markup; shell provides the theme) ──
  const formInterior = !emailSent ? (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-700 mb-1.5">Email address</label>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoFocus
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {isLoading ? 'Sending…' : 'Send reset link'}
      </button>

      <p className="text-xs text-center text-gray-500 pt-2">
        <Link to={backHref} className="inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="w-3 h-3" /> Back to sign in
        </Link>
      </p>
    </form>
  ) : (
    // Confirmation state — also themed (was the broken full-green screen)
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-lg border border-emerald-200 bg-emerald-50">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-sm text-emerald-900">
          <p className="font-semibold mb-1">Reset link sent</p>
          <p className="leading-relaxed">
            We sent a password reset link to <strong>{email}</strong>. Check your inbox
            (and spam folder) — the link expires in about an hour.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 text-xs text-gray-500 leading-relaxed">
        <Mail className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p>
          Didn&rsquo;t receive it? Make sure you used the email you signed up with.
          You can try a different address below.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setEmailSent(false)}
        className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
      >
        Try a different email
      </button>

      <p className="text-xs text-center text-gray-500 pt-2">
        <Link to={backHref} className="inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="w-3 h-3" /> Back to sign in
        </Link>
      </p>
    </div>
  );

  const subtitle = !emailSent
    ? "Enter the email you signed up with and we'll send you a reset link."
    : undefined; // confirmation state has its own headline-replacement banner

  if (audience === 'professional') {
    return (
      <AuthShellProfessional title="Reset your password" subtitle={subtitle}>
        {formInterior}
      </AuthShellProfessional>
    );
  }
  return (
    <AuthShellRecruiter title="Reset your password" subtitle={subtitle}>
      {formInterior}
    </AuthShellRecruiter>
  );
};

export default ForgotPassword;
