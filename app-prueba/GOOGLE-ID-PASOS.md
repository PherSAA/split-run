# Cómo crear el ID de Google (Client ID) · 8 pasos

> Esto lo haces tú con tu cuenta de Google. Nadie más necesita tu contraseña: **no la compartas con nadie, tampoco con el bot.**
> Al final solo copias **un texto público** (el Client ID). El "Client secret" **no** se usa y **no** se pega en ningún lado.

1. **Abre** https://console.cloud.google.com/ en el teléfono o la computadora y entra con tu cuenta de Google.
2. **Crea un proyecto:** arriba toca el selector de proyecto → **Nuevo proyecto** → nombre: `Phenom prueba` → **Crear**.
3. **Pantalla de consentimiento:** menú ☰ → **APIs y servicios** → **Pantalla de consentimiento de OAuth** → tipo **Externo** → nombre de la app `Phenom (prueba)`, tu correo de soporte y tu correo de contacto → **Guardar**.
4. **Usuarios de prueba:** en esa misma pantalla, deja la app en modo **Prueba (Testing)** y agrega tu correo en **Usuarios de prueba**.
5. **Crear el ID:** menú ☰ → **APIs y servicios** → **Credenciales** → **+ Crear credenciales** → **ID de cliente de OAuth**.
6. **Tipo de aplicación:** elige **Aplicación web**. Nombre: `Phenom app prueba`.
7. **Orígenes autorizados de JavaScript:** toca **+ Agregar URI** y escribe exactamente `https://phersaa.github.io` (sin barra al final y sin `/split-run`). Deja vacío "URI de redireccionamiento". Toca **Crear**.
8. **Copia solo el ID de cliente** (termina en `.apps.googleusercontent.com`) y pégalo en `app-prueba/config.js` → `GOOGLE_CLIENT_ID: "…"`. O mándalo en el chat y se pega por ti en la versión de prueba.

**Aviso honesto:** con el ID, la app muestra tu nombre, correo y foto para rellenar formularios. Eso **no** es un ingreso seguro: para cuentas reales hace falta un servidor que verifique el token de Google.
