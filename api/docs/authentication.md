# Authentication System

Sistema de autenticación basado en Better Auth con Email OTP (One-Time Password).

## Características

- **Autenticación sin contraseñas**: Los usuarios inician sesión con códigos OTP de 6 dígitos enviados por email
- **Sesiones JWT**: Tokens con 7 días de validez, renovación automática cada 24 horas
- **Roles jerárquicos**: `superadmin` > `admin` > `user`
- **PostgreSQL**: Base de datos separada para autenticación (no usa ClickHouse)
- **Resend**: Servicio de envío de emails con templates HTML profesionales

## Flujo de Autenticación

### 1. Solicitar código OTP

```http
POST /api/auth/email-otp/send-verification-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "type": "sign-in"
}
```

**Respuesta:**
```json
{
  "message": "OTP sent successfully"
}
```

El usuario recibirá un email con un código de 6 dígitos que expira en 10 minutos.

### 2. Verificar código OTP

```http
POST /api/auth/email-otp/verify-email
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Respuesta exitosa:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin"
  },
  "session": {
    "token": "jwt_token_here",
    "expiresAt": "2024-01-15T10:00:00.000Z"
  }
}
```

### 3. Usar token en requests

Incluye el token en el header Authorization de todas las requests autenticadas:

```http
GET /api/users
Authorization: Bearer jwt_token_here
```

### 4. Cerrar sesión

```http
POST /api/auth/sign-out
Authorization: Bearer jwt_token_here
```

### 5. Obtener sesión actual

```http
GET /api/auth/get-session
Authorization: Bearer jwt_token_here
```

**Respuesta:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin"
  },
  "session": {
    "expiresAt": "2024-01-15T10:00:00.000Z"
  }
}
```

## Sistema de Roles

### Jerarquía de Roles

1. **superadmin** (nivel 3)
   - Acceso completo al sistema
   - Puede eliminar permanentemente usuarios
   - Puede gestionar otros admins y superadmins

2. **admin** (nivel 2)
   - Puede listar, crear, actualizar y desactivar usuarios
   - Puede gestionar usuarios regulares
   - No puede eliminar permanentemente

3. **user** (nivel 1)
   - Acceso básico al sistema
   - Sin permisos de gestión de usuarios

### Uso en Middleware

```typescript
import { authenticate } from '../core/middleware/authenticate.js';
import { requireAdmin, requireSuperadmin } from '../core/middleware/authorize.js';

// Requiere cualquier usuario autenticado
fastify.get('/profile', {
  preHandler: [authenticate]
}, handler);

// Requiere admin o superior
fastify.get('/users', {
  preHandler: [authenticate, requireAdmin]
}, handler);

// Requiere superadmin
fastify.delete('/users/:id/permanent', {
  preHandler: [authenticate, requireSuperadmin]
}, handler);
```

## Configuración Inicial

### 1. Variables de Entorno

Copia `.env.example` a `.env` y configura:

```bash
# PostgreSQL (Auth Database)
POSTGRES_URL=postgresql://dynainfo:dynainfo_dev@localhost:5432/dynainfo_auth

# Better Auth
BETTER_AUTH_SECRET=your-secret-key-here  # Genera con: openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000

# Resend
RESEND_API_KEY=re_your_api_key_here

# Superadmin inicial (opcional)
SUPERADMIN_EMAIL=admin@dynainfo.com
SUPERADMIN_NAME=Super Admin
```

### 2. Iniciar PostgreSQL

```bash
make db-up
```

### 3. Crear schema

```bash
npm run db:push
```

### 4. Crear superadmin inicial

```bash
npm run db:seed
```

Este comando crea (o actualiza) el usuario especificado en `SUPERADMIN_EMAIL` con rol de superadmin.

## Endpoints de Usuarios

Todos los endpoints requieren autenticación con rol `admin` o superior.

### Listar Usuarios

```http
GET /api/users?page=1&limit=20&search=john&role=admin&isActive=true
Authorization: Bearer jwt_token
```

**Parámetros query:**
- `page` (opcional): Número de página (default: 1)
- `limit` (opcional): Items por página (default: 20, max: 100)
- `search` (opcional): Buscar por email o nombre
- `role` (opcional): Filtrar por rol (superadmin/admin/user)
- `isActive` (opcional): Filtrar por estado activo/inactivo

**Respuesta:**
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "admin",
      "isActive": true,
      "emailVerified": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "total": 100,
    "count": 20,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### Obtener Usuario por ID

```http
GET /api/users/:id
Authorization: Bearer jwt_token
```

### Crear Usuario

```http
POST /api/users
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "email": "newuser@example.com",
  "name": "New User",
  "role": "user",
  "isActive": true
}
```

### Actualizar Usuario

```http
PATCH /api/users/:id
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "name": "Updated Name",
  "role": "admin",
  "isActive": false
}
```

### Desactivar Usuario (Soft Delete)

```http
DELETE /api/users/:id
Authorization: Bearer jwt_token
```

Esto establece `isActive = false`. El usuario no puede iniciar sesión pero sus datos persisten.

### Eliminar Usuario Permanentemente (Superadmin only)

```http
DELETE /api/users/:id/permanent
Authorization: Bearer jwt_token
```

Elimina permanentemente el usuario de la base de datos. Requiere rol `superadmin`.

## Seguridad

- **Tokens JWT**: Firmados con ES256, expiran en 7 días
- **OTP**: Códigos de 6 dígitos con 10 minutos de expiración
- **Rate Limiting**: 100 requests/minuto en producción
- **Helmet**: Headers de seguridad HTTP configurados
- **CORS**: Configurado para development, restrictivo en production
- **XSS Protection**: Habilitado
- **CSRF**: Protección mediante tokens en Better Auth

## Arquitectura de Base de Datos

```
PostgreSQL (dynainfo_auth)
├── user                    # Tabla custom (schema.ts)
│   ├── id (uuid)
│   ├── email (unique)
│   ├── name
│   ├── role (superadmin/admin/user)
│   ├── isActive
│   ├── emailVerified
│   ├── createdAt
│   └── updatedAt
│
├── session                 # Better Auth auto-generated
├── verification            # Better Auth auto-generated (OTP codes)
└── account                 # Better Auth auto-generated
```

## Email Template

Los emails OTP incluyen:
- Diseño HTML responsive
- Gradiente purple/blue
- Código destacado en grande
- Mensaje de expiración (10 minutos)
- Branding de DynaInfo

## Troubleshooting

### Error: "POSTGRES_URL environment variable is not set"

Asegúrate de tener `.env` configurado con `POSTGRES_URL`.

### Error: "Failed to send verification email"

Verifica que `RESEND_API_KEY` esté configurado correctamente en `.env`.

### Error: "Invalid or expired verification code"

Los códigos OTP expiran en 10 minutos. Solicita uno nuevo.

### Usuario no puede iniciar sesión después de crearlo

Los usuarios creados por admin tienen `emailVerified = false`. Deben usar el flujo de OTP para verificar su email y poder iniciar sesión.

## Próximos Pasos

- [ ] Implementar sistema de permisos granulares
- [ ] Añadir OAuth providers (Google, GitHub)
- [ ] Implementar 2FA
- [ ] Multi-tenancy con tabla Company
