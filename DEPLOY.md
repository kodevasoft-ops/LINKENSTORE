# CeluFénix / LINKENSTORE — Guía de Despliegue Completa

Este paquete contiene **todos los archivos backend/frontend creados o corregidos**
durante toda la sesión de trabajo: multi-punto, Wompi, TNS, InterSoft, WhatsApp,
Google OAuth, cupones, promociones, tests, SEO y `next/image`. NO es el
repositorio completo original — son las piezas que deben fusionarse con tu
repo real (`kodevasoft-ops/LINKENSTORE`).

---

## 1. Cómo aplicar este paquete a tu repositorio

```bash
git clone <tu-repo> LINKENSTORE
cd LINKENSTORE

cp -r ruta/al/paquete/backend/* backend/
cp -r ruta/al/paquete/frontend/* frontend/
cp -r ruta/al/paquete/nginx/* nginx/
cp ruta/al/paquete/docker-compose.yml .

git diff        # revisa antes de aceptar — varios archivos son reemplazos completos
git add .
git commit -m "Multi-punto, Wompi, TNS, WhatsApp, Google OAuth, cupones, SEO"
```

---

## 2. Variables de entorno — checklist completo

Copia `backend/.env.example` a `backend/.env` y llena cada una:

| Variable | Dónde conseguirla | Obligatoria |
|---|---|---|
| `DJANGO_SECRET_KEY` | `python -c "import secrets; print(secrets.token_urlsafe(50))"` | Sí |
| `DB_PASSWORD` | Contraseña propia, fuerte | Sí |
| `DB_SSLMODE` | `require` en producción, `prefer` en local | Sí |
| `FIELD_ENCRYPTION_KEY` | `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` | Sí — protege la credencial de WhatsApp en BD |
| `WOMPI_PUBLIC_KEY` / `WOMPI_PRIVATE_KEY` / `WOMPI_INTEGRITY_SECRET` / `WOMPI_EVENTS_SECRET` | Panel de comercio Wompi → Configuración → Llaves API | Sí |
| `TNS_API_URL` / `TNS_API_KEY` / `TNS_HMAC_SECRET` | Tu proveedor de TNS | Sí (sync de inventario) |
| `INTERSOFT_BASE_URL` / `INTERSOFT_API_KEY` / `INTERSOFT_SECRET_KEY` | Tu proveedor de InterSoft | Solo si usas rastreo de envíos |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_ACCOUNT_ID` / `R2_PUBLIC_DOMAIN` | Cloudflare Dashboard → R2 | Sí |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console (paso a paso abajo) | Solo si usas login con Google |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | Sí |
| `NEXT_PUBLIC_SITE_URL` | Tu dominio real (sitemap.xml/robots.txt) | Sí |
| `SENTRY_DSN` | sentry.io | Recomendada |

`docker-compose.yml` (servicio `frontend`) ya propaga `MEDIA_DOMAIN` automáticamente desde `R2_PUBLIC_DOMAIN`.

---

## 3. Despliegue LOCAL (para pruebas)

Los webhooks de Wompi y WhatsApp necesitan una URL pública — usa **ngrok** o **cloudflared tunnel** apuntando a tu `nginx` local, o prueba esos flujos a mano (sección 7).

```bash
cp backend/.env.example backend/.env
# Local: ALLOWED_HOSTS=localhost,127.0.0.1 · DEBUG=True · DB_SSLMODE=prefer
# Usa llaves de PRUEBA de Wompi (pub_test_/prv_test_), nunca las de producción.
nano backend/.env

docker compose up -d postgres redis pgbouncer
sleep 10

# Migrar en este orden exacto de dependencias:
docker compose run --rm web python manage.py migrate core
docker compose run --rm web python manage.py migrate catalog
docker compose run --rm web python manage.py migrate orders
docker compose run --rm web python manage.py migrate whatsapp
docker compose run --rm web python manage.py migrate technicians
docker compose run --rm web python manage.py migrate analytics
docker compose run --rm web python manage.py migrate superadmin
docker compose run --rm web python manage.py migrate

docker compose run --rm web python manage.py createsuperuser

# Asignar productos existentes a un Punto (obligatorio — el catálogo no
# muestra nada hasta que Product.punto deje de ser NULL)
docker compose run --rm web python manage.py shell -c "
from apps.catalog.models import Product, Punto
punto = Punto.objects.get(slug='telefonia')
Product.objects.filter(punto__isnull=True).update(punto=punto)
"

docker compose up -d
curl http://localhost/health/
```

**Sin Docker** (backend solo, más rápido para iterar):
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt --break-system-packages
export $(cat .env | xargs)
python manage.py migrate     # mismo orden de arriba si migras app por app
python manage.py runserver
```

---

## 4. Despliegue EN LA NUBE (producción)

### 4.1 Antes de arrancar
- Dominio real con DNS apuntando al servidor
- Docker + Docker Compose (mínimo 4 vCPU / 8GB RAM para el stack completo)
- El servicio `certbot` ya está en `docker-compose.yml` con renovación cada 12h

### 4.2 Pasos

```bash
cp backend/.env.example backend/.env
# Producción: llaves REALES de Wompi (prv_prod_/pub_prod_), DEBUG=False, DB_SSLMODE=require
nano backend/.env

docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d tudominio.com -d www.tudominio.com --email tu@correo.com --agree-tos

docker compose run --rm web python manage.py migrate core
docker compose run --rm web python manage.py migrate catalog
docker compose run --rm web python manage.py migrate orders
docker compose run --rm web python manage.py migrate whatsapp
docker compose run --rm web python manage.py migrate technicians
docker compose run --rm web python manage.py migrate analytics
docker compose run --rm web python manage.py migrate superadmin
docker compose run --rm web python manage.py migrate

# SuperAdmin + asignación de puntos — igual que en local (sección 3)

docker compose run --rm web python manage.py collectstatic --noinput
docker compose up -d
curl https://tudominio.com/health/
```

### 4.3 Webhooks — registrar en cada proveedor externo

| Proveedor | URL del webhook | Dónde registrarla |
|---|---|---|
| Wompi | `https://tudominio.com/api/v1/webhooks/wompi/` | Panel Wompi → Configuración → Eventos |
| 360dialog (WhatsApp) | `https://tudominio.com/api/v1/whatsapp/webhook/` | Panel 360dialog → Webhook |
| Google OAuth | `https://tudominio.com/api/auth/callback/google` | Google Cloud Console → Credenciales |

### 4.4 Infraestructura gestionada (recomendado)

Para producción real, considera Postgres gestionado (RDS/Cloud SQL/Supabase) y Redis gestionado (ElastiCache/Upstash) en vez de los contenedores locales — mejor backup, TLS nativo, más fácil de escalar.

---

## 5. Configuración de servicios externos

**Google OAuth:** console.cloud.google.com/apis/credentials → "ID de cliente OAuth" → Aplicación web → orígenes `https://tudominio.com` → redirect `https://tudominio.com/api/auth/callback/google`.

**WhatsApp/360dialog:** crear cuenta, conseguir `D360-API-KEY`, pegarla en `/panel/whatsapp` (rol Administrador). **El módulo queda pausado hasta que le des "Activar"** — es la regla de negocio, no un bug. Crear y esperar aprobación en Meta de las 3 plantillas referenciadas en el código: `confirmacion_de_compra`, `carrito_abandonado`, `seguimiento_cliente`.

**Wompi:** panel de comercio → Llaves API (`_test_` para pruebas, `_prod_` para producción real).

---

## 6. Correr las pruebas automatizadas

```bash
docker compose run --rm web python manage.py test apps.orders apps.catalog
```

**Nota honesta:** se escribieron y verificaron solo sintácticamente (sin red para instalar Django en este entorno de desarrollo) — corre esto en tu entorno real antes de confiar en ellas al 100%. Cubren: split de carrito multi-punto, que el checkout nunca descuente stock, firma de Wompi, idempotencia de envíos, precio efectivo con promociones, límite de 4 fotos.

---

## 7. Checklist manual post-deploy

1. Crear cuenta nueva → debe pedir documento de identidad en el primer checkout
2. Login con Google → crea un `customer` automáticamente
3. Carrito con productos de 2 puntos → genera 2 `Order`, 1 sola `CheckoutSession`
4. Cupón `BIENVENIDO10` (precargado por migración) → descuenta 10%
5. Simular pago aprobado a mano en Django admin (cambiar `CheckoutSession.status` a `paid`) → las `Order` hijas deben reflejarlo
6. `/panel/ventas` como vendedor → la venta pagada aparece en "Ventas pendientes"
7. Confirmar venta con referencia TNS → pasa a `confirmed`
8. Registrar guía de envío dos veces con datos distintos → actualiza, nunca duplica
9. `/productos/[slug]` de un producto real → carga galería, reseñas, relacionados

---

## 8. Deuda técnica conocida

1. **TNS**: 19 campos marcados `# CONFIRMAR` — falta un ejemplo real de `POST /v2/Acceso/Login` y `GET /v2/tablas/Material/Listar`.
2. **WhatsApp**: 3 plantillas por crear/aprobar en Meta.
3. `npm install recharts` — usado en el dashboard de Supervisor.
4. Migraciones `0001_initial` de `catalog`/`core`/`orders` deben venir de tu repo real.

---

## 9. Archivos de andamiaje agregados en esta ronda — qué es real y qué es reconstruido

| Archivo | Origen |
|---|---|
| `backend/Dockerfile` | **Idéntico** al que compartiste al inicio de la conversación — no lo modifiqué |
| `frontend/Dockerfile` | **NUEVO, escrito por mí** — nunca vi el original de tu repo. Es un multi-stage estándar de Next.js en modo `standalone`. Compáralo con el tuyo antes de reemplazar |
| `frontend/package.json` | Reconstruido a partir de los `import` reales que usé en todo el código (`next`, `react`, `next-auth`, `axios`, `lucide-react`, `recharts`) — si tu repo ya tenía dependencias adicionales (ej. una librería de fechas, un linter custom), agrégalas tú, este archivo no las conoce |
| `frontend/tsconfig.json` | Estándar de Next.js App Router, con el alias `@/*` que uso en todos los imports (`from '@/lib/api'`, etc.) |
| `next.config.js` | Agregado `output: 'standalone'`, requerido por el Dockerfile de arriba |

## 10. Lo que SIGO sin poder fabricar — necesito que venga de tu repo real

Las migraciones **`0001_initial.py`** de `catalog`, `core` y `orders` no están en ningún paquete que te haya entregado, y **no las puedo inventar**: son el reflejo exacto del primer estado de tus tablas reales en producción. Si genero una versión mía y no coincide campo por campo con lo que ya existe en tu base de datos, Django va a intentar aplicar cambios que ya están aplicados, o peor, va a intentar crear columnas que ya existen con otro tipo de dato — eso sí puede corromper datos reales. Esta es una decisión deliberada de no adivinar, no un olvido.

**Para que el `migrate` funcione de verdad, antes de nada:**
```bash
# Copia las migraciones 0001_initial ORIGINALES de tu repo real a este paquete:
cp <tu-repo-real>/backend/apps/catalog/migrations/0001_initial.py backend/apps/catalog/migrations/
cp <tu-repo-real>/backend/apps/core/migrations/0001_initial.py    backend/apps/core/migrations/
cp <tu-repo-real>/backend/apps/orders/migrations/0001_initial.py  backend/apps/orders/migrations/
```

---

## 11. Diseño frontend — fidelidad verificada contra tus archivos HTML originales

Comparé campo por campo `globals.css` contra el `<style>` inline real de tus `index.html`/`productos.html`/`tecnico.html` (no contra `style.css`, que sigue siendo un archivo huérfano que ningún HTML enlaza — confirmado desde la primera auditoría). Encontré y corregí:

- **6 variables de diseño que faltaban**: `--header-bg`, `--footer-bg`, `--input-bg`, `--input-bdr`, `--trust-bg`, `--modal-bg` — ya están en `globals.css`, para ambos temas
- **El footer nunca se había construido** — existía en tu HTML original pero no en el sitio Next.js. Ya está: mismo contenido (categorías, empresa, servicios, contacto, métodos de pago), con la particularidad real de tu diseño de que **el footer siempre es oscuro, incluso en tema claro** — antes esto se habría perdido
- **Corregí un problema de estructura**: el header/footer público envolvía por accidente también el panel interno (`/panel/*`). Ahora las rutas públicas viven en un grupo `(store)` separado — el panel nunca hereda el header de la tienda

## 12. Verificación final antes de esta entrega

- Backend: `py_compile` sin errores en el 100% de los `.py`
- Frontend: balance de sintaxis verificado en el 100% de los `.ts`/`.tsx`
- Cero `<img>` planos (todos usan `next/image`)
- Cero emojis en el código (barrido automático con regex Unicode)
- Integridad del `.zip` verificada con `unzip -t` — sin errores de compresión
