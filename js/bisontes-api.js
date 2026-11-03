/* ============================================================
   BISONTES DUX — cliente de la API propia (/api en urpilandia)
   Sustituye a supabase-js imitando solo las llamadas que usan la
   galería, el admin y el panel de partido, para que su código no
   cambie: auth, from(tabla), rpc, storage y functions.invoke.
   La sesión va en una cookie HttpOnly que pone el servidor: aquí
   no se guarda ninguna contraseña ni token.
   ============================================================ */
(function () {
  'use strict';

  const API = '/api';
  const BUCKETS_PUBLIC = { 'galeria-publica': 'publica' };
  // Cambia cuando haya que invalidar enlaces privados que algún navegador
  // haya guardado como fallidos. No contiene ningún secreto ni token.
  const PRIVATE_MEDIA_REV = 'urpilandia-20261103-1';

  /* Error con la forma que esperan las páginas ({ message, context.status, context.json() }). */
  function apiError(status, body) {
    const error = new Error((body && body.error) || `Error ${status}`);
    error.status = status;
    error.context = { status, json: async () => body || {} };
    return error;
  }
  async function request(method, path, body, options = {}) {
    let res;
    try {
      res = await fetch(`${API}${path}`, {
        method,
        credentials: 'same-origin',
        headers: options.raw ? { 'Content-Type': options.type || 'application/octet-stream', ...(options.headers || {}) } : (body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        body: options.raw ? body : (body !== undefined ? JSON.stringify(body) : undefined)
      });
    } catch (e) {
      throw apiError(0, { error: 'Failed to fetch' });
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw apiError(res.status, data);
    return data;
  }
  /* { data, error } como supabase-js. */
  async function wrap(task) {
    try { return { data: await task(), error: null }; } catch (error) { return { data: null, error }; }
  }

  /* ---------------- auth ---------------- */
  const listeners = new Set();
  let lastUser;
  function sessionOf(user) { return user ? { user } : null; }
  function notify(event, user) {
    lastUser = user;
    listeners.forEach(cb => { try { cb(event, sessionOf(user)); } catch (e) { console.error(e); } });
  }
  const auth = {
    async getSession() {
      return wrap(async () => {
        const { user } = await request('GET', '/auth/session');
        lastUser = user;
        return { session: sessionOf(user) };
      });
    },
    async signInWithPassword({ email, password }) {
      const result = await wrap(() => request('POST', '/auth/login', { email, password }));
      if (result.data) notify('SIGNED_IN', result.data.user);
      return result.error ? result : { data: { user: result.data.user, session: sessionOf(result.data.user) }, error: null };
    },
    async signUp({ email, password, options }) {
      const meta = (options && options.data) || {};
      const result = await wrap(() => request('POST', '/auth/signup', { email, password, name: meta.name, player_slug: meta.player_slug }));
      if (result.data) notify('SIGNED_IN', result.data.user);
      return result.error ? result : { data: { user: result.data.user, session: sessionOf(result.data.user) }, error: null };
    },
    async signOut() {
      const result = await wrap(() => request('POST', '/auth/logout'));
      notify('SIGNED_OUT', null);
      return { error: result.error };
    },
    async updateUser({ password }) {
      return wrap(() => request('POST', '/auth/password', { password }));
    },
    onAuthStateChange(callback) {
      listeners.add(callback);
      if (lastUser !== undefined) setTimeout(() => callback('INITIAL_SESSION', sessionOf(lastUser)), 0);
      else auth.getSession().then(({ data }) => callback('INITIAL_SESSION', data ? data.session : null));
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    }
  };

  /* ---------------- tablas ---------------- */
  function from(table) {
    const q = { table, op: 'select', columns: '*', filters: [], order: [], limit: null, values: null };
    let mode = null; /* null | 'single' | 'maybe' */
    const builder = {
      select(columns) { if (q.op === 'select') q.columns = columns || '*'; return builder; },
      insert(values) { q.op = 'insert'; q.values = values; return builder; },
      update(values) { q.op = 'update'; q.values = values; return builder; },
      delete() { q.op = 'delete'; return builder; },
      eq(column, value) { q.filters.push([column, 'eq', value]); return builder; },
      order(column, opts = {}) { q.order.push([column, opts.ascending !== false, Boolean(opts.nullsFirst)]); return builder; },
      limit(n) { q.limit = n; return builder; },
      single() { mode = 'single'; return builder; },
      maybeSingle() { mode = 'maybe'; return builder; },
      then(resolve, reject) {
        return wrap(async () => {
          const rows = await request('POST', '/db', q);
          if (mode === 'single') {
            if (rows.length !== 1) throw apiError(406, { error: 'No se encontró la fila' });
            return rows[0];
          }
          if (mode === 'maybe') return rows[0] || null;
          return rows;
        }).then(resolve, reject);
      }
    };
    return builder;
  }

  async function rpc(name, params) {
    return wrap(() => request('POST', `/rpc/${name}`, params || {}));
  }

  /* ---------------- archivos ---------------- */
  function encodePath(p) {
    return String(p).split('/').map(encodeURIComponent).join('/');
  }
  function privateMediaUrl(bucket, path, download) {
    const params = new URLSearchParams({ v: PRIVATE_MEDIA_REV });
    if (download) params.set('download', download === true ? path.split('/').pop() : download);
    return `${location.origin}${API}/media/${bucket}/${encodePath(path)}?${params}`;
  }
  function storageFrom(bucket) {
    return {
      upload(path, blob, opts = {}) {
        return wrap(() => request('PUT', `/storage/${bucket}/${encodePath(path)}`, blob, {
          raw: true, type: (opts.contentType || blob.type || 'application/octet-stream'), headers: opts.upsert ? { 'x-upsert': 'true' } : {}
        }));
      },
      remove(paths) { return wrap(() => request('POST', `/storage/${bucket}/remove`, { paths })); },
      copy(fromPath, toPath, opts = {}) {
        return wrap(() => request('POST', '/storage/copy', { bucket, from: fromPath, to: toPath, destinationBucket: opts.destinationBucket || bucket }));
      },
      getPublicUrl(path, opts = {}) {
        const folder = BUCKETS_PUBLIC[bucket];
        const base = folder ? `${location.origin}/media/${folder}/${encodePath(path)}` : privateMediaUrl(bucket, path);
        const url = opts.download ? privateMediaUrl(bucket, path, opts.download) : base;
        return { data: { publicUrl: url } };
      },
      /* Las privadas se sirven con la cookie de sesión: la «firma» es la propia sesión. */
      async createSignedUrl(path, ttl, opts = {}) {
        return { data: { signedUrl: privateMediaUrl(bucket, path, opts.download) }, error: null };
      },
      async createSignedUrls(paths) {
        return { data: paths.map(p => ({ path: p, signedUrl: privateMediaUrl(bucket, p), error: null })), error: null };
      }
    };
  }

  /* ---------------- vídeos (subida por trozos) ---------------- */
  async function uploadVideo(file, meta, onProgress) {
    const start = await request('POST', '/videos/start', { size: file.size, name: file.name });
    const size = start.chunk_size;
    const total = Math.ceil(file.size / size);
    for (let i = 0; i < total; i++) {
      const part = file.slice(i * size, Math.min(file.size, (i + 1) * size));
      for (let attempt = 0; ; attempt++) {
        try {
          await request('PUT', `/videos/${start.upload_id}/${i}`, part, { raw: true });
          break;
        } catch (error) {
          if (attempt >= 4 || (error.status && error.status < 500 && error.status !== 0)) throw error;
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
      if (onProgress) onProgress((i + 1) / total);
    }
    return request('POST', `/videos/${start.upload_id}/finish`, meta);
  }

  /* ---------------- funciones ---------------- */
  const functions = {
    invoke(name, { body } = {}) {
      return wrap(() => request('POST', `/fn/${name}`, body || {}));
    }
  };

  const client = {
    auth, from, rpc, functions,
    storage: { from: storageFrom },
    videos: { upload: uploadVideo }
  };

  /* Mismo punto de entrada que supabase-js: las páginas no cambian. */
  window.supabase = { createClient: () => client };
}());
