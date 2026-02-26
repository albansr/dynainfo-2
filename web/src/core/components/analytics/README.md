# Analytics Page System

Sistema reutilizable para crear páginas de analítica con métricas y tablas de datos.

## Descripción General

El componente `AnalyticsPage` es un sistema genérico que permite crear páginas de análisis completas con solo unas pocas líneas de código. Maneja automáticamente:

- Obtención de datos (balance y listas)
- Selección de rango de fechas
- Filtros globales
- Renderizado de métricas
- Renderizado de tablas
- Cálculos de totales
- Estados de carga

## Ejemplo Básico

```tsx
import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

export function MiPaginaAnalytica() {
  return (
    <AnalyticsPage
      title="Mi Página / Título"
      groupBy="IdRegional"
      totalsLabel="TOTAL:"
    />
  );
}
```

## Ejemplos Reales

### Página de Distribución

```tsx
import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

export function DistributionPage() {
  return (
    <AnalyticsPage
      title="Canales / Distribución"
      groupBy="IdRegional"
      totalsLabel="TOTAL REGIONALES:"
    />
  );
}
```

### Página de Marcas

```tsx
import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

export function BrandsPage() {
  return (
    <AnalyticsPage
      title="Proveedor Comercial / Marcas"
      groupBy="product"
      totalsLabel="TOTAL MARCAS:"
    />
  );
}
```

### Página con Filtros

```tsx
import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

export function ExportacionesPage() {
  return (
    <AnalyticsPage
      title="Canales / Exportaciones"
      groupBy="IdRegional"
      totalsLabel="TOTAL EXPORTACIONES:"
      filters={{ type: 'export' }}
    />
  );
}
```

## Configuración

### Propiedades de AnalyticsPageConfig

| Propiedad | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| `title` | `string` | ✅ Sí | - | Título de la página mostrado en el header |
| `groupBy` | `GroupByDimension` | ✅ Sí | - | Dimensión por la cual agrupar los datos |
| `totalsLabel` | `string` | ❌ No | `"TOTAL:"` | Label para la fila de totales en la tabla |
| `filters` | `Record<string, any>` | ❌ No | `undefined` | Filtros globales aplicados a métricas y tabla |
| `metricsPreset` | `'standard'` | ❌ No | `'standard'` | Preset de métricas a usar |

### Dimensiones Disponibles (groupBy)

- `'IdRegional'` - Agrupar por región
- `'product'` - Agrupar por producto/marca
- `'seller_id'` - Agrupar por vendedor
- `'month'` - Agrupar por mes
- `'quarter'` - Agrupar por trimestre
- `'brand'` - Agrupar por marca

## Filtros

Los filtros son **globales** y afectan tanto a las métricas como a la tabla simultáneamente. Los filtros se envían al API junto con las fechas.

### Ejemplos de Filtros

```tsx
// Filtrar por tipo
filters={{ type: 'export' }}

// Filtrar por tipo de marca
filters={{ brand_type: 'own' }}

// Múltiples filtros
filters={{
  type: 'export',
  region: 'norte'
}}
```

## Métricas

### Preset Estándar

El preset `'standard'` incluye automáticamente:

1. **Ventas (Facturado + comprometido)**
   - Valor actual
   - Valor año anterior

2. **Crecimiento de Ventas**
   - Porcentaje vs año anterior
   - Con color (verde si positivo, rojo si negativo)

3. **Cumplimiento Parcial**
   - Porcentaje de cumplimiento
   - Presupuesto en US$

## Estructura de Archivos

```
web/src/core/components/analytics/
├── README.md                       # Esta documentación
├── AnalyticsPage.tsx              # Componente principal
├── types.ts                       # Definiciones de tipos
├── hooks/
│   └── useAnalyticsData.ts       # Hook para obtener datos
└── presets/
    └── standardMetrics.tsx       # Métricas estándar
```

## Flujo de Datos

```
useDateRange() → useAnalyticsData() → {
  balanceData   // Para métricas
  listData      // Para tabla
}

listData → mapApiToRegionalData() → mappedData
mappedData → calculateTotals() → totals

Renderizar:
  - PageHeader
  - StandardMetrics (balanceData)
  - RegionalTable (mappedData, totals)
```

## Beneficios

### Antes
- 265 líneas de código por página
- Código duplicado entre páginas
- Difícil mantener consistencia
- Propenso a errores

### Después
- 17 líneas de código por página
- Cero duplicación
- Consistencia garantizada
- Fácil de mantener

### Comparación de Código

**Antes (265 líneas):**
```tsx
export function DistributionPage() {
  const { startDate, endDate } = useDateRange();
  const { data: balanceResponse, isLoading: isLoadingBalance } = useBalance(startDate, endDate);
  const balanceData = balanceResponse?.data;
  const { data: listData, isLoading: isLoadingList } = useList('IdRegional', startDate, endDate);

  const mappedData = useMemo(
    () => (listData?.data || []).map(mapApiToRegionalData),
    [listData]
  );

  const totals = useMemo(() => calculateTotals(mappedData), [mappedData]);

  // ... 250+ líneas más de código
}
```

**Después (17 líneas):**
```tsx
export function DistributionPage() {
  return (
    <AnalyticsPage
      title="Canales / Distribución"
      groupBy="IdRegional"
      totalsLabel="TOTAL REGIONALES:"
    />
  );
}
```

## Creando una Nueva Página

### Paso 1: Crear el Archivo

Crea un nuevo archivo en la carpeta features correspondiente:

```
web/src/features/mi-feature/pages/MiPage.tsx
```

### Paso 2: Implementar el Componente

```tsx
import { AnalyticsPage } from '@/core/components/analytics/AnalyticsPage';

/**
 * Mi Página de Análisis
 *
 * Descripción de qué muestra la página.
 */
export function MiPage() {
  return (
    <AnalyticsPage
      title="Mi Sección / Mi Página"
      groupBy="IdRegional"  // Cambiar según necesidad
      totalsLabel="TOTAL:"  // Personalizar label
      // filters={{ miCampo: 'miValor' }}  // Opcional
    />
  );
}
```

### Paso 3: Agregar a Rutas

Agrega la ruta en `web/src/app/App.tsx`:

```tsx
<Route
  path="/mi-ruta"
  element={
    <RouteGuard requireAuth={true}>
      <AppLayout>
        <MiPage />
      </AppLayout>
    </RouteGuard>
  }
/>
```

### Paso 4: Agregar a Navegación

Agrega el ítem en `web/src/core/config/navigation.ts`:

```tsx
{
  title: 'Mi Sección',
  items: [
    {
      key: 'mi-pagina',
      label: 'Mi Página',
      href: '/mi-ruta',
    },
  ],
}
```

## Preguntas Frecuentes

### ¿Cómo agrego filtros personalizados?

Usa la propiedad `filters`:

```tsx
<AnalyticsPage
  title="Mi Página"
  groupBy="IdRegional"
  filters={{ campo: 'valor' }}
/>
```

### ¿Los filtros afectan solo a la tabla o también a las métricas?

Los filtros son **globales** y afectan tanto a las métricas como a la tabla.

### ¿Puedo usar diferentes dimensiones de agrupación?

Sí, puedes usar cualquier dimensión disponible en `GroupByDimension`.

### ¿Qué pasa con las fechas?

Las fechas se manejan automáticamente a través del hook `useDateRange()` que lee el estado global de la aplicación.

### ¿Puedo personalizar el label de totales?

Sí, usa la propiedad `totalsLabel`:

```tsx
<AnalyticsPage
  title="Mi Página"
  groupBy="product"
  totalsLabel="TOTAL PRODUCTOS:"
/>
```

## Notas Técnicas

### Mapeo de Datos

El componente usa `mapApiToRegionalData()` para convertir los datos del API al formato `RegionalData` requerido por `RegionalTable`.

### Cálculo de Totales

La función `calculateTotals()` calcula automáticamente:
- Suma de ventas actuales y previas
- Variación porcentual de ventas
- Promedio ponderado de márgenes
- Cumplimiento de presupuesto
- Compliance de retenido

### Estado de Carga

El componente maneja automáticamente los estados de carga mostrando un mensaje "Cargando datos..." mientras se obtienen los datos.

## Soporte

Para preguntas o problemas, contacta al equipo de desarrollo.
