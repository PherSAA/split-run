# App limpia · comparación con el estilo de xrpl.org (versión de prueba)

Idea: mismo contenido y lógica que `app-prueba/`, con el lenguaje visual sencillo de xrpl.org. No se copió ningún archivo, imagen ni código de XRPL; solo se tomaron las ideas de diseño.

| Rasgo de xrpl.org | Qué se hizo en app-limpia |
|---|---|
| Fondo negro puro | `#000` en todo, sin degradados ni fondos animados |
| Botón píldora naranja arriba a la izquierda | Píldora "Versión de prueba" arriba a la izquierda; el naranja Phenom es el único color de acento (botones píldora) |
| Cabecera mínima: logo + idioma + menú | Logo Phenom real (`icons/phenom-logo.svg`, sin redibujar), "ES" y menú hamburguesa que abre una lista simple |
| Títulos blancos enormes | `h1` de 34 a 48 px (`clamp`), una idea por pantalla |
| Separadores finos | Líneas de 1 px en lugar de tarjetas, vidrio o sombras |
| Filas clave–valor | Estado, plan, detalle del recibo y piezas de Split Run en filas `dt/dd` |
| Pestañas Simple / Detallado / En bruto | Recibo de ejemplo (venta Deli o informe de obra): palabras simples, campos, y JSON + SHA-256 |
| Chip verde de éxito | "Verificado ✓" en verde si la huella recalculada coincide; "No verificado ✗" en rojo si se cambió un dato |
| "Read More →" | "Leer más →" en cada fila |
| Mucho espacio en blanco | Márgenes amplios, texto corto, una acción principal por pantalla |
| Ilustración de toroide suave (noticia) | Un solo toroide SVG estático hecho con degradados radiales, solo en Inicio, sin animación |
| Rápido | Sin peticiones externas, sin fuentes web (fuentes del sistema), sin librerías; HTML+CSS+JS pequeños |

Accesibilidad: contraste alto (blanco/gris #a3a3a3 sobre negro), foco visible naranja, `prefers-reduced-motion`, pestañas con `role="tab"`.

Honestidad: "versión de prueba", "datos de ejemplo", precios "por definir", sin estadísticas ni testimonios inventados. El sello es una huella SHA-256 en el navegador, no una firma de servidor.
