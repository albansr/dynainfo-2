export interface MenuItem {
  key: string;
  label: string;
  href: string;
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
