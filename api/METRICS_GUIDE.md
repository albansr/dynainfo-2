# Guía de Métricas - Sistema Escalable

Este documento explica cómo agregar nuevas métricas al sistema de forma simple y escalable.

## 🎯 Filosofía: Configuración Única

El sistema está diseñado para que **solo necesites agregar métricas en un lugar** y todo lo demás se construya automáticamente:

- ✅ Las consultas SQL se generan dinámicamente
- ✅ La respuesta de la API se construye automáticamente
- ✅ Los tipos de TypeScript se actualizan automáticamente
- ✅ La documentación de OpenAPI se ajusta automáticamente

## 📍 Archivo de Configuración

Todas las métricas se configuran en: `src/config/metrics.config.ts`

## 🚀 Cómo Agregar una Nueva Métrica

### Ejemplo: Agregar métrica de "Costos"

**Paso 1:** Edita `src/config/metrics.config.ts`

```typescript
export const BALANCE_METRICS: MetricConfig[] = [
  {
    table: 'transactions',
    field: 'sales_price',
    aggregation: 'sum',
    alias: 'sales',
  },
  {
    table: 'budget',
    field: 'sales_price',
    aggregation: 'sum',
    alias: 'budget',
  },
  {
    table: 'pedidos_retenidos',
    field: 'sales_price',
    aggregation: 'sum',
    alias: 'orders',
  },
  // ⬇️ AGREGA TU NUEVA MÉTRICA AQUÍ ⬇️
  {
    table: 'costs',              // Nombre de la tabla en ClickHouse
    field: 'cost_price',          // Campo a agregar
    aggregation: 'sum',           // Función de agregación
    alias: 'costs',               // Alias para la respuesta
  },
];
```

**Paso 2:** ¡Ya está! 🎉

El sistema automáticamente:
- Generará la consulta SQL para `costs`, `costs_last_year`, y `costs_vs_last_year`
- Incluirá los valores en la respuesta de la API
- Actualizará los tipos de TypeScript
- Ajustará el esquema de OpenAPI

### Ejemplo de Respuesta

Antes de agregar "costs":
```json
{
  "data": {
    "sales": 10000,
    "sales_last_year": 8000,
    "sales_vs_last_year": 25.0,
    "budget": 9000,
    "budget_last_year": 8500,
    "budget_vs_last_year": 5.88,
    "orders": 11000,
    "orders_last_year": 10000,
    "orders_vs_last_year": 10.0,
    "sales_vs_budget": 11.11,
    "budget_achievement_pct": 111.11,
    "order_fulfillment_pct": 110.0
  }
}
```

Después de agregar "costs":
```json
{
  "data": {
    "sales": 10000,
    "sales_last_year": 8000,
    "sales_vs_last_year": 25.0,
    "budget": 9000,
    "budget_last_year": 8500,
    "budget_vs_last_year": 5.88,
    "orders": 11000,
    "orders_last_year": 10000,
    "orders_vs_last_year": 10.0,
    "costs": 7000,                    // ⬅️ NUEVA
    "costs_last_year": 6500,          // ⬅️ NUEVA
    "costs_vs_last_year": 7.69,       // ⬅️ NUEVA
    "sales_vs_budget": 11.11,
    "budget_achievement_pct": 111.11,
    "order_fulfillment_pct": 110.0
  }
}
```

## 📊 Cómo Agregar Métricas Calculadas

Las métricas calculadas se derivan de métricas base (ej: margen de ganancia = ventas - costos)

**Ejemplo:** Agregar "profit_margin"

Edita `CALCULATED_METRICS` en `src/config/metrics.config.ts`:

```typescript
export const CALCULATED_METRICS: CalculatedMetricConfig[] = [
  {
    name: 'sales_vs_budget',
    type: 'percentage',
    dependencies: ['sales', 'budget'],
    description: 'Sales variance vs budget as percentage',
  },
  {
    name: 'budget_achievement_pct',
    type: 'percentage',
    dependencies: ['sales', 'budget'],
    description: 'Budget achievement percentage',
  },
  {
    name: 'order_fulfillment_pct',
    type: 'percentage',
    dependencies: ['orders', 'sales'],
    description: 'Order fulfillment percentage',
  },
  // ⬇️ AGREGA TU MÉTRICA CALCULADA AQUÍ ⬇️
  {
    name: 'profit_margin',
    type: 'percentage',
    dependencies: ['sales', 'costs'],
    description: 'Profit margin percentage',
  },
];
```

**Nota:** Las métricas calculadas actualmente se procesan en `temporal-query-builder.ts` en el método `addCalculatedMetrics()`. Si necesitas una nueva métrica calculada, también debes agregar la lógica de cálculo allí.

## 🔧 Funciones de Agregación Disponibles

- `sum`: Suma de valores
- `avg`: Promedio
- `count`: Conteo
- `min`: Valor mínimo
- `max`: Valor máximo

## 📝 Estructura de Métricas

Cada métrica en `BALANCE_METRICS` genera automáticamente 3 campos en la respuesta:

1. **`{alias}`**: Valor del período actual
2. **`{alias}_last_year`**: Valor del mismo período del año anterior
3. **`{alias}_vs_last_year`**: Variación porcentual año-sobre-año

## 🎨 Campos Requeridos

```typescript
interface MetricConfig {
  table: string;        // Tabla en ClickHouse (sin prefijo)
  field: string;        // Campo a agregar
  aggregation: string;  // Función de agregación
  alias: string;        // Nombre en la respuesta
}
```

## ⚡ Performance

- Una sola consulta SQL para todas las métricas
- Todos los cálculos se hacen en ClickHouse (no en Node.js)
- CTEs (Common Table Expressions) para máxima eficiencia
- Consultas parametrizadas para prevenir SQL injection

## 🧪 Testing

Cuando agregues una nueva métrica, los tests existentes seguirán funcionando porque el sistema es dinámico. Solo necesitas actualizar los mocks en los tests si quieres verificar la nueva métrica específicamente.

## 📚 Ejemplo Completo: Agregar "Inventory"

```typescript
// src/config/metrics.config.ts
export const BALANCE_METRICS: MetricConfig[] = [
  // ... métricas existentes ...
  {
    table: 'inventory',       // Tabla de inventario
    field: 'quantity',        // Campo de cantidad
    aggregation: 'sum',       // Sumar cantidades
    alias: 'inventory',       // Nombre en API
  },
];
```

Resultado en API:
```json
{
  "inventory": 5000,
  "inventory_last_year": 4500,
  "inventory_vs_last_year": 11.11
}
```

## 🔒 Seguridad

- Todos los nombres de campo están validados contra una lista blanca
- Consultas parametrizadas para prevenir SQL injection
- Validación de tipos en tiempo de compilación con TypeScript

## 🆘 Troubleshooting

### La nueva métrica no aparece en la respuesta

1. Verifica que el campo `alias` sea único
2. Confirma que la tabla existe en ClickHouse con el prefijo configurado
3. Verifica que el campo existe en la tabla
4. Reinicia el servidor (`npm run dev`)

### Error de SQL

Asegúrate que:
- El nombre de la tabla es correcto
- El campo existe en ClickHouse
- La agregación es compatible con el tipo de dato

---

¿Preguntas? Revisa `src/config/metrics.config.ts` para ver ejemplos completos.
