import SetNewPasswordForm from '@/components/SetNewPasswordForm';
import AuthShellProfessional from '@/components/auth-shell/AuthShellProfessional';

// Professional reset-password page. Shell is shared with the
// professional branch of /forgot-password so request-reset and
// set-new-password steps look like one flow. All recovery logic
// (token parsing, session check, updateUser, expired-link handling,
// post-success routing) is owned by SetNewPasswordForm.

export default function ResetPasswordProfessional() {
  return (
    <AuthShellProfessional
      title="Reset your password"
      subtitle="Choose a new password and we'll sign you in."
    >
      <SetNewPasswordForm audience="professional" />
    </AuthShellProfessional>
  );
}
