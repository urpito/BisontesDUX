# Bisontes DUX

Web oficial estática, publicada en GitHub Pages bajo `https://bisontesdux.es/`.

## Actualizar plantilla, fichas y archivos de descubrimiento

1. Edita `data/players.js`. Ese archivo es la fuente de verdad de la plantilla.
2. Añade las fotos a `assets/` cuando existan. Los campos opcionales admitidos están documentados en el propio archivo.
3. Ejecuta `npm run build`.
4. Comprueba el resultado local con `npm run check`.
5. Tras publicar, ejecuta `npm run check:live` para auditar el HTML servido sin JavaScript.
6. Publica también los HTML generados de `jugadores/`, `plantilla/`, `patrocina-bisontes-dux/`, `blog/`, `sitemap.xml`, `llms.txt` y `players.json`.

La plantilla se muestra en la sección `#plantilla` del index. Las antiguas URLs `/plantilla/` y `/jugadores/` solo redirigen ahí; las fichas individuales siguen en `jugadores/<nombre>/`.

## Panel de admin (/admin/)

`https://bisontesdux.es/admin/` edita toda la web sin tocar código y guarda en GitHub con un token (instrucciones en la propia página); la Action «Generar web» publica en 1-2 minutos.

- **Plantilla** (`data/players.js`): tipo, nombre, apodo, dorsal, posición, capitán, «se encarga de», edad, foto, hasta dos nacionalidades con bandera, trayectoria por etapas (de la más antigua a la actual), bio, estadísticas y redes. Buscador y enlace a cada ficha.
- **Textos de la web** (`data/site.js`): frase de la portada, «Sobre nosotros» y los datos del club, plantilla, valores, patrocinadores, Instagram, «Quiero jugar» y newsletter. Admite `**negrita**` y `[texto](enlace)`. El generador los vuelca en `index.html` entre los marcadores `SITE-…`.
- **Patrocinadores** (`data/sponsors.js`) y **Blog** (`data/blog.js`).
- Las banderas salen de `data/countries.js` (nombre en español → código ISO).

## Header y footer

El menú y el footer son los mismos en todas las páginas y salen de `NAV_SECTIONS` y `NAV_PAGES` en `scripts/generate-site.mjs` (primero las secciones del index, luego las páginas propias, con Patrocina a la derecha). En las páginas escritas a mano (`index.html`, `aviso-legal.html`, `privacidad.html`, `404.html`) se insertan entre los marcadores `GENERATED-HEADER` y `GENERATED-FOOTER`: no edites lo que hay dentro, cambia el script y ejecuta `npm run build`.

## Blog

Las entradas están en `data/blog.js` (instrucciones dentro del archivo). Tras añadir o borrar una entrada, ejecuta `npm run build`: se generan `blog/` y `blog/<slug>/` y se actualiza el sitemap.

## Galería

`galeria/` (pública, con las fotos destacadas) y `galeria/privada/` (con cuenta: todas las fotos, filtro por jugador, subida y accesos para admins) se generan con `npm run build`. Las cuentas, sesiones, fotos y vídeos no están en el repositorio: viven en el servidor propio de Urpilandia. El navegador usa `js/bisontes-api.js`; la lógica está en `js/galeria-comun.js`, `js/galeria.js` y `js/galeria-privada.js`. La carpeta `supabase/` se conserva únicamente como referencia de la instalación anterior y como ayuda para una reversión controlada durante la migración.

No hay dependencias de npm ni servidor: Node solo se usa para regenerar HTML estático. Los enlaces internos principales utilizan explícitamente el subdirectorio la raíz (`/`) de GitHub Pages.

### Editar nacionalidad y trayectoria

Todos los datos editables están en `data/players.js`. Dentro del jugador correspondiente puedes añadir una o dos nacionalidades y tantas líneas de trayectoria como necesites:

```js
{
  dorsal: 10,
  name: "García, Juan",
  position: "MCO",
  nationalities: ["España", "Argentina"],
  trajectory: [
    "2023–2025 · Club anterior",
    "2025–actualidad · Bisontes DUX"
  ]
}
```

Usa una lista con un solo país si el jugador tiene una nacionalidad. Después ejecuta `npm run build`: las fichas HTML y `players.json` se actualizan automáticamente.

`scripts/check-seo.mjs` comprueba por jugador: HTML inicial, H1, relación con Bisontes DUX, title, description, canonical, Open Graph, JSON-LD, enlaces desde plantilla e índice, sitemap y archivos machine-readable. Con `--live` comprueba además HTTP 200, ausencia de redirecciones y que cada URL pública sirva un HTML diferente.

## Analítica

`js/site.js` emite eventos `bisontesdux:analytics` sin enviar datos a terceros. Un proveedor futuro puede escuchar ese evento e integrar visitas, fichas, redes, compartidos, patrocinadores y contactos sin cambiar el marcado.

## Nota sobre robots.txt en GitHub Pages

`robots.txt` está en la raíz del dominio (`https://bisontesdux.es/robots.txt`) y apunta al sitemap. El sitemap puede enviarse a Google Search Console y Bing Webmaster Tools.

Tras cada cambio relevante de plantilla, envía `https://bisontesdux.es/sitemap.xml` en ambos servicios. Un sitemap ayuda al descubrimiento, pero no garantiza indexación.

## llms.txt y players.json

`llms.txt` sigue la propuesta comunitaria de contenido legible por sistemas de IA y se publica dentro del subdirectorio del proyecto. Es complementario: no sustituye el HTML, el enlazado interno, Schema.org ni el sitemap. `players.json` contiene exclusivamente los datos públicos generados desde `data/players.js`.

## Panel de admin

En `https://bisontesdux.es/admin/` hay un panel para editar la plantilla y el blog sin tocar código.

1. Crea una vez un token de GitHub (las instrucciones están en la propia página): *fine-grained*, solo para el repositorio `BisontesDUX`, con permiso **Contents: Read and write**.
2. Entra con el token. Puedes añadir, editar, ordenar y borrar personas (jugador, entrenador o directiva, con apodo, foto, nacionalidad, trayectoria y redes) y entradas del blog (con portada).
3. Al guardar, el panel escribe `data/players.js` o `data/blog.js` (y las imágenes en `assets/uploads/` o `assets/blog/`). La Action **Generar web** (`.github/workflows/generar-web.yml`) ejecuta `npm run build` y `npm run check`, sube las páginas generadas y GitHub Pages publica en uno o dos minutos.

El token se guarda solo en tu navegador. No marques «Recordarlo» en ordenadores compartidos.

### Apodos y roles

- `nickname`: es lo que va estampado en la espalda de la camiseta (portada y ficha). Si no hay apodo, sale el apellido.
- El staff no lleva dorsal, sino `role: "entrenador"` o `role: "directiva"`, con el cargo en `position` (por ejemplo, `"COMMUNITY MANAGER"`).

## Partido en directo (`/admin/partido/`)

Panel para el móvil, con la misma cuenta que el resto del admin.

- **Partidos:** rival, fecha, campo, casa o fuera, competición y minutos por parte.
- **11 inicial:** eliges el sistema y tocas cada posición del campo para poner a un jugador; luego suplentes y capitán. «Crear historia del 11 inicial» la deja lista para revisar y compartir (no se publica sola).
- **Directo:** empieza el partido → descanso → 2.ª parte → final, con el minuto calculado solo. Gol (goleador, asistencia y foto), gol en contra, amarilla, roja y penalti (a favor o en contra, gol o fallado). Cualquier gol se puede marcar como **gol anulado** (fuera de juego o falta): sale del marcador y genera su historia.
- **Fotos:** se suben a la galería privada con el nombre del partido.
- **Historias:** cada evento genera su historia de Instagram (1080×1920) en el propio móvil, con los datos del partido (marcador, minuto, jugador o apodo). Si la publicación automática está activada y Instagram conectado, se publica sola; si no, queda «lista» y se comparte con el botón «Compartir» del móvil.
- **Sin cobertura:** las acciones se guardan en el móvil y se suben solas al volver la conexión (arriba pone «Guardando…» o «sin guardar»).

Los datos van en `data/partidos.js` (GitHub, por la función `admin-github`). Ese archivo no lanza la Action «Generar web».

Para usar vuestra plantilla de Canva en las historias, exportad el fondo de cada tipo como PNG de 1080×1920 y guardadlo en `assets/historias/<tipo>.png` (`gol`, `gol_contra`, `amarilla`, `roja`, `penalti`, `anulado`, `inicio`, `descanso`, `final`, `once`). Los textos se pintan encima.

### Conectar Instagram (publicación automática)

1. La cuenta de Instagram del club tiene que ser **profesional** (empresa o creador).
2. En [developers.facebook.com](https://developers.facebook.com) crea una app con el producto **Instagram API** (inicio de sesión con Instagram) y añade la cuenta del club. Permisos: `instagram_business_basic` e `instagram_business_content_publish`. Genera el **token de acceso** y apunta el **ID de usuario de Instagram**.
3. En Supabase → *Edge Functions* → nueva función `instagram-story`, pega `supabase/functions/instagram-story/index.ts` y desactiva **Verify JWT**.
4. En *Edge Functions* → *Secrets*, añade `IG_USER_ID` e `IG_ACCESS_TOKEN`.
5. El token dura 60 días. Renuévalo antes de que caduque abriendo
   `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=TU_TOKEN`
   y cambia el secreto por el nuevo.

Hasta que esté conectado, el panel funciona igual y las historias se comparten a mano.

## Servidor propio (urpilandia) — sustituye a Supabase

La web se sirve en `https://bisontesdux.es` desde urpilandia, con nginx y una configuración propia, independiente de SillaMC:

- **Web:** `/var/www/bisontesdux`. El temporizador `bisontesdux-deploy.timer` mira GitHub cada minuto y copia la rama publicada (`~/.bisontesdux-branch`, normalmente `main`) con `~/bisontesdux-deploy.sh`. Si cambia `server/`, reinicia la API.
- **API:** `server/server.mjs` (servicio `bisontesdux-api`, solo en `127.0.0.1:8810`, publicado en `/api`). Lleva las cuentas y sesiones, los accesos de la galería, las fotos y vídeos, el guardado en GitHub del admin y la publicación de historias en Instagram. Usa Node 22 sin dependencias.
- **Datos:** `/srv/bisontesdux`, con la base de datos `bisontesdux.db` y `media/publica` y `media/privada`. Cuando se conecte el disco nuevo, se mueve esa carpeta y se cambia `BDX_DATA` en el servicio y la ruta en `/etc/nginx/snippets/bisontesdux-site.conf`.
- **Vídeos:** se suben por trozos (hasta 4 GB) y `ffmpeg` los pasa a MP4 H.264 con miniatura. Se ven con avance y retroceso.
- **Llaves:** `~/.bisontesdux-secretos` (chmod 600), con `GITHUB_TOKEN` y, cuando toque, `IG_USER_ID` e `IG_ACCESS_TOKEN`. Nunca van en la web ni en el repositorio.
- **Navegador:** `js/bisontes-api.js` sustituye a supabase-js (imita sus llamadas), así que la galería y los paneles no cambian.

Herramientas, en urpilandia, dentro de `~/bisontesdux-web`:

```bash
node --no-warnings server/cuentas.mjs lista
node --no-warnings server/cuentas.mjs admin correo@ejemplo.com
node --no-warnings server/cuentas.mjs clave correo@ejemplo.com
node --no-warnings server/migrar-supabase.mjs --solo-ver
```

`migrar-supabase.mjs` copia cuentas (con su hash de contraseña), accesos, fotos y archivos desde Supabase. Necesita `SUPABASE_DB_URL` y `SUPABASE_SERVICE_KEY` en el archivo de llaves y `postgresql-client`. Los hashes bcrypt se conservan tal cual y se recifran al primer inicio de sesión correcto; nunca se leen ni se muestran contraseñas en texto claro.

### Migración segura desde Supabase

La migración es aditiva y repetible: no borra nada de Supabase ni reemplaza cuentas locales que entren en conflicto. El orden obligatorio es:

```bash
node --no-warnings server/backup.mjs
node --no-warnings server/migrar-supabase.mjs --solo-ver
node --no-warnings server/migrar-supabase.mjs
node --no-warnings server/migrar-supabase.mjs --verificar
node --no-warnings server/backup.mjs
```

Los hashes bcrypt se conservan sin conocer ni mostrar las contraseñas. Al primer inicio correcto se convierten a scrypt. Las sesiones de Supabase no se copian: cada persona debe volver a iniciar sesión; solo haría falta un restablecimiento individual si un hash concreto no fuese compatible.

No se debe eliminar el proyecto de Supabase ni cambiar la rama publicada hasta comprobar los conteos, abrir fotos y vídeos desde una cuenta autorizada y confirmar el plan de vuelta atrás.

### Copias y vuelta atrás

`server/backup.mjs` crea una copia consistente de SQLite, una instantánea incremental de todos los medios y un `manifest.json` con la comprobación de integridad y los conteos. El temporizador `server/systemd/bisontesdux-backup.timer` lo ejecuta a diario a las 03:20 y conserva 14 instantáneas en `/srv/bisontesdux-backups`.

Para volver atrás, primero se detiene la API, se aparta la carpeta de datos actual, se restaura `bisontesdux.db` y `media/` desde una instantánea verificada y se arranca la API. Una restauración sustituye datos y requiere autorización expresa. Estas instantáneas están en el mismo disco físico: protegen frente a errores lógicos, pero hasta añadir una copia cifrada fuera de Urpilandia no protegen frente a la pérdida del disco.
