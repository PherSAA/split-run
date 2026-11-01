# Propuesta (borrador de prueba): torniquete verificable para la evasión de pasaje

> Idea propia de Phenom. **Sin relación con la MTA ni con OMNY.** La demo usa datos de ejemplo. No es asesoría legal.
> Fuentes consultadas el 1 de noviembre de 2026.

## 1. Cómo funciona

1. **Pase firmado de vida corta.** Un emisor firma un pase con ECDSA P-256 (o ed25519). El pase lleva solo `id` al azar, `exp` (vencimiento), `usos` y la firma. No lleva nombre, tarjeta ni biometría.
2. **El torniquete verifica sin internet.** Solo guarda la clave pública del emisor. Rechaza un pase si la firma no es válida (falsificado o alterado), si ya venció, o si ya se usó (copia).
3. **Registro encadenado.** Cada toque, aceptado o rechazado, se anota con `hash = SHA-256(hash_anterior | datos)`. Si alguien borra o cambia un toque, la cadena se rompe en ese punto.
4. **Subida posterior.** Sin internet, el registro queda en cola y se sube al volver la conexión.
5. **Zonas a revisar.** Con el registro subido, una regla simple marca estación y hora con muchos rechazos (en la demo: 3 o más).

Demo: https://phersaa.github.io/split-run/torniquete-prueba/

## 2. Qué hace ya OMNY (según fuentes oficiales)

- Es un sistema **por cuenta** (account-based) y sin contacto: tarjetas bancarias, billeteras del teléfono o reloj, y tarjetas OMNY de la MTA. Tiene un back office central para tarifas, conciliación y liquidación. Fuente: documento del Board de la MTA, https://www.mta.info/document/140456 (fecha del documento no visible en el extracto).
- El contrato (A-34024) se adjudicó a **Cubic Transportation Systems** el 1 de noviembre de 2017, con diseño, construcción y operación. Misma fuente.
- Al tocar, la pantalla confirma al instante si el toque fue válido; el historial de viajes se puede ver hasta un año en la cuenta. https://omny.info/how-omny-works
- Cubic opera el sitio, la app y partes del sistema de pago en nombre de la MTA. https://omny.info/privacy-policy (la página muestra fechas de actualización de 2026).
- **No verificado:** cómo valida OMNY cada toque por dentro (en línea o sin conexión, listas de denegación, firmas en el lector). No encontré esto en fuentes oficiales.

## 3. Lo que la MTA dice sobre la evasión (solo cifras encontradas)

- Evasión en el metro: **12.7% en 2024 → 10.2% en 2025**. https://www.mta.info/agency/new-york-city-transit/ridership/2025
- De junio a diciembre de 2024: metro de 14% a 10% (−26%); autobuses de 50% a 45%. Pérdida estimada por el panel Blue-Ribbon: **$690 millones** en pasajes y peajes no pagados en 2022. https://www.mta.info/press-release/icymi-governor-hochul-announces-subway-fare-evasion-down-26-percent-new-york-city
- Multas por niveles desde el 1 de enero de 2025 (advertencia, luego $100 y $150; Fair Fares $50 y $75). En 2025, cerca del 89% de los casos de evasión terminaron en advertencia. Informe TAB, 15 de diciembre de 2025: https://www.mta.info/document/194166
- La evasión en autobuses se estima con contadores automáticos (APC) y datos de cobro (AFC). https://data.ny.gov/api/views/uv5h-dfhp/files/f4f079e1-a663-4db3-8929-b2818e888a83?download=

## 4. Programas de puertas nuevas

- Piloto de puertas modernas en 20 estaciones, con tres proveedores; plan para 150 estaciones con el Plan de Capital 2025–2029. Las puertas nuevas solo aceptan "tap and ride". https://www.mta.info/project/modern-fare-gates (actualizado el 31 de marzo de 2026)
- 7 de octubre de 2026: el piloto redujo la evasión un **35% en promedio** en esas 20 estaciones. Proveedores calificados: Cubic, STraffic y Conduent. Inversión de $1.100 millones para 150 estaciones; siguen 20 estaciones más con instalación desde fines de 2026. https://www.governor.ny.gov/news/governor-hochul-announces-new-subway-gate-pilot-reduced-fare-evasion-35-unveils-next-20

## 5. Privacidad y aspectos legales

- La MTA, como corporación de beneficio público, está sujeta a la ley de privacidad e Internet de NY, a FOIL y a la Personal Privacy Protection Law (según la política de OMNY). https://omny.info/privacy-policy
- La ley de NYC sobre información biométrica (Adm. Code §22-1201 y siguientes) exige avisos a **comercios** que la recojan y prohíbe venderla. https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-42626 — **No verificado** si aplica a la MTA. Esta propuesta no usa biometría.
- Un registro de toques, aunque no tenga nombres, puede volverse sensible si se cruza con otros datos. Hay que definir retención, acceso y quién lo audita.

## 6. Riesgos

- **No frena lo físico:** saltar, empujar o forzar una puerta no genera toque. Para eso están las puertas nuevas y la presencia en estación.
- **Copias sin conexión:** dos lectores sin internet podrían aceptar la misma copia hasta sincronizar. Mitigaciones: vida corta, un uso, sincronización frecuente.
- **Claves:** si se roba la clave privada del emisor, se pueden falsificar pases. Requiere HSM, rotación y revocación.
- **Integración:** OMNY es un contrato existente con Cubic. Esto sería, como mucho, una capa adicional (auditoría del registro), no un sustituto.
- **Equidad:** marcar "zonas" no debe traducirse en vigilancia desigual por barrio. Las reglas y su uso deben ser públicos.

## 7. Idea de piloto (solo como propuesta)

1. Laboratorio, sin pasajeros: lectores de prueba con pases firmados y registro encadenado; medir el tiempo de verificación sin internet.
2. Auditoría paralela en una estación: copiar (con permiso) los eventos del lector a una cadena SHA-256 y comprobar que la cadena coincide con los datos oficiales.
3. Informe público: qué detecta, qué no, costo y riesgos.

## 8. Lo que necesita a la MTA, a Cubic o a abogados

- Acceso a especificaciones de lectores y back office (no son públicas).
- Permiso para cualquier prueba en estaciones; contacto formal con la MTA.
- Revisión legal de privacidad (FOIL, PPPL, retención de datos) y de contratos.
- Nada de esto se ha pedido ni presentado; es un borrador.
