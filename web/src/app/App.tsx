import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HeroUIProvider } from '@heroui/react';
import { QueryClient, QueryClientProvider, keepPreviousData } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AppLayout } from '@/core/layouts/AppLayout';
import { RouteGuard } from '@/core/router/RouteGuard';
import { AuthProvider } from '@/core/router/AuthProvider';
import { LoadingSkeleton } from '@/core/components/LoadingSkeleton';

// Route-level code-splitting: each page is its own chunk, loaded on demand.
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const CodeVerifyPage = lazy(() => import('@/features/auth/pages/CodeVerifyPage').then((m) => ({ default: m.CodeVerifyPage })));
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const FestivalVirtualPage = lazy(() => import('@/features/festival/pages/FestivalVirtualPage').then((m) => ({ default: m.FestivalVirtualPage })));
const FilteredDetailPage = lazy(() => import('@/features/dashboard/pages/FilteredDetailPage').then((m) => ({ default: m.FilteredDetailPage })));
const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 min
      // Keep the previous data while a query with changed params refetches, so
      // switching view/temporality/page doesn't blank the UI into a loading flash.
      placeholderData: keepPreviousData,
    },
  },
});

function App() {
  return (
    <HeroUIProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<LoadingSkeleton />}>
            <Routes>
              <Route
                path="/login"
                element={
                  <RouteGuard requireAuth={false}>
                    <LoginPage />
                  </RouteGuard>
                }
              />
              <Route
                path="/code-verify"
                element={
                  <RouteGuard requireAuth={false}>
                    <CodeVerifyPage />
                  </RouteGuard>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <RouteGuard requireAuth={true}>
                    <AppLayout>
                      <DashboardPage />
                    </AppLayout>
                  </RouteGuard>
                }
              />
              <Route
                path="/festival-virtual"
                element={
                  <RouteGuard requireAuth={true}>
                    <AppLayout>
                      <FestivalVirtualPage />
                    </AppLayout>
                  </RouteGuard>
                }
              />
              <Route
                path="/distribucion/detalle"
                element={
                  <RouteGuard requireAuth={true}>
                    <AppLayout>
                      <FilteredDetailPage />
                    </AppLayout>
                  </RouteGuard>
                }
              />
              <Route
                path="/configuracion"
                element={
                  <RouteGuard requireAuth={true}>
                    <AppLayout>
                      <SettingsPage />
                    </AppLayout>
                  </RouteGuard>
                }
              />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
        <Toaster position="top-right" theme="dark" />
      </QueryClientProvider>
    </HeroUIProvider>
  );
}

export default App;
