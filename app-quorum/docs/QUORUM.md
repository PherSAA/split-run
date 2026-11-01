# Quórum 2 de 3 · versión de prueba

Datos de ejemplo. Mismo dispositivo: **no son 3 teléfonos**.

## Qué hace

1. El emisor sella un informe (de obra o de garantía de techo) con su llave ECDSA P-256. La llave se crea en el navegador y la privada no se puede exportar.
2. El informe se divide en piezas de 160 bytes. Cada pieza lleva su SHA-256 y hay una huella raíz. Las piezas se envían al **grupo de 3 células** (A, B y C).
3. Cada célula es un **Web Worker aislado**, con su propia llave y su propia base IndexedDB (llavero, revocadas y nonces). Cada una por su cuenta:
   - rearma las piezas y comprueba la huella raíz;
   - comprueba la huella del informe, la firma del emisor, que la llave sea conocida y no esté revocada, y que el nonce no se haya visto;
   - firma su voto («verifica» o «rechaza») con su llave.
4. **Regla:** el informe vale solo si **2 o más** votos firmados dicen «verifica» sobre esta misma huella y esta misma raíz, y todas las firmas de voto verifican.
5. El **acta** reúne el informe, el grupo (huellas y llaves públicas) y los votos. `docs/verify-acta.mjs` la verifica fuera de la app con Node WebCrypto.

La reserva E **no se usa** en esta demo.

## Relación con documentos anteriores

- **phenom-agent-api/docs/quorum.md:** la misma tarea va a 2 células; si discrepan, decide una 3.ª. Aquí las 3 votan siempre, así que siempre se gasta 3× CPU. Hay que mantener su límite: **si 2 células del mismo dueño se ponen de acuerdo para mentir, ganan**. Para eso existe «recompute» (que el servidor recalcule), y aquí no se implementa.
- **phenom-adn-simulacion (README):** 24 células en 8 grupos de 3, como modelo conceptual. Aquí se usa **un** grupo de 3 como motor real de verificación. Esto no dice nada de biología.

## Qué prueba y qué NO prueba

**Prueba:** una célula caída o una que miente no decide el resultado, y un voto con firma falsa no cuenta.

**No prueba:**
- que las células sean organizaciones independientes (mismo dispositivo, mismo código);
- que el contenido del informe sea verdad;
- valor legal.

No se ha probado en 3 teléfonos reales. El modo de 3 pestañas por BroadcastChannel no se hizo: se eligieron Workers por fiabilidad.
