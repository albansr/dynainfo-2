# Cómo Agregar Campos

## 📊 Agregar Nueva Métrica

**Ejemplo:** Agregar métrica `profit` (ganancia)

### 1. Agregar configuración

**Archivo:** `src/core/config/metrics.config.ts`

```typescript
export const BALANCE_METRICS: MetricConfig[] = [
  // ... métricas existentes
  {
    table: 'transactions',
    field: 'profit_amount',
    aggregation: 'sum',
    alias: 'profit',
  },
];
```

**Listo.** Automáticamente:
- ✅ Aparece en `/api/balance` y `/api/list`
- ✅ Incluye YoY comparison (`profit_ly`, `profit_vs_last_year`)
- ✅ Disponible para ordenamiento (`orderBy=profit`)
- ✅ OpenAPI docs actualizados

### 2. Agregar métrica calculada (opcional)

```typescript
export const CALCULATED_METRICS: CalculatedMetricConfig[] = [
  // ... existentes
  {
    alias: 'profit_margin',
    formula: '(profit / sales) * 100',
    dependencies: ['profit', 'sales'],
  },
];
```

### 3. Agregar tests

**Archivo:** `test/core/config/metrics.config.test.ts`

```typescript
it('should include profit metric', () => {
  const profit = BALANCE_METRICS.find(m => m.alias === 'profit');
  expect(profit).toBeDefined();
  expect(profit?.table).toBe('transactions');
});
```

---

## 🏷️ Agregar Nueva Dimensión

**Ejemplo:** Agregar dimensión `product_category`

### 1. Agregar a configuración

**Archivo:** `src/core/config/dimensions.config.ts`

```typescript
export const ALLOWED_DIMENSIONS = [
  'seller_id',
  'IdRegional',
  'month',
  'product_category',  // ← Nueva dimensión
] as const;
```

### 2. Si tiene campo "name" separado (opcional)

**Archivo:** `src/core/config/dimension-fields.config.ts`

```typescript
const ID_TO_NAME_MAP: Record<string, string> = {
  customer_id: 'customer_name',
  product_id: 'product_name',
  seller_id: 'seller_name',
  product_category: 'category_name',  // ← Mapeo
};
```

**Listo.** Automáticamente:
- ✅ Disponible en `/api/list?groupBy=product_category`
- ✅ Validación en schemas
- ✅ Retorna `{id, name}` si tiene mapeo

### 3. Agregar tests

**Archivo:** `test/core/config/dimensions.config.test.ts`

```typescript
it('should allow product_category dimension', () => {
  expect(ALLOWED_DIMENSIONS).toContain('product_category');
});
```

---

## ✅ Checklist

Después de agregar campos:

```bash
# 1. Ejecutar tests
npm test

# 2. Verificar coverage
npm run test:coverage

# 3. Verificar linter
npm run lint

# 4. Verificar que compila
npm run build
```

---

## 🔍 Troubleshooting

### La métrica no aparece en la respuesta
- ✅ Verificar que el campo existe en ClickHouse
- ✅ Verificar nombre de tabla en `table:` de config
- ✅ Verificar agregación (`sum`, `avg`, `count`, etc.)

### La dimensión no funciona
- ✅ Verificar que está en `ALLOWED_DIMENSIONS`
- ✅ Verificar que el campo existe en todas las tablas (transactions, budget, pedidos_retenidos)

### El campo name no aparece
- ✅ Verificar que existe en tabla `transactions`
- ✅ Verificar mapeo en `dimension-fields.config.ts`
- ✅ Otras tablas (budget, pedidos) pueden no tener el campo name
