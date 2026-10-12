# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: afición y familias.** Seguidores, amigos y familiares de los jugadores que entran para ver la plantilla, leer el blog y saltar al Instagram del club. Suelen llegar desde el móvil, a menudo con un enlace compartido por WhatsApp o desde Instagram.
- **Otras audiencias:** el dueño indicó que hay más público además de la afición, pero aún no ha dicho cuál. Hasta confirmarlo, no se prioriza a jugadores nuevos ni a patrocinadores por encima de la afición (aunque la web ya tiene el formulario «Quiero jugar» y la página «Patrocina»).

## Product Purpose

La web oficial de Bisontes DUX: presenta al club, su plantilla y su gente, cuenta su vida en el blog y conecta con sus canales (Instagram, newsletter, contacto). Funciona bien cuando la afición encuentra rápido a «su» jugador, entiende qué es el club y sigue a la manada en redes.

## Positioning

Bisontes DUX es a la vez un **proyecto social** y un **grupo de amigos**. El patrocinador principal es Todos Juegan, una asociación sin ánimo de lucro que busca equipos para jóvenes en riesgo de exclusión, y el club se vive como una comunidad cercana («la manada»), no como un equipo amateur más.

## Operating Context

- Club de fútbol de Madrid fundado en 2025. Compite en la **liga municipal de Orcasur**.
- La actualidad diaria (resultados, convocatorias, vestuario) vive en Instagram @bisontes.dux. La web es el sitio estable y oficial.
- Contacto: bisontes.dux@gmail.com.

## Capabilities and Constraints

- Web estática en GitHub Pages, bajo el subdirectorio `https://urpito.github.io/BisontesDUX/`. Los enlaces internos usan `/BisontesDUX/` de forma absoluta.
- Sin framework ni dependencias de npm: Node solo regenera el HTML (`npm run build`, `npm run check`, `npm run check:live`).
- Fuentes de datos: `data/players.js` (plantilla; cada persona puede tener `nickname`, que es lo que va en la espalda de la camiseta, y el staff lleva `role`: entrenador o directiva), `data/sponsors.js`, `data/joinForm.js`, `data/blog.js`.
- Panel de admin en `/admin/` (funcional, sin diseño): edita plantilla y blog guardando en GitHub con un token personal; la Action «Generar web» regenera las páginas al hacer push.
- Header y footer comunes generados desde `scripts/generate-site.mjs`; el footer debe ser idéntico en todas las páginas.
- La plantilla vive en la sección `#plantilla` del index; cada jugador tiene su ficha estática en `jugadores/<slug>/` pensada para aparecer en Google.
- Todo el contenido está en español.

## Brand Commitments

- Nombre: Bisontes DUX. Apodo: «la manada».
- Valores: compromiso, equipo y pasión.
- Escudo y logos existentes en `assets/` (`logo.png`, `logo.svg`, `logo-rosa.png`, `mascota.svg`).

## Evidence on Hand

- Plantilla real con 17 jugadores, 2 entrenadores (Ben Gunduz y Flavio Chicaiza, ambos «entrenador», sin primero ni segundo) y la directiva: Fabio Loi, community manager (quien mantiene la web y las redes). Fotos en `assets/`, `assets/optimized/` y `assets/uploads/`.
- Patrocinadores y colaboradores reales: Todos Juegan (principal), Fratelli D'Italia, Alcze, ISOS y PcFactory.
- No hay estadísticas, resultados, palmarés, testimonios ni prensa publicados: no se deben inventar. Las estadísticas de cada jugador solo se muestran si son reales.

## Product Principles

1. Primero la gente: los jugadores y la comunidad son el contenido principal.
2. El lado social y el grupo de amigos se notan siempre, sin sonar a institución.
3. Solo hechos reales: nada de cifras, logros ni citas inventadas.
4. Pensada para el móvil y para compartir: cada página debe verse bien en un enlace de WhatsApp o Instagram.
5. Fácil de mantener: añadir un jugador, un patrocinador o una entrada del blog es editar un archivo de datos y ejecutar el build.
