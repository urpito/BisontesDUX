/* ============================================================
   BISONTES DUX — «Para redes» (/admin/redes/)
   · Solo admins. Archivos originales, sin comprimir, que luego se
     publican en redes: «Copiar enlace» da un enlace directo y
     temporal (7 días) para Metricool → «Desde URL».
   · Se suben por trozos con /api/videos/start (como los vídeos de
     la galería) y se cierran con /api/redes/<id>/finish.
   ============================================================ */
(function () {
  'use strict';

  const API = '/api';
  const STATUS = { pendiente: 'Pendiente', programado: 'Programado', publicado: 'Publicado' };
  const client = window.supabase.createClient();
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let items = [];

  async function api(method, path, body, raw) {
    const res = await fetch(API + path, {
      method, credentials: 'same-origin',
      headers: raw ? { 'Content-Type': 'application/octet-stream' } : (body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      body: raw ? body : (body !== undefined ? JSON.stringify(body) : undefined)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) { const e = new Error((data && data.error) || `Error ${res.status}`); e.status = res.status; throw e; }
    return data;
  }

  function show(id) {
    for (const s of ['login', 'main']) $(`#${s}`).hidden = s !== id;
  }
  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 3500);
  }
  const mb = n => `${(n / 1048576).toFixed(n > 104857600 ? 0 : 1)} MB`;
  const when = v => (v ? new Date(v).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

  /* ---------------- lista ---------------- */
  async function load() {
    items = await api('GET', '/redes');
    render();
  }
  function render() {
    const box = $('#items');
    if (!items.length) { box.innerHTML = '<p class="muted">Todavía no hay nada para publicar.</p>'; return; }
    box.innerHTML = items.map(item => {
      const src = `${API}/redes/${item.id}/file`;
      const media = (item.mime || '').startsWith('image/')
        ? `<img src="${src}" alt="" loading="lazy" />`
        : `<video src="${src}#t=0.5" preload="metadata" muted playsinline controls></video>`;
      return `<article class="item" data-id="${item.id}">
        ${media}
        <div>
          <h3>${esc(item.name)}</h3>
          <span class="badge ${item.status}">${STATUS[item.status] || item.status}</span>
          <span class="muted">${mb(item.size)}${item.publish_on ? ` · para el ${esc(when(item.publish_on))}` : ''}${item.uploaded_by_email ? ` · ${esc(item.uploaded_by_email)}` : ''}</span>
          <textarea data-field="caption" aria-label="Copy" placeholder="Copy / notas">${esc(item.caption)}</textarea>
          <div class="actions">
            <button type="button" class="primary" data-act="link">🔗 Copiar enlace</button>
            <select data-field="status" aria-label="Estado">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === item.status ? ' selected' : ''}>${v}</option>`).join('')}</select>
            <a href="${src}" download="${esc(item.name)}"><button type="button">Descargar</button></a>
            <button type="button" class="danger" data-act="delete">Borrar</button>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  $('#items').addEventListener('click', async e => {
    const button = e.target.closest('[data-act]');
    if (!button) return;
    const id = button.closest('.item').dataset.id;
    try {
      if (button.dataset.act === 'link') {
        const { url, expires_at: expires } = await api('POST', `/redes/${id}/link`);
        const until = new Date(expires).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
        try { await navigator.clipboard.writeText(url); toast(`Enlace copiado · caduca el ${until}`); } catch { window.prompt(`Copia el enlace (caduca el ${until}):`, url); }
      }
      if (button.dataset.act === 'delete' && confirm('¿Borrar este archivo para siempre?')) {
        await api('DELETE', `/redes/${id}`);
        items = items.filter(i => i.id !== id);
        render();
      }
    } catch (error) { toast(error.message); }
  });
  $('#items').addEventListener('change', async e => {
    const field = e.target.dataset.field;
    if (!field) return;
    const id = e.target.closest('.item').dataset.id;
    try {
      const row = await api('PATCH', `/redes/${id}`, { [field]: e.target.value });
      items = items.map(i => (i.id === id ? { ...i, ...row } : i));
      if (field === 'status') render();
      toast('Guardado');
    } catch (error) { toast(error.message); }
  });

  /* ---------------- subir (por trozos, con reintentos) ---------------- */
  async function uploadOne(file, meta, onProgress) {
    const start = await api('POST', '/videos/start', { size: file.size, name: file.name });
    const total = Math.ceil(file.size / start.chunk_size);
    for (let i = 0; i < total; i++) {
      const part = file.slice(i * start.chunk_size, Math.min(file.size, (i + 1) * start.chunk_size));
      for (let attempt = 0; ; attempt++) {
        try { await api('PUT', `/videos/${start.upload_id}/${i}`, part, true); break; } catch (error) {
          if (attempt >= 4 || (error.status && error.status < 500)) throw error;
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
      onProgress((i + 1) / total);
    }
    return api('POST', `/redes/${start.upload_id}/finish`, { ...meta, mime: file.type });
  }

  let uploading = false;
  async function upload(files) {
    if (!files.length || uploading) return;
    uploading = true;
    const status = $('#upload-status');
    const progress = $('#progress');
    const publish = $('#publish_on').value;
    const meta = { caption: $('#caption').value.trim() || null, publish_on: publish ? new Date(publish).toISOString() : null };
    progress.innerHTML = files.map((f, i) => `<li data-i="${i}">${esc(f.name)} · <em>en cola</em><div class="bar"><i></i></div></li>`).join('');
    let done = 0;
    for (const [i, file] of files.entries()) {
      const li = progress.querySelector(`[data-i="${i}"]`);
      try {
        const row = await uploadOne(file, meta, part => {
          li.querySelector('em').textContent = `${Math.round(part * 100)} %`;
          li.querySelector('i').style.width = `${part * 100}%`;
        });
        li.querySelector('em').textContent = 'subido ✓';
        items.unshift(row);
        render();
        done++;
      } catch (error) {
        li.querySelector('em').textContent = error.message;
      }
    }
    status.textContent = done === files.length ? '¡Listo! Ya puedes copiar el enlace.' : `Se han subido ${done} de ${files.length}.`;
    status.className = `status ${done === files.length ? 'ok' : 'err'}`;
    if (done) { $('#caption').value = ''; $('#publish_on').value = ''; $('#files').value = ''; }
    uploading = false;
  }
  $('#files').addEventListener('change', e => upload([...e.target.files]));
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => { e.preventDefault(); upload([...e.dataTransfer.files]); });
  window.addEventListener('beforeunload', e => { if (uploading) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------------- arranque ---------------- */
  async function enter() {
    const { data: isAdmin, error } = await client.rpc('gallery_is_admin');
    if (error) throw error;
    if (isAdmin !== true) {
      await client.auth.signOut({ scope: 'local' });
      throw new Error('Tu cuenta no es admin.');
    }
    show('main');
    await load();
  }
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const status = $('#login-status');
    status.textContent = 'Comprobando…';
    status.className = 'status';
    try {
      const { error } = await client.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value });
      if (error) throw new Error(/Invalid login/i.test(error.message) ? 'Correo o contraseña incorrectos.' : error.message);
      await enter();
    } catch (error) {
      status.textContent = error.message;
      status.className = 'status err';
    }
  });
  client.auth.getSession().then(({ data }) => {
    if (!data.session) { show('login'); return; }
    enter().catch(error => { show('login'); $('#login-status').textContent = error.message; $('#login-status').className = 'status err'; });
  });
}());
