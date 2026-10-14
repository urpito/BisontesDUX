/**
 * BLOG — BISONTES DUX
 * --------------------
 * Cada entrada del blog es un bloque { ... } de la lista. Para publicar una
 * nueva, copia un bloque, cambia los valores y ejecuta `npm run build`.
 * Se ordenan solas por fecha (la más reciente primero).
 *
 * Campos:
 *   title    → Título de la entrada
 *   date     → Fecha de publicación en formato "AAAA-MM-DD"
 *   excerpt  → Resumen de 1-2 frases (sale en la tarjeta y en Google)
 *   body     → Lista de párrafos. Si un párrafo empieza por "## " se
 *              muestra como subtítulo.
 *   slug     → Parte final de la URL (OPCIONAL — si no, se genera del título)
 *   author   → Autor (OPCIONAL — si no, firma "Bisontes DUX")
 *   cover    → Imagen de portada, ruta dentro de assets/ (OPCIONAL)
 *   coverAlt → Descripción de la imagen de portada (OPCIONAL)
 *
 * Para borrar una entrada, elimina su bloque y vuelve a ejecutar el build.
 */

const posts = [
  {
    "title": "Pachanga Día de la Hispanidad",
    "date": "2026-10-14",
    "excerpt": "Opiniones de Fabio Loi sobre la Pachanga del Día de la Hispanidad",
    "body": [
      "El reciente 12 de octubre, en Orcasur, realizamos una pachanga para ver los jugadores nuevos, y algunos más que querían incorporarse. Después de haber visto el partido completo, opino que estos nuevos fichajes logran sincronizarse muy bien con los anteriores jugadores del club, por ello, no harán falta entrenamientos de coordinación, solo de estrategia y técnica."
    ],
    "author": "Fabio Loi"
  },
  {
    "title": "Arranca el blog de Bisontes DUX",
    "slug": "arranca-el-blog",
    "date": "2026-10-12",
    "excerpt": "Estrenamos un espacio propio en la web para contar las novedades, crónicas y la vida del club.",
    "body": [
      "Bienvenidos al blog de Bisontes DUX. A partir de ahora, además de nuestro Instagram, tendremos aquí un sitio para contar con más calma todo lo que pasa en la manada.",
      "## Qué vas a encontrar",
      "Crónicas de partidos, novedades de la plantilla, eventos, noticias de nuestros patrocinadores y colaboradores, y todo lo que queramos compartir sobre el club.",
      "## Síguenos",
      "Si no quieres perderte nada, síguenos en Instagram en @bisontes.dux o suscríbete a la newsletter desde la página principal. Y si quieres jugar con nosotros, rellena el formulario de «Quiero jugar»."
    ]
  }
];
