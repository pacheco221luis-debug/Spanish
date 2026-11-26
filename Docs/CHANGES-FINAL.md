# Spanish with Lisa — versión final

**Base visual:** Spanish-with-Lisa-redesign-gradual (misma tipografía Fraunces + DM Sans, logo de hoja, hero con burbujas, tarjetas asimétricas, fotos y paleta). Sobre esa base se fusionaron solo mejoras de solidez, accesibilidad y funcionamiento.

## Contenido corregido
- **Santa Ana** donde se imparten las clases (antes decía San Salvador): título, descripción, hero, sección "Where We Learn", formulario, privacidad y footer.
- **Foto:** `alt` neutro (es una imagen de Freepik, no una clase de Lisa); se eliminó la afirmación "Lisa conducting…". Dimensiones reales (935×1024).
- **Sección de reseñas visible como VISTA PREVIA para la clienta** (nombres de ejemplo, con el aviso "Design preview" que indica que no son testimonios reales). Antes de publicar: sustituir por reseñas reales (p. ej. de Google) y borrar el aviso `prototype-note`. Hay un comentario en el HTML que lo recuerda.
- **Pie de página igual al de la versión gradual** (logo de hoja, enlaces Home / Where We Learn / Student Reviews / Start Learning / Privacy Policy).
- **Ningún correo visible en el sitio** (ni en footer, formulario, privacidad, datos estructurados ni mensajes de error). El único canal de contacto es el formulario; "Contact" en el menú lleva al formulario. Sin JavaScript se pide activarlo.
- Nota honesta: las interacciones con otras personas dependen de la situación y no están garantizadas.

## Funcionamiento y buenas prácticas
- **Formulario → Google Sheets** (API + Apps Script): validación estricta en servidor, éxito solo si Sheets confirma, timeout de 9 s, `LockService`, columnas `Status`/`Notes` con lista desplegable, teléfonos guardados como texto, aviso opcional por correo (`NOTIFY_EMAIL`).
- **main.js:** validación de teléfono, el botón conserva su texto, mensajes de error sin correo, versión de consentimiento 1.1, código muerto (modal) eliminado, burbujas con `hidden` (visibles sin JavaScript).
- **CSP endurecida:** ya no hay estilos en línea en ninguna página pública, así que se quitó `'unsafe-inline'`. Caché para imágenes. LF en `_headers` y `sitemap.xml`.
- **Móvil:** el botón de inicio ya no desaparece del header ("Get started").
- **Accesibilidad:** foco visible, chips con estado seleccionado, contraste AA en etiquetas, hover del footer y títulos de tarjetas; la tipografía del footer usaba una fuente no cargada (Poppins).
- **SEO / compartir:** og-image 1200×630, favicon y apple-touch-icon con el logo de hoja, JSON-LD básico, `theme-color` alineado, itálica real de Fraunces.
- **Privacidad v1.1** y **404** reconstruidas en el estilo del sitio (sin estilos en línea; antes la política tenía huecos enormes entre secciones).
- `transition: all` reemplazado por propiedades concretas; clases sin CSS eliminadas.

## Antes de publicar
1. Reemplazar `REPLACE_WITH_TURNSTILE_SITE_KEY` (index.html) y definir en Cloudflare: `TURNSTILE_SECRET_KEY`, `GOOGLE_SHEETS_WEBHOOK_URL`, `GOOGLE_SHEETS_WEBHOOK_SECRET`. Seguir `Docs/GOOGLE-SHEETS-SETUP.md`.
2. Licencia de Freepik: si es el plan gratuito, añadir el crédito (TODO en el footer).
3. Probar en un entorno de prueba (Cloudflare Pages preview): Turnstile con la CSP nueva; si falla, reponer `'unsafe-inline'` temporalmente. Probar un envío real con teléfono `+503…`.
4. Autoalojar DM Sans y Fraunces (woff2), quitar los dominios de Google de la CSP y actualizar la política (sección 4).
5. Confirmar con Lisa: retención de 12 meses y textos de privacidad. Publicar la política junto con Sheets activo.
6. Cuando haya fotos reales de Santa Ana, sustituir la foto de stock y `og-image.jpg`.
7. Añadir WhatsApp (`wa.me/<número>`) cuando esté disponible.
8. Reseñas de Google: al conectarlas, actualizar CSP (`img-src`), política y quitar `hidden` de `#reviews`.
9. **Privacidad:** como no se publica un correo, la política indica que las solicitudes sobre datos se hacen por el formulario o directamente con Lisa. Conviene confirmar con la clienta (o un asesor) que esto es suficiente para su caso, sobre todo con estudiantes europeos (GDPR).
10. `NOTIFY_EMAIL` del Apps Script (opcional) es un aviso interno hacia el correo de Lisa; no se muestra en el sitio.
11. Los nombres de lugares del panel admin (`Docs/admin-prototype.html`) son datos de ejemplo; reemplazarlos por locales reales de Santa Ana si se construye.

## v2 — endurecimiento del backend (sin cambios visuales)
- **inquiry.js:** verificación de Turnstile con tiempo límite y manejo de caídas (503), y comprobación opcional del dominio (`ALLOWED_HOSTNAMES`).
- **Apps Script:** detección de duplicados (24 h) y purga de datos a los 12 meses (programable), ambas probadas con simulaciones.
- **Documentación:** pasos para limitar envíos con Cloudflare y lista de pruebas previas a la publicación (`GOOGLE-SHEETS-SETUP.md`).
