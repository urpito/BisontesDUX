import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://urpito.github.io/BisontesDUX/';
const SITE_PATH = '/BisontesDUX/';
const LIVE = process.argv.includes('--live');
const errors = [];
const warnings = [];

function fullName(name) {
  const parts = String(name).split(',').map(part => part.trim());
  return parts.length > 1 ? `${parts.slice(1).join(' ')} ${parts[0]}` : parts[0];
}

function slugify(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isCoach(player) {
  return String(player.dorsal).toUpperCase() === 'COACH';
}

function extract(html, pattern) {
  return html.match(pattern)?.[1]?.trim();
}

function getSchemas(html, label) {
  const schemas = [];
  for (const match of html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try { schemas.push(JSON.parse(match[1])); }
    catch (error) { errors.push(`${label}: JSON-LD inválido (${error.message})`); }
  }
  return schemas.flatMap(schema => schema['@graph'] || [schema]);
}

function checkPlayerHtml(player, html, label) {
  const name = fullName(player.name);
  const slug = player.slug || slugify(name);
  const url = `${SITE_URL}jugadores/${slug}/`;
  const htmlWithoutScripts = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const title = extract(html, /<title>([^<]+)<\/title>/i);
  const description = extract(html, /<meta\s+name="description"\s+content="([^"]+)"/i);
  const canonical = extract(html, /<link\s+rel="canonical"\s+href="([^"]+)"/i);
  const robots = extract(html, /<meta\s+name="robots"\s+content="([^"]+)"/i) || '';
  const ogUrl = extract(html, /<meta\s+property="og:url"\s+content="([^"]+)"/i);

  if (!new RegExp(`<h1\\b[^>]*>${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/h1>`, 'i').test(htmlWithoutScripts)) errors.push(`${label}: H1 inicial no contiene exactamente ${name}`);
  if (!htmlWithoutScripts.includes(name) || !htmlWithoutScripts.includes('Bisontes DUX')) errors.push(`${label}: nombre y club no coexisten en el HTML inicial`);
  if (!htmlWithoutScripts.includes(`${name} es futbolista y jugador de Bisontes DUX`) && !isCoach(player)) errors.push(`${label}: falta relación textual persona → jugador → Bisontes DUX`);
  if (!title?.startsWith(`${name} - `) || !title.includes('Bisontes DUX') || !title.includes('Perfil oficial')) errors.push(`${label}: title poco inequívoco o incorrecto`);
  if (!description?.includes(name) || !description.includes('Bisontes DUX')) errors.push(`${label}: meta description no relaciona nombre y club`);
  if (canonical !== url) errors.push(`${label}: canonical ${canonical || 'ausente'}; esperado ${url}`);
  if (/noindex/i.test(robots)) errors.push(`${label}: contiene noindex`);
  if (ogUrl !== url) errors.push(`${label}: og:url incorrecto`);
  for (const property of ['og:type', 'og:title', 'og:description', 'og:image']) {
    if (!new RegExp(`<meta\\s+property="${property}"\\s+content="[^"]+"`, 'i').test(html)) errors.push(`${label}: falta ${property}`);
  }

  const schemas = getSchemas(html, label);
  const profile = schemas.find(item => item['@type'] === 'ProfilePage');
  const person = schemas.find(item => item['@type'] === 'Person' && item.name === name);
  if (!profile) errors.push(`${label}: falta ProfilePage en JSON-LD`);
  if (!person) errors.push(`${label}: falta Person con el nombre correcto en JSON-LD`);
  if (!isCoach(player) && person?.jobTitle !== 'Futbolista') errors.push(`${label}: Person.jobTitle no identifica al futbolista`);
  if (person?.memberOf?.name !== 'Bisontes DUX' || person?.memberOf?.['@type'] !== 'SportsTeam') errors.push(`${label}: Person.memberOf no identifica a Bisontes DUX como SportsTeam`);

  return { name, slug, url, title, description };
}

const context = {};
const source = fs.readFileSync(path.join(ROOT, 'data/players.js'), 'utf8');
vm.runInNewContext(`${source}\nthis.__players = players;`, context, { filename: 'data/players.js' });
const players = JSON.parse(JSON.stringify(context.__players));
const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const llms = fs.readFileSync(path.join(ROOT, 'llms.txt'), 'utf8');
const publicData = JSON.parse(fs.readFileSync(path.join(ROOT, 'players.json'), 'utf8'));
const localResults = [];

for (const player of players) {
  const name = fullName(player.name);
  const slug = player.slug || slugify(name);
  const relative = `jugadores/${slug}/index.html`;
  const file = path.join(ROOT, relative);
  if (!fs.existsSync(file)) {
    errors.push(`${name}: no existe ${relative}`);
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  const result = checkPlayerHtml(player, html, relative);
  const expectedHref = `href="${SITE_PATH}jugadores/${slug}/"`;
  if (!home.includes(expectedHref)) errors.push(`${name}: falta enlace HTML absoluto desde la plantilla del index`);
  if (!sitemap.includes(`<loc>${result.url}</loc>`)) errors.push(`${name}: falta en sitemap.xml`);
  if (!llms.includes(`](${result.url})`)) errors.push(`${name}: falta en llms.txt`);
  localResults.push(result);
}

const descriptions = localResults.map(result => result.description);
if (new Set(descriptions).size !== descriptions.length) errors.push('Las meta descriptions de jugadores no son únicas');

const footballerCount = players.filter(player => !isCoach(player)).length;
const staffCount = players.filter(isCoach).length;
if (publicData.team?.name !== 'Bisontes DUX') errors.push('players.json: equipo incorrecto');
if (publicData.players?.length !== footballerCount) errors.push(`players.json: ${publicData.players?.length || 0} jugadores; esperados ${footballerCount}`);
if (publicData.staff?.length !== staffCount) errors.push(`players.json: ${publicData.staff?.length || 0} técnicos; esperados ${staffCount}`);

if (LIVE) {
  const liveHashes = new Set();
  for (const player of players) {
    const name = fullName(player.name);
    const slug = player.slug || slugify(name);
    const url = `${SITE_URL}jugadores/${slug}/`;
    let response;
    try {
      response = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'BisontesDUX-SEO-Audit/1.0' } });
    } catch (error) {
      errors.push(`${url}: error de red (${error.message})`);
      continue;
    }
    if (response.status !== 200) errors.push(`${url}: HTTP ${response.status}, esperado 200`);
    if (response.status >= 300 && response.status < 400) errors.push(`${url}: redirección inesperada a ${response.headers.get('location')}`);
    const html = await response.text();
    liveHashes.add(crypto.createHash('sha256').update(html).digest('hex'));
    checkPlayerHtml(player, html, `PUBLIC ${url}`);
  }
  if (liveHashes.size !== players.length) errors.push(`Web pública: solo ${liveHashes.size} HTML distintos para ${players.length} fichas`);

  for (const resource of ['blog/', 'sitemap.xml', 'robots.txt', 'llms.txt', 'players.json']) {
    const url = `${SITE_URL}${resource}`;
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status !== 200) errors.push(`${url}: HTTP ${response.status}, esperado 200`);
    } catch (error) { errors.push(`${url}: error de red (${error.message})`); }
  }

  try {
    const originRobots = await fetch('https://urpito.github.io/robots.txt', { redirect: 'manual' });
    if (originRobots.status !== 200) warnings.push(`La raíz del host /robots.txt devuelve HTTP ${originRobots.status}; el robots del subdirectorio no se descubre automáticamente.`);
  } catch (error) { warnings.push(`No se pudo comprobar robots.txt del origen: ${error.message}`); }
}

if (warnings.length) console.warn(`Avisos:\n- ${warnings.join('\n- ')}`);
if (errors.length) {
  console.error(`Fallaron ${errors.length} comprobaciones SEO:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log(`SEO de jugadores validado: ${players.length} fichas estáticas, enlaces, metadata, canonical, JSON-LD, sitemap, llms.txt y players.json${LIVE ? ' en la web pública' : ''}.`);
