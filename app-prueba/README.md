# Phenom · app de prueba (`app-prueba/`)

**VERSIÓN DE PRUEBA · sin pagos reales · datos de ejemplo.** Página con `noindex`.

URL: https://phersaa.github.io/split-run/app-prueba/

## Qué es
App web instalable (manifest + service worker, abre sin internet) con 4 pestañas:
- **Inicio**: saludo, 4 tarjetas (Cotizar gotera, Caja Deli, Informe de obra verificado, Mis recibos), estado real (modo prueba, conexión, enlaces de la cadena de auditoría guardada) y lista "Qué sigue" que sale de `config.js`.
- **Cotizar**: formularios Gotera / Piloto / Deli / Construcción rellenados con tu perfil. Solo abren WhatsApp con el mensaje escrito.
- **El plan**: hecho, en prueba y lo que falta, más enlaces a ofertas y al laboratorio.
- **Perfil**: datos guardados solo en el teléfono (localStorage), con botón "Borrar mis datos".

## config.js
| Campo | Vacío = | Para activarlo |
|---|---|---|
| `GOOGLE_CLIENT_ID` | botón Google deshabilitado, solo modo demo, ninguna petición a Google | ver pasos abajo |
| `WHATSAPP` | botones "número pendiente" | número con código de país, solo dígitos |
| `DOMINIO` | pendiente | nombre del dominio cuando exista |
| `REVISION_LEGAL` | `false` | `true` solo tras revisión de un abogado |
| `STRIPE_TEST_BACKEND` | pendiente | URL del backend de Stripe **modo prueba** |

## Ingreso con Google: pasos exactos
1. Entra a https://console.cloud.google.com/ con tu cuenta (nunca compartas tu contraseña con nadie, ni con el bot).
2. Crea o elige un proyecto.
3. **APIs & Services → OAuth consent screen**: tipo *External*, nombre "Phenom (prueba)", tu correo de soporte; deja el modo *Testing* y agrega tu correo como usuario de prueba.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
5. Application type: **Web application**.
6. En **Authorized JavaScript origins** agrega: `https://phersaa.github.io` (sin ruta ni barra final).
7. Crear. Copia **solo el Client ID** (termina en `.apps.googleusercontent.com`). **No** copies el *Client secret*; no se usa y no debe ir en el repo.
8. Pégalo en `config.js` → `GOOGLE_CLIENT_ID: "…"`.

**Aviso honesto:** la app solo decodifica el token en el navegador para mostrar nombre, correo y foto y rellenar formularios. **No es un ingreso seguro.** Para cuentas reales, un servidor debe verificar la firma del token de Google.

## Límites
- Sin servidor, sin cuentas reales, sin pagos.
- Iconos solo en SVG (el logo real `icons/phenom-logo.svg`); algunos teléfonos piden PNG para instalar.
- "Mis recibos" solo lee datos de v1.16 guardados en el mismo navegador.
