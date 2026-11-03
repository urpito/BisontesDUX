// ============================================================
// BISONTES DUX — API propia (sustituye a Supabase)
// Corre en urpilandia como servicio «bisontesdux-api», solo en
// 127.0.0.1; nginx la publica en https://bisontesdux.es/api.
//
// · Cuentas y sesiones (cookie HttpOnly). Las contraseñas que vienen
//   de Supabase (bcrypt) se aceptan y se recifran con scrypt al entrar.
// · Accesos de la galería: pendiente, jugador, invitado (con fecha de
//   fin), admin, sin acceso. Los permisos se comprueban aquí.
// · Fotos y vídeos en disco (BDX_DATA/media/{publica,privada}). Las
//   privadas solo las sirve nginx tras pasar por /api/media
//   (X-Accel-Redirect). Los vídeos se suben por trozos y ffmpeg los
//   pasa a MP4 H.264 con miniatura.
// · Guardar en GitHub (data/*.js) y publicar historias en Instagram,
//   con las llaves en ~/.bisontesdux-secretos (nunca en la web).
//
// La web habla con esta API con js/bisontes-api.js, que imita las
// llamadas de Supabase que ya usaban la galería y los paneles.
// Sin dependencias: Node 22 (node:sqlite, node:crypto).
// ============================================================
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const PORT = Number(process.env.BDX_PORT || 8810);
const DATA = process.env.BDX_DATA || '/srv/bisontesdux';
const ORIGIN = process.env.BDX_ORIGIN || 'https://bisontesdux.es';
const SECRETS_FILE = process.env.BDX_SECRETS || path.join(process.env.HOME || '/home/urpi', '.bisontesdux-secretos');
const REPO = 'urpito/BisontesDUX';
const BRANCH = process.env.BDX_BRANCH || 'main';
const MEDIA = path.join(DATA, 'media');
const TMP = path.join(DATA, 'tmp');
const BUCKETS = { 'galeria-publica': 'publica', 'galeria-privada': 'privada' };
const SESSION_DAYS = 60;
const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_VIDEO = 4 * 1024 * 1024 * 1024;
const CHUNK = 8 * 1024 * 1024;
const ALLOWED_PATH = /^(data\/[a-z]+\.js|assets\/(uploads|sponsors|blog|historias)\/[a-z0-9-]+\.(webp|png|jpg))$/;

for (const dir of [DATA, path.join(MEDIA, 'publica'), path.join(MEDIA, 'privada'), TMP]) fs.mkdirSync(dir, { recursive: true });

function secrets() {
  const out = {};
  try {
    for (const line of fs.readFileSync(SECRETS_FILE, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* sin archivo: las funciones que lo necesitan avisan */ }
  return out;
}

/* ---------------- base de datos ---------------- */
const db = new DatabaseSync(path.join(DATA, 'bisontesdux.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE IF NOT EXISTS members (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL, name TEXT, player_slug TEXT,
    role TEXT NOT NULL DEFAULT 'pending' CHECK (role IN ('pending','player','guest','admin','blocked')),
    expires_at TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY, full_path TEXT NOT NULL, thumb_path TEXT NOT NULL,
    width INTEGER, height INTEGER, event TEXT, taken_on TEXT, caption TEXT,
    players TEXT NOT NULL DEFAULT '[]', is_public INTEGER NOT NULL DEFAULT 0,
    media_type TEXT NOT NULL DEFAULT 'image', status TEXT NOT NULL DEFAULT 'ready', duration REAL,
    uploaded_by TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS photos_public ON photos (is_public, taken_on);
  CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, size INTEGER NOT NULL, received INTEGER NOT NULL DEFAULT 0,
    next_index INTEGER NOT NULL DEFAULT 0, name TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
`);
const now = () => new Date().toISOString();
db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());

/* ---------------- contraseñas ---------------- */
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}
/* Hashes bcrypt de Supabase: se comprueban con crypt() del sistema (libxcrypt). */
function bcryptMatches(password, hash) {
  return new Promise(resolve => {
    const child = spawn('perl', ['-e', 'my $p = <STDIN>; chomp $p; print crypt($p, $ARGV[0]) eq $ARGV[0] ? "ok" : "no"', hash]);
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.on('close', () => resolve(out === 'ok'));
    child.on('error', () => resolve(false));
    child.stdin.end(`${password}\n`);
  });
}
async function verifyPassword(password, stored) {
  if (stored.startsWith('scrypt$')) {
    const [, salt, hash] = stored.split('$');
    const expected = Buffer.from(hash, 'base64');
    const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
    return crypto.timingSafeEqual(expected, actual);
  }
  if (/^\$2[aby]\$/.test(stored)) return bcryptMatches(password, stored);
  return false;
}

/* ---------------- utilidades HTTP ---------------- */
class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}
function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}
async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Payload too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function readJson(req) {
  const body = await readBody(req, 12 * 1024 * 1024);
  if (!body.length) return {};
  try { return JSON.parse(body.toString('utf8')); } catch { throw new HttpError(400, 'Petición no válida'); }
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
}
function clientIp(req) {
  return req.headers['x-real-ip'] || req.socket.remoteAddress || '';
}

/* Límite de intentos por IP (en memoria). */
const attempts = new Map();
function limit(key, max, minutes) {
  const t = Date.now();
  const list = (attempts.get(key) || []).filter(x => t - x < minutes * 60000);
  if (list.length >= max) throw new HttpError(429, 'Too many requests: rate limit');
  list.push(t);
  attempts.set(key, list);
}

/* ---------------- sesiones ---------------- */
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
/* «Secure» solo cuando nginx avisa de que la conexión es HTTPS (en producción, siempre). */
const secureFlag = req => (req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '');
function startSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, expires.toISOString());
  res.setHeader('Set-Cookie', `bdx_session=${token}; Path=/; HttpOnly${secureFlag(req)}; SameSite=Lax; Expires=${expires.toUTCString()}`);
}
function endSession(req, res) {
  const token = cookies(req).bdx_session;
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.setHeader('Set-Cookie', `bdx_session=; Path=/; HttpOnly${secureFlag(req)}; SameSite=Lax; Max-Age=0`);
}
function currentUser(req) {
  const token = cookies(req).bdx_session;
  if (!token) return null;
  const row = db.prepare(`SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).get(sha256(token), now());
  return row || null;
}
function memberOf(user) {
  return user ? db.prepare('SELECT * FROM members WHERE user_id = ?').get(user.id) || null : null;
}
/* Rol efectivo: como gallery_role() de Supabase (null si no tiene acceso vigente). */
function roleOf(user) {
  const m = memberOf(user);
  if (!m || !['player', 'guest', 'admin'].includes(m.role)) return null;
  if (m.expires_at && m.expires_at <= now()) return null;
  return m.role;
}
function requireUser(req) {
  const user = currentUser(req);
  if (!user) throw new HttpError(401, 'Hay que entrar con tu cuenta.');
  return user;
}
function requireAdmin(req) {
  const user = requireUser(req);
  if (roleOf(user) !== 'admin') throw new HttpError(403, 'permission denied: solo admins');
  return user;
}

/* ---------------- tablas (imitan las de Supabase) ---------------- */
const TABLES = {
  gallery_members: { table: 'members', key: 'user_id', columns: ['user_id', 'email', 'name', 'player_slug', 'role', 'expires_at', 'created_at'], editable: ['name', 'player_slug', 'role', 'expires_at'] },
  gallery_photos: {
    table: 'photos', key: 'id',
    columns: ['id', 'full_path', 'thumb_path', 'width', 'height', 'event', 'taken_on', 'caption', 'players', 'is_public', 'media_type', 'status', 'duration', 'uploaded_by', 'created_at'],
    editable: ['full_path', 'thumb_path', 'width', 'height', 'event', 'taken_on', 'caption', 'players', 'is_public']
  }
};
function rowOut(name, row) {
  if (name === 'gallery_photos') return { ...row, players: JSON.parse(row.players || '[]'), is_public: Boolean(row.is_public) };
  return row;
}
function valueIn(name, column, value) {
  if (name === 'gallery_photos' && column === 'players') return JSON.stringify(Array.isArray(value) ? value.map(String) : []);
  if (name === 'gallery_photos' && column === 'is_public') return value ? 1 : 0;
  if (value === undefined || value === '') return null;
  return value;
}

function dbQuery(req, q) {
  const spec = TABLES[q.table];
  if (!spec) throw new HttpError(400, `Could not find the table ${q.table}`);
  const user = currentUser(req);
  const role = roleOf(user);
  const admin = role === 'admin';
  const where = [];
  const params = [];
  for (const [column, op, value] of q.filters || []) {
    if (!spec.columns.includes(column) || op !== 'eq') throw new HttpError(400, 'Filtro no admitido');
    where.push(`${column} = ?`);
    params.push(valueIn(q.table, column, value));
  }

  // Permisos (las mismas reglas que tenía galeria.sql)
  if (q.table === 'gallery_photos') {
    if (q.op === 'select' && !role) where.push('is_public = 1');
    if (q.op !== 'select' && !admin) throw new HttpError(403, 'permission denied');
  } else {
    if (!user) throw new HttpError(401, 'Hay que entrar con tu cuenta.');
    if (q.op === 'select' && !admin) { where.push('user_id = ?'); params.push(user.id); }
    if (q.op !== 'select' && !admin) throw new HttpError(403, 'permission denied');
    if (q.op === 'insert') throw new HttpError(403, 'permission denied');
  }

  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  if (q.op === 'select') {
    const cols = !q.columns || q.columns === '*' ? spec.columns : String(q.columns).split(',').map(c => c.trim()).filter(c => spec.columns.includes(c));
    const order = (q.order || []).filter(o => spec.columns.includes(o[0]))
      .map(([column, asc, nullsFirst]) => `${column} IS NULL ${nullsFirst ? 'DESC' : 'ASC'}, ${column} ${asc ? 'ASC' : 'DESC'}`);
    const sql = `SELECT ${cols.join(', ')} FROM ${spec.table}${whereSql}${order.length ? ` ORDER BY ${order.join(', ')}` : ''}${q.limit ? ` LIMIT ${Number(q.limit) | 0}` : ''}`;
    return db.prepare(sql).all(...params).map(row => rowOut(q.table, row));
  }
  if (q.op === 'insert') {
    const rows = Array.isArray(q.values) ? q.values : [q.values];
    const out = [];
    for (const values of rows) {
      const data = { id: values.id || crypto.randomUUID(), uploaded_by: user.id };
      for (const column of spec.editable) if (column in values) data[column] = valueIn(q.table, column, values[column]);
      const cols = Object.keys(data);
      db.prepare(`INSERT INTO ${spec.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...cols.map(c => data[c]));
      out.push(rowOut(q.table, db.prepare(`SELECT * FROM ${spec.table} WHERE id = ?`).get(data.id)));
    }
    return out;
  }
  if (!where.length) throw new HttpError(400, 'Falta el filtro');
  const before = db.prepare(`SELECT * FROM ${spec.table}${whereSql}`).all(...params);
  if (q.op === 'update') {
    const sets = Object.keys(q.values || {}).filter(c => spec.editable.includes(c));
    if (q.table === 'gallery_members' && 'role' in (q.values || {}) && !['pending', 'player', 'guest', 'admin', 'blocked'].includes(q.values.role)) throw new HttpError(400, 'Rol no válido');
    if (sets.length) db.prepare(`UPDATE ${spec.table} SET ${sets.map(c => `${c} = ?`).join(', ')}${whereSql}`).run(...sets.map(c => valueIn(q.table, c, q.values[c])), ...params);
    return before.map(row => rowOut(q.table, db.prepare(`SELECT * FROM ${spec.table} WHERE ${spec.key} = ?`).get(row[spec.key])));
  }
  if (q.op === 'delete') {
    db.prepare(`DELETE FROM ${spec.table}${whereSql}`).run(...params);
    if (q.table === 'gallery_members') for (const row of before) db.prepare('DELETE FROM users WHERE id = ?').run(row.user_id);
    return before.map(row => rowOut(q.table, row));
  }
  throw new HttpError(400, 'Operación no admitida');
}

/* ---------------- archivos ---------------- */
function mediaPath(bucket, relative) {
  const folder = BUCKETS[bucket];
  if (!folder) throw new HttpError(400, 'Bucket desconocido');
  const clean = path.posix.normalize(String(relative || '')).replace(/^\/+/, '');
  if (!clean || clean.startsWith('..') || clean.includes('/../') || !/^[A-Za-z0-9._\/-]+$/.test(clean)) throw new HttpError(400, 'Ruta no válida');
  return { file: path.join(MEDIA, folder, clean), clean, folder };
}
const IMAGE_TYPES = ['image/jpeg', 'image/webp', 'image/png'];

/* ---------------- vídeos ---------------- */
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn('nice', ['-n', '15', command, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('close', code => (code === 0 ? resolve(out) : reject(new Error(err.slice(-400) || `${command} ${code}`))));
    child.on('error', reject);
  });
}
const videoQueue = [];
let videoBusy = false;
async function processVideos() {
  if (videoBusy) return;
  videoBusy = true;
  while (videoQueue.length) {
    const job = videoQueue.shift();
    try { await processVideo(job); } catch (error) {
      console.error('vídeo', job.id, error.message);
      db.prepare("UPDATE photos SET status = 'error' WHERE id = ?").run(job.id);
    }
  }
  videoBusy = false;
}
async function processVideo({ id, input, isPublic }) {
  const probe = JSON.parse(await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', input]));
  const video = (probe.streams || []).find(s => s.codec_type === 'video');
  const audio = (probe.streams || []).find(s => s.codec_type === 'audio');
  if (!video) throw new Error('El archivo no tiene vídeo');
  const dir = path.join(MEDIA, 'privada', id);
  await fsp.mkdir(dir, { recursive: true });
  const out = path.join(dir, 'video.mp4');
  const poster = path.join(dir, 'thumb.jpg');
  const rotation = Number((video.tags && video.tags.rotate) || ((video.side_data_list || []).find(s => s.rotation !== undefined) || {}).rotation || 0);
  const compatible = video.codec_name === 'h264' && (!audio || audio.codec_name === 'aac') && /mp4|mov/.test(probe.format.format_name) && (video.pix_fmt === 'yuv420p') && Math.max(video.width, video.height) <= 1920;
  // Compatible: solo se reordena para que empiece a verse antes de bajarlo entero.
  const args = compatible
    ? ['-y', '-i', input, '-c', 'copy', '-movflags', '+faststart', out]
    : ['-y', '-i', input, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
      '-vf', "scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))'", '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out];
  await run('ffmpeg', args);
  const duration = Number(probe.format.duration) || null;
  await run('ffmpeg', ['-y', '-ss', String(Math.min(1, (duration || 2) / 2)), '-i', out, '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '4', poster]);
  const info = JSON.parse(await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-print_format', 'json', out]));
  let { width, height } = info.streams[0];
  if (Math.abs(rotation) === 90 || Math.abs(rotation) === 270) [width, height] = [height, width];
  await fsp.rm(input, { force: true });
  if (isPublic) {
    await fsp.mkdir(path.join(MEDIA, 'publica', id), { recursive: true });
    await fsp.copyFile(out, path.join(MEDIA, 'publica', id, 'video.mp4'));
    await fsp.copyFile(poster, path.join(MEDIA, 'publica', id, 'thumb.jpg'));
  }
  db.prepare("UPDATE photos SET full_path = ?, thumb_path = ?, width = ?, height = ?, duration = ?, status = 'ready' WHERE id = ?")
    .run(`${id}/video.mp4`, `${id}/thumb.jpg`, width, height, duration, id);
}
// Vídeos que quedaron a medias si se reinició el servicio.
for (const row of db.prepare("SELECT id FROM photos WHERE status = 'processing'").all()) {
  const input = path.join(TMP, `${row.id}.upload`);
  if (fs.existsSync(input)) videoQueue.push({ id: row.id, input, isPublic: Boolean(db.prepare('SELECT is_public FROM photos WHERE id = ?').get(row.id).is_public) });
  else db.prepare("UPDATE photos SET status = 'error' WHERE id = ?").run(row.id);
}
processVideos();

/* ---------------- GitHub e Instagram ---------------- */
async function github(file, init = {}) {
  const token = secrets().GITHUB_TOKEN;
  if (!token) throw new HttpError(500, 'Falta la llave de GitHub (GITHUB_TOKEN en ~/.bisontesdux-secretos).');
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${file}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'bisontesdux-api', ...(init.headers || {}) }
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
async function fnAdminGithub(req, body) {
  const user = requireAdmin(req);
  const file = String(body.path || '');
  if (!ALLOWED_PATH.test(file)) throw new HttpError(400, `No se puede tocar ${file || 'esa ruta'} desde el panel.`);
  if (body.action === 'read') {
    const { status, data } = await github(`${file}?ref=${BRANCH}&t=${Date.now()}`);
    if (status !== 200) throw new HttpError(status, `GitHub ${status}: ${data.message || ''}`);
    return { sha: data.sha, content: data.content };
  }
  if (body.action === 'write') {
    if (typeof body.content !== 'string' || !body.content) throw new HttpError(400, 'Falta el contenido');
    const { status, data } = await github(file, {
      method: 'PUT',
      body: JSON.stringify({ message: `${body.message || `admin: actualiza ${file}`} (${user.email})`, content: body.content, branch: BRANCH, ...(body.sha ? { sha: body.sha } : {}) })
    });
    if (status !== 200 && status !== 201) throw new HttpError(status, `GitHub ${status}: ${data.message || ''}`);
    return { sha: data.content && data.content.sha };
  }
  throw new HttpError(400, 'Acción desconocida');
}
async function fnInstagramStory(req, body) {
  requireAdmin(req);
  const s = secrets();
  if (!s.IG_USER_ID || !s.IG_ACCESS_TOKEN) throw new HttpError(501, 'Instagram todavía no está conectado (faltan IG_USER_ID e IG_ACCESS_TOKEN).', { notConfigured: true });
  const imageUrl = String(body.image_url || '');
  if (!imageUrl.startsWith(`${ORIGIN}/media/publica/historias/`) || !/\.jpg$/i.test(imageUrl)) throw new HttpError(400, 'Esa imagen no es una historia del panel.');
  const api = `https://graph.instagram.com/${s.IG_API_VERSION || 'v23.0'}`;
  const call = async (endpoint, params, method = 'POST') => {
    const query = new URLSearchParams({ ...params, access_token: s.IG_ACCESS_TOKEN });
    const res = await fetch(method === 'GET' ? `${api}/${endpoint}?${query}` : `${api}/${endpoint}`, method === 'GET' ? {} : { method, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: query });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new HttpError(502, `No se pudo publicar en Instagram: ${(data.error && data.error.message) || res.status}`);
    return data;
  };
  const container = await call(`${s.IG_USER_ID}/media`, { image_url: imageUrl, media_type: 'STORIES' });
  for (let i = 0; i < 10; i++) {
    const status = await call(container.id, { fields: 'status_code' }, 'GET');
    if (status.status_code === 'FINISHED') break;
    if (['ERROR', 'EXPIRED'].includes(status.status_code)) throw new HttpError(502, `Instagram no aceptó la imagen (${status.status_code}).`);
    await new Promise(r => setTimeout(r, 1500));
  }
  const published = await call(`${s.IG_USER_ID}/media_publish`, { creation_id: container.id });
  return { id: published.id };
}

/* ---------------- rutas ---------------- */
async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const route = url.pathname.replace(/^\/api/, '');
  const method = req.method;

  // Comprobación de origen en las peticiones que cambian algo (CSRF).
  if (method !== 'GET' && method !== 'HEAD') {
    const origin = req.headers.origin;
    if (origin && origin !== ORIGIN && !/^https:\/\/www\.bisontesdux\.es$/.test(origin) && !/^http:\/\/([a-z]+\.)?(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) throw new HttpError(403, 'Origen no permitido');
  }

  if (route === '/health') return send(res, 200, { ok: true, videos_en_cola: videoQueue.length + (videoBusy ? 1 : 0) });

  // --- cuentas ---
  if (route === '/auth/session' && method === 'GET') {
    const user = currentUser(req);
    return send(res, 200, { user });
  }
  if (route === '/auth/login' && method === 'POST') {
    const body = await readJson(req);
    limit(`login:${clientIp(req)}`, 10, 15);
    const email = String(body.email || '').trim().toLowerCase();
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!row || !(await verifyPassword(String(body.password || ''), row.password_hash))) throw new HttpError(400, 'Invalid login credentials');
    if (!row.password_hash.startsWith('scrypt$')) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(body.password)), row.id);
    startSession(req, res, row.id);
    return send(res, 200, { user: { id: row.id, email: row.email } });
  }
  if (route === '/auth/signup' && method === 'POST') {
    const body = await readJson(req);
    limit(`signup:${clientIp(req)}`, 5, 60);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Correo no válido');
    if (password.length < 8) throw new HttpError(400, 'Password should be at least 8 characters');
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new HttpError(400, 'User already registered');
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(id, email, hashPassword(password));
    db.prepare('INSERT INTO members (user_id, email, name, player_slug) VALUES (?, ?, ?, ?)')
      .run(id, email, String(body.name || '').trim().slice(0, 80) || null, String(body.player_slug || '').trim() || null);
    startSession(req, res, id);
    return send(res, 200, { user: { id, email } });
  }
  if (route === '/auth/logout' && method === 'POST') {
    endSession(req, res);
    return send(res, 200, { ok: true });
  }
  if (route === '/auth/password' && method === 'POST') {
    const user = requireUser(req);
    const body = await readJson(req);
    if (String(body.password || '').length < 8) throw new HttpError(400, 'Password should be at least 8 characters');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(body.password)), user.id);
    // Una contraseña nueva invalida el resto de dispositivos. La sesión actual
    // se sustituye inmediatamente para no expulsar a quien hizo el cambio.
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    startSession(req, res, user.id);
    return send(res, 200, { ok: true });
  }

  // --- rpc ---
  if (route === '/rpc/gallery_is_admin' && method === 'POST') return send(res, 200, roleOf(currentUser(req)) === 'admin');
  if (route === '/rpc/gallery_admin_set_password' && method === 'POST') {
    requireAdmin(req);
    const body = await readJson(req);
    if (String(body.new_password || '').length < 8) throw new HttpError(400, 'La contraseña tiene que tener al menos 8 caracteres');
    const result = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(body.new_password)), String(body.target_user));
    if (!result.changes) throw new HttpError(404, 'No existe esa cuenta');
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(String(body.target_user));
    return send(res, 200, null);
  }

  // --- tablas ---
  if (route === '/db' && method === 'POST') return send(res, 200, dbQuery(req, await readJson(req)));

  // --- archivos ---
  const storage = route.match(/^\/storage\/([a-z-]+)\/(.+)$/);
  if (storage && method === 'PUT') {
    requireAdmin(req);
    const { file } = mediaPath(storage[1], decodeURIComponent(storage[2]));
    const type = String(req.headers['content-type'] || '').split(';')[0];
    if (!IMAGE_TYPES.includes(type)) throw new HttpError(400, 'Solo se admiten imágenes JPG, WebP o PNG.');
    if (fs.existsSync(file) && req.headers['x-upsert'] !== 'true') throw new HttpError(409, 'The resource already exists');
    const body = await readBody(req, MAX_IMAGE);
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, body);
    return send(res, 200, { path: decodeURIComponent(storage[2]) });
  }
  if (route.match(/^\/storage\/[a-z-]+\/remove$/) && method === 'POST') {
    requireAdmin(req);
    const bucket = route.split('/')[2];
    const body = await readJson(req);
    for (const p of body.paths || []) {
      const { file } = mediaPath(bucket, p);
      await fsp.rm(file, { force: true });
      await fsp.rmdir(path.dirname(file)).catch(() => {});
    }
    return send(res, 200, { ok: true });
  }
  if (route === '/storage/copy' && method === 'POST') {
    requireAdmin(req);
    const body = await readJson(req);
    const from = mediaPath(body.bucket, body.from);
    const to = mediaPath(body.destinationBucket || body.bucket, body.to);
    await fsp.mkdir(path.dirname(to.file), { recursive: true });
    await fsp.copyFile(from.file, to.file);
    return send(res, 200, { ok: true });
  }

  // --- servir privadas (nginx hace el envío con X-Accel-Redirect) ---
  const media = route.match(/^\/media\/(galeria-privada|galeria-publica)\/(.+)$/);
  if (media && (method === 'GET' || method === 'HEAD')) {
    const { clean, folder, file } = mediaPath(media[1], decodeURIComponent(media[2]));
    if (folder === 'privada' && !roleOf(currentUser(req))) throw new HttpError(403, 'permission denied');
    if (!fs.existsSync(file)) throw new HttpError(404, 'No existe');
    const headers = {
      'X-Accel-Redirect': `/_media/${folder}/${clean}`,
      // El navegador no debe reutilizar una foto privada después de cerrar
      // sesión ni conservar como rota una respuesta anterior sin permiso.
      'Cache-Control': folder === 'privada' ? 'private, no-store' : 'public, max-age=3600'
    };
    if (url.searchParams.get('download')) headers['Content-Disposition'] = `attachment; filename="${url.searchParams.get('download').replace(/[^A-Za-z0-9._-]/g, '_')}"`;
    res.writeHead(200, headers);
    return res.end();
  }

  // --- vídeos por trozos ---
  if (route === '/videos/start' && method === 'POST') {
    const user = requireAdmin(req);
    const body = await readJson(req);
    const size = Number(body.size);
    if (!size || size > MAX_VIDEO) throw new HttpError(413, 'El vídeo pesa demasiado (máximo 4 GB).');
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO uploads (id, user_id, size, name) VALUES (?, ?, ?, ?)').run(id, user.id, size, String(body.name || '').slice(0, 120));
    return send(res, 200, { upload_id: id, chunk_size: CHUNK });
  }
  const chunk = route.match(/^\/videos\/([0-9a-f-]{36})\/(\d+)$/);
  if (chunk && method === 'PUT') {
    requireAdmin(req);
    const upload = db.prepare('SELECT * FROM uploads WHERE id = ?').get(chunk[1]);
    if (!upload) throw new HttpError(404, 'Subida no encontrada');
    const index = Number(chunk[2]);
    if (index < upload.next_index) return send(res, 200, { received: upload.received }); // trozo repetido: ya estaba
    if (index !== upload.next_index) throw new HttpError(409, `Falta el trozo ${upload.next_index}`);
    const body = await readBody(req, CHUNK + 1024);
    await fsp.appendFile(path.join(TMP, `${upload.id}.upload`), body);
    db.prepare('UPDATE uploads SET received = received + ?, next_index = next_index + 1 WHERE id = ?').run(body.length, upload.id);
    return send(res, 200, { received: upload.received + body.length });
  }
  const finish = route.match(/^\/videos\/([0-9a-f-]{36})\/finish$/);
  if (finish && method === 'POST') {
    const user = requireAdmin(req);
    const upload = db.prepare('SELECT * FROM uploads WHERE id = ?').get(finish[1]);
    if (!upload) throw new HttpError(404, 'Subida no encontrada');
    if (upload.received !== upload.size) throw new HttpError(409, 'El vídeo no ha llegado entero. Vuelve a subirlo.');
    const meta = await readJson(req);
    db.prepare(`INSERT INTO photos (id, full_path, thumb_path, event, taken_on, caption, players, is_public, media_type, status, uploaded_by)
      VALUES (?, '', '', ?, ?, ?, ?, ?, 'video', 'processing', ?)`)
      .run(upload.id, meta.event || null, meta.taken_on || null, meta.caption || null, JSON.stringify(meta.players || []), meta.is_public ? 1 : 0, user.id);
    db.prepare('DELETE FROM uploads WHERE id = ?').run(upload.id);
    videoQueue.push({ id: upload.id, input: path.join(TMP, `${upload.id}.upload`), isPublic: Boolean(meta.is_public) });
    processVideos();
    return send(res, 200, rowOut('gallery_photos', db.prepare('SELECT * FROM photos WHERE id = ?').get(upload.id)));
  }

  // --- funciones (antes Edge Functions de Supabase) ---
  if (route === '/fn/admin-github' && method === 'POST') return send(res, 200, await fnAdminGithub(req, await readJson(req)));
  if (route === '/fn/instagram-story' && method === 'POST') return send(res, 200, await fnInstagramStory(req, await readJson(req)));

  throw new HttpError(404, 'No existe');
}

http.createServer(async (req, res) => {
  try {
    await handle(req, res);
  } catch (error) {
    const known = error instanceof HttpError;
    const status = known ? error.status : 500;
    if (!known) console.error(error);
    if (!res.headersSent) send(res, status, { error: known ? error.message : 'Error interno', ...(error.extra || {}) });
    else res.end();
  }
}).listen(PORT, '127.0.0.1', () => console.log(`bisontesdux-api en 127.0.0.1:${PORT}, datos en ${DATA}`));

// Limpieza: subidas de vídeo abandonadas hace más de un día.
setInterval(() => {
  const old = db.prepare("SELECT id FROM uploads WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day')").all();
  for (const row of old) {
    fs.rmSync(path.join(TMP, `${row.id}.upload`), { force: true });
    db.prepare('DELETE FROM uploads WHERE id = ?').run(row.id);
  }
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
}, 3600000).unref();
