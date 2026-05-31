import SetNewPasswordForm from '@/components/SetNewPasswordForm';

// Recruiter reset-password page. Mirrors the /signup recruiter layout:
// left panel form on bg-[#f8f8f8], right panel testimonial on white.
// All recovery logic owned by the shared SetNewPasswordForm; this is
// presentation only.

export default function ResetPasswordRecruiter() {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — form (mirrors SignUp.tsx) */}
      <div className="w-full lg:w-[480px] xl:w-[540px] flex flex-col bg-[#f8f8f8] px-10 py-12 shrink-0">
        <div className="mb-10">
          <span className="font-bold text-lg text-gray-900 tracking-tight">SFC Talent</span>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto lg:mx-0">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Reset your password</h1>
          <p className="text-sm text-gray-500 mb-6">
            Choose a new password and we&rsquo;ll get you back into the recruiter portal.
          </p>

          <SetNewPasswordForm audience="recruiter" />
        </div>

        <p className="text-xs text-gray-400 mt-10 leading-relaxed max-w-sm mx-auto lg:mx-0">
          By continuing, you agree to SFC Talent&rsquo;s{' '}
          <a href="https://strategicfinancecareers.com" className="underline hover:text-gray-600">Terms of Service</a>
          {' '}and{' '}
          <a href="https://strategicfinancecareers.com" className="underline hover:text-gray-600">Privacy Policy</a>.
        </p>
      </div>

      {/* Right panel — testimonial (mirrors SignUp.tsx) */}
      <div className="hidden lg:flex flex-1 bg-white items-center justify-center px-16">
        <div className="max-w-md">
          <div className="text-gray-200 text-6xl font-serif leading-none mb-6 select-none">&ldquo;</div>
          <blockquote className="text-2xl font-medium text-gray-900 leading-snug mb-6">
            Found our CFO in under two weeks. The quality of candidates in the SFC network is genuinely different.
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
              SK
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Sarah K.</p>
              <p className="text-xs text-gray-400">CEO, growth-stage fintech</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
