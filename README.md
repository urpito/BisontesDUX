# Bisontes DUX

Web oficial estática, publicada en GitHub Pages bajo `https://urpito.github.io/BisontesDUX/`.

## Actualizar plantilla, fichas y sitemap

1. Edita `data/players.js`. Ese archivo es la fuente de verdad de la plantilla.
2. Añade las fotos a `assets/` cuando existan. Los campos opcionales admitidos están documentados en el propio archivo.
3. Ejecuta `npm run build`.
4. Comprueba el resultado con `npm run check`.
5. Publica también los HTML generados de `jugadores/`, `plantilla/`, `patrocina-bisontes-dux/` y `sitemap.xml`.

No hay dependencias de npm ni servidor: Node solo se usa para regenerar HTML estático. Las rutas relativas están preparadas para el subdirectorio `/BisontesDUX/` de GitHub Pages.

## Analítica

`js/site.js` emite eventos `bisontesdux:analytics` sin enviar datos a terceros. Un proveedor futuro puede escuchar ese evento e integrar visitas, fichas, redes, compartidos, patrocinadores y contactos sin cambiar el marcado.

## Nota sobre robots.txt en GitHub Pages

El archivo se publica correctamente en `/BisontesDUX/robots.txt` y referencia el sitemap del proyecto. Los buscadores solicitan por convención el `robots.txt` de la raíz del host (`urpito.github.io/robots.txt`), que solo puede gestionarse desde el repositorio de la página de usuario. El sitemap de este proyecto puede enviarse directamente a Google Search Console y Bing Webmaster Tools.
