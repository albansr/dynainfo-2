export interface MenuItem {
  key: string;
  label: string;
  href: string;
  /** Optional highlight badge rendered next to the label in the sidebar. */
  badge?: 'live' | 'new';
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const NAVIGATION_SECTIONS: MenuSection[] = [
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
    // Standalone highlighted item shown right after "Inicio" (no section heading).
    title: '',
    items: [
      {
        key: 'festival-virtual',
        label: 'Festival Virtual',
        href: '/festival-virtual',
        badge: 'live',
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
      {
        key: 'retail',
        label: 'Dynamica Retail',
        href: '/canales/retail',
      },
    ],
  },
  {
    title: 'Proveedor Comercial',
    items: [
      {
        key: 'marcas-principal',
        label: 'Marcas Exclusivas',
        href: '/proveedor-comercial/marcas',
      },
      {
        key: 'marcas-detalle',
        label: 'Marcas Aliadas',
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

/**
 * Menu shown to the Distribution channel role (MANAGER_DISTRIBUTION).
 * Table-only listings, filtered to the distribution channel.
 */
export const DISTRIBUTION_MENU: MenuSection[] = [
  {
    title: '',
    items: [
      { key: 'dist-regionales', label: 'Regionales', href: '/distribucion/regionales' },
      { key: 'dist-comerciales', label: 'Vendedores', href: '/distribucion/comerciales' },
      { key: 'dist-clientes', label: 'Clientes', href: '/distribucion/clientes' },
      { key: 'dist-productos', label: 'Productos', href: '/distribucion/productos' },
    ],
  },
  {
    title: 'Marcas',
    items: [
      { key: 'dist-marcas', label: 'Marcas Exclusivas', href: '/distribucion/marcas' },
      { key: 'dist-marcas-aliadas', label: 'Marcas Aliadas', href: '/distribucion/marcas-aliadas' },
    ],
  },
];
