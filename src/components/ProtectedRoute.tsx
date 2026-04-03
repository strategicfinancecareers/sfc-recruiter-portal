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
  if (!user) return <Navigate to="/login" replace />;

  if (requireAdmin) {
    if (isProfileLoading) return <LoaderScreen />;
    if (user.role !== 'admin' && user.role !== 'owner') {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
