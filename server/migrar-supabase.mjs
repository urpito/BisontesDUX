// ============================================================
// BISONTES DUX — migración verificable desde Supabase
//
// --solo-ver   inventario y plan, sin escribir ni descargar
// --verificar  compara Supabase con la copia local, sin escribir
// Sin opción   copia cuentas, perfiles, fotos y archivos; es reanudable
// ============================================================
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const DATA = process.env.BDX_DATA || '/srv/bisontesdux';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bejzptdcmyzgcyaqgfks.supabase.co';
const DRY = process.argv.includes('--solo-ver');
const VERIFY_ONLY = process.argv.includes('--verificar');
const secretsFile = process.env.BDX_SECRETS || path.join(process.env.HOME, '.bisontesdux-secretos');

function readSecrets(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const secrets = readSecrets(secretsFile);
if (!secrets.SUPABASE_DB_URL || !secrets.SUPABASE_SERVICE_KEY) {
  console.error('Faltan SUPABASE_DB_URL y/o SUPABASE_SERVICE_KEY en el archivo de secretos.');
  process.exit(1);
}

function sql(query) {
  const result = spawnSync('psql', [secrets.SUPABASE_DB_URL, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query], {
    encoding: 'utf8', maxBuffer: 256 * 1024 * 1024
  });
  if (result.error) throw new Error(result.error.code === 'ENOENT' ? 'Falta psql (postgresql-client).' : result.error.message);
  if (result.status !== 0) throw new Error(result.stderr.trim());
  const text = result.stdout.trim();
  return text ? JSON.parse(text) : [];
}

console.log('Leyendo inventario de Supabase…');
const users = sql("select coalesce(json_agg(json_build_object('id', id, 'email', lower(email), 'hash', encrypted_password, 'created_at', created_at)), '[]'::json) from auth.users where email is not null");
const members = sql("select coalesce(json_agg(m), '[]'::json) from public.gallery_members m");
const photos = sql("select coalesce(json_agg(p), '[]'::json) from public.gallery_photos p");
const objects = sql("select coalesce(json_agg(json_build_object('bucket', bucket_id, 'name', name, 'size', coalesce((metadata->>'size')::bigint, 0))), '[]'::json) from storage.objects where bucket_id in ('galeria-privada', 'galeria-publica')");
const objectMap = new Map(objects.map(item => [`${item.bucket}/${item.name}`, Number(item.size) || 0]));
const sourceRoles = Object.fromEntries([...new Set(members.map(member => member.role))].sort().map(role => [role, members.filter(member => member.role === role).length]));
const sourceBytes = objects.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
console.log(`  ${users.length} cuentas, ${members.length} accesos, ${photos.length} fotos, ${objects.length} archivos (${sourceBytes} bytes)`);
console.log(`  Roles: ${Object.entries(sourceRoles).map(([role, count]) => `${role}=${count}`).join(', ') || '(ninguno)'}`);

const dbPath = path.join(DATA, 'bisontesdux.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');
const localUsers = db.prepare('SELECT id, email FROM users').all();
const byId = new Map(localUsers.map(user => [user.id, user]));
const byEmail = new Map(localUsers.map(user => [String(user.email).toLowerCase(), user]));
const conflicts = [];
const usersToAdd = [];
for (const user of users) {
  if (!user.hash) { conflicts.push({ kind: 'sin_hash', id: user.id }); continue; }
  if (byId.has(user.id)) continue;
  const sameEmail = byEmail.get(user.email);
  if (sameEmail) { conflicts.push({ kind: 'email', id: user.id }); continue; }
  usersToAdd.push(user);
}
const futureIds = new Set([...byId.keys(), ...usersToAdd.map(user => user.id)]);
const membersToAdd = members.filter(member => futureIds.has(member.user_id) && !db.prepare('SELECT 1 FROM members WHERE user_id = ?').get(member.user_id));
const photosToAdd = photos.filter(photo => !db.prepare('SELECT 1 FROM photos WHERE id = ?').get(photo.id));

function targetsFor(photo) {
  const targets = [
    ['galeria-privada', 'privada', photo.full_path],
    ['galeria-privada', 'privada', photo.thumb_path]
  ];
  if (photo.is_public) {
    targets.push(['galeria-publica', 'publica', photo.full_path]);
    targets.push(['galeria-publica', 'publica', photo.thumb_path]);
  }
  return targets;
}

function localFile(folder, name) {
  const clean = path.posix.normalize(String(name || '')).replace(/^\/+/, '');
  if (!clean || clean.startsWith('..') || clean.includes('/../')) throw new Error(`Ruta de archivo no válida: ${name}`);
  return path.join(DATA, 'media', folder, clean);
}

function fileMatches(bucket, folder, name) {
  const file = localFile(folder, name);
  if (!fs.existsSync(file)) return false;
  const expected = objectMap.get(`${bucket}/${name}`);
  return !expected || fs.statSync(file).size === expected;
}

const missingFiles = photos.flatMap(targetsFor).filter(([bucket, folder, name]) => !fileMatches(bucket, folder, name));
console.log(`${DRY ? 'Plan' : VERIFY_ONLY ? 'Verificación solicitada' : 'Pendiente'}: ${usersToAdd.length} cuentas, ${membersToAdd.length} accesos, ${photosToAdd.length} fotos, ${missingFiles.length} archivos.`);
if (conflicts.length) console.log(`  Conflictos de cuenta: ${conflicts.length} (${conflicts.map(item => item.kind).join(', ')}).`);

function verify() {
  const errors = [];
  for (const user of users) if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(user.id)) errors.push(`cuenta:${user.id}`);
  for (const member of members) if (!db.prepare('SELECT 1 FROM members WHERE user_id = ?').get(member.user_id)) errors.push(`acceso:${member.user_id}`);
  for (const photo of photos) {
    if (!db.prepare('SELECT 1 FROM photos WHERE id = ?').get(photo.id)) errors.push(`foto:${photo.id}`);
    for (const [bucket, folder, name] of targetsFor(photo)) if (!fileMatches(bucket, folder, name)) errors.push(`archivo:${bucket}/${name}`);
  }
  const result = {
    source: { users: users.length, members: members.length, photos: photos.length, objects: objects.length, bytes: sourceBytes },
    local: {
      users: db.prepare('SELECT count(1) n FROM users').get().n,
      members: db.prepare('SELECT count(1) n FROM members').get().n,
      photos: db.prepare('SELECT count(1) n FROM photos').get().n
    },
    errors
  };
  console.log(`Verificación: ${errors.length ? `${errors.length} diferencias` : 'OK; cuentas, accesos, fotos y tamaños coinciden'}.`);
  if (errors.length) console.log(`  Primeras diferencias: ${errors.slice(0, 10).join(', ')}`);
  return result;
}

if (DRY) process.exit(conflicts.length ? 2 : 0);
if (VERIFY_ONLY) process.exit(verify().errors.length ? 1 : 0);
if (conflicts.length) {
  console.error('Migración detenida: resuelve los conflictos de cuenta antes de escribir.');
  process.exit(2);
}

db.exec('BEGIN IMMEDIATE');
try {
  for (const user of usersToAdd) {
    db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(user.id, user.email, user.hash, new Date(user.created_at).toISOString());
  }
  for (const member of membersToAdd) {
    db.prepare('INSERT INTO members (user_id, email, name, player_slug, role, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(member.user_id, member.email, member.name, member.player_slug, member.role,
        member.expires_at ? new Date(member.expires_at).toISOString() : null, new Date(member.created_at).toISOString());
  }
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}

async function download(bucket, name, destination) {
  const encoded = name.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encoded}`, {
    headers: { apikey: secrets.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${secrets.SUPABASE_SERVICE_KEY}` }
  });
  if (!response.ok) throw new Error(`${bucket}/${name}: HTTP ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  const expected = objectMap.get(`${bucket}/${name}`);
  if (expected && body.length !== expected) throw new Error(`${bucket}/${name}: ${body.length} bytes; se esperaban ${expected}`);
  if (!body.length) throw new Error(`${bucket}/${name}: archivo vacío`);
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.part-${crypto.randomUUID()}`;
  // Nginx (www-data) entrega el fichero tras X-Accel-Redirect. La carpeta
  // privada sigue siendo inaccesible directamente; el archivo debe ser legible
  // por el worker de Nginx una vez que la API autoriza la petición.
  await fsp.writeFile(temporary, body, { mode: 0o644 });
  await fsp.rename(temporary, destination);
}

let downloaded = 0;
let insertedPhotos = 0;
const failures = [];
for (const photo of photos) {
  let complete = true;
  for (const [bucket, folder, name] of targetsFor(photo)) {
    if (fileMatches(bucket, folder, name)) continue;
    try {
      await download(bucket, name, localFile(folder, name));
      downloaded++;
    } catch (error) {
      complete = false;
      failures.push(error.message);
    }
  }
  if (!complete || db.prepare('SELECT 1 FROM photos WHERE id = ?').get(photo.id)) continue;
  db.prepare(`INSERT INTO photos (id, full_path, thumb_path, width, height, event, taken_on, caption, players, is_public, media_type, status, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'image', 'ready', ?, ?)`).run(
    photo.id, photo.full_path, photo.thumb_path, photo.width, photo.height, photo.event, photo.taken_on,
    photo.caption, JSON.stringify(photo.players || []), photo.is_public ? 1 : 0, photo.uploaded_by,
    new Date(photo.created_at).toISOString()
  );
  insertedPhotos++;
}

console.log(`Copiado: ${usersToAdd.length} cuentas, ${membersToAdd.length} accesos, ${insertedPhotos} fotos, ${downloaded} archivos.`);
if (failures.length) {
  console.error(`Fallaron ${failures.length} archivos. La migración es reanudable; primeras incidencias:`);
  for (const failure of failures.slice(0, 10)) console.error(`  ! ${failure}`);
  process.exit(1);
}
process.exit(verify().errors.length ? 1 : 0);
