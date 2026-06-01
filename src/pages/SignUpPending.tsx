import { Link } from 'react-router-dom';
import { Clock, Mail } from 'lucide-react';

// Shown after a fresh recruiter signup, and any time a pending recruiter
// hits a protected route (ProtectedRoute redirects here).
// Copy is recruiter-framed — no "application" / "applicant" language.
export default function SignUpPending() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8] px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-amber-700" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">
            Submission received — vetting in progress
          </h1>

          <p className="text-gray-600 leading-relaxed mb-4">
            Thanks for joining SFC Talent as a recruiter. We personally review every recruiter signup to keep candidate quality high on the platform.
          </p>

          <p className="text-gray-600 leading-relaxed mb-6">
            We typically approve within a few hours during US business hours (PDT). You'll get an email at the address you signed up with as soon as your account is live — no need to refresh this page.
          </p>
        </div>

        {/* Callout: email-verification reminder */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 mb-6 flex gap-3 items-start">
          <Mail className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-900 leading-relaxed">
            <strong>One more thing:</strong> check your inbox now and confirm your email address. We can't approve accounts with unverified emails.
          </p>
        </div>

        <div className="text-center border-t pt-6 space-y-3 text-sm">
          <p className="text-gray-500">
            Already approved?{' '}
            <Link to="/signup?mode=signin" className="text-[#008037] hover:underline font-medium">Sign in here</Link>
          </p>
          <p className="text-gray-400 text-xs">
            Questions? Email{' '}
            <a href="mailto:zu@strategicfinancecareers.com" className="underline">zu@strategicfinancecareers.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
