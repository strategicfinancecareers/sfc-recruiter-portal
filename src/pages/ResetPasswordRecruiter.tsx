import SetNewPasswordForm from '@/components/SetNewPasswordForm';
import AuthShellRecruiter from '@/components/auth-shell/AuthShellRecruiter';

// Recruiter reset-password page. Shell is shared with the recruiter
// branch of /forgot-password so request-reset and set-new-password
// steps look like one flow. All recovery logic
// (token parsing, session check, updateUser, expired-link handling,
// post-success routing) is owned by SetNewPasswordForm.

export default function ResetPasswordRecruiter() {
  return (
    <AuthShellRecruiter
      title="Reset your password"
      subtitle="Choose a new password and we'll get you back into the recruiter portal."
    >
      <SetNewPasswordForm audience="recruiter" />
    </AuthShellRecruiter>
  );
}
