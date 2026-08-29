import { XCircle } from 'lucide-react';

// Shown to recruiters whose recruiter_status is 'rejected'. Reached
// either via the rejection email or via ProtectedRoute redirect after
// they try to sign in.
export default function SignUpRejected() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f8f8] px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-8 h-8 text-red-700" />
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">Application not approved</h1>
        <p className="text-gray-600 leading-relaxed mb-6">
          After review, we weren't able to approve your recruiter application at this time.
        </p>
        <p className="text-sm text-gray-500">
          If you'd like to discuss this further or reapply later, email{' '}
          <a href="mailto:talent@strategicfinancecareers.com" className="text-[#008037] hover:underline font-medium">
            talent@strategicfinancecareers.com
          </a>.
        </p>
      </div>
    </div>
  );
}
