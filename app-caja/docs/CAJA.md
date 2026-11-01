# Caja · versión de prueba

Los cobros son **SIMULADOS** y no mueven dinero. Los recibos están **firmados y sellados, no cifrados**. localStorage e IndexedDB no están cifrados.

## Qué cambió respecto al archivo «Vaúlt Xpay Gold T0 V13»

| En el archivo recibido | Aquí | Por qué |
|---|---|---|
| `btoa` presentado como cifrado | Firma ECDSA P-256 + SHA-256 (WebCrypto) y se dice «firmado y sellado» | btoa es solo codificación: cualquiera lo revierte |
| Llave = texto fijo + userAgent | Llave creada al azar en el navegador; la privada no se puede exportar (IndexedDB) | Una llave predecible no protege nada |
| Llave guardada junto a los datos | Junto al libro solo se guarda la llave **pública** | La privada nunca sale del navegador |
| WebAuthn sin efecto, con reto fijo | WebAuthn real y opcional (`credentials.create` y luego `get`), con reto aleatorio | Si está activado, de verdad bloquea el botón |
| «PAID» sin pago | «SIMULADO — no mueve dinero» | No hay pagos reales |
| IDs con `Math.random` | `crypto.getRandomValues` | Valores aleatorios aptos para criptografía |
| `alert()` | Avisos dentro de la página | Accesible y sin bloquear la pantalla |
| «Encrypted / Secured» | Sin esas palabras | Serían falsas |

## Planes

- **Normal:** negro con naranja Phenom. Incluye caja con un monto, recibo firmado, libro encadenado y botón para verificar.
- **Pago (demo):** dorado (#d4af37 sobre #0a0a0a) con bóveda en SVG. Además incluye:
  - cobros de 2–5 líneas de producto;
  - exportar el libro firmado en JSON;
  - vista para imprimir;
  - passkey opcional.
- La seguridad es **la misma** en los dos planes.
- El interruptor Pago es solo una demo: no hay pago ni suscripción. Los precios están por definir.

## Libro

- Cada recibo guarda la huella del anterior y lleva su firma.
- El total se calcula con los recibos que verifican.
- Si se altera un recibo guardado, el libro sale como ROTA desde ese recibo.
- El JSON exportado se puede verificar fuera de la app, con cualquier implementación de WebCrypto (se probó con Node).

## Límites

- La passkey se probó solo con el autenticador virtual de Playwright, no en un iPhone real.
- La passkey no se verifica en un servidor: solo bloquea el botón en este dispositivo.
- La firma prueba que el recibo no cambió y qué llave lo firmó. No prueba que alguien pagó.
- No hay respaldo de la llave ni del libro.
- No hay revisión legal ni contable.
