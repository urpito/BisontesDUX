# Bisontes DUX

Web oficial estática, publicada en GitHub Pages bajo `https://urpito.github.io/BisontesDUX/`.

## Actualizar plantilla, fichas y archivos de descubrimiento

1. Edita `data/players.js`. Ese archivo es la fuente de verdad de la plantilla.
2. Añade las fotos a `assets/` cuando existan. Los campos opcionales admitidos están documentados en el propio archivo.
3. Ejecuta `npm run build`.
4. Comprueba el resultado local con `npm run check`.
5. Tras publicar, ejecuta `npm run check:live` para auditar el HTML servido sin JavaScript.
6. Publica también los HTML generados de `jugadores/`, `plantilla/`, `patrocina-bisontes-dux/`, `blog/`, `sitemap.xml`, `llms.txt` y `players.json`.

La plantilla se muestra en la sección `#plantilla` del index. Las antiguas URLs `/plantilla/` y `/jugadores/` solo redirigen ahí; las fichas individuales siguen en `jugadores/<nombre>/`.

## Panel de admin (/admin/)

`https://urpito.github.io/BisontesDUX/admin/` edita toda la web sin tocar código y guarda en GitHub con un token (instrucciones en la propia página); la Action «Generar web» publica en 1-2 minutos.

- **Plantilla** (`data/players.js`): tipo, nombre, apodo, dorsal, posición, capitán, edad, foto, hasta dos nacionalidades con bandera, trayectoria por etapas, bio, estadísticas y redes. Buscador y enlace a cada ficha.
- **Textos de la web** (`data/site.js`): «Sobre nosotros» y los datos del club, plantilla, valores, patrocinadores, Instagram, «Quiero jugar» y newsletter. Admite `**negrita**` y `[texto](enlace)`. El generador los vuelca en `index.html` entre los marcadores `SITE-…`.
- **Patrocinadores** (`data/sponsors.js`) y **Blog** (`data/blog.js`).
- Las banderas salen de `data/countries.js` (nombre en español → código ISO).

## Header y footer

El menú y el footer son los mismos en todas las páginas y salen de `NAV_SECTIONS` y `NAV_PAGES` en `scripts/generate-site.mjs` (primero las secciones del index, luego las páginas propias, con Patrocina a la derecha). En las páginas escritas a mano (`index.html`, `aviso-legal.html`, `privacidad.html`, `404.html`) se insertan entre los marcadores `GENERATED-HEADER` y `GENERATED-FOOTER`: no edites lo que hay dentro, cambia el script y ejecuta `npm run build`.

## Blog

Las entradas están en `data/blog.js` (instrucciones dentro del archivo). Tras añadir o borrar una entrada, ejecuta `npm run build`: se generan `blog/` y `blog/<slug>/` y se actualiza el sitemap.

## Galería

`galeria/` (pública, con las fotos destacadas) y `galeria/privada/` (con cuenta: todas las fotos, filtro por jugador, subida y accesos para admins) se generan con `npm run build`, pero las fotos y las cuentas no están en el repositorio: viven en Supabase. Puesta en marcha, uso y límites: [`supabase/README.md`](supabase/README.md). La conexión está en `js/galeria-config.js`; la lógica, en `js/galeria-comun.js`, `js/galeria.js` y `js/galeria-privada.js`.

No hay dependencias de npm ni servidor: Node solo se usa para regenerar HTML estático. Los enlaces internos principales utilizan explícitamente el subdirectorio `/BisontesDUX/` de GitHub Pages.

### Editar nacionalidad y trayectoria

Todos los datos editables están en `data/players.js`. Dentro del jugador correspondiente puedes añadir una o dos nacionalidades y tantas líneas de trayectoria como necesites:

```js
{
  dorsal: 10,
  name: "García, Juan",
  position: "MCO",
  nationalities: ["España", "Argentina"],
  trajectory: [
    "2025–actualidad · Bisontes DUX",
    "2023–2025 · Club anterior"
  ]
}
```

Usa una lista con un solo país si el jugador tiene una nacionalidad. Después ejecuta `npm run build`: las fichas HTML y `players.json` se actualizan automáticamente.

`scripts/check-seo.mjs` comprueba por jugador: HTML inicial, H1, relación con Bisontes DUX, title, description, canonical, Open Graph, JSON-LD, enlaces desde plantilla e índice, sitemap y archivos machine-readable. Con `--live` comprueba además HTTP 200, ausencia de redirecciones y que cada URL pública sirva un HTML diferente.

## Analítica

`js/site.js` emite eventos `bisontesdux:analytics` sin enviar datos a terceros. Un proveedor futuro puede escuchar ese evento e integrar visitas, fichas, redes, compartidos, patrocinadores y contactos sin cambiar el marcado.

## Nota sobre robots.txt en GitHub Pages

El archivo se publica correctamente en `/BisontesDUX/robots.txt` y referencia el sitemap del proyecto. Los buscadores solicitan por convención el `robots.txt` de la raíz del host (`urpito.github.io/robots.txt`), que solo puede gestionarse desde el repositorio de la página de usuario. El sitemap de este proyecto puede enviarse directamente a Google Search Console y Bing Webmaster Tools.

Tras cada cambio relevante de plantilla, envía `https://urpito.github.io/BisontesDUX/sitemap.xml` en ambos servicios. Un sitemap ayuda al descubrimiento, pero no garantiza indexación.

## llms.txt y players.json

`llms.txt` sigue la propuesta comunitaria de contenido legible por sistemas de IA y se publica dentro del subdirectorio del proyecto. Es complementario: no sustituye el HTML, el enlazado interno, Schema.org ni el sitemap. `players.json` contiene exclusivamente los datos públicos generados desde `data/players.js`.

## Panel de admin

En `https://urpito.github.io/BisontesDUX/admin/` hay un panel para editar la plantilla y el blog sin tocar código.

1. Crea una vez un token de GitHub (las instrucciones están en la propia página): *fine-grained*, solo para el repositorio `BisontesDUX`, con permiso **Contents: Read and write**.
2. Entra con el token. Puedes añadir, editar, ordenar y borrar personas (jugador, entrenador o directiva, con apodo, foto, nacionalidad, trayectoria y redes) y entradas del blog (con portada).
3. Al guardar, el panel escribe `data/players.js` o `data/blog.js` (y las imágenes en `assets/uploads/` o `assets/blog/`). La Action **Generar web** (`.github/workflows/generar-web.yml`) ejecuta `npm run build` y `npm run check`, sube las páginas generadas y GitHub Pages publica en uno o dos minutos.

El token se guarda solo en tu navegador. No marques «Recordarlo» en ordenadores compartidos.

### Apodos y roles

- `nickname`: es lo que va estampado en la espalda de la camiseta (portada y ficha). Si no hay apodo, sale el apellido.
- El staff no lleva dorsal, sino `role: "entrenador"` o `role: "directiva"`, con el cargo en `position` (por ejemplo, `"COMMUNITY MANAGER"`).
