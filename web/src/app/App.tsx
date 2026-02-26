import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HeroUIProvider } from '@heroui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { CodeVerifyPage } from '@/features/auth/pages/CodeVerifyPage';
import { DashboardPage } from '@/features/dashboard/pages/DashboardPage';
import { MaintenancePage } from '@/features/dashboard/pages/MaintenancePage';
import { EjemploPage } from '@/features/dashboard/pages/EjemploPage';
import { DistributionPage } from '@/features/distribution/pages/DistributionPage';
import { ExportacionesPage } from '@/features/exportaciones/pages/ExportacionesPage';
import { CadenasPage } from '@/features/cadenas/pages/CadenasPage';
import { BrandsPage } from '@/features/brands/pages/BrandsPage';
import { BrandsExternalPage } from '@/features/brands/pages/BrandsExternalPage';
import { PortafolioPage } from '@/features/portafolio/pages/PortafolioPage';
import { ClientesPage } from '@/features/clientes/pages/ClientesPage';
import { GmroiPage } from '@/features/gmroi/pages/GmroiPage';
import { VeraPage } from '@/features/vera/pages/VeraPage';
import { AppLayout } from '@/core/layouts/AppLayout';
import { RouteGuard } from '@/core/router/RouteGuard';
import { AuthProvider } from '@/core/router/AuthProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <HeroUIProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
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
              path="/canales/distribucion"
              element={
                <RouteGuard requireAuth={true}>
                  <AppLayout>
                    <DistributionPage />
                  </AppLayout>
                </RouteGuard>
              }
            />
            <Route
              path="/canales/exportaciones"
              element={
                <RouteGuard requireAuth={true}>
                  <AppLayout>
                    <ExportacionesPage />
                  </AppLayout>
                </RouteGuard>
              }
            />
            <Route
              path="/canales/cadenas"
              element={
                <RouteGuard requireAuth={true}>
                  <AppLayout>
                    <CadenasPage />
                  </AppLayout>
                </RouteGuard>
              }
            />
            <Route
              path="/proveedor-comercial/marcas"
              element={
                <RouteGuard requireAuth={true}>
                  <AppLayout>
                    <BrandsPage />
                  </AppLayout>
                </RouteGuard>
              }
            />
            <Route
              path="/proveedor-comercial/marcas-detalle"
              element={
                <RouteGuard requireAuth={true}>
                  <AppLayout>
                    <BrandsExternalPage />
                  </AppLayout>
                </RouteGuard>
              }
            />
            <Route
              path="/multivariados/portafolio"
              element={
                <RouteGuard requireAuth={true}>
                  <AppLayout>
                    <PortafolioPage />
                  </AppLayout>
                </RouteGuard>
              }
            />
            <Route
              path="/multivariados/clientes"
              element={
                <RouteGuard requireAuth={true}>
                  <AppLayout>
                    <ClientesPage />
                  </AppLayout>
                </RouteGuard>
              }
            />
            <Route
              path="/ejemplo"
              element={
                <RouteGuard requireAuth={true}>
                  <AppLayout>
                    <EjemploPage />
                  </AppLayout>
                </RouteGuard>
              }
            />
            <Route
              path="/mantenimiento"
              element={
                <RouteGuard requireAuth={true}>
                  <AppLayout>
                    <MaintenancePage />
                  </AppLayout>
                </RouteGuard>
              }
            />
            <Route
              path="/inventarios/gmroi"
              element={
                <RouteGuard requireAuth={true}>
                  <AppLayout>
                    <GmroiPage />
                  </AppLayout>
                </RouteGuard>
              }
            />
            <Route
              path="/compania-vinculada/vera"
              element={
                <RouteGuard requireAuth={true}>
                  <AppLayout>
                    <VeraPage />
                  </AppLayout>
                </RouteGuard>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      </QueryClientProvider>
    </HeroUIProvider>
  );
}

export default App;
