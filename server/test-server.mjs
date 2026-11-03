import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(import.meta.dirname, '..');
const data = await fsp.mkdtemp(path.join(os.tmpdir(), 'bisontesdux-test-'));
const backups = `${data}-backups`;
const socket = net.createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const origin = `http://localhost:${port}`;
const child = spawn(process.execPath, ['--no-warnings', path.join(root, 'server/server.mjs')], {
  env: { ...process.env, BDX_DATA: data, BDX_PORT: String(port), BDX_ORIGIN: origin, BDX_SECRETS: path.join(data, 'missing-secrets') },
  stdio: ['ignore', 'pipe', 'pipe']
});
let childLog = '';
child.stdout.on('data', chunk => { childLog += chunk; });
child.stderr.on('data', chunk => { childLog += chunk; });

async function waitForHealth() {
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) return;
    } catch { /* todavía arrancando */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`La API no arrancó:\n${childLog}`);
}

async function request(method, route, body, cookie, type = 'application/json') {
  const headers = { Origin: origin };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers['Content-Type'] = type;
  const response = await fetch(`${origin}${route}`, {
    method, headers, body: body === undefined ? undefined : (Buffer.isBuffer(body) ? body : JSON.stringify(body))
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

try {
  await waitForHealth();
  const signup = await request('POST', '/api/auth/signup', { email: 'prueba@bisontes.local', password: 'Clave-prueba-2026', name: 'Prueba' });
  assert.equal(signup.response.status, 200);
  assert.ok(signup.cookie);

  const session = await request('GET', '/api/auth/session', undefined, signup.cookie);
  assert.equal(session.body.user.email, 'prueba@bisontes.local');

  const db = new DatabaseSync(path.join(data, 'bisontesdux.db'));
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get('prueba@bisontes.local');
  db.prepare("INSERT INTO photos (id, full_path, thumb_path, players, is_public) VALUES ('publica', 'publica/f.jpg', 'publica/t.jpg', '[]', 1)").run();
  db.prepare("INSERT INTO photos (id, full_path, thumb_path, players, is_public) VALUES ('privada', 'privada/f.jpg', 'privada/t.jpg', '[]', 0)").run();

  const pendingView = await request('POST', '/api/db', { op: 'select', table: 'gallery_photos', columns: '*' }, signup.cookie);
  assert.equal(pendingView.response.status, 200);
  assert.deepEqual(pendingView.body.map(row => row.id), ['publica']);

  db.prepare("UPDATE members SET role = 'admin' WHERE user_id = ?").run(user.id);
  const upload = await request('PUT', '/api/storage/galeria-privada/prueba/pixel.png', Buffer.from('png-test'), signup.cookie, 'image/png');
  assert.equal(upload.response.status, 200);
  assert.equal(fs.readFileSync(path.join(data, 'media/privada/prueba/pixel.png'), 'utf8'), 'png-test');

  const privateMedia = await request('GET', '/api/media/galeria-privada/prueba/pixel.png', undefined, signup.cookie);
  assert.equal(privateMedia.response.status, 200);
  assert.equal(privateMedia.response.headers.get('cache-control'), 'private, no-store');

  const adminView = await request('POST', '/api/db', { op: 'select', table: 'gallery_photos', columns: '*', order: [['id', true, false]] }, signup.cookie);
  assert.equal(adminView.response.status, 200);
  assert.deepEqual(adminView.body.map(row => row.id), ['privada', 'publica']);

  const changed = await request('POST', '/api/auth/password', { password: 'Clave-nueva-2026' }, signup.cookie);
  assert.equal(changed.response.status, 200);
  assert.ok(changed.cookie);
  const oldSession = await request('GET', '/api/auth/session', undefined, signup.cookie);
  assert.equal(oldSession.body.user, null);
  const newSession = await request('GET', '/api/auth/session', undefined, changed.cookie);
  assert.equal(newSession.body.user.email, 'prueba@bisontes.local');
  db.close();

  const backup = spawnSync(process.execPath, ['--no-warnings', path.join(root, 'server/backup.mjs')], {
    env: { ...process.env, BDX_DATA: data, BDX_BACKUP: backups, BDX_BACKUP_KEEP: '2' }, encoding: 'utf8'
  });
  assert.equal(backup.status, 0, backup.stderr || backup.stdout);
  const latest = fs.realpathSync(path.join(backups, 'latest'));
  const manifest = JSON.parse(fs.readFileSync(path.join(latest, 'manifest.json'), 'utf8'));
  assert.equal(manifest.sqlite_integrity, 'ok');
  assert.equal(manifest.counts.users, 1);
  assert.equal(manifest.counts.photos, 2);
  console.log('API, permisos, rotación de sesión y backup: OK');
} finally {
  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
  await fsp.rm(data, { recursive: true, force: true });
  await fsp.rm(backups, { recursive: true, force: true });
}
