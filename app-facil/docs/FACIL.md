# Phenom · Fácil (versión de prueba)

Versión de prueba · datos de ejemplo. Sin pagos reales. No es asesoría de ningún tipo.

## Para qué sirve
Es la misma tecnología que `app-sobre`, pero con dos botones: **Enviar** y **Recibir**. No hace falta que los dos teléfonos estén encendidos a la vez, ni intercambiar tarjetas antes.

## Cómo se usa
1. **Primera vez:** escribes tu nombre. El teléfono crea tu sello en silencio; nunca sale del teléfono y no se puede exportar.
2. **Enviar:** eliges Obra o Techo (ya viene un ejemplo rellenado), puedes añadir una foto y tocas **Enviar**. Se abre el menú de compartir del teléfono (WhatsApp, correo, mensajes). Si el menú no está disponible, el enlace se copia y puedes descargar el archivo.
3. **Recibir:** la otra persona toca el enlace o abre el archivo. La primera vez ve «Es de <nombre>. ¿Confiar?» y toca **Sí, confiar**. Entonces ve **Verificado ✓** en verde, o **Cambió ✗** en rojo junto con la parte que cambió.
4. **Confirmar recepción:** la otra persona toca ese botón y te devuelve una confirmación firmada por el mismo camino. Al abrirla ves **Entregado y confirmado ✓**.
5. **Mis envíos:** estados Enviado / Recibido / Confirmado / Cambió.

## Detalles técnicos (para quien los quiera)
- Firma ECDSA P-256 con WebCrypto. La llave privada no es exportable y se guarda en IndexedDB (`phenom-facil`).
- El envío se parte en piezas de 160 bytes. Cada pieza tiene su huella SHA-256 y la raíz va firmada. El envío incluye el nombre y la llave pública del emisor, así que la confianza se da en el primer envío que se recibe («confiar al primer uso»).
- El código del sello (huella) aparece en «Detalles» y en «?» para quien quiera compararlo por otra vía.
- Repetición: cada envío lleva un número único. Si se vuelve a abrir uno que ya estaba verificado, se muestra igual con la nota «ya lo habías abierto»; si no, se rechaza.
- La foto no viaja: solo su huella, su tamaño y su tipo.
- No usa servidores ni hace peticiones externas (tampoco STUN). En esta versión no hay modo en vivo (WebRTC).
- El enlace usa el fragmento `#s=` o `#a=`, que el navegador no envía al servidor. Va comprimido con deflate-raw y codificado en base64url.
- El Modo avanzado (en «?») muestra las vistas Simple, Detallado y En bruto, la lista de personas de confianza y la opción de bloquear.

## Límites honestos
- Un chat puede cortar o cambiar el enlace (unos 1.500 caracteres). En ese caso sale «Cambió ✗» o «Llegó cortado ✗»: envíalo como archivo.
- Confiar al primer uso: si alguien se hace pasar por otra persona en el primer envío, la app no lo puede saber. Para estar seguro, comparad el código del sello por otra vía.
- En iPhone, Safari y el ícono de la pantalla de inicio guardan datos por separado. El sello vive en uno solo y no tiene copia de respaldo.
- iOS a veces no comparte archivos; entonces se comparte el enlace.
- Verificado = no cambió y lo firmó esa persona; no prueba que sea verdad ni tiene valor legal.
- Probado solo en emulación (Playwright 390x844), todavía no en teléfonos reales.
