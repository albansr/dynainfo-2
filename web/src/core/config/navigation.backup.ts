// BACKUP DE NAVEGACIÓN ORIGINAL - NO BORRAR
// Este archivo contiene los enlaces originales antes de poner la página de mantenimiento
// Para restaurar, copiar el contenido de NAVIGATION_SECTIONS a navigation.ts

export interface MenuItem {
  key: string;
  label: string;
  href: string;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const NAVIGATION_SECTIONS_ORIGINAL: MenuSection[] = [
  {
    title: 'General',
    items: [
      {
        key: 'inicio',
        label: 'Inicio',
        href: '/dashboard',
      },
    ],
  },
  {
    title: 'Canales',
    items: [
      {
        key: 'distribucion',
        label: 'Distribución',
        href: '/canales/distribucion',
      },
      {
        key: 'exportaciones',
        label: 'Exportaciones',
        href: '/canales/exportaciones',
      },
      {
        key: 'cadenas',
        label: 'Cadenas',
        href: '/canales/cadenas',
      },
    ],
  },
  {
    title: 'Proveedor Comercial',
    items: [
      {
        key: 'marcas-principal',
        label: 'Marcas',
        href: '/proveedor-comercial/marcas',
      },
      {
        key: 'marcas-detalle',
        label: 'Marcas',
        href: '/proveedor-comercial/marcas-detalle',
      },
    ],
  },
  {
    title: 'Multivariados',
    items: [
      {
        key: 'portafolio',
        label: 'Portafolio',
        href: '/multivariados/portafolio',
      },
      {
        key: 'clientes',
        label: 'Clientes',
        href: '/multivariados/clientes',
      },
    ],
  },
  {
    title: 'Inventarios',
    items: [
      {
        key: 'gmroi',
        label: 'GMROI',
        href: '/inventarios/gmroi',
      },
    ],
  },
  {
    title: 'Compañía Vinculada',
    items: [
      {
        key: 'vera',
        label: 'Vera',
        href: '/compania-vinculada/vera',
      },
    ],
  },
] as const;

// ============================================
// INSTRUCCIONES PARA RESTAURAR FUNCIONALIDAD
// ============================================
//
// 1. NAVEGACIÓN (navigation.ts):
//    Copiar NAVIGATION_SECTIONS_ORIGINAL de este archivo a navigation.ts
//
// 2. APP LAYOUT (AppLayout.tsx línea ~37):
//    a) Cambiar href: href="/mantenimiento" → href="/dashboard"
//    b) Restaurar estado activo en "Compañía General":
//       Cambiar: className="cursor-pointer mb-4"
//       A: className={`cursor-pointer mb-4 ${location.pathname === '/dashboard' ? 'bg-gray-200/60' : ''}`}
//    c) Restaurar estado activo en items del sidebar (línea ~52):
//       Antes del map de items, agregar:
//       const isActive = location.pathname === item.href;
//       Y cambiar className de: className="cursor-pointer"
//       A: className={`cursor-pointer ${isActive ? 'bg-gray-200/60' : ''}`}
//
// 3. LOGIN REDIRECT (CodeVerifyPage.tsx línea ~27):
//    Cambiar: const from = (location.state as { from?: string })?.from || '/mantenimiento';
//    A: const from = (location.state as { from?: string })?.from || '/dashboard';
//
// 4. SSO REDIRECT (api/src/core/auth/plugins/sso.plugin.ts línea ~141):
//    Cambiar: ? `${process.env['ORIGIN_URL']}/mantenimiento`
//           : 'http://localhost:4000/mantenimiento';
//    A: ? `${process.env['ORIGIN_URL']}/dashboard`
//      : 'http://localhost:4000/dashboard';
//
// 5. ROOT REDIRECT (App.tsx línea ~97):
//    Cambiar: <Route path="/" element={<Navigate to="/mantenimiento" replace />} />
//    A: <Route path="/" element={<Navigate to="/dashboard" replace />} />
