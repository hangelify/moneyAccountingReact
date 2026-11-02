import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingFallback } from '@/components/common/LoadingFallback';
import type { ReactElement } from 'react';

export function RequireAuth({
  children,
}: {
  children: ReactElement;
}): ReactElement {
  const { user } = useAuth();
  const location = useLocation();

  if (user === undefined) return <LoadingFallback />;
  if (user === null) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
