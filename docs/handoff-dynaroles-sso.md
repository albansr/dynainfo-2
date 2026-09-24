# Handoff — DynaRoles (SSO) para IT de Dyna

Documento de traspaso: qué debe enviar Dyna en el JWT del SSO para que el control
de acceso por rol funcione en DynaInfo 2.0.

---

## 1. Qué tiene que hacer Dyna

En el **JWT del SSO** (firmado con `SSO_SECRET_KEY`, enviado a `/sso/dyna-login`),
rellenar **dos claims**:

| Claim   | Tipo   | Obligatorio | Descripción |
|---------|--------|-------------|-------------|
| `role`  | string | recomendado | Perfil del usuario (catálogo §2). Si va vacío → se asume `MANAGER`. |
| `scope` | string | solo 2 roles | Ámbito del usuario. Solo se usa en `DISTRIBUTION` y `SELLER` (§3). En el resto: omitir o vacío. |

Payload esperado:

```json
{
  "uid": "...",
  "email": "...",
  "nombre": "...",
  "role": "DISTRIBUTION",
  "scope": "2",
  "iat": 0,
  "exp": 0
}
```

DynaInfo persiste ambos (`user.dyna_role`, `user.scope`) y los sincroniza en cada login.
El resto de claims (`uid`, `email`, `nombre`) siguen igual que hoy.

---

## 2. Catálogo de `role` (valores EXACTOS, en mayúsculas)

| `role`         | Etiqueta               | Qué ve / restricciones |
|----------------|------------------------|------------------------|
| `ADMIN`        | Gerencia General       | Todo sin restricción (todas las temporalidades, todos los años, Excel sí) |
| `MANAGER`      | Gerencias              | Todas las páginas; 4 temporalidades; años 2024-2025; Excel sí. **Default si `role` va vacío** |
| `BOARD`        | Junta General          | Todas las páginas; **solo Mes anterior + Acumulado**; años 2024-2025; Excel sí |
| `RETAIL`       | Dirección Retail       | Retail; 4 temporalidades; 2024-2025; Excel sí |
| `NEW_CHANNELS` | Dirección Nuevos Canales | Exportaciones + Cadenas; 4 temporalidades; 2024-2025; Excel sí |
| `DISTRIBUTION` | Directores             | Distribución **recortada por grupo regional** (via `scope`); 4 temporalidades; 2024-2025; Excel sí |
| `SELLER`       | Vendedores             | **Solo su zona** (via `scope` = su seller_id); 4 temporalidades; **solo año 2025**; **Excel NO** |

*(4 temporalidades = Mes anterior, Mes actual, Acumulado, Hoy.)*

---

## 3. `scope` — cuándo y con qué valor

Solo se interpreta para dos roles; en los demás se ignora.

### a) `role = DISTRIBUTION` → `scope` = grupo regional `"1"`, `"2"` o `"3"`

| `scope` | Regionales que ve | Director (referencia cliente) |
|---------|-------------------|-------------------------------|
| `"1"`   | `0001` Costa Atlántica (BQLLA), `0026` Oriente | César Pérez de la Rosa |
| `"2"`   | `0002` Andina (Medellín), `0004` Bogotá Ciudad, `0019` Centro, `0018` Territorio Especial | Omar Nausan Parra |
| `"3"`   | `0003` Costa Pacífica (Cali), `0033` Eje Centro | Jhon Alexander Castañeda |

> Un `DISTRIBUTION` **sin `scope`** ve **toda** la distribución sin filtro regional.

### b) `role = SELLER` → `scope` = el `seller_id` (código de vendedor)

Es el valor que recorta la data a su zona. Debe venir siempre para que el vendedor
vea solo lo suyo.

---

## 4. Roles antiguos → nuevos

Los strings antiguos **ya no se usan**. Dyna debe migrar a los nuevos:

| `role` antiguo          | `role` nuevo                | Notas |
|-------------------------|-----------------------------|-------|
| `MANAGER` (acceso total)| `ADMIN` **o** `MANAGER`     | Antes `MANAGER` era acceso total. Ahora: `ADMIN` = Gerencia General sin restricción; `MANAGER` = Gerencias (con temporalidad/años acotados). Asignar según corresponda. |
| *(role vacío)*          | `MANAGER`                   | Sin cambios: vacío sigue cayendo en `MANAGER` (Gerencias). |
| `MANAGER_DISTRIBUTION`  | `DISTRIBUTION` (+ `scope`)  | Ahora requiere `scope` (grupo regional) para el recorte. |
| `MANAGER_CADENAS`       | `NEW_CHANNELS`              | Cadenas y Exportaciones se **fusionan** en un solo rol. |
| `MANAGER_EXPORTATION`   | `NEW_CHANNELS`              | Idem (fusionado con Cadenas). |
| `MANAGER_RETAIL`        | `RETAIL`                    | — |
| *(no existía)*          | `BOARD`                     | Nuevo: Junta General. |
| *(no existía)*          | `SELLER` (+ `scope`)        | Nuevo: Vendedores; requiere `scope` = seller_id. |

---

## 5. Notas

- Los grupos regionales 1/2/3 están **hardcodeados en DynaInfo** (mapa `scope → lista de IdRegional`).
  Si cambian regionales de grupo, se ajusta config en DynaInfo; Dyna solo manda "1"/"2"/"3".
- **Seguridad: hoy el recorte se aplica en frontend.** El `role`/`scope` definen qué ve el usuario,
  pero un usuario técnico podría saltarse el filtro. El blindaje en backend se hará en una fase
  posterior. (Informativo; no requiere acción de Dyna.)
