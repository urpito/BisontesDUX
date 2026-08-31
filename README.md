# Bisontes DUX

Web oficial estática, publicada en GitHub Pages bajo `https://urpito.github.io/BisontesDUX/`.

## Actualizar plantilla, fichas y archivos de descubrimiento

1. Edita `data/players.js`. Ese archivo es la fuente de verdad de la plantilla.
2. Añade las fotos a `assets/` cuando existan. Los campos opcionales admitidos están documentados en el propio archivo.
3. Ejecuta `npm run build`.
4. Comprueba el resultado local con `npm run check`.
5. Tras publicar, ejecuta `npm run check:live` para auditar el HTML servido sin JavaScript.
6. Publica también los HTML generados de `jugadores/`, `plantilla/`, `patrocina-bisontes-dux/`, `sitemap.xml`, `llms.txt` y `players.json`.

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
