# Patio Madera ARAUCO — Control de Flujo

PWA instalable para controlar el flujo de patio de madera:

```
GRÚA carga TRACTOR en COLUMNA → TRACTOR elige LÍNEA (1 de 4) → DESCARGA en línea, tractor liberado
```

**Datos en la nube vía Supabase**: todos los dispositivos leen y escriben la misma base. Los cambios se sincronizan en vivo (Realtime) — si un celular registra una carga, los demás la ven aparecer sin recargar la página.

## Modelo de dominio

Entidad central: **Viaje**. Nace cuando una grúa de cancha carga un tractor disponible con madera de una columna, y avanza por 3 estados:

| Estado | Módulo que lo genera | Qué ocurre |
|---|---|---|
| `cargado` | 01 · Carga | Grúa carga un tractor disponible en una columna. Tractor pasa a `en_viaje`. |
| `en_transito` | 02 · Tractor | El tractor cargado elige una de las 4 líneas fijas y parte. |
| `completado` | 03 · Descarga | Se confirma volumen descargado en línea. Tractor vuelve a `disponible`. |

## Estructura de archivos

```
patio-pwa/
├── index.html
├── manifest.json
├── sw.js
├── css/styles.css
├── sql/
│   └── schema.sql            # tablas + RLS + Realtime para Supabase
├── js/
│   ├── app.js                # router + auth gate + suscripción realtime
│   ├── db.js                 # capa de datos (Supabase / Postgres)
│   ├── auth.js                # login con Supabase Auth
│   ├── supabaseConfig.js      # ⚠️ completar con tu URL y anon key
│   ├── utils.js                # helpers
│   └── views/
│       ├── dashboard.js        # kanban de los 3 estados
│       ├── carga.js            # módulo 01
│       ├── tractor.js          # módulo 02
│       ├── descarga.js         # módulo 03
│       ├── recursos.js         # CRUD tractores/columnas
│       └── reportes.js         # reporte + export Excel
└── assets/icon-192.png, icon-512.png
```

## ☁️ Configurar Supabase (antes de publicar)

1. Crea un proyecto gratis en [supabase.com](https://supabase.com/dashboard).
2. **SQL Editor → New query**: pega y ejecuta todo el contenido de `sql/schema.sql`. Esto crea las 4 tablas, las políticas de seguridad (RLS), activa Realtime, y siembra datos de ejemplo.
3. **Settings → API**: copia el "Project URL" y la "anon public" key.
4. Pégalos en `js/supabaseConfig.js`:
   ```js
   export const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
   export const SUPABASE_ANON_KEY = 'tu-anon-key';
   ```
5. **Authentication → Users → Add user**: crea al menos un usuario (email + contraseña) para cada persona que vaya a operar la app — el login es obligatorio para leer y escribir datos (protegido por RLS).

> La *anon key* es segura de exponer en el código público del repo: por sí sola no da acceso a nada, todo el acceso real lo controla Row Level Security, que exige sesión autenticada.

## 🚀 Publicar en GitHub Pages

1. **Crea el repositorio** (o usa uno existente) y sube todo el contenido de esta carpeta (`index.html`, `manifest.json`, `sw.js`, `css/`, `js/`, `assets/`) a la raíz del repo — o a una carpeta `docs/` si prefieres esa convención.

   ```bash
   cd patio-pwa
   git init
   git add .
   git commit -m "Patio Madera ARAUCO — PWA"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
   git push -u origin main
   ```

2. **Activa Pages**: en GitHub, ve a *Settings → Pages*. En "Source" elige la rama `main` y la carpeta `/ (root)` (o `/docs` si subiste ahí). Guarda.

3. Espera 1–2 minutos. Tu app queda en:
   `https://TU_USUARIO.github.io/TU_REPO/`

   > Todas las rutas del proyecto son **relativas** (`css/styles.css`, `js/app.js`, etc.) y el `manifest.json` usa `start_url: "."` / `scope: "."`, así que funciona correctamente en ese subpath — no hace falta ajustar nada.

4. **Instalar en el celular**:
   - Abre esa URL en Chrome (Android) o Safari (iPhone).
   - **Android/Chrome**: aparece automáticamente el banner "Agregar a pantalla de inicio" / o menú ⋮ → "Instalar app".
   - **iPhone/Safari**: botón Compartir (□↑) → "Agregar a pantalla de inicio".
   - Queda como ícono nativo, abre en pantalla completa (sin barra del navegador) y funciona offline gracias al Service Worker.

## Actualizar la app ya instalada

Cada vez que hagas `git push` con cambios, GitHub Pages se actualiza solo. Para que el celular tome la nueva versión, sube el número en `sw.js` (`CACHE_NAME = 'patio-arauco-v4'`, etc.) — así el Service Worker sabe que debe refrescar el caché. Si no cambias esa línea, el celular puede seguir viendo la versión cacheada anterior.

## Ejecutar localmente (antes de subir)

```bash
cd patio-pwa
python -m http.server 8000
```
Abrir `http://localhost:8000`.

## Reglas de negocio clave

- **Carga**: solo permite tractores `disponible`; valida que el volumen no supere el stock de la columna ni la capacidad del tractor.
- **Tractor**: 4 líneas fijas (Descortezado, Astillado, Aserradero, Biomasa); un clic despacha el viaje.
- **Descarga**: exige volumen descargado; libera el tractor y suma al consumo acumulado de la línea.
- **Folio**: correlativo `V-{año}-{secuencia}`.

## Notas técnicas

- Persistencia en **Supabase (Postgres)**, compartida por todos los dispositivos.
- **Realtime**: la app se suscribe a cambios en las 4 tablas; cualquier inserción/edición de otro usuario refresca la vista actual automáticamente.
- **Auth**: login obligatorio (Supabase Auth, email/password) antes de poder leer o escribir. Sin sesión, RLS bloquea todo.
- Sin build step: JS con módulos ES nativos; `@supabase/supabase-js` se importa directo desde CDN (`esm.sh`), no requiere `npm install`.
- Service Worker: cachea el "cascarón" de la app (HTML/CSS/JS) para que abra rápido y offline — pero los **datos** requieren conexión, ya que viven en Supabase. Si se pierde la señal a mitad de un registro, se muestra un error; no hay cola offline (ver "Próximas mejoras").

## Próximas mejoras sugeridas

- **Cola offline real**: si el celular pierde señal en la cancha, guardar el movimiento en IndexedDB local y reintentar el envío a Supabase cuando vuelva la conexión (hoy solo funciona con conexión activa).
- Roles diferenciados (operador de cancha, tractorista, supervisor) usando RLS por rol en vez de "cualquier autenticado".
- Historial multi-día en Reportes con filtros por rango de fechas.
- Notificación cuando un tractor queda cargado esperando destino por más de X minutos.
