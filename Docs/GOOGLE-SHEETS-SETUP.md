# Spanish with Lisa — gradual redesign and form setup

## Visual direction selected
- Natural and approachable, not corporate or overly polished.
- Prefer authentic photographs of Lisa, students (with permission), and real locations in El Salvador.
- Keep the existing green, cream and terracotta identity.
- Use editorial typography (Fraunces for headings, DM Sans for body text).
- Improve the current page progressively; do not rebuild the site or remove existing sections.

## Changes applied in this revision
- Updated the hero message to sound more personal and less promotional.
- Reduced the repeated card appearance in the benefits, phrasebook and steps sections.
- Added a clear prototype notice above the sample reviews. They are not represented as real or Google-verified reviews.
- Refined typography, spacing, colors, form controls, mobile layouts and focus states.
- Removed Student Reviews from the main navigation while the section remains a preview.
- Updated the form submission UI so it only displays success when the API explicitly confirms that the inquiry was saved.
- Prepared the Cloudflare Pages Function to forward validated inquiries to a Google Apps Script Web App.

## Before publishing the redesign
1. Confirm the existing `Estudiantes.webp` image is an authentic, approved photo and that the people shown consented to its use. Replace it with authentic photos when available; do not create fictional portraits of Lisa.
2. Review the new English copy with Lisa so it reflects her real teaching approach and voice.
3. Check the site at desktop, tablet and mobile widths.
4. Keep the sample reviews clearly marked as placeholders until real reviews are connected. Do not display “Verified by Google” for sample content.

## Google Sheets integration — setup required
The form is not live until the steps below are completed. The server function intentionally returns HTTP 503 when the Google Sheets settings are missing; it will not claim that an inquiry was saved when it was not.

### A. Create the destination spreadsheet
1. Create a Google Spreadsheet owned by the account that should receive inquiries.
2. Copy its spreadsheet ID from the URL (the value between `/d/` and `/edit`).
3. The Apps Script will create a tab named `Inquiries` and its header row automatically.
4. Restrict spreadsheet sharing to the people who genuinely need access. Do not make the sheet public.

### B. Create the Apps Script receiver
1. In the spreadsheet, open **Extensions → Apps Script**.
2. Replace the starter code with the contents of `Google-Sheets-Web-App.gs` in this folder.
3. Open **Project Settings → Script Properties** and add:
   - `INQUIRY_SPREADSHEET_ID` = the spreadsheet ID from step A.
   - `INQUIRY_WEBHOOK_SECRET` = a long, random secret (at least 32 random characters).
4. Deploy → **New deployment** → type **Web app**.
5. Execute as the spreadsheet owner. Set access to the provider's available public web-app access option so the Cloudflare server can call it; the shared secret remains mandatory.
6. Authorize the script and copy the deployed `/exec` URL. Do not use the `/dev` test URL in production.

### C. Configure Cloudflare Pages environment variables
In the Cloudflare Pages project, add these as production secrets/environment variables (not in HTML or `main.js`):
- `TURNSTILE_SECRET_KEY` = the real Cloudflare Turnstile secret key.
- `GOOGLE_SHEETS_WEBHOOK_URL` = the Apps Script deployed `/exec` URL.
- `GOOGLE_SHEETS_WEBHOOK_SECRET` = exactly the same random secret as `INQUIRY_WEBHOOK_SECRET`.

Also replace the example Turnstile site key in `Public/index.html` (`data-sitekey`) with the real public site key configured for the production hostname. The site key is public; the secret key must remain server-side.

Redeploy the Cloudflare Pages project after setting variables.

### D. Test before enabling real inquiries
- Submit a valid test inquiry and confirm one new row appears in `Inquiries`.
- Check all fields, especially interests, days, consent and timestamp.
- Submit invalid data and verify it is rejected.
- Test with Turnstile incomplete and verify no row is created.
- Test a missing/wrong webhook secret and verify no row is created.
- Confirm the browser only shows the thank-you state after the API responds with `{ "success": true }`.
- Delete test personal data from the sheet after testing.

## Data protection reminders
- Limit spreadsheet access and enable account-level two-factor authentication.
- Do not put Google credentials or webhook secrets in frontend files.
- Decide and document the actual retention period before publishing the form.
- Update the Privacy Policy to accurately describe Google Sheets as a processor/storage destination once the integration is active. The current policy should not claim the integration is active before deployment.
- Consider a notification workflow separately; do not send personal inquiry details to third parties unless needed and disclosed.

## Important scope notes
- This revision does not create a live Google connection and does not publish the website.
- The review cards remain visual placeholders pending genuine Google review integration and permission/attribution checks.
- The current photo asset has not been independently verified as a real photograph. Confirm its origin and usage permission before describing it as authentic.

---
## Update v3
- `Google-Sheets-Web-App.gs` now uses `LockService`, adds `Status` (dropdown: New, Contacted, Scheduled, Active, Renewal due, Closed) and `Notes` columns, and stores each new row as plain text so phone numbers like `+503…` stay intact.
- Optional Script Property `NOTIFY_EMAIL`: if set, you get an email "A new inquiry has arrived" (no personal data inside). On redeploy Google will ask to authorize sending mail.
- If you already deployed the old script, create a **New deployment** version after pasting the new code.
- Admin location names in `admin-prototype.html` are dummy data and must be replaced with real Santa Ana venues if the panel is ever built.

---
## Update v4 — seguridad y base de datos
**Cloudflare (variable nueva, recomendada):** `ALLOWED_HOSTNAMES` = `spanishwithlisa.com,www.spanishwithlisa.com` (añade el dominio `*.pages.dev` de pruebas mientras pruebes). Así se rechazan tokens de Turnstile resueltos en otro sitio.

**API (`inquiry.js`):** la verificación de Turnstile ahora tiene límite de 5 s y maneja caídas (responde 503 en vez de fallar sin control).

**Apps Script (`Google-Sheets-Web-App.gs`, vuelve a pegar el código y crea una nueva versión de la implementación):**
- *Duplicados:* si el mismo email (o mismo teléfono + mismo nombre) vuelve a enviar dentro de 24 h, se responde "éxito" pero no se guarda otra fila. Dos personas distintas con el mismo teléfono sí se guardan.
- *Retención de 12 meses:* `purgeOldInquiries()` borra filas de más de 365 días, salvo las que tengan Status `Scheduled`, `Active` o `Renewal due`. **No se activa sola:** ejecuta `installRetentionTrigger()` una vez (menú Ejecutar) para programarla el día 1 de cada mes. Pruébala antes en una copia de la hoja. Lisa debe mantener el Status al día.

**Limitación de envíos (sin código):** en Cloudflare → tu dominio → Security → WAF → Rate limiting rules, crea una regla para `URI Path = /api/inquiry` con `Method = POST` que limite las solicitudes por IP (por ejemplo 5 cada 10 minutos; los periodos y umbrales disponibles dependen del plan).

## Pruebas antes de autorizar la publicación
1. Enviar un formulario válido: aparece **una** fila nueva con Status `New`; el teléfono `+503…` se ve completo.
2. Reenviar lo mismo de inmediato: la página muestra el agradecimiento pero la hoja **no** añade otra fila.
3. Enviar con Turnstile sin resolver, con un campo inválido y con el secreto del webhook incorrecto: no se crea ninguna fila.
4. Probar en un móvil real (iPhone y Android) y en escritorio: formulario, menú, burbujas y mensajes de error.
5. Revisar que el correo de aviso (`NOTIFY_EMAIL`, si se usa) llega sin datos personales.
6. Confirmar la CSP: abrir la consola del navegador y verificar que no hay errores de CSP (sobre todo Turnstile).
7. Borrar las filas de prueba.
