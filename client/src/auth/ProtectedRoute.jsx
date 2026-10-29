import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './context';
import { ErrorNotice, Loading } from '../components/Status';

export function ProtectedRoute() {
  const { user, status, error, refresh } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <Loading />;
  if (status === 'error') return <ErrorNotice message={error} onRetry={refresh} />;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
