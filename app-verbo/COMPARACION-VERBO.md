# App Verbo · decisiones de diseño (versión de prueba)

> «En el principio era el Verbo, y el Verbo era con Dios, y el Verbo era Dios.» — Juan 1:1

La frase se usa una sola vez, como epígrafe y con su cita. Es una inspiración de diseño, no una afirmación sobre el producto: Phenom no es divino, no sana ni hace milagros, y ninguna iglesia ni institución religiosa lo respalda.

## El principio, traducido a técnica (honesto)

| Idea | Qué hace la app de verdad |
|---|---|
| Primero la palabra | Toda acción empieza como texto: una frase, un recibo, un informe, una garantía |
| Luego el sello | Se calcula su huella SHA-256 (JSON canónico, claves ordenadas) y se firma con ECDSA P-256 en el navegador |
| Lo dicho queda | Al verificar se recalcula la huella y se comprueba la firma: "Verificado ✓" o "ROTA ✗" si cambió una sola letra |

Límites: la clave es de ejemplo y se crea en tu navegador en cada visita. Detecta cambios, pero no prueba identidad ante terceros (eso necesita una clave publicada y custodiada). Nada se sube a un servidor; el archivo de arte se lee solo en el teléfono.

## Lo que se integró ("lo que falta")

- Navegación: 5 entradas (Inicio, La Palabra, Ofertas, Qué falta, Perfil) + "Más" (La llave y Split Run, Torniquete, Pedir información).
- Ofertas: Deli (enlace a v1.17), Informe de obra (sellado), Garantía de techo (nuevo, sellado), Arte con certificado (nuevo, huella del archivo local), Goteras (sitio de prueba).
- La llave y Split Run: la simulación de app-limpia.
- Torniquete: enlace a la simulación y a su propuesta.
- Perfil con autorrelleno; Google pendiente de Client ID (config.js, GOOGLE-ID-PASOS.md).
- Qué falta: lista honesta de pendientes.

## Estilo (igual que app-limpia)

Negro, títulos grandes, una idea por pantalla, naranja como único acento, separadores de 1 px, sin peticiones externas, sin fuentes web, `prefers-reduced-motion`, foco visible. Etiquetas: "versión de prueba · datos de ejemplo"; precios "por definir"; sin cifras ni testimonios inventados; sin pagos reales.

Nota: el texto "1 items" de Deli está en la v1.17 publicada; no se tocó.
