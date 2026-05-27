import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';

// Shown after a fresh recruiter signup, or any time a pending recruiter
// hits a protected route (ProtectedRoute redirects here).
export default function SignUpPending() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8] px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8 text-amber-700" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">Application received</h1>
        <p className="text-gray-600 leading-relaxed mb-6">
          Thanks for applying to SFC Talent. We manually review every recruiter to keep the network high-signal — usually <strong>within 1–2 business days</strong>.
        </p>
        <p className="text-sm text-gray-500 mb-8">
          We'll email you the moment your application is approved.
        </p>

        <div className="border-t pt-6 space-y-3 text-sm">
          <p className="text-gray-500">
            Already approved? <Link to="/login" className="text-emerald-600 hover:underline font-medium">Sign in here</Link>
          </p>
          <p className="text-gray-400 text-xs">
            Questions? Email <a href="mailto:zu@strategicfinancecareers.com" className="underline">zu@strategicfinancecareers.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
