import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://urpito.github.io/BisontesDUX/';
const SITE_PATH = '/BisontesDUX/';
const TEAM_ID = `${SITE_URL}#team`;
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());

function readData(file, variable) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const context = {};
  vm.runInNewContext(`${source}\nthis.__result = ${variable};`, context, { filename: file });
  return JSON.parse(JSON.stringify(context.__result));
}

const players = readData('data/players.js', 'players');
const sponsors = readData('data/sponsors.js', 'sponsors');

const positionNames = {
  POR: 'portero', DFC: 'defensa central', LI: 'lateral izquierdo', LD: 'lateral derecho',
  MC: 'mediocentro', MCO: 'mediocentro ofensivo', EI: 'extremo izquierdo',
  ED: 'extremo derecho', DC: 'delantero centro', ENTRENADOR: 'entrenador',
  'SEGUNDO ENTRENADOR': 'segundo entrenador', 'COMMUNITY MANAGER': 'community manager'
};

const socialNames = { instagram: 'Instagram', x: 'X', twitter: 'X', tiktok: 'TikTok', facebook: 'Facebook' };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function fullName(name) {
  const parts = String(name).split(',').map(part => part.trim());
  return parts.length > 1 ? `${parts.slice(1).join(' ')} ${parts[0]}` : parts[0];
}

function slugify(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* Apellido (lo que va estampado en la espalda) y grupo para el filtro de la plantilla. */
function surname(name) {
  return String(name).split(',')[0].trim();
}

const positionGroups = {
  POR: 'porteros', DFC: 'defensas', LI: 'defensas', LD: 'defensas',
  MC: 'centrocampistas', MCO: 'centrocampistas', EI: 'delanteros', ED: 'delanteros', DC: 'delanteros'
};

function positionName(position) {
  return positionNames[String(position).toUpperCase()] || String(position).toLowerCase();
}

/* Staff = no juega (entrenadores y directiva). Se admite el antiguo dorsal "COACH". */
function staffKind(player) {
  if (player.role) return String(player.role).toLowerCase() === 'directiva' ? 'directiva' : 'entrenador';
  return String(player.dorsal).toUpperCase() === 'COACH' ? 'entrenador' : null;
}

function isCoach(player) {
  return Boolean(staffKind(player));
}

function sourcePhoto(player) {
  const candidate = player.photo || (!isCoach(player) ? `assets/jugador${player.dorsal}.png` : '');
  return candidate && fs.existsSync(path.join(ROOT, candidate)) ? candidate : null;
}

function displayPhoto(player) {
  const original = sourcePhoto(player);
  if (!original) return 'assets/logo.png';
  const optimized = `assets/optimized/${path.basename(original, path.extname(original))}.webp`;
  return fs.existsSync(path.join(ROOT, optimized)) ? optimized : original;
}

function playerData(player) {
  const name = fullName(player.name);
  const coach = isCoach(player);
  const position = positionName(player.position);
  const slug = player.slug || slugify(name);
  const pageUrl = `${SITE_URL}jugadores/${slug}/`;
  const hasPortrait = Boolean(sourcePhoto(player));
  const originalPhoto = sourcePhoto(player);
  const photo = displayPhoto(player);
  const nationalities = (Array.isArray(player.nationalities)
    ? player.nationalities
    : player.nationality ? [player.nationality] : [])
    .map(value => String(value).trim()).filter(Boolean).slice(0, 2);
  const trajectory = (Array.isArray(player.trajectory)
    ? player.trajectory
    : player.trajectory ? [player.trajectory] : [])
    .map(value => String(value).trim()).filter(Boolean);
  const imageUrl = new URL(originalPhoto || 'assets/logo.png', SITE_URL).href;
  const kind = staffKind(player);
  const area = kind === 'directiva' ? 'la directiva' : 'el cuerpo técnico';
  const statement = coach
    ? `${name} forma parte de ${area} de Bisontes DUX, club de fútbol con sede en Madrid, España. Ejerce como ${position}.`
    : `${name} es futbolista y jugador de Bisontes DUX, club de fútbol con sede en Madrid, España. Juega como ${position} y utiliza el dorsal ${player.dorsal}.`;
  const supportingText = coach
    ? `${name} pertenece a ${area} actual de Bisontes DUX. Esta es su ficha oficial dentro del sitio web del club.`
    : `${name} forma parte de la plantilla actual de Bisontes DUX. Esta es su ficha oficial dentro del sitio web del club, donde se recoge la información pública disponible sobre el jugador.`;
  const title = coach
    ? `${name} - ${kind === 'directiva' ? 'Directiva' : 'Cuerpo técnico'} de Bisontes DUX | Perfil oficial`
    : `${name} - Jugador de Bisontes DUX | Perfil oficial`;
  const description = coach
    ? `Perfil oficial de ${name}, miembro de ${area} de Bisontes DUX. Información sobre su función en el club.`
    : `Perfil oficial de ${name}, jugador de Bisontes DUX. Información sobre su participación en la plantilla, posición y dorsal.`;
  const nickname = String(player.nickname || '').trim();
  const shirtName = nickname || surname(player.name);
  const group = kind === 'directiva' ? 'directiva' : coach ? 'tecnicos' : (positionGroups[String(player.position).toUpperCase()] || 'otros');
  return { ...player, name, nickname, shirtName, group, coach, kind, position, slug, pageUrl, photo, imageUrl, hasPortrait, nationalities, trajectory, statement, supportingText, title, description };
}

const roster = players.map(playerData);

function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function head({ title, description, canonical, image, type = 'website', prefix = '' }) {
  return `
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta name="theme-color" content="#545454" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="${type}" />
  <meta property="og:site_name" content="Bisontes DUX" />
  <meta property="og:locale" content="es_ES" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:alt" content="${escapeHtml(title)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="twitter:image:alt" content="${escapeHtml(title)}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&amp;family=Big+Shoulders+Display:wght@700;800;900&amp;display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${prefix}css/style.css" />
  <link rel="icon" type="image/png" href="${prefix}favicon.png" />`;
}

/* Menú común: primero las secciones del index (scroll), luego las páginas propias. */
const NAV_SECTIONS = [
  ['sobre-nosotros', 'Sobre nosotros'],
  ['plantilla', 'Plantilla'],
  ['valores', 'Valores'],
  ['sponsors', 'Sponsors'],
  ['instagram', 'Instagram'],
  ['join', 'Únete']
];
const NAV_PAGES = [
  ['blog/', 'Blog'],
  ['patrocina-bisontes-dux/', 'Patrocina']
];

function siteHeader({ home = false, current = '' } = {}) {
  const sectionHref = id => (home ? `#${id}` : `${SITE_PATH}#${id}`);
  const sections = NAV_SECTIONS.map(([id, label]) => `<li><a href="${sectionHref(id)}">${label}</a></li>`).join('\n    ');
  const pages = NAV_PAGES.map(([href, label], index) => {
    const isCurrent = current === href;
    const classes = [index === 0 ? 'nav-page nav-page--first' : 'nav-page', index === NAV_PAGES.length - 1 ? 'nav-page--cta' : ''].filter(Boolean).join(' ');
    return `<li class="${classes}"><a href="${SITE_PATH}${href}"${isCurrent ? ' aria-current="page"' : ''}>${label}</a></li>`;
  }).join('\n    ');
  return `<!-- GENERATED-HEADER:START -->
<nav id="navbar" aria-label="Navegación principal">
  <a href="${SITE_PATH}" class="nav-brand">
    <img src="${SITE_PATH}assets/logo.png" alt="Escudo de Bisontes DUX" class="nav-logo-img" width="500" height="500" />
    <span class="nav-brand-name">Bisontes <strong>DUX</strong></span>
  </a>
  <ul class="nav-links" id="nav-links">
    ${sections}
    ${pages}
  </ul>
  <button class="nav-toggle" id="nav-toggle" aria-label="Menú" aria-expanded="false" aria-controls="nav-links">
    <span></span><span></span><span></span>
  </button>
</nav>
<!-- GENERATED-HEADER:END -->`;
}

function siteFooter() {
  const sections = NAV_SECTIONS.map(([id, label]) => `<a href="${SITE_PATH}#${id}">${label}</a>`).join(' · ');
  const pages = NAV_PAGES.map(([href, label]) => `<a href="${SITE_PATH}${href}">${label}</a>`).join(' · ');
  return `<!-- GENERATED-FOOTER:START -->
<footer class="footer-min">
  <a href="${SITE_PATH}" class="footer-min-brand">
    <img src="${SITE_PATH}assets/logo.png" alt="Escudo de Bisontes DUX" width="40" height="40" loading="lazy" decoding="async" />
    <span>Bisontes <strong>DUX</strong></span>
  </a>
  <p class="footer-min-links">${sections} · ${pages}</p>
  <p class="footer-min-links footer-min-contact">
    <a href="https://www.instagram.com/bisontes.dux" target="_blank" rel="noopener">Instagram @bisontes.dux</a> ·
    <a href="mailto:bisontes.dux@gmail.com">bisontes.dux@gmail.com</a>
  </p>
  <p class="footer-min-legal">© 2026 Bisontes DUX — Todos los derechos reservados · <a href="${SITE_PATH}aviso-legal.html">Aviso legal</a> · <a href="${SITE_PATH}privacidad.html">Privacidad</a></p>
</footer>
<!-- GENERATED-FOOTER:END -->`;
}

/* Sin foto: el escudo del club ocupa el sitio del retrato. */
function silhouette() {
  return `<img src="${SITE_PATH}assets/logo.png" alt="" width="500" height="500" loading="lazy" decoding="async" />`;
}

/* Lo que va estampado en el sitio del dorsal: número o función del técnico. */
function dorsalLabel(player) {
  if (!player.coach) return String(player.dorsal);
  if (player.kind === 'entrenador') return 'ENT.';
  /* Directiva: iniciales del cargo (COMMUNITY MANAGER → CM) */
  return String(player.position).split(/\s+/).map(word => word[0]).join('').toUpperCase().slice(0, 3);
}

/* Escudito de capitán (brazalete con la C) en tarjeta y ficha. */
function captainBadge() {
  return '<span class="captain-badge" title="Capitán" aria-label="Capitán">C</span>';
}

function rosterCard(player, prefix = '') {
  const image = player.hasPortrait
    ? `<img src="${SITE_PATH}${player.photo}" alt="Retrato de ${escapeHtml(player.name)}, ${escapeHtml(player.position)} de Bisontes DUX" class="player-card__photo" width="720" height="900" loading="lazy" decoding="async" />`
    : `<div class="player-card__silhouette player-card__silhouette--visible" aria-hidden="true">${silhouette()}</div>`;
  const dorsalClass = player.coach ? 'player-card__dorsal player-card__dorsal--text' : 'player-card__dorsal';
  return `<a class="player-card" href="${SITE_PATH}jugadores/${player.slug}/" data-group="${player.group}" data-track="player_card_click" data-player="${escapeHtml(player.name)}">
    <div class="player-card__img-wrap">
      ${image}
      <span class="${dorsalClass}" aria-hidden="true">${escapeHtml(dorsalLabel(player))}</span>
      ${player.captain ? captainBadge() : ''}
    </div>
    <div class="player-card__info">
      <h3 class="player-card__name">${escapeHtml(player.nickname || player.name)}</h3>
      <span class="player-card__pos">${escapeHtml(player.position)}</span>
      <span class="player-card__profile-link">Ver ficha oficial</span>
    </div>
  </a>`;
}

function playerPage(player) {
  const prefix = '../../';
  const personId = `${player.pageUrl}#person`;
  const facts = [
    ['Equipo', `<a href="${SITE_PATH}">Bisontes DUX</a>`],
    ['Función', escapeHtml(player.position.toLocaleUpperCase('es-ES'))],
    ...(player.captain ? [['Capitán', 'Sí']] : []),
    ...(player.nickname ? [['Apodo', escapeHtml(player.nickname)]] : []),
    ...(!player.coach ? [['Dorsal', escapeHtml(player.dorsal)]] : []),
    ...(player.age ? [['Edad', escapeHtml(player.age)]] : []),
    ['Nacionalidad', player.nationalities.length ? escapeHtml(player.nationalities.join(' · ')) : '<span class="profile-empty">Por completar</span>']
  ];
  const trajectory = `<section class="profile-section" aria-labelledby="trayectoria"><h2 id="trayectoria">Trayectoria</h2>${player.trajectory.length
    ? `<ul class="profile-trajectory">${player.trajectory.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '<p class="profile-empty">Trayectoria pendiente de actualizar.</p>'}</section>`;
  const stats = player.stats && Object.keys(player.stats).length
    ? `<section class="profile-section" aria-labelledby="estadisticas"><h2 id="estadisticas">Estadísticas</h2><dl class="profile-stats">${Object.entries(player.stats).map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl></section>`
    : '';
  const socials = player.socials && Object.keys(player.socials).length
    ? `<section class="profile-section" aria-labelledby="redes"><h2 id="redes">Redes sociales</h2><div class="profile-socials">${Object.entries(player.socials).map(([network, url]) => `<a href="${escapeHtml(url)}" target="_blank" rel="me noopener" data-track="player_social_click" data-player="${escapeHtml(player.name)}" data-platform="${escapeHtml(network)}">${socialNames[network.toLowerCase()] || escapeHtml(network)}</a>`).join('')}</div></section>`
    : '';
  const imageMarkup = player.hasPortrait
    ? `<img src="${prefix}${player.photo}" width="720" height="900" alt="Retrato oficial de ${escapeHtml(player.name)}, ${escapeHtml(player.position)} de Bisontes DUX" decoding="async" fetchpriority="high" />`
    : `<div class="profile-silhouette" role="img" aria-label="Bisontes DUX: imagen genérica para ${escapeHtml(player.name)}">${silhouette()}</div>`;
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage', '@id': `${player.pageUrl}#profilepage`, url: player.pageUrl,
        name: player.title, description: player.description, inLanguage: 'es',
        isPartOf: { '@id': `${SITE_URL}#website` }, mainEntity: { '@id': personId },
        breadcrumb: { '@id': `${player.pageUrl}#breadcrumb` }
      },
      {
        '@type': 'Person', '@id': personId, name: player.name,
        url: player.pageUrl,
        jobTitle: player.coach ? player.position : 'Futbolista',
        description: player.bio || `${player.statement} ${player.supportingText}`,
        mainEntityOfPage: { '@id': `${player.pageUrl}#profilepage` },
        ...(player.hasPortrait ? { image: player.imageUrl } : {}),
        ...(player.nationalities.length ? { nationality: player.nationalities.map(name => ({ '@type': 'Country', name })) } : {}),
        memberOf: { '@id': TEAM_ID, '@type': 'SportsTeam', name: 'Bisontes DUX', sport: 'Fútbol', url: SITE_URL },
        ...(player.socials ? { sameAs: Object.values(player.socials) } : {})
      },
      {
        '@type': 'BreadcrumbList', '@id': `${player.pageUrl}#breadcrumb`, itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Plantilla', item: `${SITE_URL}#plantilla` },
          { '@type': 'ListItem', position: 3, name: player.name, item: player.pageUrl }
        ]
      }
    ]
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>${head({ title: player.title, description: player.description, canonical: player.pageUrl, image: player.imageUrl, type: 'profile', prefix })}
  <script type="application/ld+json">${jsonLd(schema)}</script>
</head>
<body class="subpage-body">
  ${siteHeader()}
  <main class="profile-page">
    <nav class="breadcrumbs" aria-label="Migas de pan"><a href="${SITE_PATH}">Inicio</a><span>/</span><a href="${SITE_PATH}#plantilla">Plantilla</a><span>/</span><span aria-current="page">${escapeHtml(player.name)}</span></nav>
    <article class="profile-card">
      <div class="profile-photo"><span class="profile-shirt" aria-hidden="true"><span class="profile-shirt__name">${escapeHtml(player.shirtName)}</span><span class="profile-shirt__num${player.coach ? ' profile-shirt__num--text' : ''}">${escapeHtml(dorsalLabel(player))}</span></span>${imageMarkup}</div>
      <div class="profile-content">
        <div class="profile-title"><h1 class="font-display">${escapeHtml(player.name)}</h1>${player.captain ? captainBadge() : ''}</div>
        <p class="profile-role">${player.coach ? escapeHtml(player.position) : `${escapeHtml(player.position)} · Dorsal ${escapeHtml(player.dorsal)}`}</p>
        <p class="profile-statement">${escapeHtml(player.statement)}</p>
        <p class="profile-context">${escapeHtml(player.supportingText)}</p>
        ${player.bio ? `<p class="profile-bio">${escapeHtml(player.bio)}</p>` : ''}
        <dl class="profile-facts">${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>
        ${trajectory}${stats}${socials}
        <div class="profile-navigation"><a class="btn btn-ghost profile-back" href="${SITE_PATH}#plantilla">← Volver a la plantilla</a><a class="profile-home-link" href="${SITE_PATH}">Bisontes DUX · Web oficial</a></div>
      </div>
    </article>
  </main>
  ${siteFooter()}
  <script src="${prefix}js/site.js" defer></script>
</body>
</html>`;
}

/* Antiguas URLs (/plantilla/ y /jugadores/): la plantilla vive ahora en el index. */
function redirectPage(title) {
  const target = `${SITE_PATH}#plantilla`;
  return `<!DOCTYPE html>
<html lang="es"><head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="La plantilla de Bisontes DUX está en la página principal del club." />
  <meta name="robots" content="noindex, follow" />
  <link rel="canonical" href="${SITE_URL}" />
  <meta http-equiv="refresh" content="0; url=${target}" />
  <script>location.replace('${target}');</script>
</head><body>
  <h1>${escapeHtml(title)}</h1>
  <p><a href="${target}">Ir a la plantilla de Bisontes DUX</a></p>
</body></html>`;
}

/* ---------------- BLOG ---------------- */
const posts = readData('data/blog.js', 'posts')
  .map(post => ({ ...post, slug: post.slug || slugify(post.title), url: `${SITE_URL}blog/${post.slug || slugify(post.title)}/` }))
  .sort((a, b) => String(b.date).localeCompare(String(a.date)));

function formatDate(value) {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

/* Cada bloque del cuerpo es un párrafo; si empieza por "## " es un subtítulo. */
function postBody(blocks) {
  return (blocks || []).map(block => block.startsWith('## ')
    ? `<h2>${escapeHtml(block.slice(3))}</h2>`
    : `<p>${escapeHtml(block)}</p>`).join('\n      ');
}

function postImage(post) {
  return post.cover ? new URL(post.cover, SITE_URL).href : `${SITE_URL}assets/logo.png`;
}

function blogCard(post) {
  return `<article class="blog-card">
      <a href="${SITE_PATH}blog/${post.slug}/">
        ${post.cover ? `<img src="${SITE_PATH}${escapeHtml(post.cover)}" alt="${escapeHtml(post.coverAlt || post.title)}" loading="lazy" decoding="async" />` : ''}
        <div class="blog-card__body">
          <h2>${escapeHtml(post.title)}</h2>
          <time datetime="${post.date}">${formatDate(post.date)}</time>
          <p>${escapeHtml(post.excerpt)}</p>
          <span class="blog-card__more">Leer entrada</span>
        </div>
      </a>
    </article>`;
}

function blogIndexPage() {
  const canonical = `${SITE_URL}blog/`;
  const title = 'Blog de Bisontes DUX | Noticias y crónicas del club';
  const description = 'Noticias, crónicas y novedades de Bisontes DUX, club de fútbol de Madrid.';
  const schema = {
    '@context': 'https://schema.org', '@type': 'Blog', '@id': `${canonical}#blog`, url: canonical, name: 'Blog de Bisontes DUX', description, inLanguage: 'es',
    publisher: { '@id': TEAM_ID, '@type': 'SportsTeam', name: 'Bisontes DUX', url: SITE_URL },
    blogPost: posts.map(post => ({ '@type': 'BlogPosting', headline: post.title, url: post.url, datePublished: post.date }))
  };
  return `<!DOCTYPE html>
<html lang="es"><head>${head({ title, description, canonical, image: `${SITE_URL}assets/logo.png`, prefix: '../' })}
  <script type="application/ld+json">${jsonLd(schema)}</script>
</head><body class="subpage-body">
  ${siteHeader({ current: 'blog/' })}
  <main class="blog-page">
    <div class="subpage-hero"><h1 class="font-display">Blog</h1><p>Noticias, crónicas de partido y novedades de la manada.</p></div>
    ${posts.length ? `<div class="blog-grid">${posts.map(blogCard).join('\n    ')}</div>` : '<p class="blog-empty">Todavía no hay entradas. Muy pronto contaremos aquí las novedades del club.</p>'}
  </main>
  ${siteFooter()}
  <script src="../js/site.js" defer></script>
</body></html>`;
}

function blogPostPage(post) {
  const canonical = post.url;
  const title = `${post.title} | Blog de Bisontes DUX`;
  const description = post.excerpt;
  const image = postImage(post);
  const schema = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', '@id': `${canonical}#post`, url: canonical, mainEntityOfPage: canonical,
    headline: post.title, description, image, datePublished: post.date, ...(post.updated ? { dateModified: post.updated } : {}), inLanguage: 'es',
    author: { '@type': post.author ? 'Person' : 'SportsTeam', name: post.author || 'Bisontes DUX' },
    publisher: { '@id': TEAM_ID, '@type': 'SportsTeam', name: 'Bisontes DUX', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}assets/logo.png` } },
    isPartOf: { '@id': `${SITE_URL}blog/#blog` }
  };
  return `<!DOCTYPE html>
<html lang="es"><head>${head({ title, description, canonical, image, type: 'article', prefix: '../../' })}
  <script type="application/ld+json">${jsonLd(schema)}</script>
</head><body class="subpage-body">
  ${siteHeader({ current: 'blog/' })}
  <main class="blog-page">
    <nav class="breadcrumbs" aria-label="Migas de pan"><a href="${SITE_PATH}">Inicio</a><span>/</span><a href="${SITE_PATH}blog/">Blog</a><span>/</span><span aria-current="page">${escapeHtml(post.title)}</span></nav>
    <article class="blog-post">
      <h1 class="font-display">${escapeHtml(post.title)}</h1>
      <p class="blog-post__meta"><time datetime="${post.date}">${formatDate(post.date)}</time>${post.author ? ` · ${escapeHtml(post.author)}` : ' · Bisontes DUX'}</p>
      ${post.cover ? `<img class="blog-post__cover" src="${SITE_PATH}${escapeHtml(post.cover)}" alt="${escapeHtml(post.coverAlt || post.title)}" decoding="async" />` : ''}
      ${postBody(post.body)}
      <p class="blog-post__back"><a class="btn btn-ghost" href="${SITE_PATH}blog/">← Volver al blog</a></p>
    </article>
  </main>
  ${siteFooter()}
  <script src="../../js/site.js" defer></script>
</body></html>`;
}

function sponsorCard(sponsor, prefix) {
  const principal = sponsor.tier === 'principal';
  const logoSrc = sponsor.logo ? (sponsor.logo.startsWith('http') ? sponsor.logo : `${prefix}${sponsor.logo}`) : '';
  const inner = `<span class="sponsor-logo-wrap">${logoSrc ? `<img src="${escapeHtml(logoSrc)}" alt="Logo de ${escapeHtml(sponsor.name)}" class="sponsor-logo-img" loading="lazy" decoding="async" />` : `<span class="sponsor-placeholder">${escapeHtml(sponsor.name)}</span>`}</span>
      <span class="sponsor-name">${escapeHtml(sponsor.name)}</span>
      <span class="sponsor-tier-label${principal ? ' sponsor-tier-principal' : ''}">${principal ? 'Patrocinador principal' : 'Colaborador'}</span>
      ${sponsor.description ? `<span class="sponsor-desc">${escapeHtml(sponsor.description)}</span>` : ''}
      ${sponsor.url ? '<span class="sponsor-link">Visitar web</span>' : ''}`;
  const cls = `sponsor-card${principal ? ' sponsor-card--principal' : ''}`;
  return sponsor.url
    ? `<a class="${cls}" href="${escapeHtml(sponsor.url)}" target="_blank" rel="sponsored noopener" data-track="sponsor_click" data-sponsor="${escapeHtml(sponsor.name)}">${inner}</a>`
    : `<div class="${cls}">${inner}</div>`;
}

function sponsorPage() {
  const prefix = '../';
  const canonical = `${SITE_URL}patrocina-bisontes-dux/`;
  const title = 'Patrocina Bisontes DUX | Colabora con el club';
  const description = 'Descubre cómo colaborar con Bisontes DUX y formar parte del crecimiento de un club de fútbol de Madrid.';
  const principal = sponsors.find(sponsor => sponsor.tier === 'principal');
  const mail = 'mailto:bisontes.dux@gmail.com?subject=Quiero%20patrocinar%20Bisontes%20DUX';
  const schema = { '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name: title, description, inLanguage: 'es', about: { '@id': TEAM_ID, '@type': 'SportsTeam', name: 'Bisontes DUX', sport: 'Fútbol', url: SITE_URL } };
  return `<!DOCTYPE html><html lang="es"><head>${head({ title, description, canonical, image: `${SITE_URL}assets/logo.png`, prefix })}<script type="application/ld+json">${jsonLd(schema)}</script></head>
<body class="subpage-body">${siteHeader({ current: 'patrocina-bisontes-dux/' })}<main class="sponsor-page">
  <section class="sponsor-hero">
    <div class="sponsor-hero__copy">
      <h1 class="font-display">Pon tu marca en la camiseta de la manada</h1>
      <p>Bisontes DUX es un club de amigos de Madrid con proyecto social. Buscamos empresas y organizaciones que quieran crecer con nosotros. Cada colaboración la preparamos a medida, sin paquetes cerrados ni cifras inventadas.</p>
      <div class="sponsor-hero__actions">
        <a class="btn btn-primary" href="${mail}" data-track="sponsor_contact_click">Hablar con el club</a>
        <a class="btn btn-ghost" href="#apoyos">Ver quién nos apoya</a>
      </div>
    </div>
    <figure class="kit-map" aria-labelledby="kit-map-caption">
      <svg class="kit-map__shirt" viewBox="0 0 600 640" aria-hidden="true" focusable="false"><path class="kit-map__body" d="M210 20 C240 34 270 40 300 40 C330 40 360 34 390 20 L520 70 L600 220 L510 262 L478 214 L478 640 L122 640 L122 214 L90 262 L0 220 L80 70 Z"/><path class="kit-map__collar" d="M214 24 C242 37 270 44 300 44 C330 44 358 37 386 24"/><rect class="kit-map__zone kit-map__zone--taken" x="190" y="230" width="220" height="120" rx="6"/><rect class="kit-map__zone kit-map__zone--taken" x="466" y="124" width="64" height="52" rx="6" transform="rotate(30 498 150)"/><rect class="kit-map__zone" x="175" y="440" width="250" height="90" rx="6"/></svg>
      <ol class="kit-map__legend">
        <li class="is-taken"><strong>Pecho</strong><span>${escapeHtml(principal ? principal.name : 'Patrocinador principal')}</span></li>
        <li class="is-taken"><strong>Manga</strong><span>ISOS</span></li>
        <li><strong>Más espacios</strong><span>Camiseta, web y redes: pregúntanos</span></li>
      </ol>
      <figcaption id="kit-map-caption" class="visually-hidden">Esquema de la camiseta con las zonas de marca: el pecho lo lleva ${escapeHtml(principal ? principal.name : 'el patrocinador principal')}, la manga ISOS, y el resto de espacios se acuerdan con el club.</figcaption>
    </figure>
  </section>

  <section class="sponsor-why" aria-labelledby="por-que">
    <h2 id="por-que" class="font-display">Por qué la manada</h2>
    <ul class="sponsor-why__list">
      <li><h3>Un club de verdad</h3><p>Escudo, equipación y plantilla con fichas oficiales. Nacimos en 2025 y jugamos la liga municipal de Orcasur.</p></li>
      <li><h3>Un proyecto social</h3><p>En el pecho llevamos a Todos Juegan, que busca equipos para jóvenes en riesgo de exclusión. Apoyarnos también es apoyar eso.</p></li>
      <li><h3>Un grupo de amigos</h3><p>Detrás no hay una institución: hay un vestuario de amigos de Madrid que lo cuenta todo en Instagram y en esta web.</p></li>
    </ul>
  </section>

  <section class="sponsor-opportunities" aria-labelledby="colaborar">
    <h2 id="colaborar" class="font-display">Formas de colaborar</h2>
    <div class="opportunity-grid">
      <article><h3>Patrocinio</h3><p>Tu marca en la camiseta o en el material del club, con presencia en la web y en Instagram.</p></article>
      <article><h3>Colaboración</h3><p>Servicios, producto o apoyo a una iniciativa concreta: un torneo, un evento o el material de la temporada.</p></article>
      <article><h3>A tu medida</h3><p>Cuéntanos qué buscas y preparamos una propuesta juntos, con lo que de verdad podemos ofrecer.</p></article>
    </div>
  </section>

  <section class="current-sponsors" id="apoyos" aria-labelledby="apoyos-titulo">
    <h2 id="apoyos-titulo" class="font-display">Quienes ya nos apoyan</h2>
    <div id="sponsors-grid">${sponsors.map(sponsor => sponsorCard(sponsor, prefix)).join('')}</div>
  </section>

  <section class="sponsor-contact" aria-labelledby="hablamos">
    <h2 id="hablamos" class="font-display">¿Hablamos?</h2>
    <p>Escríbenos y cuéntanos qué tipo de colaboración te interesa. Te respondemos nosotros, los del club.</p>
    <div class="sponsor-contact__actions">
      <a class="btn btn-dark" href="${mail}" data-track="sponsor_contact_click">bisontes.dux@gmail.com</a>
      <a class="btn btn-outline" href="https://www.instagram.com/bisontes.dux" target="_blank" rel="noopener">Instagram @bisontes.dux</a>
    </div>
  </section>
</main>${siteFooter()}<script src="${prefix}js/site.js" defer></script></body></html>`;
}

function write(file, content) {
  const target = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${content.trim()}\n`);
}

/* Borra las fichas de personas que ya no están en la plantilla. */
const rosterSlugs = new Set(roster.map(player => player.slug));
for (const entry of fs.readdirSync(path.join(ROOT, 'jugadores'), { withFileTypes: true })) {
  if (entry.isDirectory() && !rosterSlugs.has(entry.name)) fs.rmSync(path.join(ROOT, 'jugadores', entry.name), { recursive: true });
}
for (const player of roster) write(`jugadores/${player.slug}/index.html`, playerPage(player));
write('plantilla/index.html', redirectPage('Plantilla de Bisontes DUX'));
write('jugadores/index.html', redirectPage('Jugadores de Bisontes DUX'));
write('patrocina-bisontes-dux/index.html', sponsorPage());
write('blog/index.html', blogIndexPage());
const postDirs = new Set(posts.map(post => post.slug));
if (fs.existsSync(path.join(ROOT, 'blog'))) {
  for (const entry of fs.readdirSync(path.join(ROOT, 'blog'), { withFileTypes: true })) {
    if (entry.isDirectory() && !postDirs.has(entry.name)) fs.rmSync(path.join(ROOT, 'blog', entry.name), { recursive: true });
  }
}
for (const post of posts) write(`blog/${post.slug}/index.html`, blogPostPage(post));

/* Header y footer comunes en las páginas escritas a mano. */
const headerPattern = /<!-- GENERATED-HEADER:START -->[\s\S]*?<!-- GENERATED-HEADER:END -->/;
const footerPattern = /<!-- GENERATED-FOOTER:START -->[\s\S]*?<!-- GENERATED-FOOTER:END -->/;
for (const file of ['aviso-legal.html', 'privacidad.html', '404.html']) {
  const target = path.join(ROOT, file);
  let html = fs.readFileSync(target, 'utf8');
  if (!headerPattern.test(html) || !footerPattern.test(html)) throw new Error(`Faltan los marcadores GENERATED-HEADER/FOOTER en ${file}`);
  html = html.replace(headerPattern, siteHeader()).replace(footerPattern, siteFooter());
  fs.writeFileSync(target, html);
}

/* Hero: espalda de camiseta + tira de dorsales con los jugadores que tienen foto. */
function heroBlock() {
  const withPhoto = roster.filter(player => player.hasPortrait && !player.coach);
  const lead = withPhoto.find(player => String(player.dorsal) === '10') || withPhoto[0];
  if (!lead) return '';
  const dorsals = withPhoto.map(player => `<button type="button" class="dorsal-strip__btn" aria-pressed="${player === lead}" data-name="${escapeHtml(player.name)}" data-shirt="${escapeHtml(player.shirtName)}" data-num="${escapeHtml(player.dorsal)}" data-pos="${escapeHtml(player.position)}" data-photo="${SITE_PATH}${player.photo}" data-url="${SITE_PATH}jugadores/${player.slug}/" aria-label="${escapeHtml(player.name)}, dorsal ${escapeHtml(player.dorsal)}">${escapeHtml(player.dorsal)}</button>`).join('\n      ');
  return `<!-- GENERATED-HERO:START -->
  <div class="kit-hero__shirt" data-shirt>
    <svg class="kit-hero__garment" viewBox="0 0 600 640" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false"><path class="kit-hero__garment-body" d="M210 20 C240 34 270 40 300 40 C330 40 360 34 390 20 L520 70 L600 220 L510 262 L478 214 L478 640 L122 640 L122 214 L90 262 L0 220 L80 70 Z"/><path class="kit-hero__garment-collar" d="M214 24 C242 37 270 44 300 44 C330 44 358 37 386 24"/></svg>
    <p class="kit-hero__back" aria-hidden="true"><span class="kit-hero__name" data-shirt-name>${escapeHtml(lead.shirtName)}</span></p>
    <img src="${SITE_PATH}${lead.photo}" alt="${escapeHtml(lead.name)}, ${escapeHtml(lead.position)} de Bisontes DUX" class="kit-hero__player" width="720" height="900" fetchpriority="high" data-shirt-photo />
    <a class="kit-hero__caption" href="${SITE_PATH}jugadores/${lead.slug}/" data-shirt-link><strong data-shirt-fullname>${escapeHtml(lead.name)}</strong><span data-shirt-pos>${escapeHtml(lead.position)}</span><span class="kit-hero__caption-more">Ver ficha</span></a>
  </div>
  <div class="dorsal-strip" role="group" aria-label="Elige un dorsal para ver al jugador">
    <span class="dorsal-strip__label">Elige dorsal</span>
    <div class="dorsal-strip__nums">
      ${dorsals}
    </div>
  </div>
<!-- GENERATED-HERO:END -->`;
}

const indexPath = path.join(ROOT, 'index.html');
let index = fs.readFileSync(indexPath, 'utf8');
const generatedRoster = `<!-- GENERATED-ROSTER:START -->\n${roster.map(player => rosterCard(player)).join('\n')}\n<!-- GENERATED-ROSTER:END -->`;
const markerPattern = /<!-- GENERATED-ROSTER:START -->[\s\S]*?<!-- GENERATED-ROSTER:END -->/;
if (!markerPattern.test(index)) throw new Error('No se encontraron los marcadores GENERATED-ROSTER en index.html');
index = index.replace(markerPattern, generatedRoster);
const heroPattern = /<!-- GENERATED-HERO:START -->[\s\S]*?<!-- GENERATED-HERO:END -->/;
if (!heroPattern.test(index)) throw new Error('No se encontraron los marcadores GENERATED-HERO en index.html');
index = index.replace(heroPattern, heroBlock());
if (!headerPattern.test(index) || !footerPattern.test(index)) throw new Error('Faltan los marcadores GENERATED-HEADER/FOOTER en index.html');
index = index.replace(headerPattern, siteHeader({ home: true })).replace(footerPattern, siteFooter());
const teamSchema = {
  '@context': 'https://schema.org', '@type': 'SportsTeam', '@id': TEAM_ID,
  name: 'Bisontes DUX', alternateName: 'Bisontes DUX FC', url: SITE_URL,
  logo: `${SITE_URL}assets/logo.png`, image: `${SITE_URL}assets/logo.png`,
  description: 'Club de fútbol con sede en Madrid, fundado en 2025. Diversión, equipo y respeto.',
  sport: 'Fútbol', foundingDate: '2025', email: 'bisontes.dux@gmail.com',
  sameAs: ['https://www.instagram.com/bisontes.dux', 'https://github.com/urpito/BisontesDUX'],
  address: { '@type': 'PostalAddress', addressLocality: 'Madrid', addressCountry: 'ES' },
  member: roster.map(player => ({
    '@type': 'Person', '@id': `${player.pageUrl}#person`, name: player.name, url: player.pageUrl,
    jobTitle: player.coach ? player.position : 'Futbolista'
  }))
};
const generatedTeamSchema = `<!-- GENERATED-TEAM-SCHEMA:START -->\n  <script type="application/ld+json">${jsonLd(teamSchema)}</script>\n  <!-- GENERATED-TEAM-SCHEMA:END -->`;
const teamMarkerPattern = /<!-- GENERATED-TEAM-SCHEMA:START -->[\s\S]*?<!-- GENERATED-TEAM-SCHEMA:END -->/;
if (!teamMarkerPattern.test(index)) throw new Error('No se encontraron los marcadores GENERATED-TEAM-SCHEMA en index.html');
index = index.replace(teamMarkerPattern, generatedTeamSchema);
fs.writeFileSync(indexPath, index);

const sitemapUrls = [SITE_URL, `${SITE_URL}patrocina-bisontes-dux/`, `${SITE_URL}blog/`, ...posts.map(post => post.url), ...roster.map(player => player.pageUrl)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map((url, index) => `  <url>\n    <loc>${url}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>${index === 0 ? 'weekly' : 'monthly'}</changefreq>\n    <priority>${index === 0 ? '1.0' : index < 3 + posts.length ? '0.8' : '0.6'}</priority>\n  </url>`).join('\n')}
</urlset>`);

const footballers = roster.filter(player => !player.coach);
const staff = roster.filter(player => player.coach);
write('llms.txt', `# Bisontes DUX

> Bisontes DUX es un club de fútbol con sede en Madrid, España. Este archivo enlaza a la información oficial publicada por el club.

Bisontes DUX fue fundado en 2025. Los perfiles enlazados a continuación identifican a los integrantes de la plantilla actual a partir de la fuente de datos pública del sitio.

## Páginas principales

- [Web oficial de Bisontes DUX](${SITE_URL}): información general del club, sobre nosotros y plantilla con jugadores y cuerpo técnico.
- [Blog de Bisontes DUX](${SITE_URL}blog/): noticias y novedades del club.
- [Patrocina Bisontes DUX](${SITE_URL}patrocina-bisontes-dux/): información para posibles colaboradores.
- [Datos públicos de jugadores](${SITE_URL}players.json): versión JSON generada desde la plantilla.

## Perfiles oficiales de jugadores

${footballers.map(player => `- [${player.name}](${player.pageUrl}): ${player.position}, dorsal ${player.dorsal}.`).join('\n')}

## Cuerpo técnico

${staff.map(player => `- [${player.name}](${player.pageUrl}): ${player.position}.`).join('\n')}`);

write('players.json', JSON.stringify({
  team: { name: 'Bisontes DUX', url: SITE_URL, sport: 'Fútbol', location: 'Madrid, España' },
  players: footballers.map(player => ({
    name: player.name, url: player.pageUrl, position: player.position, dorsal: player.dorsal,
    ...(player.hasPortrait ? { image: player.imageUrl } : {}),
    ...(player.nationalities.length ? { nationalities: player.nationalities } : {}),
    ...(player.trajectory.length ? { trajectory: player.trajectory } : {}),
    ...(player.socials ? { socials: player.socials } : {})
  })),
  staff: staff.map(player => ({ name: player.name, url: player.pageUrl, role: player.position }))
}, null, 2));

console.log(`Generadas ${roster.length} fichas, ${posts.length} entradas de blog, datos públicos y sitemap (${sitemapUrls.length} URLs).`);
