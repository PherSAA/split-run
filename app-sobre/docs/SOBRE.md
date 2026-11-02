# Sobre · versión de prueba

Datos de ejemplo. Sin pagos reales. Hasta ahora **solo se ha probado en navegadores de escritorio y emulados**, todavía no en teléfonos reales.

## Por qué

En la prueba real con 2 teléfonos (app-2telefonos), la conexión en vivo solo funcionó cuando los dos teléfonos estaban abiertos a la vez. Si uno se apagaba o tardaba, había que crear otro código. El **sobre** no necesita conexión en vivo: es un mensaje que se basta a sí mismo, y el otro teléfono lo abre cuando quiera, incluso sin internet.

## Cómo funciona

1. **Mi tarjeta** (una sola vez, no caduca)
   - Es un enlace corto (unos 230 caracteres) o un QR.
   - Contiene la llave pública ECDSA P-256 del teléfono y un nombre corto. Muestra la huella.
   - El otro teléfono la abre y toca **Confiar**. La llave queda guardada en su llavero local.
2. **Enviar sobre**
   - Se sella el informe (Obra o Techo) y se parte en piezas de 160 bytes.
   - Cada pieza lleva su SHA-256. Además van la huella raíz, la firma de la raíz, la firma del documento y un nonce.
   - Todo se comprime (CompressionStream; si el navegador no lo tiene, se envía sin comprimir) y va en el **fragmento del enlace** (`#s=…`). El fragmento no se envía a ningún servidor.
   - Se puede mandar de cuatro formas:
     - por el menú Compartir del teléfono (como archivo `.phenom` si se puede; si no, como enlace);
     - copiando el enlace;
     - descargando el archivo;
     - con un QR: de un cuadro hasta 900 caracteres, o animado de varios cuadros si es más largo.
   - La pantalla muestra el tamaño del sobre y qué formas sirven para ese tamaño.
3. **Abrir sobre**
   - Se abre tocando el enlace, pegándolo o eligiendo el archivo.
   - Se revisa, en este orden:
     - que el sobre esté completo (detecta un enlace cortado);
     - la huella raíz;
     - **cada pieza** (dice cuál falta o está alterada);
     - la huella del documento;
     - las dos firmas;
     - la huella de la llave;
     - que la llave no esté revocada;
     - que la llave esté en el llavero;
     - que no sea una repetición (nonce).
   - El resultado puede ser Verificado ✓, ROTA ✗ o Rechazado ✗, y se ve en Simple, Detallado o En bruto.
4. **Acuse**
   - El receptor crea un acuse firmado con su llave. El acuse incluye la huella del informe, la raíz, el veredicto y el motivo, y se devuelve por los mismos medios (`#a=…`).
   - El emisor lo abre y ve **Acuse verificado ✓**, ligado al informe que envió.
5. **Bandeja**: lista local de lo enviado y lo recibido, con su estado: enviado, abierto/verificado, acuse creado o acuse recibido.

## Conexión en vivo (opcional)

- Usa el WebRTC de app-2telefonos, pero **sin servidores externos** (sin STUN ni TURN). Por eso normalmente solo funciona en la misma wifi.
- «Reintentar sin código nuevo» hace un reinicio ICE usando el mismo canal, y solo funciona si el canal sigue abierto.
- Si la conexión falla, la app dice que se use el Sobre.

## Límites

- **Tamaños medidos:**
  - tarjeta: unos 230 caracteres;
  - sobre de ejemplo (Obra o Techo): unos 1.500 caracteres (5 piezas);
  - acuse: unos 710 caracteres.
- Un enlace de hasta unos 2.000 caracteres suele pasar bien por chat. Si es más largo, conviene usar el archivo.
- El QR animado solo se puede leer con cámara en navegadores con BarcodeDetector (Chrome en Android). En iPhone hay que usar el enlace o el archivo.
- WhatsApp, iMessage y otros chats pueden cortar enlaces o cambiar archivos. Entonces sale **ROTA ✗** e indica la pieza que falla. Eso es la protección funcionando: hay que reenviar como archivo.
- En iPhone (Safari) puede que no se puedan compartir archivos. En ese caso se comparte el enlace o se copia.
- Las llaves son de cada teléfono y no tienen respaldo.
- Verificado ✓ no prueba que el contenido sea verdad y no tiene valor legal.
