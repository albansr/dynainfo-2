import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { LoadingSkeleton } from '@/core/components/LoadingSkeleton';

interface RouteGuardProps {
  children: ReactNode;
  requireAuth: boolean;
}

export function RouteGuard({ children, requireAuth }: RouteGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (requireAuth && !isAuthenticated) {
    // Save the attempted location so we can redirect back after login
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!requireAuth && isAuthenticated) {
    // Redirect authenticated users away from public routes (login, code-verify)
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
