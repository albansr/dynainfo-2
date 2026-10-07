/**
 * Novedades — the single source of truth for changelog entries.
 *
 * Entries live in code: the copy ships in the same PR as the change it
 * describes, is reviewed in the diff and goes live with the deploy. They power
 * the public /novedades page (GET /api/changelog/entries) and the daily digest
 * email. Newest first. See .claude/rules/changelog.md.
 */

export type ChangelogCategory = 'nuevo' | 'mejorado' | 'corregido';

export interface ChangelogChangeGroup {
  category: ChangelogCategory;
  /** Each item leads with a short `**bold**` phrase, then a plain explanation. */
  items: string[];
}

export interface ChangelogEntry {
  id: string;
  /** Go-live day, plain YYYY-MM-DD (project timezone). */
  date: string;
  title: string;
  summary?: string;
  /** Optional illustration served by the web app (path under web/public, e.g. /novedades/x.png). Use mockups with fictional data, never real customer data. */
  image?: { src: string; alt: string };
  /** false while on dev; true (with the real go-live date) on the dev → master deploy. */
  published: boolean;
  changes: ChangelogChangeGroup[];
}

export const CATEGORY_LABEL: Record<ChangelogCategory, string> = {
  nuevo: 'Nuevo',
  mejorado: 'Mejorado',
  corregido: 'Corregido',
};

export const CHANGELOG_ENTRIES: readonly ChangelogEntry[] = [
  {
    id: '2026-10-07-novedades-por-correo',
    date: '2026-10-07',
    title: 'Novedades por correo',
    summary: 'Todas las mejoras de DynaInfo en un solo sitio, y un aviso por correo cuando haya algo nuevo.',
    published: false,
    changes: [
      {
        category: 'nuevo',
        items: [
          '**Página de novedades**: las mejoras de DynaInfo ordenadas de la más reciente a la más antigua.',
          '**Aviso por correo**: deja tu email y recibirás un resumen la mañana siguiente a cada novedad. Te das de baja con un clic desde el propio correo.',
        ],
      },
    ],
  },
  {
    id: '2026-09-28-estado-vendedores',
    date: '2026-09-28',
    title: 'Estado: tu cartera de un vistazo',
    summary:
      'Una página nueva para vendedores que convierte tu cartera en una lista clara de dónde actuar: quién dejó de comprarte, quién está en riesgo, quién está creciendo y qué clientes sostienen tus ventas. Menos tiempo buscando en los informes y más tiempo con los clientes que mueven tu cumplimiento.',
    image: {
      src: '/novedades/estado.png',
      alt: 'Página Estado con la cobertura del mes y cuatro tarjetas: clientes que se enfriaron, en riesgo, promesas y clientes clave',
    },
    published: true,
    changes: [
      {
        category: 'nuevo',
        items: [
          '**Cobertura del mes**: cuántos de tus clientes activos ya te compraron este mes, con una barra de avance y acceso directo a los que todavía no lo han hecho.',
          '**Clientes que se enfriaron**: te compraban y llevan 3 meses sin hacerlo. Un contacto a tiempo suele bastar para reactivarlos antes de que se pierdan.',
          '**Clientes en riesgo y cayendo**: clasificados en riesgo comercial y con ventas a la baja, junto con la facturación anual y el margen que tienes en juego si se van.',
          '**Promesas creciendo**: clientes con potencial que ya crecen frente al año anterior, con su facturación y su margen, para que sepas dónde un empujón rinde más.',
          '**Clientes clave**: los pocos que concentran el 80 % de tus ventas de los últimos 12 meses, cuáles de ellos retroceden y cuánto pesan en tus ventas.',
          '**Del dato a la acción**: cada tarjeta abre el listado de esos clientes con su cédula o NIT, con buscador y exportación a Excel, listo para planificar tus visitas y llamadas.',
        ],
      },
    ],
  },
];

/** Entries visible to the public and eligible for the digest. */
export function publishedEntries(
  entries: readonly ChangelogEntry[] = CHANGELOG_ENTRIES,
): ChangelogEntry[] {
  return entries.filter((entry) => entry.published);
}
