/* ============================================================
   BISONTES DUX — panel de admin
   Se entra con la cuenta de la galería (Supabase Auth). Lee y
   guarda los archivos de data/ en GitHub a través de la función
   admin-github de Supabase, que guarda la llave de GitHub y solo
   deja pasar a los admins. Al guardar, la GitHub Action "Generar
   web" regenera las páginas y GitHub Pages publica en 1-2 minutos.
   ============================================================ */
(function () {
  'use strict';

  const REPO = 'urpito/BisontesDUX';
  const BRANCH = 'main';
  const SITE = '/BisontesDUX/';
  const config = window.BISONTES_GALERIA || {};
  const client = window.supabase && config.supabaseUrl
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: true, storageKey: 'bisontes-galeria' } })
    : null;

  const POSITIONS = [
    ['POR', 'Portero'], ['DFC', 'Defensa central'], ['LI', 'Lateral izquierdo'], ['LD', 'Lateral derecho'],
    ['MC', 'Mediocentro'], ['MCO', 'Mediocentro ofensivo'], ['EI', 'Extremo izquierdo'], ['ED', 'Extremo derecho'], ['DC', 'Delantero centro']
  ];
  const SOCIALS = [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['x', 'X'], ['facebook', 'Facebook']];

  /* Cada pestaña edita un archivo de data/ que define una variable. */
  const FILES = {
    players: { path: 'data/players.js', variable: 'players', folder: 'assets/uploads', label: 'la plantilla' },
    site: { path: 'data/site.js', variable: 'site', label: 'los textos de la web' },
    sponsors: { path: 'data/sponsors.js', variable: 'sponsors', folder: 'assets/sponsors', label: 'los patrocinadores' },
    blog: { path: 'data/blog.js', variable: 'posts', folder: 'assets/blog', label: 'el blog' }
  };

  const $ = sel => document.querySelector(sel);
  let countries = {};
  const state = {
    players: { data: [], header: '', sha: null, dirty: false },
    site: { data: {}, header: '', sha: null, dirty: false },
    sponsors: { data: [], header: '', sha: null, dirty: false },
    blog: { data: [], header: '', sha: null, dirty: false },
    pendingUploads: new Map(), /* objeto (persona, patrocinador o entrada) → { field, blob, name, kind } */
    open: new Set(),           /* elementos desplegados (se mantienen al repintar) */
    search: ''
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
  function move(list, from, to) {
    if (to < 0 || to >= list.length) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
  }
  function setOptional(obj, key, value) {
    if (value === '' || value === undefined || value === false || (Array.isArray(value) && !value.length)) delete obj[key];
    else obj[key] = value;
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

  /* ---------------- GitHub (a través de la función admin-github) ---------------- */
  async function callGithub(body) {
    const { data, error } = await client.functions.invoke('admin-github', { body });
    if (error) {
      let detail = error.message;
      let status = 0;
      try { status = error.context.status; detail = (await error.context.json()).error || detail; } catch (e) { /* sin detalle */ }
      const failure = new Error(detail);
      failure.status = status;
      throw failure;
    }
    return data;
  }
  async function readFile(path) {
    const data = await callGithub({ action: 'read', path });
    return { sha: data.sha, text: b64decode(data.content) };
  }
  async function writeFile(path, base64, message, sha) {
    const data = await callGithub({ action: 'write', path, content: base64, message, sha });
    return { content: { sha: data.sha } };
  }

  /* data/*.js son JavaScript: se separa el comentario de cabecera y se evalúa la variable. */
  function parseDataFile(text, variable) {
    const index = text.indexOf(`const ${variable}`);
    if (index === -1) throw new Error(`No encuentro "const ${variable}" en el archivo`);
    const data = new Function(`${text}\n;return ${variable};`)();
    return { header: text.slice(0, index), data };
  }
  function serializeDataFile(header, variable, data) {
    return `${header}const ${variable} = ${JSON.stringify(data, null, 2)};\n`;
  }

  async function loadAll() {
    setStatus('Cargando datos de GitHub…');
    const kinds = Object.keys(FILES);
    const [files, countryFile] = await Promise.all([Promise.all(kinds.map(kind => readFile(FILES[kind].path))), readFile('data/countries.js')]);
    kinds.forEach((kind, i) => Object.assign(state[kind], parseDataFile(files[i].text, FILES[kind].variable), { sha: files[i].sha, dirty: false }));
    countries = parseDataFile(countryFile.text, 'countries').data;
    renderAll();
    setStatus('');
  }

  function renderAll() {
    renderPlayers();
    renderSite();
    renderSponsors();
    renderPosts();
  }

  /* ---------------- guardar ---------------- */
  async function uploadPending(kind) {
    for (const [item, pending] of state.pendingUploads) {
      if (pending.kind !== kind) continue;
      const path = `${FILES[kind].folder}/${pending.name}`;
      setStatus(`Subiendo imagen ${pending.name}…`);
      await writeFile(path, await blobToB64(pending.blob), `admin: imagen ${pending.name}`);
      item[pending.field] = path;
      state.pendingUploads.delete(item);
    }
  }

  const VALIDATORS = { players: validatePlayers, site: validateSite, sponsors: validateSponsors, blog: validatePosts };

  async function save(kind) {
    const file = FILES[kind];
    const store = state[kind];
    const button = document.querySelector(`[data-save="${kind}"]`);
    button.disabled = true;
    try {
      const problem = VALIDATORS[kind](store.data);
      if (problem) throw new Error(problem);
      if (file.folder) await uploadPending(kind);
      setStatus('Guardando…');
      const text = serializeDataFile(store.header, file.variable, store.data);
      const result = await writeFile(file.path, b64encode(text), `admin: actualiza ${file.label}`, store.sha);
      store.sha = result.content.sha;
      store.dirty = false;
      renderAll();
      setStatus('Guardado ✓ Ya está en GitHub. La web tarda 2-4 minutos en mostrarlo: no hace falta volver a guardar. Si luego no lo ves, recarga la página con Ctrl+F5 (en el móvil, recarga normal).', 'ok');
    } catch (error) {
      if (error.status === 409) setStatus('Alguien cambió el archivo mientras editabas. Recarga la página y vuelve a aplicar los cambios.', 'err');
      else setStatus(`No se pudo guardar: ${error.message}`, 'err');
    } finally {
      button.disabled = false;
    }
  }

  function markDirty(kind) {
    state[kind].dirty = true;
    const button = document.querySelector(`[data-save="${kind}"]`);
    if (!button.textContent.endsWith('*')) button.textContent += ' *';
  }
  function resetSaveLabels() {
    document.querySelectorAll('[data-save]').forEach(button => {
      button.textContent = button.textContent.replace(/ \*$/, '');
      if (state[button.dataset.save].dirty) button.textContent += ' *';
    });
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
  function validateSite(site) {
    const titles = [['about', 'Sobre nosotros'], ['roster', 'Plantilla'], ['values', 'Valores'], ['sponsors', 'Patrocinadores'], ['instagram', 'Instagram'], ['join', 'Quiero jugar'], ['newsletter', 'Newsletter']];
    for (const [key, label] of titles) if (!String(site[key]?.title || '').trim()) return `Falta el título de «${label}».`;
    if (!String(site.hero?.tagline || '').trim()) return 'Falta la frase de la portada.';
    if (!site.about.paragraphs.some(text => text.trim())) return '«Sobre nosotros» necesita al menos un párrafo.';
    if (site.values.items.some(item => !item.word.trim() || !item.text.trim())) return 'Cada valor necesita palabra y texto.';
    if (site.about.facts.some(fact => !fact.label.trim() || !fact.value.trim())) return 'Cada dato del club necesita nombre y valor (o bórralo).';
    return '';
  }
  function validateSponsors(list) {
    for (const s of list) if (!String(s.name || '').trim()) return 'Hay un patrocinador sin nombre.';
    if (list.filter(s => s.tier === 'principal').length > 1) return 'Solo puede haber un patrocinador principal.';
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

  /* ---------------- piezas de formulario ---------------- */
  function photoUrl(path) {
    if (!path) return `${SITE}assets/logo.png`;
    return /^https?:/.test(path) ? path : `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`;
  }
  function field(label, html, full) {
    return `<div${full ? ' class="full"' : ''}><label>${label}</label>${html}</div>`;
  }
  function flagImg(country) {
    const code = countries[country];
    return code ? `<img class="flag" src="https://flagcdn.com/${code}.svg" alt="" />` : '';
  }
  function countrySelect(key, value) {
    const names = Object.keys(countries).sort((a, b) => a.localeCompare(b, 'es'));
    const unknown = value && !countries[value] ? `<option value="${esc(value)}" selected>${esc(value)} (sin bandera)</option>` : '';
    return `<span class="with-flag">${flagImg(value)}<select data-k="${key}"><option value="">—</option>${unknown}${names.map(name => `<option${name === value ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select></span>`;
  }
  /* Lista editable de filas: cada fila con ↑ ↓ ✕ y un botón para añadir. */
  function rows(list, prefix, renderRow, addLabel) {
    return `<div class="rows">${list.map((item, i) => `<div class="row">${renderRow(item, i)}
        <span class="row-actions">
          <button type="button" data-act="${prefix}-up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
          <button type="button" data-act="${prefix}-down" data-i="${i}" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button>
          <button type="button" data-act="${prefix}-del" data-i="${i}" class="danger" aria-label="Quitar">✕</button>
        </span></div>`).join('')}
      <button type="button" data-act="${prefix}-add" class="add">+ ${addLabel}</button></div>`;
  }
  function keepOpen(details, item) {
    details.open = state.open.has(item);
    details.addEventListener('toggle', () => (details.open ? state.open.add(item) : state.open.delete(item)));
  }

  /* ---------------- plantilla ---------------- */
  function playerType(p) {
    return p.role ? String(p.role).toLowerCase() : (String(p.dorsal).toUpperCase() === 'COACH' ? 'entrenador' : 'jugador');
  }

  function renderPlayers() {
    const wrap = $('#players-list');
    resetSaveLabels();
    wrap.innerHTML = '';
    const query = slugify(state.search);
    state.players.data.forEach((p, i) => {
      const type = playerType(p);
      const haystack = slugify(`${fullName(p.name)} ${p.nickname || ''} ${p.dorsal ?? ''} ${p.position || ''}`);
      if (query && !haystack.includes(query)) return;
      const pending = state.pendingUploads.get(p);
      const preview = pending ? URL.createObjectURL(pending.blob) : photoUrl(p.photo || (type === 'jugador' ? `assets/jugador${p.dorsal}.png` : ''));
      const slug = p.slug || slugify(fullName(p.name));
      const nats = p.nationalities || [];
      const trajectory = p.trajectory || [];
      const stats = Object.entries(p.stats || {});
      const details = document.createElement('details');
      details.className = 'item';
      details.innerHTML = `
        <summary>
          <img src="${esc(preview)}" alt="" onerror="this.src='${SITE}assets/logo.png'" />
          <strong>${esc(fullName(p.name) || 'Nueva persona')}</strong>
          ${p.nickname ? `<span class="muted">«${esc(p.nickname)}»</span>` : ''}
          ${p.captain ? '<span class="captain" title="Capitán">C</span>' : ''}
          <span class="flags">${nats.map(flagImg).join('')}</span>
          <span class="tag">${type === 'jugador' ? `Dorsal ${esc(p.dorsal ?? '?')} · ${esc(p.position || '')}` : esc(p.position || type)}</span>
          <span class="spacer">
            ${p.name ? `<a href="${SITE}jugadores/${esc(slug)}/" target="_blank" rel="noopener">Ver ficha</a>` : ''}
            <button type="button" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
            <button type="button" data-act="down" ${i === state.players.data.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button>
            <button type="button" data-act="delete" class="danger">Borrar</button>
          </span>
        </summary>
        <div class="fields">
          <h3 class="full">Datos básicos</h3>
          ${field('Tipo', `<select data-k="type">
              <option value="jugador"${type === 'jugador' ? ' selected' : ''}>Jugador</option>
              <option value="entrenador"${type === 'entrenador' ? ' selected' : ''}>Entrenador</option>
              <option value="directiva"${type === 'directiva' ? ' selected' : ''}>Directiva</option></select>`)}
          ${field('Nombre completo («Apellido, Nombre»)', `<input data-k="name" value="${esc(p.name)}" placeholder="Arias, Miguel" />`)}
          ${field('Apodo (tarjeta y espalda de la camiseta)', `<input data-k="nickname" value="${esc(p.nickname)}" placeholder="Opcional: Miguelín" />`)}
          ${type === 'jugador'
            ? field('Dorsal', `<input data-k="dorsal" type="number" min="1" max="99" value="${esc(p.dorsal)}" />`) +
              field('Posición', `<select data-k="position">${POSITIONS.map(([code, label]) => `<option value="${code}"${p.position === code ? ' selected' : ''}>${label} (${code})</option>`).join('')}</select>`) +
              field('Capitán', `<label class="check"><input type="checkbox" data-k="captain"${p.captain ? ' checked' : ''} /> Lleva el brazalete (escudito «C»)</label>`)
            : field('Cargo', `<input data-k="position" value="${esc(p.position)}" placeholder="${type === 'entrenador' ? 'ENTRENADOR' : 'COMMUNITY MANAGER'}" />`)}
          ${field('Se encarga de (opcional)', `<input data-k="duties" value="${esc(p.duties)}" placeholder="Redes sociales y web del club" />`)}
          ${field('Edad', `<input data-k="age" type="number" min="5" max="99" value="${esc(p.age)}" placeholder="Opcional" />`)}
          ${field('Foto', `<div class="photo-row"><img src="${esc(preview)}" alt="" onerror="this.src='${SITE}assets/logo.png'" /><div><input type="file" data-k="photo" accept="image/*" /><p class="hint">Mejor recortada con fondo transparente (PNG). Se convierte sola a WebP.</p>${p.photo ? `<p class="hint">Actual: ${esc(p.photo)} <button type="button" class="link" data-act="nophoto">quitar</button></p>` : ''}</div></div>`, true)}

          <h3 class="full">Nacionalidad</h3>
          ${field('Nacionalidad', countrySelect('nat0', nats[0]))}
          ${field('Segunda nacionalidad (opcional)', countrySelect('nat1', nats[1]))}

          <h3 class="full">Trayectoria <span class="hint">(de la etapa más antigua a la actual; la última suele ser «2025–actualidad · Bisontes DUX»)</span></h3>
          <div class="full">${rows(trajectory, 'traj', (item, n) => `<input data-k="traj.${n}" value="${esc(item)}" placeholder="2023–2025 · Club anterior" />`, 'Añadir etapa')}</div>

          <h3 class="full">Presentación</h3>
          ${field('Bio corta (sale en su ficha)', `<textarea data-k="bio" placeholder="Unas líneas sobre el jugador">${esc(p.bio)}</textarea>`, true)}

          <h3 class="full">Estadísticas <span class="hint">(opcional; p. ej. «Goles» · «7»)</span></h3>
          <div class="full">${rows(stats, 'stat', ([label, value], n) => `<input data-k="stat-label.${n}" value="${esc(label)}" placeholder="Goles" /><input data-k="stat-value.${n}" value="${esc(value)}" placeholder="7" />`, 'Añadir estadística')}</div>

          <h3 class="full">Redes sociales</h3>
          ${SOCIALS.map(([key, label]) => field(`${label} (enlace)`, `<input data-k="socials.${key}" type="url" value="${esc(p.socials?.[key])}" placeholder="https://…" />`)).join('')}
        </div>`;
      keepOpen(details, p);
      bindPlayer(details, p, i);
      wrap.appendChild(details);
    });
    if (!wrap.children.length) wrap.innerHTML = '<p class="muted">No hay nadie que coincida con la búsqueda.</p>';
  }

  function bindPlayer(details, p, i) {
    details.addEventListener('click', e => {
      const button = e.target.closest('[data-act]');
      if (!button) return;
      const act = button.dataset.act;
      const n = Number(button.dataset.i);
      e.preventDefault();
      const list = state.players.data;
      if (act === 'delete') {
        if (!confirm(`¿Borrar a ${fullName(p.name) || 'esta persona'}? Su ficha desaparecerá de la web al guardar.`)) return;
        list.splice(i, 1);
      } else if (act === 'up') move(list, i, i - 1);
      else if (act === 'down') move(list, i, i + 1);
      else if (act === 'nophoto') { delete p.photo; state.pendingUploads.delete(p); }
      else if (act.startsWith('traj-')) {
        p.trajectory = p.trajectory || [];
        if (act === 'traj-add') p.trajectory.push('');
        if (act === 'traj-del') p.trajectory.splice(n, 1);
        if (act === 'traj-up') move(p.trajectory, n, n - 1);
        if (act === 'traj-down') move(p.trajectory, n, n + 1);
        setOptional(p, 'trajectory', p.trajectory);
      } else if (act.startsWith('stat-')) {
        const entries = Object.entries(p.stats || {});
        if (act === 'stat-add') {
          let label = 'Nueva estadística';
          for (let k = 2; entries.some(([name]) => name === label); k++) label = `Nueva estadística ${k}`;
          entries.push([label, '']);
        }
        if (act === 'stat-del') entries.splice(n, 1);
        if (act === 'stat-up') move(entries, n, n - 1);
        if (act === 'stat-down') move(entries, n, n + 1);
        setOptional(p, 'stats', entries.length ? Object.fromEntries(entries) : '');
      } else return;
      markDirty('players');
      renderPlayers();
    });
    details.addEventListener('change', async e => {
      const key = e.target.dataset.k;
      if (!key) return;
      const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value.trim();
      let repaint = false;
      if (key === 'type') {
        if (value === 'jugador') { delete p.role; p.dorsal = ''; p.position = 'MC'; }
        else { p.role = value; delete p.dorsal; delete p.captain; p.position = value === 'entrenador' ? 'ENTRENADOR' : 'COMMUNITY MANAGER'; }
        repaint = true;
      } else if (key === 'photo') {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const blob = await toWebp(file, 900);
          const slug = p.slug || slugify(fullName(p.name)) || 'persona';
          state.pendingUploads.set(p, { field: 'photo', blob, name: `${slug}-${Date.now()}.webp`, kind: 'players' });
          setStatus('Foto preparada. Se subirá al guardar.');
        } catch (error) { setStatus(error.message, 'err'); return; }
        repaint = true;
      } else if (key === 'dorsal') { p.dorsal = value === '' ? '' : Number(value); repaint = true; }
      else if (key === 'age') setOptional(p, 'age', value === '' ? '' : Number(value));
      else if (key === 'captain') { setOptional(p, 'captain', value); repaint = true; }
      else if (key === 'nat0' || key === 'nat1') {
        const nats = [...(p.nationalities || [])];
        nats[key === 'nat0' ? 0 : 1] = value;
        setOptional(p, 'nationalities', nats.filter(Boolean));
        repaint = true;
      } else if (key.startsWith('traj.')) {
        p.trajectory[Number(key.split('.')[1])] = value;
      } else if (key.startsWith('stat-')) {
        const entries = Object.entries(p.stats || {});
        const n = Number(key.split('.')[1]);
        if (key.startsWith('stat-label.')) entries[n][0] = value;
        else entries[n][1] = value;
        p.stats = Object.fromEntries(entries);
      } else if (key.startsWith('socials.')) {
        const network = key.split('.')[1];
        p.socials = p.socials || {};
        setOptional(p.socials, network, value);
        if (!Object.keys(p.socials).length) delete p.socials;
      } else if (key === 'name') { p.name = value; repaint = true; }
      else if (key === 'position') { p.position = value.toUpperCase(); repaint = true; }
      else { setOptional(p, key, value); repaint = key === 'nickname'; }
      markDirty('players');
      if (repaint) renderPlayers();
    });
  }

  /* Al guardar, las filas vacías no se guardan. */
  function tidyPlayers() {
    for (const p of state.players.data) {
      if (p.trajectory) setOptional(p, 'trajectory', p.trajectory.map(t => String(t).trim()).filter(Boolean));
      if (p.stats) {
        const entries = Object.entries(p.stats).filter(([label, value]) => String(label).trim() && String(value).trim());
        setOptional(p, 'stats', entries.length ? Object.fromEntries(entries) : '');
      }
    }
  }

  /* ---------------- textos de la web ---------------- */
  function siteInput(path, value, options = {}) {
    return options.area
      ? `<textarea data-site="${path}" rows="${options.rows || 3}">${esc(value)}</textarea>`
      : `<input data-site="${path}" value="${esc(value)}" />`;
  }

  function renderSite() {
    const s = state.site.data;
    const box = $('#site-form');
    if (!s.about) { box.innerHTML = ''; return; }
    box.innerHTML = `
      <section class="block">
        <h3>Portada</h3>
        ${field('Frase bajo «Bisontes DUX»', siteInput('hero.tagline', s.hero ? s.hero.tagline : ''), true)}
      </section>
      <section class="block">
        <h3>Sobre nosotros</h3>
        ${field('Título', siteInput('about.title', s.about.title), true)}
        <label>Párrafos (el primero sale más grande)</label>
        ${rows(s.about.paragraphs, 'site:about.paragraphs', (text, n) => siteInput(`about.paragraphs.${n}`, text, { area: true }), 'Añadir párrafo')}
        <label>Datos del club (la «etiqueta» de la derecha)</label>
        ${rows(s.about.facts, 'site:about.facts', (fact, n) => `${siteInput(`about.facts.${n}.label`, fact.label)}${siteInput(`about.facts.${n}.value`, fact.value, { area: true, rows: 2 })}`, 'Añadir dato')}
      </section>
      <section class="block">
        <h3>Plantilla</h3>
        ${field('Título', siteInput('roster.title', s.roster.title), true)}
        ${field('Entradilla', siteInput('roster.intro', s.roster.intro, { area: true }), true)}
      </section>
      <section class="block">
        <h3>Valores</h3>
        ${field('Título', siteInput('values.title', s.values.title), true)}
        ${rows(s.values.items, 'site:values.items', (item, n) => `${siteInput(`values.items.${n}.word`, item.word)}${siteInput(`values.items.${n}.text`, item.text, { area: true })}`, 'Añadir valor')}
      </section>
      <section class="block">
        <h3>Patrocinadores (portada)</h3>
        ${field('Título', siteInput('sponsors.title', s.sponsors.title), true)}
        ${field('Entradilla', siteInput('sponsors.intro', s.sponsors.intro, { area: true }), true)}
      </section>
      <section class="block">
        <h3>Instagram</h3>
        ${field('Título', siteInput('instagram.title', s.instagram.title), true)}
        ${field('Texto', siteInput('instagram.text', s.instagram.text, { area: true }), true)}
      </section>
      <section class="block">
        <h3>Quiero jugar</h3>
        ${field('Título', siteInput('join.title', s.join.title), true)}
        ${field('Texto', siteInput('join.text', s.join.text, { area: true }), true)}
      </section>
      <section class="block">
        <h3>Newsletter</h3>
        ${field('Título', siteInput('newsletter.title', s.newsletter.title), true)}
      </section>`;
  }

  function sitePath(path) {
    const keys = path.split('.');
    let target = state.site.data;
    for (const key of keys.slice(0, -1)) target = target[key];
    return { target, key: keys[keys.length - 1] };
  }

  $('#site-form').addEventListener('change', e => {
    const path = e.target.dataset.site;
    if (!path) return;
    const { target, key } = sitePath(path);
    target[key] = e.target.value.trim();
    markDirty('site');
  });
  $('#site-form').addEventListener('click', e => {
    const button = e.target.closest('[data-act^="site:"]');
    if (!button) return;
    e.preventDefault();
    const [, rest] = button.dataset.act.split(':');
    const action = rest.slice(rest.lastIndexOf('-') + 1);
    const listPath = rest.slice(0, rest.lastIndexOf('-'));
    const { target, key } = sitePath(listPath);
    const list = target[key];
    const n = Number(button.dataset.i);
    if (action === 'add') list.push(listPath.endsWith('facts') ? { label: '', value: '' } : listPath.endsWith('items') ? { word: '', text: '' } : '');
    if (action === 'del') list.splice(n, 1);
    if (action === 'up') move(list, n, n - 1);
    if (action === 'down') move(list, n, n + 1);
    markDirty('site');
    renderSite();
  });

  /* ---------------- patrocinadores ---------------- */
  function renderSponsors() {
    const wrap = $('#sponsors-list');
    wrap.innerHTML = '';
    state.sponsors.data.forEach((s, i) => {
      const pending = state.pendingUploads.get(s);
      const logo = pending ? URL.createObjectURL(pending.blob) : (s.logo ? photoUrl(s.logo) : '');
      const details = document.createElement('details');
      details.className = 'item';
      details.innerHTML = `
        <summary>
          ${logo ? `<img src="${esc(logo)}" alt="" class="logo" />` : ''}
          <strong>${esc(s.name || 'Nuevo patrocinador')}</strong>
          <span class="tag">${s.tier === 'principal' ? 'Principal' : 'Colaborador'}</span>
          <span class="spacer">
            <button type="button" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
            <button type="button" data-act="down" ${i === state.sponsors.data.length - 1 ? 'disabled' : ''} aria-label="Bajar">↓</button>
            <button type="button" data-act="delete" class="danger">Borrar</button>
          </span>
        </summary>
        <div class="fields">
          ${field('Nombre', `<input data-k="name" value="${esc(s.name)}" />`)}
          ${field('Tipo', `<select data-k="tier"><option value="principal"${s.tier === 'principal' ? ' selected' : ''}>Patrocinador principal</option><option value="colaborador"${s.tier !== 'principal' ? ' selected' : ''}>Colaborador</option></select>`)}
          ${field('Web o Instagram (enlace)', `<input data-k="url" type="url" value="${esc(s.url)}" placeholder="https://…" />`)}
          ${field('Descripción (una frase)', `<textarea data-k="description">${esc(s.description)}</textarea>`, true)}
          ${field('Logo', `<div class="photo-row">${logo ? `<img src="${esc(logo)}" alt="" />` : ''}<div><input type="file" data-k="logo" accept="image/*" /><p class="hint">PNG o SVG con fondo transparente, unos 200×80 px.</p></div></div>`, true)}
        </div>`;
      keepOpen(details, s);
      details.addEventListener('click', e => {
        const button = e.target.closest('[data-act]');
        if (!button) return;
        e.preventDefault();
        const list = state.sponsors.data;
        if (button.dataset.act === 'delete') {
          if (!confirm(`¿Borrar a ${s.name || 'este patrocinador'}?`)) return;
          list.splice(i, 1);
        } else if (button.dataset.act === 'up') move(list, i, i - 1);
        else if (button.dataset.act === 'down') move(list, i, i + 1);
        markDirty('sponsors');
        renderSponsors();
      });
      details.addEventListener('change', async e => {
        const key = e.target.dataset.k;
        if (!key) return;
        if (key === 'logo') {
          const file = e.target.files[0];
          if (!file) return;
          try {
            const blob = await toWebp(file, 600);
            state.pendingUploads.set(s, { field: 'logo', blob, name: `${slugify(s.name) || 'patrocinador'}-${Date.now()}.webp`, kind: 'sponsors' });
            setStatus('Logo preparado. Se subirá al guardar.');
          } catch (error) { setStatus(error.message, 'err'); return; }
        } else s[key] = e.target.value.trim();
        markDirty('sponsors');
        if (key === 'name' || key === 'tier' || key === 'logo') renderSponsors();
      });
      wrap.appendChild(details);
    });
  }

  /* ---------------- blog ---------------- */
  function renderPosts() {
    const wrap = $('#posts-list');
    wrap.innerHTML = '';
    if (!state.blog.data.length) wrap.innerHTML = '<p class="muted">Todavía no hay entradas.</p>';
    state.blog.data.forEach((post, i) => {
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
      keepOpen(details, post);
      details.addEventListener('click', e => {
        const button = e.target.closest('[data-act]');
        if (!button) return;
        e.preventDefault();
        if (button.dataset.act === 'delete') {
          if (!confirm(`¿Borrar la entrada «${post.title || 'sin título'}»?`)) return;
          state.blog.data.splice(i, 1);
        } else if (button.dataset.act === 'nocover') { delete post.cover; delete post.coverAlt; state.pendingUploads.delete(post); }
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
            state.pendingUploads.set(post, { field: 'cover', blob, name: `${post.slug || slugify(post.title) || 'entrada'}-${Date.now()}.webp`, kind: 'blog' });
            setStatus('Portada preparada. Se subirá al guardar.');
          } catch (error) { setStatus(error.message, 'err'); return; }
        } else if (key === 'body') post.body = e.target.value.split(/\n\s*\n/).map(v => v.trim()).filter(Boolean);
        else if (key === 'title') post.title = value;
        else setOptional(post, key, value);
        markDirty('blog');
        if (key === 'title' || key === 'date' || key === 'cover') renderPosts();
      });
      wrap.appendChild(details);
    });
  }

  /* ---------------- arranque ---------------- */
  async function enter(session) {
    const { data: isAdmin, error } = await client.rpc('gallery_is_admin');
    if (error) throw error;
    if (isAdmin !== true) {
      await client.auth.signOut({ scope: 'local' });
      throw new Error('Tu cuenta no es admin. Pide a un admin que te dé permiso en «Accesos» de la galería privada.');
    }
    showPanel(`Conectado como ${session.user.email}`);
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
    try {
      if (!client) throw new Error('No se ha podido conectar con Supabase.');
      const { data, error } = await client.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value });
      if (error) throw new Error(/Invalid login/i.test(error.message) ? 'Correo o contraseña incorrectos.' : error.message);
      await enter(data.session);
    } catch (error) {
      status.textContent = error.message;
      status.className = 'status err';
    }
  });

  $('#logout').addEventListener('click', async () => {
    await client.auth.signOut({ scope: 'local' });
    location.reload();
  });

  document.querySelectorAll('[data-tab]').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach(t => t.setAttribute('aria-selected', String(t === tab)));
    for (const kind of Object.keys(FILES)) $(`#tab-${kind}`).hidden = tab.dataset.tab !== kind;
  }));

  $('#players-search').addEventListener('input', e => {
    state.search = e.target.value;
    renderPlayers();
  });
  $('#add-player').addEventListener('click', () => {
    const player = { dorsal: '', name: '', position: 'MC' };
    state.players.data.push(player);
    state.open.add(player);
    state.search = '';
    $('#players-search').value = '';
    markDirty('players');
    renderPlayers();
    $('#players-list').lastElementChild.scrollIntoView({ block: 'center' });
  });
  $('#add-sponsor').addEventListener('click', () => {
    const sponsor = { tier: 'colaborador', name: '', description: '', logo: '', url: '' };
    state.sponsors.data.push(sponsor);
    state.open.add(sponsor);
    markDirty('sponsors');
    renderSponsors();
    $('#sponsors-list').lastElementChild.scrollIntoView({ block: 'center' });
  });
  $('#add-post').addEventListener('click', () => {
    const post = { title: '', date: today(), excerpt: '', body: [] };
    state.blog.data.unshift(post);
    state.open.add(post);
    markDirty('blog');
    renderPosts();
  });
  document.querySelectorAll('[data-save]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.save === 'players') tidyPlayers();
    save(button.dataset.save);
  }));

  window.addEventListener('beforeunload', e => {
    if (Object.keys(FILES).some(kind => state[kind].dirty)) { e.preventDefault(); e.returnValue = ''; }
  });

  if (client) {
    client.auth.getSession().then(({ data }) => {
      if (data.session) enter(data.session).catch(error => setLoginError(error.message));
    });
  }
  function setLoginError(message) {
    const status = $('#login-status');
    status.textContent = message;
    status.className = 'status err';
  }
}());
