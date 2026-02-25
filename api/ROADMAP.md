# API Roadmap - Funcionalidades Pendientes

## 📊 Contexto del Proyecto

- **Tipo:** API interna expuesta a clientes externos
- **Usuarios:** 10-100 usuarios concurrentes
- **Datos:** 1M-100M registros en ClickHouse
- **Autenticación:** Necesaria (clientes externos)
- **Export:** Crítico (Excel/CSV)
- **Análisis temporal:** Ya funciona con periodos custom

## ✅ Estado Actual (Lo que ya tienes)

### Endpoints Implementados
- `GET /api/balance` - Balance sheet con YoY comparisons
- `GET /api/list` - Lista agrupada por dimensión
- `GET /health` - Health checks detallados
- `GET /docs` - Documentación Swagger

### Características Implementadas
- ✅ Filtrado dinámico por cualquier campo
- ✅ Paginación (20-100 items)
- ✅ Ordenamiento configurable
- ✅ Comparaciones año-sobre-año
- ✅ Métricas calculadas
- ✅ Rate limiting (100 req/min production)
- ✅ Security headers (Helmet)
- ✅ SQL injection protection
- ✅ 99.73% test coverage
- ✅ TypeScript + TypeBox type safety
- ✅ Kubernetes-ready

## 🎯 Funcionalidades Pendientes

### Prioridad 1: CRÍTICO (Implementar primero)

#### 1. Autenticación & Autorización
**Por qué:** API expuesta a clientes externos, necesitas identificar usuarios

**Implementación recomendada:**
- **JWT Authentication** con `@fastify/jwt`
- Token en header: `Authorization: Bearer <token>`
- Refresh tokens para sesiones largas
- Rate limiting por usuario

**Archivos a crear:**
```
src/core/auth/
  ├── auth.plugin.ts       # Fastify plugin para JWT
  ├── auth.middleware.ts   # Middleware de verificación
  └── auth.schemas.ts      # Schemas de login/token

src/features/auth/
  ├── auth.routes.ts       # POST /api/auth/login, /refresh
  └── auth.service.ts      # Lógica de autenticación
```

**Ejemplo de uso:**
```typescript
// Proteger endpoints
fastify.get('/api/balance', {
  preHandler: [fastify.authenticate], // <- Middleware de auth
  schema: { ... }
}, handler);
```

**Estimación:** 3-4 días

---

#### 2. Export a Excel/CSV
**Por qué:** Requisito crítico del negocio

**Implementación recomendada:**
- **CSV:** `csv-stringify` (streaming para datasets grandes)
- **Excel:** `exceljs` (formato profesional con estilos)

**Endpoints nuevos:**
```
GET /api/balance/export/csv
GET /api/balance/export/xlsx
GET /api/list/export/csv
GET /api/list/export/xlsx
```

**Query parameters:**
```
?format=csv|xlsx
&filename=reporte-ventas-2025
&includeHeaders=true
&maxRows=10000  // Límite de seguridad
```

**Archivos a crear:**
```
src/core/export/
  ├── csv-exporter.ts      # Lógica de export CSV
  ├── excel-exporter.ts    # Lógica de export Excel
  └── export.types.ts      # Tipos compartidos

src/features/balance/
  └── balance-export.routes.ts  # Endpoints de export

src/features/list/
  └── list-export.routes.ts
```

**Consideraciones:**
- Streaming para archivos grandes (no cargar todo en memoria)
- Content-Disposition header para descarga automática
- Timeout mayor para exports (60s vs 30s normal)
- Límite de filas para evitar abusos (10K-50K)

**Ejemplo respuesta:**
```typescript
reply.header('Content-Type', 'text/csv')
     .header('Content-Disposition', 'attachment; filename="ventas-2025.csv"')
     .send(csvStream);
```

**Estimación:** 3-4 días

---

### Prioridad 2: IMPORTANTE (Siguiente fase)

#### 3. Caching con Redis
**Por qué:** Volumen medio de datos → queries pueden ser costosas

**Implementación recomendada:**
- **Redis** con `@fastify/redis`
- Cache TTL: 5-15 minutos (configurable)
- Cache key basado en query params

**Estrategia de cache:**
```typescript
// Cache key example:
const cacheKey = `balance:${hash(filters)}:${startDate}:${endDate}`;

// TTL por endpoint:
- /api/balance: 10 min (cambia poco)
- /api/list: 5 min (más dinámico)
- Exports: no cachear (siempre fresh)
```

**Archivos a crear:**
```
src/core/cache/
  ├── cache.plugin.ts      # Redis connection
  ├── cache.service.ts     # Get/Set/Invalidate
  └── cache.decorator.ts   # @Cacheable decorator
```

**Beneficios:**
- Response time: 500ms → 10ms
- Reduce carga en ClickHouse 70-90%
- Soporta más usuarios concurrentes

**Estimación:** 2-3 días

---

#### 4. API Versioning
**Por qué:** Clientes externos necesitan estabilidad

**Cambios:**
```
Antes: /api/balance
Ahora: /v1/api/balance
```

**Implementación:**
```typescript
// src/server.ts
fastify.register(balanceRoutes, { prefix: '/v1/api' });
fastify.register(listRoutes, { prefix: '/v1/api' });

// Deprecation headers
reply.header('X-API-Version', '1.0.0');
reply.header('X-API-Deprecated', 'false');
```

**Estimación:** 1-2 días

---

### Prioridad 3: RECOMENDADO (Futuro)

#### 5. Audit Logging
**Por qué:** Compliance, seguridad, debugging

**Qué loguear:**
```typescript
{
  timestamp: '2025-01-05T22:30:00Z',
  userId: 'user123',
  clientId: 'acme-corp',
  endpoint: '/v1/api/balance',
  method: 'GET',
  queryParams: { startDate: '2025-01-01', seller_id: 'S001' },
  responseTime: 245,
  statusCode: 200,
  ipAddress: '192.168.1.100',
  userAgent: 'Mozilla/5.0...'
}
```

**Almacenamiento:**
- Archivo de log separado: `logs/audit.log`
- O tabla en ClickHouse: `audit_logs`
- Retención: 90 días mínimo

**Estimación:** 1-2 días

---

#### 6. Metadata Endpoints
**Por qué:** Clientes necesitan descubrir qué pueden consultar

**Endpoints nuevos:**
```
GET /v1/api/metadata/metrics
GET /v1/api/metadata/dimensions
GET /v1/api/metadata/filters/{field}
```

**Ejemplo respuesta `/metadata/metrics`:**
```json
{
  "metrics": [
    {
      "name": "sales",
      "description": "Total sales amount",
      "type": "currency",
      "aggregation": "sum"
    },
    {
      "name": "budget",
      "description": "Budget amount",
      "type": "currency",
      "aggregation": "sum"
    }
  ],
  "calculated": [
    {
      "name": "sales_vs_budget",
      "description": "Sales vs budget variance %",
      "formula": "(sales - budget) / budget * 100",
      "dependencies": ["sales", "budget"]
    }
  ]
}
```

**Estimación:** 1-2 días

---

## 📅 Roadmap Propuesto

### Fase 1: MVP Clientes (1-2 semanas)
1. ✅ Autenticación JWT (3-4 días)
2. ✅ Export CSV/Excel (3-4 días)

**Objetivo:** API lista para clientes externos con funcionalidad básica

---

### Fase 2: Performance & Estabilidad (1 semana)
3. ✅ Redis caching (2-3 días)
4. ✅ API versioning (1-2 días)

**Objetivo:** API escalable y estable para producción

---

### Fase 3: Mejoras Opcionales (1 semana)
5. ⚠️ Audit logging (1-2 días)
6. ⚠️ Metadata endpoints (1-2 días)
7. ⚠️ Aggregation totals endpoint (2 días)

**Objetivo:** Features adicionales según demanda de clientes

---

## 🛠️ Stack Técnico Recomendado

### Autenticación
- `@fastify/jwt` - JWT authentication
- `bcrypt` - Password hashing (si hay login)
- `@fastify/oauth2` - Si necesitas OAuth2/SSO

### Export
- `csv-stringify` - CSV generation (streaming)
- `exceljs` - Excel generation con formato
- `archiver` - ZIP múltiples archivos

### Caching
- `@fastify/redis` - Redis client
- `ioredis` - Redis avanzado (cluster support)
- `cache-manager` - Abstracción multi-cache

### Monitoring (opcional)
- `prom-client` - Prometheus metrics
- `@fastify/helmet` - Ya implementado ✅
- `@opentelemetry/api` - Distributed tracing

---

## ⚠️ Funcionalidades que NO necesitas ahora

Estas pueden esperar hasta que haya demanda real:

❌ **GraphQL API** - REST es suficiente, GraphQL añade complejidad
❌ **Webhooks** - Analytics no necesita push notifications
❌ **Real-time updates** - Polling cada 30-60s es suficiente
❌ **Saved queries** - Implementar solo si clientes lo piden
❌ **Forecast/ML** - Requiere data science team
❌ **Multi-tenancy completo** - Con auth básico es suficiente inicialmente

---

## 📊 Estimación Total de Esfuerzo

| Fase | Funcionalidades | Días | Acumulado |
|------|----------------|------|-----------|
| Fase 1 | Auth + Export | 6-8 días | 6-8 días |
| Fase 2 | Cache + Versioning | 3-5 días | 9-13 días |
| Fase 3 | Audit + Metadata | 3-5 días | 12-18 días |

**Total:** 2.5-4 semanas de desarrollo

---

## 🎯 Próximos Pasos

1. **Decidir prioridad:** ¿Empezamos con Fase 1?
2. **Auth strategy:** ¿JWT simple o integración con SSO?
3. **Export limits:** ¿Cuál es el máximo de filas aceptable?
4. **Redis setup:** ¿Tienes ya Redis en infra o hay que provisionarlo?

---

## 📚 Referencias

- [Fastify Authentication](https://www.fastify.io/docs/latest/Reference/Plugins/Authentication/)
- [ExcelJS Documentation](https://github.com/exceljs/exceljs)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [API Versioning Best Practices](https://www.freecodecamp.org/news/how-to-version-a-rest-api/)

---

**Última actualización:** 2025-01-05
**Coverage actual:** 99.73% ✅
**Tests pasando:** 194/194 ✅
