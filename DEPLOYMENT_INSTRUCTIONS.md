# Instrucciones de Despliegue a Producción

## Nuevos Cambios Implementados

### 1. Sistema SSO con JWT
- Autenticación con JWT del sistema Dyna externo
- Endpoint: `/api/auth/sso/dyna-login?token={JWT}`
- Nueva dependencia: `jsonwebtoken`

### 2. Página de Mantenimiento Temporal
- Todos los enlaces del sidebar redirigen a `/mantenimiento`
- Dashboard principal sigue accesible directamente

### 3. Nueva Variable de Entorno Requerida
- `SSO_SECRET_KEY`: Clave secreta para validar tokens JWT del sistema Dyna

---

## Pasos para Desplegar en Producción

### OPCIÓN A: Despliegue Completo (Recomendado si es primera vez)

1. **Conectar al servidor de producción**
   ```bash
   ssh your-server
   cd /path/to/dynainfo
   ```

2. **Hacer pull del nuevo código**
   ```bash
   git pull origin master
   ```

3. **Ejecutar setup de producción** (Esto te pedirá todas las variables incluyendo SSO_SECRET_KEY)
   ```bash
   make setup-prod
   ```

   **IMPORTANTE:** Cuando te pida el `SSO Secret Key`, ingresa:
   ```
   69101241e01f0b5962c8d24ab8c554e1240cf43bdff870507e2769dd03ecb4f3120cc11cdbcaebe4a34aed319a0791ca7c508ea9eeb198f972c995fce54b264b9e99a236cd7159ec48b4e60ac39503d9b836c03a92f68b3d523fb8d3bddce028
   ```

4. **El wizard te preguntará si quieres desplegar ahora**
   - Responde `y` para desplegar automáticamente
   - O ejecuta `make deploy` manualmente después

---

### OPCIÓN B: Solo Actualizar Configuración (Si ya tienes .env configurado)

1. **Conectar al servidor**
   ```bash
   ssh your-server
   cd /path/to/dynainfo
   ```

2. **Pull del código**
   ```bash
   git pull origin master
   ```

3. **Agregar SSO_SECRET_KEY al archivo .env existente**
   ```bash
   cd api
   nano .env
   ```

   Agregar al final del archivo:
   ```env
   # SSO Configuration (Dyna system integration)
   SSO_SECRET_KEY=69101241e01f0b5962c8d24ab8c554e1240cf43bdff870507e2769dd03ecb4f3120cc11cdbcaebe4a34aed319a0791ca7c508ea9eeb198f972c995fce54b264b9e99a236cd7159ec48b4e60ac39503d9b836c03a92f68b3d523fb8d3bddce028
   ```

4. **Desplegar**
   ```bash
   cd ..
   make deploy
   ```

---

## Verificación Post-Despliegue

### 1. Verificar que los contenedores están corriendo
```bash
docker compose -f api/docker-compose.production.yml ps
```

Deberías ver:
- `dynainfo-postgres-prod` (healthy)
- `dynainfo-api-prod` (healthy)

### 2. Verificar logs del API
```bash
docker compose -f api/docker-compose.production.yml logs -f api
```

No deberías ver errores relacionados con `SSO_SECRET_KEY`

### 3. Probar el SSO
El sistema Dyna externo podrá enviar usuarios a:
```
https://api.dynainfo.com.co/api/auth/sso/dyna-login?token={JWT}
```

### 4. Verificar el frontend
- Visitar https://dynainfo.com.co
- Todos los enlaces del sidebar deberían mostrar "Página en mantenimiento"
- El dashboard principal debería estar accesible

---

## Troubleshooting

### Error: "SSO_SECRET_KEY environment variable is required"
**Solución:** Asegúrate de que la variable está en `api/.env` y reinicia los contenedores:
```bash
make deploy
```

### El SSO retorna "INVALID_TOKEN"
**Posibles causas:**
1. Token JWT expirado (10 minutos de validez por defecto)
2. SSO_SECRET_KEY incorrecto
3. Formato de JWT inválido

**Verificar:**
```bash
cd api
cat .env | grep SSO_SECRET_KEY
```

### Package lock errors durante el build
**Solución:** El `package-lock.json` ahora está en el repositorio. Si hay conflictos:
```bash
cd api
rm package-lock.json
npm install
git add package-lock.json
git commit -m "Update package-lock.json"
```

---

## Rollback (En caso de problemas)

Si necesitas revertir los cambios:

```bash
# Volver al commit anterior
git reset --hard f0630ed^

# Reconstruir contenedores
make deploy
```

---

## Nuevas Dependencias

El siguiente paquete fue agregado y se instalará automáticamente durante el build:
- `jsonwebtoken@^9.0.3`
- `@types/jsonwebtoken@^9.0.10`

---

## Contacto

Si tienes problemas durante el despliegue, contacta al equipo de desarrollo.
