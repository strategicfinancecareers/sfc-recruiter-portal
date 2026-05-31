import '@fontsource-variable/newsreader';
import SetNewPasswordForm from '@/components/SetNewPasswordForm';

// Professional reset-password page. Uses the cream / Newsreader / brand-
// green palette that matches /apply's right-panel value-prop styling and
// the marketing landing at /. The form interior lives in
// <SetNewPasswordForm/> so any logic fix lands in one place.
//
// All recovery logic (token parsing, session check, updateUser, expired-
// link handling, post-success routing to /candidate-dashboard) is owned
// by the shared component. This page is presentation only.

export default function ResetPasswordProfessional() {
  return (
    <div
      className="min-h-screen flex"
      style={{ background: '#f4f1ea', color: '#0e0e0d' }}
    >
      {/* Left panel — form */}
      <div className="w-full min-[860px]:w-[480px] xl:w-[540px] flex flex-col bg-[#f8f8f8] px-10 py-12 shrink-0">
        <div className="mb-10">
          <span className="font-bold text-lg text-gray-900 tracking-tight">SFC Talent</span>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto min-[860px]:mx-0">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Reset your password</h1>
          <p className="text-sm text-gray-500 mb-6">
            Choose a new password and we&rsquo;ll sign you in.
          </p>

          <SetNewPasswordForm audience="professional" />
        </div>

        <p className="text-xs text-gray-400 mt-10 leading-relaxed max-w-sm mx-auto min-[860px]:mx-0">
          By continuing, you agree to SFC Talent&rsquo;s{' '}
          <a href="https://strategicfinancecareers.com" className="underline hover:text-gray-600">Terms of Service</a>
          {' '}and{' '}
          <a href="https://strategicfinancecareers.com" className="underline hover:text-gray-600">Privacy Policy</a>.
        </p>
      </div>

      {/* Right panel — value props in landing tokens (mirrors /apply auth screen) */}
      <div
        className="hidden min-[860px]:flex flex-1 items-center justify-center px-16"
        style={{ background: '#f4f1ea', color: '#0e0e0d' }}
      >
        <div className="max-w-md w-full">
          <p
            className="mb-7"
            style={{
              fontFamily: '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace',
              fontSize: '10.5px',
              fontWeight: 500,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(14,14,13,.55)',
            }}
          >
            Professionals
          </p>

          <h2
            className="leading-tight tracking-tight mb-5"
            style={{
              fontFamily: '"Newsreader Variable", "Newsreader", Georgia, serif',
              fontWeight: 500,
              fontSize: 'clamp(28px, 3vw, 38px)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            Pick a new password.<br />
            Stay <em style={{ fontStyle: 'italic', color: '#008037', fontWeight: 400 }}>open</em>.
          </h2>

          <p style={{ color: 'rgba(14,14,13,.65)', fontSize: '15px', lineHeight: 1.6, maxWidth: '38ch' }}>
            Your profile stays hidden until you approve an introduction — same as before.
            This just gets you back in.
          </p>
        </div>
      </div>
    </div>
  );
}
