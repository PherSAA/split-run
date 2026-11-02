# Phenom — ¿Somos los únicos? (investigación, 1 nov 2026)

> **Aviso:** esto NO es opinión de abogado ni una búsqueda profesional de patentes ni de libertad de operación (FTO). No concluimos nada sobre la validez de ninguna patente ni sobre si podemos operar libremente. No afirmamos que Phenom sea único en sentido legal. Los enlaces se comprobaron con curl el 1 nov 2026 (hora America/New_York).

## Veredicto honesto
Cada pieza por separado **ya existe** (firmas en el dispositivo, envío por trozos con hash, umbral 2 de 3, hash en el Memo de XRPL, cadenas de hash, PWA offline). Lo que podría diferenciarnos es **la combinación y la sencillez**: 2 toques, sin cuenta, sin servidor, offline, en español, pensado para delis y subcontratistas latinos (Queens/Quito). Esa diferencia es de producto, no una protección legal.

## Tabla: componente → existente → link → diferencia
| # | Componente | Existente | Link | Diferencia |
|---|---|---|---|---|
| 1 | Recibos firmados ECDSA P-256 en el dispositivo, Verificado/Cambió, acuse, TOFU | ProofMode (firma offline de fotos con PGP + hash) | https://proofmode.org/verify | Ellos: evidencia de fotos/medios. Nosotros: recibos y reportes con acuse firmado de vuelta, por enlace. |
| 1 | ídem | C2PA / Content Credentials, Truepic | https://c2pa.org/specifications/specifications/2.4/index.html · https://contentcredentials.org · https://truepic.com | Estándar de procedencia de medios; nosotros no somos compatibles con C2PA (todavía). |
| 1 | ídem | Keybase, Signal (TOFU / números de seguridad) | https://keybase.io · https://signal.org/docs/ | Mensajería, no recibos de trabajo. |
| 2 | Envío por trozos SHA-256 + raíz; reenviar solo lo que falta | BitTorrent BEP3, IPFS merkle-dag, rsync, tus, magic-wormhole, croc, Syncthing | https://www.bittorrent.org/beps/bep_0003.html · https://docs.ipfs.tech/concepts/merkle-dag/ · https://tus.io | Técnica muy conocida; lo nuevo para nosotros es hacerlo por enlaces/chat sin servidor. |
| 3 | Quórum 2 de 3 | Firmas umbral / MPC (Ripple MPC, patentes de umbral) | https://xrpl.org (ver docs de Ripple MPC) | Nosotros: 2 de 3 personas confirman un recibo, no custodia de claves. |
| 4 | Pago XRPL testnet con hash del recibo en el Memo | DAS Proof (SHA-256 en memo XRPL), RILDocs (hash anclado en XRPL + otras), Transparence (hackathon XRPL Commons) | https://xrpl.org/docs/references/protocol/transactions/common-fields#memos-field | Ellos anclan documentos; nosotros unimos pago + recibo firmado + verificación contra el ledger en la misma pantalla. Solo testnet. |
| 5 | Cadena de hash con paso de torniquete (MTA, simulado) | OpenTimestamps, Chainpoint, RFC 6962 (Certificate Transparency), Verifactu (registros encadenados SHA-256), fiskaly | https://opentimestamps.org · https://www.rfc-editor.org/rfc/rfc6962 · https://www.boe.es/buscar/act.php?id=BOE-A-2024-22138 | Encadenar hashes es estándar. El torniquete es solo una simulación, sin relación con la MTA. |
| 6 | PWA offline-first | Práctica estándar (service workers); CompanyCam y Fieldwire sincronizan offline | https://companycam.com/pricing · https://www.fieldwire.com | Nada nuevo en lo técnico. |
| 7a | Caja de deli | Facturación fiscal: SAT (MX), SRI (EC), FatturaPA (IT), Verifactu (ES), fiskaly | https://www.sat.gob.mx · https://www.sri.gob.ec · https://www.fatturapa.gov.it | No somos un sistema fiscal y no afirmamos cumplir ninguna norma. |
| 7b | Reportes verificados para subcontratistas | CompanyCam, Fieldwire, Procore | https://companycam.com/pricing · https://www.procore.com | No encontramos que ellos documenten reportes a prueba de manipulación firmados por ambas partes. Sí tienen GPS/hora y sincronización. |
| — | Firma de documentos | DocuSign, Proof.com | https://www.docusign.com · https://www.proof.com | Requieren cuenta y servidor; legalmente más maduros. |
| — | Estándares abiertos | W3C VC 2.0, RFC 7515 (JWS), in-toto, SLSA, XRPL-Standards | https://www.w3.org/TR/vc-data-model-2.0/ · https://www.rfc-editor.org/rfc/rfc7515 · https://in-toto.io · https://slsa.dev · https://github.com/XRPLF/XRPL-Standards | Podríamos exportar en estos formatos. |

## Top 5 más cercanos
1. ProofMode — https://proofmode.org/verify
2. RILDocs (anclaje en XRPL) — encontrado por búsqueda; la página respondió 200
3. DAS Proof (SHA-256 en memo XRPL) — encontrado por búsqueda; la página respondió 200
4. CompanyCam — https://companycam.com/pricing
5. fiskaly / Verifactu — https://www.boe.es/buscar/act.php?id=BOE-A-2024-22138
(C2PA es el estándar con el que conviene alinearse.)

## Patentes encontradas (solo referencia; sin conclusión sobre validez ni FTO)
| Número | Tema | Link | Estado del link |
|---|---|---|---|
| US9276749 | Validación distribuida de documentos firmados | https://patents.google.com/patent/US9276749 | 200 |
| US20140067676 | Recibos digitales, autenticación local offline en el móvil | https://patents.google.com/patent/US20140067676A1 | 200 (vía patentsencyclopedia) |
| US20080270436A1 | Trozos con lista de hashes, pedir solo los que faltan | https://patents.google.com/patent/US20080270436A1 | 200 |
| US20160035388A1 | Video por trozos, reenviar solo los fallidos | https://patents.google.com/patent/US20160035388A1 | 200 |
| WO2019034951A1 | Firma digital umbral | https://patents.google.com/patent/WO2019034951A1 | 200 |
| US11641283B2 | Transferencia de activo digital con umbral | https://patents.google.com/patent/US11641283B2 | 200 |
| US7694332B2 | Recibo digital de transacción | https://patents.google.com/patent/US7694332B2 | 503: visto en búsqueda, no por fetch directo |
| US20230421396A1 | Firma MPC en dos niveles | https://patents.google.com/patent/US20230421396A1 | 503: visto en búsqueda, no por fetch directo |
| US6199049 | Diario electrónico verificable para POS (hash corrido) | https://patents.google.com/patent/US6199049 | 503: visto en búsqueda, no por fetch directo |
| WO2020104935A1 | Cadena de registros a prueba de manipulación | https://patents.google.com/patent/WO2020104935A1 | 503: visto en búsqueda, no por fetch directo |
| US8006094B2 | Logs enlazados por hashes criptográficos | https://patents.google.com/patent/US8006094B2 | 503: visto en búsqueda, no por fetch directo |
| US8429413 / US7975144 | Recibo firmado con ayuda de servidor | https://patents.google.com/patent/US8429413 | Solo por búsqueda, no comprobado |

## Lo que no pudimos verificar
- 5 páginas de Google Patents devolvieron 503 (límite de tráfico), incluso al reintentar.
- US8429413 y US7975144 solo aparecieron en la búsqueda.
- No hay un enlace válido a "recibos digitales" de Square (el URL dio 404), así que lo quitamos.
- No buscamos en bases no indexadas (USPTO full-text, EPO, IMPI, SENADI). Tampoco revisamos apps privadas ni regionales sin web.

## Qué más podemos hacer (por prioridad)
| # | Acción | Por qué | Esfuerzo |
|---|---|---|---|
| 1 | Piloto con 2–3 delis y 2–3 subcontratistas (Queens/Quito) | La ventaja real es el nicho y la sencillez; hay que probarlo con usuarios | Medio (personas, sin código) |
| 2 | Flujo WhatsApp-first (compartir enlace o recibo en 1 toque) | Así se comunica el nicho | Bajo |
| 3 | Exportar como JWS / W3C VC y luego C2PA | Interoperar con estándares y dar credibilidad | Medio |
| 4 | Anclaje opcional con OpenTimestamps o XRPL (testnet) | Sello de tiempo independiente, gratis o barato | Bajo–medio |
| 5 | Página "cómo verificar" sin la app (verificador estático) | Que un tercero confíe sin instalar nada | Bajo |
| 6 | Aviso de Verifactu/SRI/SAT ("no es factura fiscal") | Evitar confusiones; no prometemos cumplimiento | Bajo |
| 7 | Precios "por definir": validar disposición a pagar en el piloto | Sin pagos reales todavía | Bajo |
| 8 | Consultar a un abogado de patentes antes de lanzar o invertir | Esto no es FTO; las patentes listadas tocan temas cercanos | Externo (costo por definir) |
