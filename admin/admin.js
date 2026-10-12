/* ============================================================
   BISONTES DUX — panel de admin
   Lee y escribe data/players.js y data/blog.js en GitHub con la
   API de contenidos. Al guardar, la GitHub Action "Generar web"
   regenera las páginas y GitHub Pages publica en 1-2 minutos.
   ============================================================ */
(function () {
  'use strict';

  const REPO = 'urpito/BisontesDUX';
  const BRANCH = 'main';
  const API = `https://api.github.com/repos/${REPO}`;
  const SITE = '/BisontesDUX/';
  const TOKEN_KEY = 'bisontes-admin-token';

  const POSITIONS = [
    ['POR', 'Portero'], ['DFC', 'Defensa central'], ['LI', 'Lateral izquierdo'], ['LD', 'Lateral derecho'],
    ['MC', 'Mediocentro'], ['MCO', 'Mediocentro ofensivo'], ['EI', 'Extremo izquierdo'], ['ED', 'Extremo derecho'], ['DC', 'Delantero centro']
  ];

  const $ = sel => document.querySelector(sel);
  let token = '';
  const state = {
    players: { list: [], header: '', sha: null, dirty: false },
    blog: { list: [], header: '', sha: null, dirty: false },
    pendingUploads: new Map() /* objeto (jugador o entrada) → { field, blob, name } */
  };

  /* ---------------- utilidades ---------------- */
  function setStatus(msg, type) {
    const el = $('#status');
    el.textContent = msg || '';
    el.className = 'status' + (type ? ' ' + type : '');
  }
  function b64encode(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
  }
  function b64decode(b64) {
    const bin = atob(b64.replace(/\n/g, ''));
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  }
  function blobToB64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  function slugify(value) {
    return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function fullName(name) {
    const parts = String(name || '').split(',').map(p => p.trim());
    return parts.length > 1 ? `${parts.slice(1).join(' ')} ${parts[0]}` : parts[0];
  }
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function today() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
  }

  /* Reduce una imagen a WebP (mantiene transparencia) para que la web cargue rápido. */
  function toWebp(file, maxWidth) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('No se pudo convertir la imagen'))), 'image/webp', 0.86);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => reject(new Error('Imagen no válida'));
      img.src = URL.createObjectURL(file);
    });
  }

  /* ---------------- GitHub ---------------- */
  async function gh(path, options = {}) {
    const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', ...(options.headers || {}) }
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).message || ''; } catch (e) { /* sin cuerpo */ }
      const error = new Error(`GitHub ${res.status}${detail ? `: ${detail}` : ''}`);
      error.status = res.status;
      throw error;
    }
    return res.status === 204 ? null : res.json();
  }
  async function readFile(path) {
    const data = await gh(`/contents/${path}?ref=${BRANCH}&t=${Date.now()}`);
    return { sha: data.sha, text: b64decode(data.content) };
  }
  async function writeFile(path, base64, message, sha) {
    return gh(`/contents/${path}`, {
      method: 'PUT',
      body: JSON.stringify({ message, content: base64, branch: BRANCH, ...(sha ? { sha } : {}) })
    });
  }

  /* data/*.js son JavaScript: se separa el comentario de cabecera y se evalúa la lista. */
  function parseDataFile(text, variable) {
    const index = text.indexOf(`const ${variable}`);
    if (index === -1) throw new Error(`No encuentro "const ${variable}" en el archivo`);
    const list = new Function(`${text}\n;return ${variable};`)();
    return { header: text.slice(0, index), list };
  }
  function serializeDataFile(header, variable, list) {
    return `${header}const ${variable} = ${JSON.stringify(list, null, 2)};\n`;
  }

  async function loadAll() {
    setStatus('Cargando datos de GitHub…');
    const [players, blog] = await Promise.all([readFile('data/players.js'), readFile('data/blog.js')]);
    Object.assign(state.players, parseDataFile(players.text, 'players'), { sha: players.sha, dirty: false });
    Object.assign(state.blog, parseDataFile(blog.text, 'posts'), { sha: blog.sha, dirty: false });
    renderPlayers();
    renderPosts();
    setStatus('');
  }

  async function uploadPending(items, folder) {
    for (const item of items) {
      const pending = state.pendingUploads.get(item);
      if (!pending) continue;
      const path = `${folder}/${pending.name}`;
      setStatus(`Subiendo imagen ${pending.name}…`);
      await writeFile(path, await blobToB64(pending.blob), `admin: imagen ${pending.name}`);
      item[pending.field] = path;
      state.pendingUploads.delete(item);
    }
  }

  async function save(kind) {
    const isPlayers = kind === 'players';
    const store = state[kind];
    const button = $(isPlayers ? '#save-players' : '#save-blog');
    button.disabled = true;
    try {
      if (isPlayers) {
        const problem = validatePlayers(store.list);
        if (problem) throw new Error(problem);
        await uploadPending(store.list, 'assets/uploads');
      } else {
        const problem = validatePosts(store.list);
        if (problem) throw new Error(problem);
        await uploadPending(store.list, 'assets/blog');
      }
      setStatus('Guardando…');
      const file = isPlayers ? 'data/players.js' : 'data/blog.js';
      const text = serializeDataFile(store.header, isPlayers ? 'players' : 'posts', store.list);
      const result = await writeFile(file, b64encode(text), isPlayers ? 'admin: actualiza la plantilla' : 'admin: actualiza el blog', store.sha);
      store.sha = result.content.sha;
      store.dirty = false;
      isPlayers ? renderPlayers() : renderPosts();
      setStatus('Guardado ✓ La web se actualizará sola en 1-2 minutos.', 'ok');
    } catch (error) {
      if (error.status === 409) setStatus('Alguien cambió el archivo mientras editabas. Recarga la página y vuelve a aplicar los cambios.', 'err');
      else setStatus(`No se pudo guardar: ${error.message}`, 'err');
    } finally {
      button.disabled = false;
    }
  }

  /* ---------------- validación ---------------- */
  function validatePlayers(list) {
    const slugs = new Set();
    const dorsals = new Set();
    for (const p of list) {
      if (!String(p.name || '').trim()) return 'Hay una persona sin nombre.';
      const slug = p.slug || slugify(fullName(p.name));
      if (slugs.has(slug)) return `Hay dos personas con el mismo nombre: ${fullName(p.name)}.`;
      slugs.add(slug);
      if (!p.role) {
        if (p.dorsal === '' || p.dorsal === undefined || Number.isNaN(Number(p.dorsal))) return `${fullName(p.name)} no tiene un dorsal válido.`;
        if (dorsals.has(Number(p.dorsal))) return `El dorsal ${p.dorsal} está repetido.`;
        dorsals.add(Number(p.dorsal));
      } else if (!String(p.position || '').trim()) return `${fullName(p.name)} necesita un cargo.`;
    }
    return '';
  }
  function validatePosts(list) {
    const slugs = new Set();
    for (const post of list) {
      if (!String(post.title || '').trim()) return 'Hay una entrada sin título.';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date || '')) return `La entrada «${post.title}» necesita una fecha (AAAA-MM-DD).`;
      if (!String(post.excerpt || '').trim()) return `La entrada «${post.title}» necesita un resumen.`;
      const slug = post.slug || slugify(post.title);
      if (slugs.has(slug)) return `Hay dos entradas con la misma dirección (${slug}).`;
      slugs.add(slug);
    }
    return '';
  }

  /* ---------------- formularios ---------------- */
  function markDirty(kind) {
    state[kind].dirty = true;
    const summary = document.querySelector(kind === 'players' ? '#save-players' : '#save-blog');
    summary.textContent = kind === 'players' ? 'Guardar plantilla *' : 'Guardar blog *';
  }
  function photoUrl(path) {
    if (!path) return `${SITE}assets/logo.png`;
    return /^https?:/.test(path) ? path : `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`;
  }
  function field(label, html, full) {
    return `<div${full ? ' class="full"' : ''}><label>${label}</label>${html}</div>`;
  }

  function renderPlayers() {
    const wrap = $('#players-list');
    $('#save-players').textContent = 'Guardar plantilla';
    wrap.innerHTML = '';
    state.players.list.forEach((p, i) => {
      const type = p.role ? String(p.role).toLowerCase() : (String(p.dorsal).toUpperCase() === 'COACH' ? 'entrenador' : 'jugador');
      const pending = state.pendingUploads.get(p);
      const preview = pending ? URL.createObjectURL(pending.blob) : photoUrl(p.photo || (type === 'jugador' ? `assets/jugador${p.dorsal}.png` : ''));
      const details = document.createElement('details');
      details.className = 'item';
      details.innerHTML = `
        <summary>
          <img src="${esc(preview)}" alt="" onerror="this.src='${SITE}assets/logo.png'" />
          <strong>${esc(fullName(p.name) || 'Nueva persona')}</strong>
          ${p.nickname ? `<span class="muted">«${esc(p.nickname)}»</span>` : ''}
          <span class="tag">${type === 'jugador' ? `Dorsal ${esc(p.dorsal ?? '?')} · ${esc(p.position || '')}` : esc(p.position || type)}</span>
          <span class="spacer">
            <button type="button" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
            <button type="button" data-act="down" ${i === state.players.list.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button>
            <button type="button" data-act="delete" class="danger">Borrar</button>
          </span>
        </summary>
        <div class="fields">
          ${field('Tipo', `<select data-k="type">
              <option value="jugador"${type === 'jugador' ? ' selected' : ''}>Jugador</option>
              <option value="entrenador"${type === 'entrenador' ? ' selected' : ''}>Entrenador</option>
              <option value="directiva"${type === 'directiva' ? ' selected' : ''}>Directiva</option></select>`)}
          ${field('Nombre («Apellido, Nombre» o un solo nombre)', `<input data-k="name" value="${esc(p.name)}" />`)}
          ${field('Apodo (va en la espalda de la camiseta)', `<input data-k="nickname" value="${esc(p.nickname)}" placeholder="Opcional" />`)}
          ${type === 'jugador'
            ? field('Dorsal', `<input data-k="dorsal" type="number" min="1" max="99" value="${esc(p.dorsal)}" />`) +
              field('Posición', `<select data-k="position">${POSITIONS.map(([code, label]) => `<option value="${code}"${p.position === code ? ' selected' : ''}>${label} (${code})</option>`).join('')}</select>`)
            : field('Cargo', `<input data-k="position" value="${esc(p.position)}" placeholder="${type === 'entrenador' ? 'ENTRENADOR' : 'COMMUNITY MANAGER'}" />`)}
          ${field('Foto', `<div class="photo-row"><img src="${esc(preview)}" alt="" onerror="this.src='${SITE}assets/logo.png'" /><div><input type="file" data-k="photo" accept="image/*" /><p class="hint">Mejor recortada con fondo transparente (PNG). Se convierte sola a WebP.</p>${p.photo ? `<p class="hint">Actual: ${esc(p.photo)} <button type="button" class="link" data-act="nophoto">quitar</button></p>` : ''}</div></div>`, true)}
          ${field('Nacionalidades (separadas por coma, máx. 2)', `<input data-k="nationalities" value="${esc((p.nationalities || []).join(', '))}" />`)}
          ${field('Edad', `<input data-k="age" type="number" min="5" max="99" value="${esc(p.age)}" />`)}
          ${field('Trayectoria (una línea por etapa, la más reciente primero)', `<textarea data-k="trajectory">${esc((p.trajectory || []).join('\n'))}</textarea>`, true)}
          ${field('Bio corta', `<textarea data-k="bio">${esc(p.bio)}</textarea>`, true)}
          ${field('Instagram (URL)', `<input data-k="socials.instagram" type="url" value="${esc(p.socials?.instagram)}" />`)}
          ${field('TikTok (URL)', `<input data-k="socials.tiktok" type="url" value="${esc(p.socials?.tiktok)}" />`)}
          ${field('X (URL)', `<input data-k="socials.x" type="url" value="${esc(p.socials?.x)}" />`)}
        </div>`;
      bindPlayer(details, p, i);
      wrap.appendChild(details);
    });
  }

  function setOptional(obj, key, value) {
    if (value === '' || value === undefined || (Array.isArray(value) && !value.length)) delete obj[key];
    else obj[key] = value;
  }

  function bindPlayer(details, p, i) {
    details.addEventListener('click', e => {
      const act = e.target.dataset && e.target.dataset.act;
      if (!act) return;
      e.preventDefault();
      const list = state.players.list;
      if (act === 'delete') {
        if (!confirm(`¿Borrar a ${fullName(p.name) || 'esta persona'}? Su ficha desaparecerá de la web al guardar.`)) return;
        list.splice(i, 1);
      } else if (act === 'up') [list[i - 1], list[i]] = [list[i], list[i - 1]];
      else if (act === 'down') [list[i + 1], list[i]] = [list[i], list[i + 1]];
      else if (act === 'nophoto') { delete p.photo; state.pendingUploads.delete(p); }
      markDirty('players');
      renderPlayers();
    });
    details.addEventListener('change', async e => {
      const key = e.target.dataset.k;
      if (!key) return;
      const value = e.target.value.trim();
      if (key === 'type') {
        if (value === 'jugador') { delete p.role; p.dorsal = ''; p.position = 'MC'; }
        else { p.role = value; delete p.dorsal; p.position = value === 'entrenador' ? 'ENTRENADOR' : 'COMMUNITY MANAGER'; }
        markDirty('players');
        renderPlayers();
        details.open = true;
        return;
      }
      if (key === 'photo') {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const blob = await toWebp(file, 900);
          const slug = p.slug || slugify(fullName(p.name)) || 'persona';
          state.pendingUploads.set(p, { field: 'photo', blob, name: `${slug}-${Date.now()}.webp` });
          setStatus('Foto preparada. Se subirá al guardar.');
        } catch (error) { setStatus(error.message, 'err'); }
      } else if (key === 'dorsal') p.dorsal = value === '' ? '' : Number(value);
      else if (key === 'age') setOptional(p, 'age', value === '' ? '' : Number(value));
      else if (key === 'nationalities') setOptional(p, 'nationalities', value.split(',').map(v => v.trim()).filter(Boolean).slice(0, 2));
      else if (key === 'trajectory') setOptional(p, 'trajectory', value.split('\n').map(v => v.trim()).filter(Boolean));
      else if (key.startsWith('socials.')) {
        const network = key.split('.')[1];
        p.socials = p.socials || {};
        setOptional(p.socials, network, value);
        if (!Object.keys(p.socials).length) delete p.socials;
      } else if (key === 'name') p.name = value;
      else if (key === 'position') p.position = value.toUpperCase();
      else setOptional(p, key, value);
      markDirty('players');
      if (key === 'name' || key === 'nickname' || key === 'photo' || key === 'dorsal' || key === 'position') {
        const open = details.open;
        renderPlayers();
        $('#players-list').children[state.players.list.indexOf(p)].open = open;
      }
    });
  }

  function renderPosts() {
    const wrap = $('#posts-list');
    $('#save-blog').textContent = 'Guardar blog';
    wrap.innerHTML = '';
    if (!state.blog.list.length) wrap.innerHTML = '<p class="muted">Todavía no hay entradas.</p>';
    state.blog.list.forEach((post, i) => {
      const pending = state.pendingUploads.get(post);
      const cover = pending ? URL.createObjectURL(pending.blob) : (post.cover ? photoUrl(post.cover) : '');
      const details = document.createElement('details');
      details.className = 'item';
      details.innerHTML = `
        <summary>
          ${cover ? `<img src="${esc(cover)}" alt="" />` : ''}
          <strong>${esc(post.title || 'Nueva entrada')}</strong>
          <span class="tag">${esc(post.date || 'sin fecha')}</span>
          <span class="spacer">
            ${post.title ? `<a href="${SITE}blog/${esc(post.slug || slugify(post.title))}/" target="_blank" rel="noopener">Ver</a>` : ''}
            <button type="button" data-act="delete" class="danger">Borrar</button>
          </span>
        </summary>
        <div class="fields">
          ${field('Título', `<input data-k="title" value="${esc(post.title)}" />`, true)}
          ${field('Fecha', `<input data-k="date" type="date" value="${esc(post.date)}" />`)}
          ${field('Autor (opcional)', `<input data-k="author" value="${esc(post.author)}" placeholder="Bisontes DUX" />`)}
          ${field('Dirección (slug, opcional)', `<input data-k="slug" value="${esc(post.slug)}" placeholder="${esc(slugify(post.title))}" />`)}
          ${field('Resumen (sale en la tarjeta y en Google)', `<textarea data-k="excerpt">${esc(post.excerpt)}</textarea>`, true)}
          ${field('Portada (opcional)', `<div class="photo-row">${cover ? `<img src="${esc(cover)}" alt="" />` : ''}<div><input type="file" data-k="cover" accept="image/*" />${post.cover ? `<p class="hint">Actual: ${esc(post.cover)} <button type="button" class="link" data-act="nocover">quitar</button></p>` : ''}</div></div>`)}
          ${field('Texto alternativo de la portada', `<input data-k="coverAlt" value="${esc(post.coverAlt)}" placeholder="Qué se ve en la foto" />`)}
          ${field('Cuerpo', `<textarea data-k="body" style="min-height:260px">${esc((post.body || []).join('\n\n'))}</textarea>`, true)}
        </div>`;
      details.addEventListener('click', e => {
        const act = e.target.dataset && e.target.dataset.act;
        if (!act) return;
        e.preventDefault();
        if (act === 'delete') {
          if (!confirm(`¿Borrar la entrada «${post.title || 'sin título'}»?`)) return;
          state.blog.list.splice(i, 1);
        } else if (act === 'nocover') { delete post.cover; delete post.coverAlt; state.pendingUploads.delete(post); }
        markDirty('blog');
        renderPosts();
      });
      details.addEventListener('change', async e => {
        const key = e.target.dataset.k;
        if (!key) return;
        const value = e.target.value.trim();
        if (key === 'cover') {
          const file = e.target.files[0];
          if (!file) return;
          try {
            const blob = await toWebp(file, 1600);
            state.pendingUploads.set(post, { field: 'cover', blob, name: `${post.slug || slugify(post.title) || 'entrada'}-${Date.now()}.webp` });
            setStatus('Portada preparada. Se subirá al guardar.');
          } catch (error) { setStatus(error.message, 'err'); return; }
        } else if (key === 'body') post.body = e.target.value.split(/\n\s*\n/).map(v => v.trim()).filter(Boolean);
        else if (key === 'title') post.title = value;
        else setOptional(post, key, value);
        markDirty('blog');
        if (key === 'title' || key === 'date' || key === 'cover') {
          renderPosts();
          $('#posts-list').children[state.blog.list.indexOf(post)].open = true;
        }
      });
      wrap.appendChild(details);
    });
  }

  /* ---------------- arranque ---------------- */
  async function login(candidate, remember) {
    token = candidate;
    const user = await gh('https://api.github.com/user');
    const repo = await gh('');
    if (!repo.permissions || !repo.permissions.push) throw new Error('Este token no puede escribir en el repositorio.');
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
      if (remember) localStorage.setItem(TOKEN_KEY, token);
    } catch (e) { /* almacenamiento bloqueado: se queda solo en memoria */ }
    showPanel(`Conectado como ${user.login}`);
    await loadAll();
  }

  function showPanel(label) {
    $('#who').textContent = label;
    $('#logout').hidden = false;
    $('#login').hidden = true;
    $('#panel').hidden = false;
  }

  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const status = $('#login-status');
    status.textContent = 'Comprobando…';
    status.className = 'status';
    try { await login($('#token').value.trim(), $('#remember').checked); }
    catch (error) {
      token = '';
      status.textContent = error.status === 401 ? 'Token incorrecto o caducado.' : `No se pudo entrar: ${error.message}`;
      status.className = 'status err';
    }
  });

  $('#logout').addEventListener('click', () => {
    try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* nada */ }
    location.reload();
  });

  document.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach(t => t.setAttribute('aria-selected', String(t === tab)));
    $('#tab-players').hidden = tab.dataset.tab !== 'players';
    $('#tab-blog').hidden = tab.dataset.tab !== 'blog';
  }));

  $('#add-player').addEventListener('click', () => {
    state.players.list.push({ dorsal: '', name: '', position: 'MC' });
    markDirty('players');
    renderPlayers();
    const items = $('#players-list').children;
    items[items.length - 1].open = true;
    items[items.length - 1].scrollIntoView({ block: 'center' });
  });
  $('#add-post').addEventListener('click', () => {
    state.blog.list.unshift({ title: '', date: today(), excerpt: '', body: [] });
    markDirty('blog');
    renderPosts();
    $('#posts-list').children[0].open = true;
  });
  $('#save-players').addEventListener('click', () => save('players'));
  $('#save-blog').addEventListener('click', () => save('blog'));

  window.addEventListener('beforeunload', e => {
    if (state.players.dirty || state.blog.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  let saved = '';
  try { saved = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { /* nada */ }
  if (saved) login(saved, false).catch(() => { token = ''; });
}());
