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
    id: '2026-10-26-mejoras-comerciales',
    date: '2026-10-26',
    title: 'Mejoras comerciales en clientes, vendedores y Estado',
    summary:
      'Más contexto para leer a cada cliente y a cada vendedor: cuánto compra al mes, de cuánto es su pedido medio y quién empieza a enfriarse antes.',
    published: false,
    changes: [
      {
        category: 'nuevo',
        items: [
          '**Promedio mensual en clientes**: al listar clientes, la columna Ret. Cartera se sustituye por lo que compra cada cliente al mes en la temporalidad elegida (ventas entre los meses del periodo; un mes empezado cuenta como uno), comparado con el año anterior. También en el Excel.',
          '**Pedido promedio en vendedores**: el listado de vendedores suma una columna con el valor medio de sus pedidos en la temporalidad elegida (ventas entre número de pedidos), comparado con el año anterior. También en el Excel.',
        ],
      },
      {
        category: 'mejorado',
        items: [
          '**Clientes que se enfriaron, antes**: en Estado, un cliente se considera enfriado cuando lleva 2 meses sin comprarte (antes eran 3), para que puedas reactivarlo a tiempo.',
          '**Nombre de la sucursal en clientes**: los clientes se muestran siempre con el nombre de su sucursal en lugar de la razón social, que es como los conoces en la calle.',
        ],
      },
    ],
  },
  {
    id: '2026-10-15-ayuda-y-soporte',
    date: '2026-10-15',
    title: 'Ayuda y soporte desde cualquier pantalla',
    summary:
      'Si algo no funciona o una cifra no cuadra, cuéntanoslo desde DynaInfo sin salir de la pantalla. Guardamos lo que estás viendo para revisarlo a la primera, y sigues tu solicitud hasta que esté resuelta.',
    published: true,
    changes: [
      {
        category: 'nuevo',
        items: [
          {
            text: '**Ayuda y soporte en el menú**: abajo en el menú lateral, en todas las pantallas. Elige si es un error, un dato incorrecto, un tema de acceso o una sugerencia, y responde a una pregunta guiada. El asunto es opcional.',
            image: {
              src: '/novedades/soporte-ayuda.png',
              alt: 'Formulario de Ayuda y soporte con los cuatro tipos de solicitud y la pregunta ¿Qué cifra ves y cuál esperabas?',
            },
          },
          {
            text: '**Sin explicar dónde estabas**: la solicitud lleva la pantalla, los filtros y las fechas que tenías puestos, y una captura de lo que estabas viendo que puedes revisar o quitar antes de enviar.',
            image: {
              src: '/novedades/soporte-contexto.png',
              alt: 'Casilla Incluir captura de pantalla y resumen de lo que se envía: pantalla, fechas, filtros y rol',
            },
          },
          {
            text: '**¿Este dato no cuadra?**: pasa el ratón por cualquier indicador y pulsa la bandera, o usa «¿Algún dato no cuadra?» encima de las tablas. La solicitud se abre ya preparada con la cifra que estabas mirando.',
            image: {
              src: '/novedades/soporte-dato.png',
              alt: 'Indicador Cumpl. presupuesto con una bandera y el aviso ¿Este dato no cuadra?',
            },
          },
          {
            text: '**Mis solicitudes a un clic**: en Ayuda y soporte encuentras Nueva solicitud y Mis solicitudes. Cuando te respondemos, el menú te lo marca con un número, y además te avisamos por correo.',
            image: {
              src: '/novedades/soporte-menu.png',
              alt: 'Menú de Ayuda y soporte con Nueva solicitud y Mis solicitudes, que indica 1 respuesta del equipo',
            },
          },
          {
            text: '**Sabes en qué punto está**: cada solicitud muestra si está enviada, en revisión o resuelta y qué esperar, y la conversación se lee como un chat. Al resolverla nos dices con un clic si se solucionó o si sigue pasando, también desde el correo.',
            image: {
              src: '/novedades/soporte-seguimiento.png',
              alt: 'Pasos Enviada, En revisión, Resuelta y Cerrada, con la pregunta ¿Se solucionó? y los botones Sí, cerrar y Sigue pasando',
            },
          },
          {
            text: '**Para Admin y superadmin: Solicitudes**: debajo de Ayuda y soporte, la bandeja con las solicitudes de todos, ordenadas por las que esperan respuesta, y una pestaña con las tuyas. Desde cada una abres la pantalla del usuario tal como la tenía, la ves con su rol, respondes con respuestas rápidas y la resuelves en un paso.',
            image: {
              src: '/novedades/soporte-bandeja.png',
              alt: 'Bandeja Solicitudes con las pestañas Todas y Mis solicitudes, y por solicitud el número, asunto, solicitante, a quién le toca y prioridad con puntos de color',
            },
          },
        ],
      },
    ],
  },
  {
    id: '2026-10-14-presupuesto-en-detalle-y-marcas',
    date: '2026-10-14',
    title: 'El presupuesto aparece al bajar al detalle y en Marcas Aliadas',
    summary:
      'Las columnas de presupuesto ya se ven en el detalle y en Marcas Aliadas, siempre que el presupuesto se pueda repartir por lo que estás viendo.',
    published: true,
    changes: [
      {
        category: 'corregido',
        items: [
          '**Presupuesto en el detalle**: al bajar al detalle, por ejemplo de Marcas Exclusivas a sus proveedores, la tabla muestra el presupuesto, el cumplimiento y el margen presupuestado de cada fila. Lo mismo al agrupar por regional, vendedor, canal o periodo.',
          '**Presupuesto en Marcas Aliadas**: el tablero de Marcas Aliadas ahora muestra el presupuesto de cada proveedor, igual que Marcas Exclusivas.',
          '**Sigue oculto donde no aplica**: el presupuesto no se reparte por cliente, producto ni categoría, así que en esas agrupaciones las columnas no aparecen en vez de marcar 0.',
        ],
      },
    ],
  },
  {
    id: '2026-10-13-agrupar-por-canal-de-venta',
    date: '2026-10-13',
    title: 'Agrupar por canal de venta en todos los análisis',
    summary:
      'Ahora puedes ver cualquier análisis repartido por canal de venta: Vendedores, Tienda Virtual y Call Center, el mismo reparto que ya tenía Festival Virtual.',
    published: true,
    changes: [
      {
        category: 'nuevo',
        items: [
          '**Canal de venta en «Agrupar por»**: elige Canal de venta para ver ventas, margen y evolución de Vendedores, Tienda Virtual y Call Center en Compañía General, en cada canal y en las marcas. Es distinto de «Canal», que separa Distribución, Cadenas, Exportaciones y Retail.',
          '**Filtra y baja al detalle**: filtra por un canal de venta o pulsa uno para ver qué vendedores venden por él.',
        ],
      },
    ],
  },
  {
    id: '2026-10-13-clientes-sin-compra-activos',
    date: '2026-10-13',
    title: 'Clientes sin compra: solo clientes activos, igual en todo DynaInfo',
    summary:
      'Clientes sin compra se cuenta ahora igual en Festival Virtual, en los tableros de análisis y en Estado: los clientes activos del maestro comercial que no han comprado. Así la cifra señala a quién llamar, sin clientes inactivos ni bloqueados.',
    published: true,
    changes: [
      {
        category: 'mejorado',
        items: [
          '**Misma regla en todos los tableros**: Clientes sin compra son los clientes activos y no bloqueados del maestro comercial (regionales de venta) que no han comprado en el periodo, dentro de los filtros del tablero. El detalle muestra el vendedor asignado a cada cliente.',
          '**Estado más fiel a tu cartera**: «Sin compra este mes» y los clientes activos parten de los clientes activos que tienes asignados, y «Se enfriaron» deja fuera a los clientes inactivos o bloqueados.',
          '**Solo donde aplica**: en Exportaciones, Cadenas y Dynamica Retail la tarjeta de Clientes sin compra no se muestra, porque esos clientes no están en el maestro comercial. Items y Numérica siguen visibles.',
        ],
      },
      {
        category: 'corregido',
        items: [
          '**Detalle por vendedor en Festival Virtual**: la lista de clientes sin compra vuelve a cargar al bajar a un vendedor.',
        ],
      },
    ],
  },
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
