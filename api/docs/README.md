# DynaInfo API - Documentación

API REST de analytics financieros con comparaciones YoY, filtrado dinámico y agrupación.

## ✨ Features

- **Comparaciones YoY** - Automático current vs last year + % variación
- **Filtrado dinámico** - Por cualquier campo: `?seller_id=S001,S002&country=españa`
- **Agrupación** - Por dimensión: `?groupBy=seller_id`
- **Ordenamiento** - Por cualquier métrica: `?orderBy=sales&orderDirection=desc`
- **Paginación** - `?page=1&limit=50` (window functions, sin COUNT extra)
- **Métricas calculadas** - Automáticas (sales_vs_budget, profit_margin, etc.)
- **Type-safe** - TypeBox schemas + TypeScript strict
- **SQL injection protected** - Allowlists y sanitización

## 📈 Endpoints

> **Documentación interactiva:** [Swagger UI](http://localhost:3000/docs) (una vez iniciado el servidor)

### `GET /api/balance`
Balance único con comparación YoY de todas las métricas.

**Ejemplo:**
```bash
GET /api/balance?startDate=2025-01-01&endDate=2025-01-31&seller_id=S001,S002
```

### `GET /api/list`
Lista agrupada por dimensión con YoY.

**Ejemplos:**
```bash
# Agrupar por vendedor
GET /api/list?groupBy=seller_id&orderBy=sales&orderDirection=desc

# Filtrar + paginar
GET /api/list?groupBy=IdRegional&country=españa&page=2&limit=20

# Ordenar por métrica calculada
GET /api/list?groupBy=month&orderBy=sales_vs_budget
```

**Parámetros:**
- `groupBy` (required): seller_id, IdRegional, month, quarter, year, customer_id, product_id
- `orderBy` (optional): cualquier métrica o "name" (default: sales)
- `orderDirection` (optional): asc o desc (default: desc)
- `page`, `limit` (optional): paginación
- Cualquier otro campo: filtro dinámico

**Respuesta incluye:**


- `id` - ID de la dimensión
- `name` - Nombre descriptivo (si existe en BD)
- Métricas actuales: `sales`, `budget`, `orders`, etc.
- Métricas last year: `sales_ly`, `budget_ly`, etc.
- Variaciones YoY: `sales_vs_last_year`, etc.
- Métricas calculadas: `sales_vs_budget`, etc.


## 📚 Documentación

- **[Estructura del Proyecto](./project-structure.md)** - Organización del código
- **[Cómo Agregar Campos](./adding-fields.md)** - Agregar métricas y dimensiones

## 🚀 Quick Start

```bash
npm install
cp .env.example .env
npm run dev
npm test
```

## 📊 Stack

- Fastify 5 + TypeScript strict
- ClickHouse
- Vitest (99.73% coverage)
