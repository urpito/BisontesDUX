import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://urpito.github.io/BisontesDUX/';
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
  'SEGUNDO ENTRENADOR': 'segundo entrenador'
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

function positionName(position) {
  return positionNames[String(position).toUpperCase()] || String(position).toLowerCase();
}

function isCoach(player) {
  return String(player.dorsal).toUpperCase() === 'COACH';
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
  const imageUrl = new URL(originalPhoto || 'assets/logo.png', SITE_URL).href;
  const statement = coach
    ? `${name} forma parte del cuerpo técnico de Bisontes DUX como ${position}.`
    : `${name} es jugador de Bisontes DUX. Juega como ${position} y utiliza el dorsal ${player.dorsal}.`;
  const title = coach ? `${name} | Cuerpo técnico de Bisontes DUX` : `${name} | Jugador de Bisontes DUX`;
  const description = coach
    ? `Perfil oficial de ${name}, ${position} de Bisontes DUX. Consulta su función y trayectoria en el club.`
    : `Perfil oficial de ${name}, jugador de Bisontes DUX. Consulta su posición, dorsal, estadísticas y trayectoria en el club.`;
  return { ...player, name, coach, position, slug, pageUrl, photo, imageUrl, hasPortrait, statement, title, description };
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
  <meta name="theme-color" content="#222222" />
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
  <link href="https://fonts.googleapis.com/css2?family=Anton&amp;family=Bebas+Neue&amp;family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${prefix}css/style.css" />
  <link rel="icon" type="image/png" href="${prefix}favicon.png" />`;
}

function header(prefix) {
  return `<header class="legal-top subpage-top">
    <a href="${prefix}" class="legal-brand">
      <img src="${prefix}assets/logo.png" width="42" height="42" alt="Escudo de Bisontes DUX" />
      <span>Bisontes <strong>DUX</strong></span>
    </a>
    <nav class="subpage-nav" aria-label="Navegación principal">
      <a href="${prefix}plantilla/">Plantilla</a>
      <a href="${prefix}patrocina-bisontes-dux/">Patrocina</a>
      <a href="${prefix}#join">Quiero jugar</a>
    </nav>
  </header>`;
}

function footer(prefix) {
  return `<footer class="footer-min">
    <p>© 2026 Bisontes DUX — Todos los derechos reservados</p>
    <p class="footer-min-links">
      <a href="${prefix}plantilla/">Plantilla</a> ·
      <a href="${prefix}patrocina-bisontes-dux/">Patrocina Bisontes DUX</a> ·
      <a href="${prefix}aviso-legal.html">Aviso legal</a> ·
      <a href="${prefix}privacidad.html">Privacidad</a>
    </p>
  </footer>`;
}

function silhouette() {
  return `<svg viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="50" cy="32" r="22" fill="currentColor"/><path d="M12 140 Q12 78 50 78 Q88 78 88 140Z" fill="currentColor"/>
  </svg>`;
}

function rosterCard(player, prefix = '') {
  const image = player.hasPortrait
    ? `<img src="${prefix}${player.photo}" alt="Retrato de ${escapeHtml(player.name)}, ${escapeHtml(player.position)} de Bisontes DUX" class="player-card__photo" width="720" height="900" loading="lazy" decoding="async" />`
    : `<div class="player-card__silhouette player-card__silhouette--visible" aria-hidden="true">${silhouette()}</div>`;
  const dorsalClass = player.coach ? 'player-card__dorsal player-card__dorsal--text' : 'player-card__dorsal';
  return `<a class="player-card reveal" href="${prefix}jugadores/${player.slug}/" data-track="player_card_click" data-player="${escapeHtml(player.name)}">
    <div class="player-card__img-wrap">
      ${image}
      <span class="${dorsalClass}" aria-hidden="true">${escapeHtml(player.dorsal)}</span>
    </div>
    <div class="player-card__info">
      <span class="player-card__pos">${escapeHtml(player.position)}</span>
      <h3 class="player-card__name">${escapeHtml(player.name)}</h3>
      <span class="player-card__profile-link">Ver ficha oficial →</span>
    </div>
  </a>`;
}

function playerPage(player) {
  const prefix = '../../';
  const personId = `${player.pageUrl}#person`;
  const facts = [
    ['Equipo', `<a href="${prefix}">Bisontes DUX</a>`],
    ['Función', escapeHtml(player.position)],
    ...(!player.coach ? [['Dorsal', escapeHtml(player.dorsal)]] : []),
    ...(player.age ? [['Edad', escapeHtml(player.age)]] : []),
    ...(player.nationality ? [['Nacionalidad', escapeHtml(player.nationality)]] : [])
  ];
  const stats = player.stats && Object.keys(player.stats).length
    ? `<section class="profile-section" aria-labelledby="estadisticas"><h2 id="estadisticas">Estadísticas</h2><dl class="profile-stats">${Object.entries(player.stats).map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl></section>`
    : '';
  const socials = player.socials && Object.keys(player.socials).length
    ? `<section class="profile-section" aria-labelledby="redes"><h2 id="redes">Redes sociales</h2><div class="profile-socials">${Object.entries(player.socials).map(([network, url]) => `<a href="${escapeHtml(url)}" target="_blank" rel="me noopener" data-track="player_social_click" data-player="${escapeHtml(player.name)}" data-platform="${escapeHtml(network)}">${socialNames[network.toLowerCase()] || escapeHtml(network)}</a>`).join('')}</div></section>`
    : '';
  const imageMarkup = player.hasPortrait
    ? `<img src="${prefix}${player.photo}" width="720" height="900" alt="Retrato oficial de ${escapeHtml(player.name)}, ${escapeHtml(player.position)} de Bisontes DUX" decoding="async" fetchpriority="high" />`
    : `<div class="profile-silhouette" role="img" aria-label="Bisontes DUX: imagen genérica para ${escapeHtml(player.name)}">${silhouette()}</div>`;
  const shareText = encodeURIComponent(`${player.name} | Bisontes DUX`);
  const shareUrl = encodeURIComponent(player.pageUrl);
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
        jobTitle: player.coach ? player.position : 'Futbolista',
        description: player.bio || player.statement,
        ...(player.hasPortrait ? { image: player.imageUrl } : {}),
        memberOf: { '@id': TEAM_ID, '@type': 'SportsTeam', name: 'Bisontes DUX', sport: 'Fútbol', url: SITE_URL },
        ...(player.socials ? { sameAs: Object.values(player.socials) } : {})
      },
      {
        '@type': 'BreadcrumbList', '@id': `${player.pageUrl}#breadcrumb`, itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Plantilla', item: `${SITE_URL}plantilla/` },
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
  ${header(prefix)}
  <main class="profile-page">
    <nav class="breadcrumbs" aria-label="Migas de pan"><a href="${prefix}">Inicio</a><span>/</span><a href="${prefix}plantilla/">Plantilla</a><span>/</span><span aria-current="page">${escapeHtml(player.name)}</span></nav>
    <article class="profile-card">
      <div class="profile-photo">${imageMarkup}<span class="profile-dorsal" aria-hidden="true">${escapeHtml(player.dorsal)}</span></div>
      <div class="profile-content">
        <p class="eyebrow">${player.coach ? 'Cuerpo técnico' : `Dorsal ${escapeHtml(player.dorsal)}`} · Bisontes DUX</p>
        <h1 class="font-display">${escapeHtml(player.name)}</h1>
        <p class="profile-statement">${escapeHtml(player.statement)}</p>
        ${player.bio ? `<p class="profile-bio">${escapeHtml(player.bio)}</p>` : ''}
        <dl class="profile-facts">${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>
        ${stats}${socials}
        <section class="profile-section share-section" aria-labelledby="compartir">
          <h2 id="compartir">Compartir ficha</h2>
          <div class="share-buttons">
            <a href="https://wa.me/?text=${shareText}%20${shareUrl}" target="_blank" rel="noopener" data-track="player_share" data-player="${escapeHtml(player.name)}" data-platform="whatsapp">WhatsApp</a>
            <a href="https://twitter.com/intent/tweet?text=${shareText}&amp;url=${shareUrl}" target="_blank" rel="noopener" data-track="player_share" data-player="${escapeHtml(player.name)}" data-platform="x">X</a>
            <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener" data-track="player_share" data-player="${escapeHtml(player.name)}" data-platform="facebook">Facebook</a>
            <button type="button" data-native-share data-share-title="${escapeHtml(player.title)}" data-share-url="${player.pageUrl}" data-track="player_share" data-player="${escapeHtml(player.name)}" data-platform="native">Compartir en otras apps</button>
          </div>
          <p class="share-help">En móvil, «otras apps» permite compartir también mediante Instagram o TikTok si están instaladas.</p>
        </section>
        <a class="btn btn-ghost profile-back" href="${prefix}plantilla/">← Volver a la plantilla</a>
      </div>
    </article>
  </main>
  ${footer(prefix)}
  <script src="${prefix}js/site.js" defer></script>
</body>
</html>`;
}

function rosterPage() {
  const canonical = `${SITE_URL}plantilla/`;
  const title = 'Plantilla de Bisontes DUX | Jugadores y cuerpo técnico';
  const description = 'Consulta la plantilla oficial de Bisontes DUX: jugadores, dorsales, posiciones y cuerpo técnico del club de fútbol de Madrid.';
  const schema = {
    '@context': 'https://schema.org', '@graph': [
      { '@type': 'CollectionPage', '@id': `${canonical}#webpage`, url: canonical, name: title, description, inLanguage: 'es', isPartOf: { '@id': `${SITE_URL}#website` }, mainEntity: { '@id': `${canonical}#roster` } },
      { '@type': 'ItemList', '@id': `${canonical}#roster`, name: 'Plantilla de Bisontes DUX', numberOfItems: roster.length, itemListElement: roster.map((player, index) => ({ '@type': 'ListItem', position: index + 1, url: player.pageUrl, item: { '@type': 'Person', '@id': `${player.pageUrl}#person`, name: player.name, jobTitle: player.coach ? player.position : 'Futbolista', memberOf: { '@id': TEAM_ID } } })) },
      { '@type': 'SportsTeam', '@id': TEAM_ID, name: 'Bisontes DUX', sport: 'Fútbol', url: SITE_URL }
    ]
  };
  return `<!DOCTYPE html>
<html lang="es"><head>${head({ title, description, canonical, image: `${SITE_URL}assets/logo.png`, prefix: '../' })}
  <script type="application/ld+json">${jsonLd(schema)}</script>
</head><body class="subpage-body">
  ${header('../')}
  <main class="roster-page">
    <div class="subpage-hero"><p class="eyebrow">Bisontes DUX · Madrid</p><h1 class="font-display">La Plantilla</h1><p>Esta es la plantilla oficial de Bisontes DUX. Consulta la ficha individual de cada jugador y miembro del cuerpo técnico para conocer su dorsal y posición.</p></div>
    <section aria-labelledby="jugadores"><h2 id="jugadores" class="visually-hidden">Jugadores y cuerpo técnico de Bisontes DUX</h2><div id="players-grid">${roster.map(player => rosterCard(player, '../')).join('\n')}</div></section>
  </main>
  ${footer('../')}
  <script src="../js/site.js" defer></script>
</body></html>`;
}

function sponsorPage() {
  const prefix = '../';
  const canonical = `${SITE_URL}patrocina-bisontes-dux/`;
  const title = 'Patrocina Bisontes DUX | Colabora con el club';
  const description = 'Descubre cómo colaborar con Bisontes DUX y formar parte del crecimiento de un club de fútbol de Madrid.';
  const sponsorCards = sponsors.map(sponsor => {
    const content = `${sponsor.logo ? `<div class="sponsor-logo-wrap"><img src="${escapeHtml(sponsor.logo.startsWith('http') ? sponsor.logo : `${prefix}${sponsor.logo}`)}" alt="Logo de ${escapeHtml(sponsor.name)}" class="sponsor-logo-img" loading="lazy" decoding="async" /></div>` : ''}<h2 class="sponsor-name">${escapeHtml(sponsor.name)}</h2>${sponsor.description ? `<p class="sponsor-desc">${escapeHtml(sponsor.description)}</p>` : ''}`;
    return `<article class="sponsor-card static-card">${sponsor.url ? `<a href="${escapeHtml(sponsor.url)}" target="_blank" rel="sponsored noopener" data-track="sponsor_click" data-sponsor="${escapeHtml(sponsor.name)}">${content}</a>` : content}</article>`;
  }).join('');
  const schema = { '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name: title, description, inLanguage: 'es', about: { '@id': TEAM_ID, '@type': 'SportsTeam', name: 'Bisontes DUX', sport: 'Fútbol', url: SITE_URL } };
  return `<!DOCTYPE html><html lang="es"><head>${head({ title, description, canonical, image: `${SITE_URL}assets/logo.png`, prefix })}<script type="application/ld+json">${jsonLd(schema)}</script></head>
<body class="subpage-body">${header(prefix)}<main class="sponsor-page">
  <div class="subpage-hero"><p class="eyebrow">Crece con la manada</p><h1 class="font-display">Patrocina Bisontes DUX</h1><p>Buscamos empresas y organizaciones que quieran apoyar el proyecto deportivo y la comunidad de Bisontes DUX. Prepararemos propuestas de colaboración adaptadas a cada entidad, sin compromisos ni cifras prefabricadas.</p><a class="btn btn-primary" href="mailto:bisontes.dux@gmail.com?subject=Quiero%20patrocinar%20Bisontes%20DUX" data-track="sponsor_contact_click">Hablar con el club</a></div>
  <section class="sponsor-opportunities" aria-labelledby="colaborar"><h2 id="colaborar" class="font-display">Formas de colaborar</h2><div class="opportunity-grid"><article><h3>Patrocinio oficial</h3><p>Presencia de marca y activaciones acordadas con el club.</p></article><article><h3>Colaboraciones</h3><p>Acciones conjuntas, servicios o apoyo a iniciativas concretas.</p></article><article><h3>Media kit</h3><p>Solicita el futuro dossier comercial y una propuesta a medida.</p></article></div></section>
  <section class="current-sponsors" aria-labelledby="apoyos"><p class="eyebrow">Quienes ya nos apoyan</p><h2 id="apoyos" class="font-display">Patrocinadores y colaboradores</h2><div id="sponsors-grid">${sponsorCards}</div></section>
  <section class="sponsor-contact"><h2 class="font-display">¿Hablamos?</h2><p>Cuéntanos qué tipo de colaboración te interesa.</p><a href="mailto:bisontes.dux@gmail.com?subject=Colaboración%20con%20Bisontes%20DUX" data-track="sponsor_contact_click">bisontes.dux@gmail.com</a></section>
</main>${footer(prefix)}<script src="${prefix}js/site.js" defer></script></body></html>`;
}

function write(file, content) {
  const target = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${content.trim()}\n`);
}

for (const player of roster) write(`jugadores/${player.slug}/index.html`, playerPage(player));
write('plantilla/index.html', rosterPage());
write('patrocina-bisontes-dux/index.html', sponsorPage());

const indexPath = path.join(ROOT, 'index.html');
let index = fs.readFileSync(indexPath, 'utf8');
const generatedRoster = `<!-- GENERATED-ROSTER:START -->\n${roster.map(player => rosterCard(player)).join('\n')}\n<!-- GENERATED-ROSTER:END -->`;
const markerPattern = /<!-- GENERATED-ROSTER:START -->[\s\S]*?<!-- GENERATED-ROSTER:END -->/;
if (!markerPattern.test(index)) throw new Error('No se encontraron los marcadores GENERATED-ROSTER en index.html');
index = index.replace(markerPattern, generatedRoster);
fs.writeFileSync(indexPath, index);

const sitemapUrls = [SITE_URL, `${SITE_URL}plantilla/`, `${SITE_URL}patrocina-bisontes-dux/`, ...roster.map(player => player.pageUrl)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map((url, index) => `  <url>\n    <loc>${url}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>${index === 0 ? 'weekly' : 'monthly'}</changefreq>\n    <priority>${index === 0 ? '1.0' : index < 3 ? '0.8' : '0.6'}</priority>\n  </url>`).join('\n')}
</urlset>`);

console.log(`Generadas ${roster.length} fichas, plantilla, patrocinio y sitemap (${sitemapUrls.length} URLs).`);
