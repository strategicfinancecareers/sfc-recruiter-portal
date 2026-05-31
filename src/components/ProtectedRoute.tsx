import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoaderScreen from './LoaderScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const { user, isLoading, isProfileLoading } = useAuth();

  if (isLoading) return <LoaderScreen />;
  // Recruiter sign-in lives at /signup?mode=signin now (single front
  // door). /login still works via redirect for old bookmarks but
  // routing protected routes through the canonical URL avoids the
  // extra hop.
  if (!user) return <Navigate to="/signup?mode=signin" replace />;

  // ── Recruiter vetting gate ──────────────────────────────────────────────────
  // Applies only to users with role='recruiter'. Admins and owners bypass.
  // Grandfathered recruiters (recruiter_status IS NULL) also bypass — they
  // were on the platform before vetting was introduced.
  if (user.role === 'recruiter') {
    if (isProfileLoading) return <LoaderScreen />;
    if (user.recruiter_status === 'pending') return <Navigate to="/signup/pending" replace />;
    if (user.recruiter_status === 'rejected') return <Navigate to="/signup/rejected" replace />;
    // 'approved' or null → continue
  }

  if (requireAdmin) {
    if (isProfileLoading) return <LoaderScreen />;
    if (user.role !== 'admin' && user.role !== 'owner') {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
