// ============================================================
// BISONTES DUX — migración desde Supabase a la API propia
// Copia cuentas (con su contraseña cifrada), accesos, fotos y sus
// archivos. Se puede repetir: lo que ya está no se duplica.
//
// Necesita en ~/.bisontesdux-secretos:
//   SUPABASE_DB_URL=postgresql://...   (Supabase → Connect → Session pooler)
//   SUPABASE_SERVICE_KEY=sb_secret_... (Project Settings → API Keys)
// y el cliente de PostgreSQL (sudo apt install postgresql-client).
//
// Uso (en urpilandia):  node --no-warnings server/migrar-supabase.mjs
// Con --solo-ver enseña qué copiaría sin escribir nada.
// ============================================================
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const DATA = process.env.BDX_DATA || '/srv/bisontesdux';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bejzptdcmyzgcyaqgfks.supabase.co';
const DRY = process.argv.includes('--solo-ver');
const secretsFile = path.join(process.env.HOME, '.bisontesdux-secretos');

const secrets = {};
for (const line of fs.readFileSync(secretsFile, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) secrets[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
if (!secrets.SUPABASE_DB_URL || !secrets.SUPABASE_SERVICE_KEY) {
  console.error('Faltan SUPABASE_DB_URL y/o SUPABASE_SERVICE_KEY en ~/.bisontesdux-secretos');
  process.exit(1);
}

function sql(query) {
  const result = spawnSync('psql', [secrets.SUPABASE_DB_URL, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (result.error) throw new Error(result.error.code === 'ENOENT' ? 'Falta psql: sudo apt install postgresql-client' : result.error.message);
  if (result.status !== 0) throw new Error(result.stderr.trim());
  const text = result.stdout.trim();
  return text ? JSON.parse(text) : [];
}

console.log('Leyendo Supabase…');
const users = sql("select coalesce(json_agg(json_build_object('id', id, 'email', lower(email), 'hash', encrypted_password, 'created_at', created_at)), '[]') from auth.users where email is not null");
const members = sql("select coalesce(json_agg(m), '[]') from public.gallery_members m");
const photos = sql("select coalesce(json_agg(p), '[]') from public.gallery_photos p");
console.log(`  ${users.length} cuentas, ${members.length} accesos, ${photos.length} fotos`);

const db = new DatabaseSync(path.join(DATA, 'bisontesdux.db'));
db.exec('PRAGMA foreign_keys = ON');
let added = { users: 0, members: 0, photos: 0, files: 0 };

for (const u of users) {
  if (!u.hash) { console.log(`  · ${u.email}: sin contraseña en Supabase, se omite`); continue; }
  if (db.prepare('SELECT 1 FROM users WHERE id = ? OR email = ?').get(u.id, u.email)) continue;
  if (!DRY) db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run(u.id, u.email, u.hash, new Date(u.created_at).toISOString());
  added.users++;
}
for (const m of members) {
  if (!DRY && !db.prepare('SELECT 1 FROM users WHERE id = ?').get(m.user_id)) continue;
  if (db.prepare('SELECT 1 FROM members WHERE user_id = ?').get(m.user_id)) continue;
  if (!DRY) db.prepare('INSERT INTO members (user_id, email, name, player_slug, role, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(m.user_id, m.email, m.name, m.player_slug, m.role, m.expires_at ? new Date(m.expires_at).toISOString() : null, new Date(m.created_at).toISOString());
  added.members++;
}

async function download(bucket, file) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${file.split('/').map(encodeURIComponent).join('/')}`, {
    headers: { apikey: secrets.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${secrets.SUPABASE_SERVICE_KEY}` }
  });
  if (!res.ok) throw new Error(`${bucket}/${file}: ${res.status} ${await res.text().catch(() => '')}`.slice(0, 200));
  return Buffer.from(await res.arrayBuffer());
}

for (const p of photos) {
  const targets = [['galeria-privada', 'privada']];
  if (p.is_public) targets.push(['galeria-privada', 'publica']);
  for (const file of [p.full_path, p.thumb_path]) {
    for (const [bucket, folder] of targets) {
      const dest = path.join(DATA, 'media', folder, file);
      if (fs.existsSync(dest)) continue;
      if (DRY) { added.files++; continue; }
      try {
        const body = await download(bucket, file);
        await fsp.mkdir(path.dirname(dest), { recursive: true });
        await fsp.writeFile(dest, body);
        added.files++;
      } catch (error) {
        console.error(`  ! ${error.message}`);
      }
    }
  }
  if (db.prepare('SELECT 1 FROM photos WHERE id = ?').get(p.id)) continue;
  if (!DRY) db.prepare(`INSERT INTO photos (id, full_path, thumb_path, width, height, event, taken_on, caption, players, is_public, media_type, status, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'image', 'ready', ?, ?)`)
    .run(p.id, p.full_path, p.thumb_path, p.width, p.height, p.event, p.taken_on, p.caption, JSON.stringify(p.players || []), p.is_public ? 1 : 0, p.uploaded_by, new Date(p.created_at).toISOString());
  added.photos++;
}

console.log(`${DRY ? 'Copiaría' : 'Copiado'}: ${added.users} cuentas, ${added.members} accesos, ${added.photos} fotos, ${added.files} archivos.`);
const admins = db.prepare("SELECT email FROM members WHERE role = 'admin'").all().map(r => r.email);
console.log(`Admins: ${admins.join(', ') || '(ninguno)'}`);
