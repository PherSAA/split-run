# Phenom · Pago en XRPL testnet con recibo firmado (versión de prueba)

**TESTNET, sin dinero real.** No guarda fondos, no es una licencia ni asesoría legal o financiera.

## Cómo funciona
1. **Pagar (prueba)**
   - Crea en el teléfono una billetera de PRUEBA de XRPL. La semilla de testnet se guarda solo en `localStorage` de este navegador y nunca se muestra ni se sube.
   - La primera vez la llena con el grifo (faucet) de testnet.
   - Envía un `Payment` con un Memo `phenom/recibo-sha256` que lleva la huella SHA-256 (JSON canónico) de los datos del recibo: de, para, monto, moneda, concepto, nonce y fecha.
2. **Recibo firmado**
   - Cuando el ledger valida el pago (`tesSUCCESS`, `validated`), el teléfono firma el recibo con ECDSA P-256 (WebCrypto, llave no exportable, igual que app-facil).
   - El recibo firmado son esos datos más la huella del Memo, el hash de la transacción, el ledger y `red: "testnet"`.
   - Se comparte como enlace (`#r=`, que no se envía a ningún servidor) o como archivo `.phenom`.
3. **Verificar**
   - Primero comprueba la firma y que la huella del Memo coincide con los datos.
   - Con internet, consulta la transacción en testnet y comprueba: validada, `tesSUCCESS`, `Payment`, cuenta pagadora, cuenta receptora, monto entregado, huella en el Memo y ledger. Resultado: **Verificado ✓** o **Cambió ✗**.
   - Sin internet: **«Firma válida · pago sin comprobar»**. Se verificó solo la firma, no el ledger.
4. **Confirmar recepción**
   - El receptor devuelve una confirmación firmada (acuse).
   - El pagador la abre y ve **«Recibo confirmado ✓»**.

## Red
- Websocket a `wss://s.altnet.rippletest.net:51233`, con respaldo en `wss://testnet.xrpl-labs.com` (también testnet).
- El grifo es `faucet.altnet.rippletest.net`.
- `xrpl.js` 4.7.0 está guardado localmente en `vendor/` (licencia ISC en `vendor/xrpl-LICENSE`) y se carga solo al pagar o verificar.
- No se hace ninguna otra petición externa.

## Qué prueba y qué NO prueba
- **Prueba:** que quien tiene esa firma emitió el recibo, y que en la testnet existe un pago de prueba validado que coincide con los datos (cuentas, monto y huella en el Memo).
- **NO prueba:**
  - nada en mainnet, porque los XRP de prueba no valen nada;
  - quién es la persona en la vida real (la firma es solo un código de este teléfono);
  - que el concepto sea verdad;
  - ningún valor legal, licencia o cumplimiento.
- La testnet se reinicia de vez en cuando; entonces los pagos antiguos dejan de existir y la verificación del ledger falla.

## Seguridad
- Solo testnet. Nunca pongas aquí una semilla o billetera real.
- La semilla de prueba se guarda sin cifrar en el navegador. «Borrar billetera de prueba» (en «?») la elimina.
