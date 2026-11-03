// Backup consistente e incremental de la base SQLite y los medios.
// Destino por defecto: /srv/bisontesdux-backups (fuera de BDX_DATA).
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync, backup as sqliteBackup } from 'node:sqlite';

const DATA = process.env.BDX_DATA || '/srv/bisontesdux';
const DEST = process.env.BDX_BACKUP || '/srv/bisontesdux-backups';
const KEEP = Math.max(2, Number(process.env.BDX_BACKUP_KEEP || 14));
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const finalDir = path.join(DEST, stamp);
const tempDir = path.join(DEST, `.tmp-${stamp}`);

function snapshots() {
  if (!fs.existsSync(DEST)) return [];
  return fs.readdirSync(DEST).filter(name => /^\d{8}T\d{6}Z$/.test(name)).sort();
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr.trim() || `${command} ${result.status}`);
}

async function mediaStats(root) {
  let files = 0;
  let bytes = 0;
  async function walk(dir) {
    for (const entry of await fsp.readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const item = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(item);
      else if (entry.isFile()) { const stat = await fsp.stat(item); files++; bytes += stat.size; }
    }
  }
  await walk(root);
  return { files, bytes };
}

await fsp.mkdir(tempDir, { recursive: true, mode: 0o700 });
const sourceDb = new DatabaseSync(path.join(DATA, 'bisontesdux.db'));
await sqliteBackup(sourceDb, path.join(tempDir, 'bisontesdux.db'));
sourceDb.close();

const previous = snapshots().at(-1);
const mediaDest = path.join(tempDir, 'media');
await fsp.mkdir(mediaDest, { recursive: true, mode: 0o700 });
const args = ['-a', '--delete'];
if (previous) args.push(`--link-dest=${path.join(DEST, previous, 'media')}`);
args.push(`${path.join(DATA, 'media')}/`, `${mediaDest}/`);
run('rsync', args);

const checkDb = new DatabaseSync(path.join(tempDir, 'bisontesdux.db'), { readOnly: true });
const integrity = checkDb.prepare('PRAGMA integrity_check').get().integrity_check;
const counts = Object.fromEntries(['users', 'members', 'sessions', 'photos', 'uploads']
  .map(table => [table, checkDb.prepare(`SELECT count(1) n FROM ${table}`).get().n]));
checkDb.close();
if (integrity !== 'ok') throw new Error(`SQLite integrity_check: ${integrity}`);

const media = await mediaStats(mediaDest);
const manifest = { created_at: new Date().toISOString(), source: DATA, sqlite_integrity: integrity, counts, media };
await fsp.writeFile(path.join(tempDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
await fsp.rename(tempDir, finalDir);

const latest = path.join(DEST, 'latest');
await fsp.rm(latest, { force: true });
await fsp.symlink(stamp, latest);
const all = snapshots();
for (const old of all.slice(0, Math.max(0, all.length - KEEP))) await fsp.rm(path.join(DEST, old), { recursive: true, force: true });
console.log(`Backup verificado: ${finalDir} · ${counts.users} cuentas · ${counts.photos} medios en BD · ${media.files} archivos (${media.bytes} bytes)`);
