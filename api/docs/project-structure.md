# Estructura del Proyecto

## 📁 Directorios Clave

```
src/
├── core/config/          # Configuración central (métricas, dimensiones)
├── core/db/query/        # Query builders para ClickHouse
├── core/utils/           # Utilidades (parsers, sanitization)
├── features/             # Endpoints (balance, list)
└── plugins/              # Fastify plugins (rate-limit, security)

test/                     # Tests espejo de src/
docs/                     # Documentación
```

## 🔑 Archivos Importantes

### Configuración
- `src/core/config/metrics.config.ts` - Definir métricas
- `src/core/config/dimensions.config.ts` - Definir dimensiones
- `src/core/config/dimension-fields.config.ts` - Mapeo id→name

### Query Layer
- `src/core/db/query/analytics-query-builder.ts` - Query builder principal
- `src/core/db/query/filter-builder.ts` - WHERE clauses
- `src/core/db/query/metric-calculator.ts` - Métricas calculadas

### Features (patrón: routes → service → query builder)
```
features/list/
├── list.routes.ts    # HTTP endpoints
├── list.schemas.ts   # Validación TypeBox
└── list.service.ts   # Business logic
```

## 🔄 Flujo de Request

```
HTTP Request
  ↓
routes.ts (valida query params)
  ↓
service.ts (business logic)
  ↓
analytics-query-builder.ts (genera SQL)
  ↓
ClickHouse (ejecuta query)
  ↓
HTTP Response (JSON)
```

## 🧪 Testing

- Un archivo `.test.ts` por cada fuente
- Mocks con `vi.fn()` de Vitest
- Target: 99% coverage mínimo
