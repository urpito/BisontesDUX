// ============================================================
// BISONTES DUX — gestión de cuentas desde el servidor
//   node --no-warnings server/cuentas.mjs lista
//   node --no-warnings server/cuentas.mjs admin <correo>      → le da rol de admin
//   node --no-warnings server/cuentas.mjs clave <correo>      → contraseña nueva aleatoria
// ============================================================
import crypto from 'node:crypto';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(path.join(process.env.BDX_DATA || '/srv/bisontesdux', 'bisontesdux.db'));
db.exec('PRAGMA foreign_keys = ON');
const [command, email] = process.argv.slice(2);
const find = () => {
  const row = db.prepare('SELECT u.id, u.email, m.role FROM users u LEFT JOIN members m ON m.user_id = u.id WHERE u.email = ?').get(String(email || '').toLowerCase());
  if (!row) { console.error(`No hay ninguna cuenta con ${email}`); process.exit(1); }
  return row;
};

if (command === 'lista') {
  for (const r of db.prepare('SELECT u.email, m.role, m.name, m.expires_at FROM users u LEFT JOIN members m ON m.user_id = u.id ORDER BY m.role, u.email').all()) {
    console.log(`${(r.role || 'sin ficha').padEnd(8)} ${r.email}${r.name ? ` (${r.name})` : ''}${r.expires_at ? ` hasta ${r.expires_at.slice(0, 10)}` : ''}`);
  }
} else if (command === 'admin') {
  const row = find();
  db.prepare("UPDATE members SET role = 'admin', expires_at = NULL WHERE user_id = ?").run(row.id);
  console.log(`${row.email} ya es admin.`);
} else if (command === 'clave') {
  const row = find();
  const password = crypto.randomBytes(9).toString('base64url');
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(`scrypt$${salt.toString('base64')}$${hash.toString('base64')}`, row.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.id);
  console.log(`Contraseña nueva para ${row.email}: ${password}  (que la cambie al entrar)`);
} else {
  console.log('Uso: lista | admin <correo> | clave <correo>');
}
