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

// Sidebar keeps only Análisis (the home, rendered separately in AppLayout) and
// Festival Virtual. Every other destination lives inside the /dashboard view
// selector. Same for all roles for now.
export const NAVIGATION_SECTIONS: MenuSection[] = [
  {
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
] as const;
