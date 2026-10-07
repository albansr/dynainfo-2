/**
 * Novedades — the single source of truth for changelog entries.
 *
 * Entries live in code: the copy ships in the same PR as the change it
 * describes, is reviewed in the diff and goes live with the deploy. They power
 * the public /novedades page (GET /api/changelog/entries) and the daily digest
 * email. Newest first. See .claude/rules/changelog.md.
 */

export type ChangelogCategory = 'nuevo' | 'mejorado' | 'corregido';

/** A small illustration (mockup, fictional data) under the entry or one item. */
export interface ChangelogImage {
  src: string;
  alt: string;
}

/**
 * One change: plain text, or text with its own small mockup. Each text leads
 * with a short `**bold**` phrase, then a plain explanation.
 */
export type ChangelogItem = string | { text: string; image?: ChangelogImage };

export interface ChangelogChangeGroup {
  category: ChangelogCategory;
  items: ChangelogItem[];
}

/** Text of an item, whatever its form. */
export function itemText(item: ChangelogItem): string {
  return typeof item === 'string' ? item : item.text;
}

export interface ChangelogEntry {
  id: string;
  /** Go-live day, plain YYYY-MM-DD (project timezone). */
  date: string;
  title: string;
  summary?: string;
  /** Optional illustration served by the web app (path under web/public, e.g. /novedades/x.png). Use mockups with fictional data, never real customer data. */
  image?: ChangelogImage;
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
    id: '2026-10-07-mejoras-analisis',
    date: '2026-10-07',
    title: 'Más contexto en los tableros de análisis',
    summary:
      'Cada tablero de análisis te dice ahora cuántos productos y clientes movió el periodo, quién dejó de comprar y, por producto, cuántas unidades vendiste y a qué costo. Menos columnas vacías y más datos para pasar del dato a la acción sin salir del tablero.',
    published: true,
    changes: [
      {
        category: 'nuevo',
        items: [
          {
            text: '**Items, Numérica y Clientes sin compra en todos los tableros**: el bloque que ya tenía Festival Virtual llega a Compañía General, a cada canal, a las marcas y a sus detalles. Items son los productos distintos vendidos y Numérica los clientes distintos atendidos en el periodo.',
            image: {
              src: '/novedades/mejoras-items-numerica.png',
              alt: 'Bloque con Items 1.284, Numérica 642 y Clientes sin compra 118',
            },
          },
          {
            text: '**Quién dejó de comprar**: Clientes sin compra son los clientes que compraron en los 12 meses anteriores al periodo y no han vuelto a comprar en él, dentro de los filtros de cada tablero. Con un clic ves la lista con el vendedor de su última compra, la buscas y la exportas a Excel.',
            image: {
              src: '/novedades/mejoras-sin-compra.png',
              alt: 'Lista de clientes sin compra con NIT, cliente y vendedor, y botón Exportar a Excel',
            },
          },
          {
            text: '**Unidades, precio y costo promedio por producto**: al agrupar por producto, la tabla y el Excel muestran las unidades vendidas, el precio promedio y el costo promedio por unidad, cada uno con su evolución frente al año anterior, también en el total. Siguen el mismo criterio que Ventas: en periodos abiertos suman lo facturado y lo comprometido. Festival Virtual también los muestra al agrupar por producto.',
            image: {
              src: '/novedades/mejoras-unidades.png',
              alt: 'Listado por producto con Unidades, Precio promedio y Costo promedio, cada uno con su variación frente al año anterior',
            },
          },
          {
            text: '**Estado para directores y gerencia**: la página Estado llega a Directores, Admin y Gerencia con los totales de su equipo (los vendedores de sus regionales, o todos) y una tabla por vendedor con cada segmento: sin compra este mes, clientes que se enfriaron, en riesgo, promesas y clientes clave cayendo. Un clic en cualquier cifra abre esos clientes de ese vendedor.',
            image: {
              src: '/novedades/mejoras-estado-equipo.png',
              alt: 'Tabla por vendedor con sin compra este mes, se enfriaron, en riesgo, promesas y clientes clave cayendo',
            },
          },
        ],
      },
      {
        category: 'mejorado',
        items: [
          {
            text: '**Numérica en Estado**: la cobertura del mes se presenta como Numérica e indica qué porcentaje de los clientes activos ya compró este mes, en todas las pantallas de Estado.',
            image: {
              src: '/novedades/mejoras-numerica.png',
              alt: 'Numérica 1.466 de 14.665 clientes activos te compraron este mes, un 10% del total',
            },
          },
          '**Sin columnas de cartera vacías**: Ret. Cartera solo aparece cuando la agrupación permite desglosarla (regional, vendedor, cliente o proveedor). En canal, marca, categoría y el resto de agrupaciones siempre salía vacía y ya no se muestra; al agrupar por producto la sustituyen Unidades, Precio promedio y Costo promedio.',
          '**Cartera fuera el último día del mes**: en la vista de hoy y del mes en curso, el último día del mes se oculta el bloque de Cartera y cumplimiento del mes completo, para que no se confunda con el cumplimiento de presupuesto.',
        ],
      },
    ],
  },
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
