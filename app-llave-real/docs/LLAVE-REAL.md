# La llave real · versión de prueba

Prueba de Phenom con datos de ejemplo. No hay clientes reales ni pagos reales.
Todo ocurre en el navegador: no se envía nada a ningún servidor.

## Uso: tres botones

1. Elige **Informe de obra** o **Garantía de techo** y llena el formulario de ejemplo. Las fotos son opcionales: se calcula su huella SHA-256 en el teléfono y el archivo no se sube.
2. **Sellar**
   - La llave del emisor firma el documento.
   - Es ECDSA P-256 de WebCrypto, creada en este navegador y guardada en IndexedDB. La llave privada no se puede exportar.
   - Solo se muestra una huella pública corta. En Llaves está la opción "Exportar llave pública".
3. **Enviar** ("teleport" / split-run)
   - El paquete se divide en piezas de 160 bytes. Cada pieza tiene su SHA-256 y hay una huella raíz (SHA-256 de todas las huellas).
   - El enlace es simulado. Con **Cortar conexión** se pierde 1 de cada 3 piezas. **Reenviar solo las que faltan** manda solo esas.
   - Al armar el paquete se comprueban cada pieza y la huella raíz.
4. **Verificar** (como receptor), en este orden:
   1. Huella del documento.
   2. Firma.
   3. Huella de la llave.
   4. Llave no revocada.
   5. Llave conocida (llavero).
   6. Nonce no repetido.

   El resultado sale como **Verificado ✓** o **ROTA ✗**, con pestañas Simple / Detallado / En bruto.

## Receptor en otra pestaña

Abre `#receptor` en una segunda pestaña. Las piezas llegan por BroadcastChannel.
Esto funciona solo en el mismo navegador y dispositivo. El envío entre teléfonos (WebRTC o relevo) no está probado.

## Qué prueba

- El documento no cambió desde que se selló.
- Lo firmó una llave conocida y no revocada.
- No es una repetición.
- Llegaron todas las piezas.

## Qué NO prueba

- Que el contenido sea verdad.
- Valor como evidencia legal.
- La identidad de la persona más allá de la llave.

Las llaves son de ejemplo. El llavero, la lista de revocadas y la de nonces vistos son locales a este dispositivo.

## Límites

- No hay respaldo de la llave: si se borran los datos del navegador, se pierde y hay que crear otra.
- La revocación no se comparte entre dispositivos.
- Sin pagos reales; precios por definir.
