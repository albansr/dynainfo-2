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
        href: '/mantenimiento',
      },
      {
        key: 'exportaciones',
        label: 'Exportaciones',
        href: '/mantenimiento',
      },
      {
        key: 'cadenas',
        label: 'Cadenas',
        href: '/mantenimiento',
      },
    ],
  },
  {
    title: 'Proveedor Comercial',
    items: [
      {
        key: 'marcas-principal',
        label: 'Marcas Propias',
        href: '/mantenimiento',
      },
      {
        key: 'marcas-detalle',
        label: 'Marcas Externas',
        href: '/mantenimiento',
      },
    ],
  },
  {
    title: 'Multivariados',
    items: [
      {
        key: 'portafolio',
        label: 'Portafolio',
        href: '/mantenimiento',
      },
      {
        key: 'clientes',
        label: 'Clientes',
        href: '/mantenimiento',
      },
    ],
  },
  {
    title: 'Inventarios',
    items: [
      {
        key: 'gmroi',
        label: 'GMROI',
        href: '/mantenimiento',
      },
    ],
  },
  {
    title: 'Compañía Vinculada',
    items: [
      {
        key: 'vera',
        label: 'Vera',
        href: '/mantenimiento',
      },
    ],
  },
] as const;
