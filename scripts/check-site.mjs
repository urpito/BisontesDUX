import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://urpito.github.io/BisontesDUX/';
const errors = [];
const warnings = [];

const context = {};
const playerSource = fs.readFileSync(path.join(ROOT, 'data/players.js'), 'utf8');
vm.runInNewContext(`${playerSource}\nthis.__players = players;`, context);
const expectedPlayers = context.__players.length;

const htmlFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.impeccable', '.claude'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html') && !/^google[a-z0-9]+\.html$/i.test(entry.name)) htmlFiles.push(full);
  }
}
walk(ROOT);

const titles = new Map();
for (const file of htmlFiles) {
  const relative = path.relative(ROOT, file);
  const html = fs.readFileSync(file, 'utf8');
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1];
  const noindex = /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1];
  const h1Count = (html.match(/<h1\b/gi) || []).length;

  if (!title) errors.push(`${relative}: falta title`);
  if (!description) errors.push(`${relative}: falta meta description`);
  if (!noindex && !canonical) errors.push(`${relative}: falta canonical`);
  if (!noindex && !/<meta\s+property="og:title"/i.test(html)) errors.push(`${relative}: falta og:title`);
  if (!noindex && !/<meta\s+property="og:description"/i.test(html)) errors.push(`${relative}: falta og:description`);
  if (!noindex && !/<meta\s+property="og:image"/i.test(html)) errors.push(`${relative}: falta og:image`);
  if (!noindex && !/<meta\s+property="og:url"/i.test(html)) errors.push(`${relative}: falta og:url`);
  if (h1Count !== 1) errors.push(`${relative}: debe tener un H1 (tiene ${h1Count})`);
  if (title) {
    const list = titles.get(title) || [];
    list.push(relative);
    titles.set(title, list);
  }

  for (const script of html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(script[1]); } catch (error) { errors.push(`${relative}: JSON-LD inválido (${error.message})`); }
  }

  for (const image of html.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\salt="[^"]*"/i.test(image[0])) errors.push(`${relative}: imagen sin alt`);
  }

  const pageUrl = relative === 'index.html'
    ? SITE_URL
    : relative.endsWith(`${path.sep}index.html`)
      ? new URL(`${relative.slice(0, -'index.html'.length).replaceAll(path.sep, '/')}`, SITE_URL).href
      : new URL(relative.replaceAll(path.sep, '/'), SITE_URL).href;
  for (const attribute of html.matchAll(/\s(?:href|src)="([^"]+)"/gi)) {
    const value = attribute[1];
    if (/^(?:https?:|mailto:|tel:|#|data:|javascript:)/i.test(value)) continue;
    const resolved = new URL(value, pageUrl);
    if (resolved.origin !== new URL(SITE_URL).origin || !resolved.pathname.startsWith('/BisontesDUX/')) continue;
    const localPath = decodeURIComponent(resolved.pathname.slice('/BisontesDUX/'.length));
    const target = path.join(ROOT, localPath);
    const exists = fs.existsSync(target) || fs.existsSync(path.join(target, 'index.html'));
    if (!exists) errors.push(`${relative}: recurso o enlace local inexistente: ${value}`);
  }
}

for (const [title, files] of titles) if (files.length > 1) errors.push(`title duplicado "${title}": ${files.join(', ')}`);

const playerPages = htmlFiles.filter(file => /jugadores[/\\][^/\\]+[/\\]index\.html$/.test(file));
if (playerPages.length !== expectedPlayers) errors.push(`hay ${playerPages.length} fichas para ${expectedPlayers} entradas de players.js`);

const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
const blogContext = {};
vm.runInNewContext(`${fs.readFileSync(path.join(ROOT, 'data/blog.js'), 'utf8')}\nthis.__posts = posts;`, blogContext);
const expectedPosts = blogContext.__posts.length;
const expectedUrls = expectedPlayers + expectedPosts + 3; // home, patrocina, blog
if (sitemapUrls.length !== expectedUrls) errors.push(`sitemap: ${sitemapUrls.length} URLs; se esperaban ${expectedUrls}`);

/* Header y footer idénticos en todas las páginas (salvo los enlaces de scroll del index). */
const pagesWithLayout = htmlFiles.filter(file => !/(?:^|[/\\])(?:plantilla|jugadores|admin)[/\\]index\.html$/.test(path.relative(ROOT, file)));
const footers = new Set();
for (const file of pagesWithLayout) {
  const html = fs.readFileSync(file, 'utf8');
  const footer = html.match(/<!-- GENERATED-FOOTER:START -->[\s\S]*?<!-- GENERATED-FOOTER:END -->/)?.[0];
  if (!footer) errors.push(`${path.relative(ROOT, file)}: falta el footer común`);
  else footers.add(footer);
  if (!/<!-- GENERATED-HEADER:START -->/.test(html)) errors.push(`${path.relative(ROOT, file)}: falta el header común`);
}
if (footers.size > 1) errors.push(`el footer no es idéntico en todas las páginas (${footers.size} variantes)`);
if (new Set(sitemapUrls).size !== sitemapUrls.length) errors.push('sitemap: contiene URLs duplicadas');
for (const url of sitemapUrls) if (!url.startsWith(SITE_URL)) errors.push(`sitemap: URL fuera del subdirectorio: ${url}`);

const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const crawlablePlayerLinks = new Set(home.match(/href="\/BisontesDUX\/jugadores\/[^"/]+\/"/g) || []).size;
if (crawlablePlayerLinks !== expectedPlayers) errors.push(`home: ${crawlablePlayerLinks} enlaces rastreables a fichas; se esperaban ${expectedPlayers}`);

if (warnings.length) console.warn(warnings.join('\n'));
if (errors.length) {
  console.error(`Fallaron ${errors.length} comprobaciones:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`SEO validado: ${htmlFiles.length} HTML, ${expectedPlayers} fichas, ${sitemapUrls.length} URLs y JSON-LD correcto.`);
