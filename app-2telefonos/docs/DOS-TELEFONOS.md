# Prueba con 2 teléfonos · versión de prueba

Datos de ejemplo. Sin pagos reales. **Todavía no se ha probado en dos teléfonos reales**: hasta ahora solo se probó en navegadores de escritorio y emulados, con dos contextos de navegador en la misma máquina.

## Qué hace

1. **Teléfono A (Emisor)** sella un informe (de obra o de garantía de techo) con la llave ECDSA P-256 del teléfono. La llave se crea en el navegador, se guarda en IndexedDB y la parte privada no se puede exportar.
2. A crea un **código de conexión** (una oferta WebRTC comprimida). Se puede compartir de tres formas: como QR dibujado en el propio teléfono con `qr.js` (sin librerías externas), copiándolo o con el menú Compartir.
3. **Teléfono B (Receptor)** escanea el QR (si el navegador tiene BarcodeDetector) o pega el código, y devuelve un **código de respuesta**. A lo pega y se abre un canal de datos directo.
4. Los dos teléfonos se mandan su llave pública. B compara la huella del emisor y toca «Confiar en este emisor».
5. A envía el informe en piezas de 160 bytes. Cada pieza lleva su SHA-256 y hay una huella raíz. Si se pierden piezas, B pide **solo las que faltan** (de forma automática o con un botón). Para probarlo, el interruptor «Cortar conexión» hace que se pierdan piezas.
6. B verifica:
   - huella del documento;
   - firma;
   - huella de la llave;
   - que la llave no esté revocada;
   - que la llave esté en el llavero;
   - repetición (nonce).

   El resultado es **Verificado ✓** o **ROTA ✗**, en vista Simple, Detallada o En bruto.
7. B firma un **acuse de recibo** con su propia llave (huella del informe, huella raíz, veredicto y motivo) y lo envía. A lo comprueba con la llave pública de B. Así **los dos lados** tienen prueba.

## Registro de conexión

Cada evento queda con la hora (hh:mm:ss.mmm):
- estado de recolección y de conexión ICE;
- tipo de candidato (host, srflx, etc.; **sin direcciones IP**);
- canal abierto o cerrado;
- bytes enviados y recibidos.

«Copiar registro de prueba» copia el registro junto con la fecha, el rol, la huella y el navegador.

## Guía y casos de prueba

En la pantalla «Guía de prueba» están los pasos y 5 casos:
1. la misma wifi;
2. uno con datos móviles;
3. modo avión a mitad del envío (reconectar y tocar «Continuar envío»);
4. dato alterado;
5. llave desconocida.

Cada caso tiene un resultado y una nota que se guardan solo en el teléfono y se pueden copiar.

## Límites

- **STUN** público de Google (`stun:stun.l.google.com:19302`): es la única conexión externa y ese servidor ve la IP pública de cada teléfono.
- **Sin TURN**: en algunas redes móviles, con NAT simétrico o en redes corporativas, la conexión puede fallar.
- Las **llaves son de cada teléfono, sin respaldo**: si se borran los datos del navegador, la llave se pierde.
- Leer el QR con la cámara solo funciona si el navegador tiene BarcodeDetector. Si no, hay que copiar y pegar el código.
- Si una conexión se cae, hay que crear códigos nuevos. Las piezas que ya llegaron se conservan mientras la página siga abierta.
- Verificado ✓ no prueba que el contenido sea verdad y no tiene valor legal.

## Origen del código

- La señalización manual (`pack` / `unpack` / `gathered`) viene de `phenom-v1.7.html`, donde solo se probó entre dos navegadores en una misma máquina.
- El sellado, las piezas y la verificación vienen de `app-llave-real`.
