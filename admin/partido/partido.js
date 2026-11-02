/* ============================================================
   BISONTES DUX — partido en directo (/admin/partido/)
   · Partidos, 11 inicial y eventos se guardan en data/partidos.js
     (GitHub) a través de la función admin-github, como el resto
     del panel. Cada acción entra en una cola en el propio móvil:
     si se cae la cobertura en el campo, se guarda al volver.
   · Las fotos van a la galería (Supabase), con el partido puesto.
   · Cada evento genera su historia (historias.js) y, si está
     activada la publicación automática, se publica en Instagram
     con la función instagram-story. Si no, se comparte a mano.
   ============================================================ */
(function () {
  'use strict';

  const SITE = '/';
  const DATA_PATH = 'data/partidos.js';
  const QUEUE_KEY = 'bisontes-partido-cola';
  const PLAYERS_KEY = 'bisontes-partido-plantilla';
  const AUTO_KEY = 'bisontes-partido-auto';
  const BUCKET_PRIVATE = 'galeria-privada';
  const BUCKET_PUBLIC = 'galeria-publica';
  const POSITION_ORDER = ['POR', 'DFC', 'LI', 'LD', 'MC', 'MCO', 'EI', 'ED', 'DC'];
  const STATE_LABEL = { previa: 'Por empezar', primera: '1.ª parte', descanso: 'Descanso', segunda: '2.ª parte', final: 'Final' };
  const REASONS = ['Fuera de juego', 'Falta'];
  const H = window.BisontesHistorias;

  const config = window.BISONTES_GALERIA || {};
  const client = window.supabase && config.supabaseUrl
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'bisontes-galeria' } })
    : null;

  const $ = sel => document.querySelector(sel);
  const state = {
    server: { list: [], header: '', sha: null, loaded: false },
    ops: loadQueue(),
    people: new Map(),     /* slug → persona de la plantilla */
    current: null,         /* id del partido abierto */
    tab: 'live',
    draftLineup: null,     /* 11 inicial que se está montando (sin guardar) */
    photos: new Map(),     /* partido → fotos de la galería */
    thumbs: new Map(),     /* ruta → URL firmada */
    stories: new Map(),    /* evento → JPG generado (para compartir sin volver a dibujarlo) */
    syncing: false,
    syncError: ''
  };

  /* ---------------- utilidades ---------------- */
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
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
  function slugify(value) {
    return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  function fullName(name) {
    const parts = String(name || '').split(',').map(p => p.trim());
    return parts.length > 1 ? `${parts.slice(1).join(' ')} ${parts[0]}` : parts[0];
  }
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  let toastTimer;
  function toast(message, isError) {
    const el = $('#toast');
    el.textContent = message;
    el.className = `toast${isError ? ' err' : ''}`;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, isError ? 6000 : 3000);
  }
  function loadQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveQueue() {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(state.ops)); } catch (e) { /* sin almacenamiento */ }
  }
  function autoPublish() {
    try { return localStorage.getItem(AUTO_KEY) !== 'no'; } catch (e) { return true; }
  }
  function when(iso) {
    if (!iso) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }

  /* ---------------- GitHub (función admin-github) ---------------- */
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
  function parseDataFile(text, variable) {
    const index = text.indexOf(`const ${variable}`);
    if (index === -1) throw new Error(`No encuentro "const ${variable}" en ${variable}`);
    return { header: text.slice(0, index), data: new Function(`${text}\n;return ${variable};`)() };
  }

  /* ---------------- plantilla ---------------- */
  function setPeople(list) {
    state.people = new Map();
    list.forEach(p => {
      const name = fullName(p.name);
      const slug = p.slug || slugify(name);
      const surname = String(p.name || '').split(',')[0].trim();
      state.people.set(slug, {
        slug, name, short: p.nickname || surname, dorsal: p.role ? null : p.dorsal,
        position: p.position, staff: Boolean(p.role), photo: p.photo || (p.role ? '' : `assets/jugador${p.dorsal}.png`)
      });
    });
  }
  async function loadPeople() {
    try {
      const cached = JSON.parse(localStorage.getItem(PLAYERS_KEY) || 'null');
      if (cached) setPeople(cached);
    } catch (e) { /* nada */ }
    const file = await readFile('data/players.js');
    const list = parseDataFile(file.text, 'players').data;
    setPeople(list);
    try { localStorage.setItem(PLAYERS_KEY, JSON.stringify(list)); } catch (e) { /* nada */ }
  }
  function players() {
    return [...state.people.values()].filter(p => !p.staff)
      .sort((a, b) => (POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position)) || ((a.dorsal || 0) - (b.dorsal || 0)));
  }
  function person(slug) {
    return state.people.get(slug) || { slug, short: slug || '?', name: slug || '?' };
  }

  /* ---------------- operaciones (cola) ---------------- */
  /* Cada cambio es una operación idempotente: se aplica sobre la última
     versión de GitHub, así dos móviles a la vez no se pisan. */
  function applyOp(list, op) {
    const match = list.find(m => m.id === op.match);
    const event = match && op.event ? match.eventos.find(e => e.id === op.event) : null;
    switch (op.type) {
      case 'create':
        if (!match) list.push(op.data);
        break;
      case 'edit':
        if (match) Object.assign(match, op.data);
        break;
      case 'delete': {
        const index = list.findIndex(m => m.id === op.match);
        if (index !== -1) list.splice(index, 1);
        break;
      }
      case 'lineup':
        if (match) match.once = op.data;
        break;
      case 'state':
        if (match) {
          match.estado = op.data.estado;
          match.tiempos = match.tiempos || {};
          const key = { primera: 'inicio', descanso: 'descanso', segunda: 'reanuda', final: 'final' }[op.data.estado];
          if (key) match.tiempos[key] = op.data.en;
          if (!match.eventos.some(e => e.id === op.data.evento.id)) match.eventos.push(op.data.evento);
        }
        break;
      case 'event':
        if (match && !match.eventos.some(e => e.id === op.data.id)) match.eventos.push(op.data);
        break;
      case 'void':
        if (event) event.anulado = op.data;
        break;
      case 'photo':
        if (event) event.foto = op.data;
        break;
      case 'remove':
        if (match) match.eventos = match.eventos.filter(e => e.id !== op.event);
        break;
      case 'story':
        if (event) event.historia = op.data;
        else if (match && op.event === 'once' && match.once) match.once.historia = op.data;
        break;
      default:
        break;
    }
    return list;
  }
  function view() {
    const list = clone(state.server.list);
    state.ops.forEach(op => applyOp(list, op));
    return list;
  }
  function currentMatch() {
    return view().find(m => m.id === state.current) || null;
  }
  function addOp(op) {
    op.id = uid('op');
    state.ops.push(op);
    saveQueue();
    render();
    sync();
  }

  function describe(op) {
    return { create: 'nuevo partido', edit: 'datos del partido', delete: 'borra partido', lineup: '11 inicial', state: `estado ${op.data && op.data.estado}`, event: 'evento', void: 'gol anulado', photo: 'foto del evento', remove: 'borra evento', story: 'historia' }[op.type] || op.type;
  }

  async function sync() {
    if (state.syncing || !state.ops.length) { renderSync(); return; }
    state.syncing = true;
    renderSync();
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const pending = state.ops.slice();
        const file = await readFile(DATA_PATH);
        const parsed = parseDataFile(file.text, 'partidos');
        const list = parsed.data;
        pending.forEach(op => applyOp(list, op));
        const text = `${parsed.header}const partidos = ${JSON.stringify(list, null, 2)};\n`;
        try {
          const result = await callGithub({ action: 'write', path: DATA_PATH, content: b64encode(text), sha: file.sha, message: `partido: ${pending.map(describe).join(', ')}` });
          state.server = { list, header: parsed.header, sha: result.sha, loaded: true };
          const done = new Set(pending.map(op => op.id));
          state.ops = state.ops.filter(op => !done.has(op.id));
          saveQueue();
          state.syncError = '';
          if (!state.ops.length) break;
        } catch (error) {
          if (error.status === 409 || error.status === 422) continue; /* otro móvil guardó antes: se reintenta encima */
          throw error;
        }
      }
    } catch (error) {
      state.syncError = navigator.onLine ? error.message : 'sin conexión';
      setTimeout(sync, navigator.onLine ? 8000 : 4000);
    } finally {
      state.syncing = false;
      renderSync();
      render();
    }
    if (state.ops.length && !state.syncError) sync();
  }
  window.addEventListener('online', () => sync());

  async function loadMatches() {
    const file = await readFile(DATA_PATH);
    const parsed = parseDataFile(file.text, 'partidos');
    state.server = { list: parsed.data, header: parsed.header, sha: file.sha, loaded: true };
  }

  /* ---------------- reloj y marcador ---------------- */
  function score(match) {
    const s = { favor: 0, contra: 0 };
    (match.eventos || []).forEach(e => {
      if (e.anulado) return;
      if (e.tipo === 'gol') s.favor++;
      if (e.tipo === 'gol_contra') s.contra++;
      if (e.tipo === 'penalti' && e.resultado === 'gol') s[e.lado === 'favor' ? 'favor' : 'contra']++;
    });
    return s;
  }
  function minuteNow(match) {
    const t = match.tiempos || {};
    const half = Number(match.parte) || 45;
    const since = iso => Math.floor((Date.now() - new Date(iso).getTime()) / 60000) + 1;
    if (match.estado === 'primera' && t.inicio) {
      const m = since(t.inicio);
      return m > half ? `${half}+${m - half}'` : `${m}'`;
    }
    if (match.estado === 'segunda' && t.reanuda) {
      const m = half + since(t.reanuda);
      return m > half * 2 ? `${half * 2}+${m - half * 2}'` : `${m}'`;
    }
    if (match.estado === 'descanso') return `${half}'`;
    return '';
  }

  /* ---------------- historias ---------------- */
  function storyData(match, event) {
    const s = score(match);
    const base = { match, score: s, minute: event.minuto || '' };
    if (event.tipo === 'estado') return { ...base, kind: event.valor === 'primera' ? 'inicio' : event.valor };
    if (event.tipo === 'gol') {
      return { ...base, kind: event.anulado ? 'anulado' : 'gol', player: person(event.jugador).short, extra: event.anulado ? `Motivo: ${event.anulado.motivo.toLowerCase()}` : (event.asistente ? `Asistencia de ${person(event.asistente).short}` : '') };
    }
    if (event.tipo === 'gol_contra') return { ...base, kind: event.anulado ? 'anulado' : 'gol_contra', player: event.anulado ? (match.rival || 'Rival') : '', extra: event.anulado ? `Motivo: ${event.anulado.motivo.toLowerCase()}` : '' };
    if (event.tipo === 'tarjeta') return { ...base, kind: event.tarjeta, player: person(event.jugador).short };
    if (event.tipo === 'penalti') {
      const forUs = event.lado === 'favor';
      if (event.anulado) return { ...base, kind: 'anulado', player: forUs ? person(event.jugador).short : (match.rival || 'Rival'), extra: `Penalti · motivo: ${event.anulado.motivo.toLowerCase()}` };
      if (forUs && event.resultado === 'gol') return { ...base, kind: 'gol', player: person(event.jugador).short, extra: 'De penalti' };
      return { ...base, kind: 'penalti', player: forUs ? person(event.jugador).short : '', extra: `${forUs ? 'A favor' : 'En contra'} · ${event.resultado === 'gol' ? 'gol' : 'fallado'}` };
    }
    return null;
  }
  function needsStory(event) {
    if (event.tipo === 'estado') return ['primera', 'descanso', 'final'].includes(event.valor);
    return ['gol', 'gol_contra', 'tarjeta', 'penalti'].includes(event.tipo);
  }

  async function photoFor(event) {
    if (event.fotoLocal) return event.fotoLocal;
    if (!event.foto) return null;
    const { data } = await client.storage.from(BUCKET_PRIVATE).createSignedUrl(event.foto, 600);
    return data ? H.loadImage(data.signedUrl) : null;
  }

  /* Dibuja, sube y (si toca) publica la historia de un evento. */
  async function makeStory(matchId, eventId, photo) {
    const match = view().find(m => m.id === matchId);
    if (!match) return;
    let blob;
    let data;
    if (eventId === 'once') {
      data = { kind: 'once', match, lineup: match.once, people: state.people };
    } else {
      const event = match.eventos.find(e => e.id === eventId);
      if (!event) return;
      data = storyData(match, event);
      if (!data) return;
      data.photo = photo !== undefined ? photo : await photoFor(event);
    }
    try {
      blob = await H.render(data);
    } catch (error) {
      toast(`No se pudo crear la historia: ${error.message}`, true);
      return;
    }
    state.stories.set(eventId === 'once' ? `${matchId}-once` : eventId, blob);
    const path = `historias/${matchId}/${eventId}-${Date.now().toString(36)}.jpg`;
    let story = { estado: 'lista', en: new Date().toISOString() };
    try {
      const { error } = await client.storage.from(BUCKET_PUBLIC).upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
      story.ruta = path;
      if (autoPublish() && eventId !== 'once') {
        const url = client.storage.from(BUCKET_PUBLIC).getPublicUrl(path).data.publicUrl;
        const { error: fnError } = await client.functions.invoke('instagram-story', { body: { image_url: url } });
        if (fnError) {
          let detail = fnError.message;
          /* 404: la función aún no está desplegada; 501: falta la llave de Instagram. */
          let notConfigured = Boolean(fnError.context && fnError.context.status === 404);
          try { const body = await fnError.context.json(); detail = body.error || detail; notConfigured = notConfigured || Boolean(body.notConfigured); } catch (e) { /* sin detalle */ }
          story = notConfigured ? { ...story, estado: 'lista', aviso: 'Instagram sin conectar' } : { ...story, estado: 'error', error: detail };
          toast(notConfigured ? 'Historia lista. Instagram aún no está conectado: compártela a mano.' : detail, !notConfigured);
        } else {
          story.estado = 'publicada';
          toast('Historia publicada en Instagram ✓');
        }
      } else {
        toast('Historia lista para compartir');
      }
    } catch (error) {
      story = { ...story, estado: 'error', error: navigator.onLine ? (error.message || 'error al subir') : 'sin conexión' };
      toast(`Historia sin subir: ${story.error}. Puedes compartirla a mano.`, true);
    }
    addOp({ type: 'story', match: matchId, event: eventId, data: story });
  }

  async function storyBlob(matchId, eventId) {
    const key = eventId === 'once' ? `${matchId}-once` : eventId;
    if (state.stories.has(key)) return state.stories.get(key);
    const match = view().find(m => m.id === matchId);
    const event = eventId === 'once' ? match.once : match.eventos.find(e => e.id === eventId);
    if (event && event.historia && event.historia.ruta) {
      const url = client.storage.from(BUCKET_PUBLIC).getPublicUrl(event.historia.ruta).data.publicUrl;
      const blob = await (await fetch(url)).blob();
      state.stories.set(key, blob);
      return blob;
    }
    return null;
  }

  async function shareStory(matchId, eventId) {
    const blob = await storyBlob(matchId, eventId);
    if (!blob) { toast('Todavía no hay historia para este evento.', true); return; }
    const file = new File([blob], 'historia-bisontes.jpg', { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  }

  async function previewStory(matchId, eventId) {
    const blob = await storyBlob(matchId, eventId);
    if (!blob) { toast('Todavía no hay historia para este evento.', true); return; }
    openSheet(`<h2>Historia</h2><img class="story-preview" src="${URL.createObjectURL(blob)}" alt="Vista previa de la historia" />
      <div class="sheet-actions"><button type="button" value="close">Cerrar</button><button type="button" class="primary" data-share>Compartir</button></div>`,
    sheet => sheet.querySelector('[data-share]').addEventListener('click', () => shareStory(matchId, eventId)));
  }

  /* ---------------- fotos (galería) ---------------- */
  async function decodeImage(file) {
    if ('createImageBitmap' in window) {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
      } catch (e) { /* se prueba con <img> */ }
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    try { await image.decode(); } catch (e) {
      URL.revokeObjectURL(url);
      throw new Error(`No se puede leer «${file.name}». Si es HEIC, guárdala como JPG.`);
    }
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
  }
  function encode(picture, maxSide, type, quality) {
    const scale = Math.min(1, maxSide / Math.max(picture.width, picture.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(picture.width * scale));
    canvas.height = Math.max(1, Math.round(picture.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(picture.source, 0, 0, canvas.width, canvas.height);
    const toBlob = format => new Promise(resolve => canvas.toBlob(resolve, format, quality));
    return toBlob(type).then(async blob => {
      if (blob && blob.type !== type) blob = await toBlob('image/jpeg');
      if (!blob) throw new Error('No se ha podido preparar la foto.');
      return { blob, width: canvas.width, height: canvas.height, canvas };
    });
  }

  /* Sube la foto a la galería privada con el partido puesto. Devuelve la
     ruta grande y una versión en memoria para dibujar la historia ya. */
  async function uploadPhoto(match, file, playersInPhoto) {
    const picture = await decodeImage(file);
    let full;
    let thumb;
    try {
      full = await encode(picture, 2048, 'image/jpeg', 0.86);
      thumb = await encode(picture, 720, 'image/webp', 0.8);
    } finally { picture.release(); }
    const id = crypto.randomUUID();
    const ext = blob => (blob.type === 'image/webp' ? 'webp' : 'jpg');
    const fullPath = `${id}/full.${ext(full.blob)}`;
    const thumbPath = `${id}/thumb.${ext(thumb.blob)}`;
    for (const [path, item] of [[fullPath, full], [thumbPath, thumb]]) {
      const { error } = await client.storage.from(BUCKET_PRIVATE).upload(path, item.blob, { contentType: item.blob.type, cacheControl: '31536000', upsert: false });
      if (error) throw error;
    }
    const { data, error } = await client.from('gallery_photos').insert({
      id, full_path: fullPath, thumb_path: thumbPath, width: full.width, height: full.height,
      event: match.galeria, taken_on: (match.fecha || new Date().toISOString()).slice(0, 10), players: playersInPhoto || [], is_public: false
    }).select().single();
    if (error) throw error;
    const list = state.photos.get(match.id) || [];
    list.unshift(data);
    state.photos.set(match.id, list);
    return { path: fullPath, canvas: full.canvas };
  }

  async function loadPhotos(match, force) {
    if (!force && state.photos.has(match.id)) return state.photos.get(match.id);
    const { data, error } = await client.from('gallery_photos').select('*').eq('event', match.galeria).order('created_at', { ascending: false }).limit(60);
    if (error) throw error;
    state.photos.set(match.id, data || []);
    const missing = (data || []).map(p => p.thumb_path).filter(p => !state.thumbs.has(p));
    if (missing.length) {
      const { data: signed } = await client.storage.from(BUCKET_PRIVATE).createSignedUrls(missing, 3600);
      (signed || []).forEach(s => { if (s.signedUrl) state.thumbs.set(s.path, s.signedUrl); });
    }
    return data || [];
  }

  /* ---------------- hoja inferior ---------------- */
  function openSheet(html, bind) {
    const dialog = $('#sheet');
    $('#sheet-body').innerHTML = html;
    dialog.querySelectorAll('[value="close"]').forEach(b => b.addEventListener('click', () => dialog.close()));
    if (bind) bind(dialog);
    if (!dialog.open) dialog.showModal();
  }
  function closeSheet() { $('#sheet').close(); }

  /* Selector de jugadores: primero los del 11, luego banquillo y resto. */
  function pickerHtml(match, name, selected, options = {}) {
    const lineup = match.once || { titulares: [], suplentes: [] };
    const starters = (lineup.titulares || []).filter(Boolean);
    const bench = (lineup.suplentes || []).filter(s => !starters.includes(s));
    const rest = players().map(p => p.slug).filter(s => !starters.includes(s) && !bench.includes(s));
    const button = slug => {
      const p = person(slug);
      if (options.exclude && options.exclude.includes(slug)) return '';
      return `<button type="button" data-pick="${name}" data-value="${esc(slug)}" aria-pressed="${selected === slug}"><b>${esc(p.dorsal ?? '')}</b>${esc(p.short)}</button>`;
    };
    let html = options.none ? `<button type="button" data-pick="${name}" data-value="" aria-pressed="${!selected}">${esc(options.none)}</button>` : '';
    if (starters.length) html += `<span class="group">En el campo</span>${starters.map(button).join('')}`;
    if (bench.length) html += `<span class="group">Banquillo</span>${bench.map(button).join('')}`;
    html += `<span class="group">${starters.length ? 'Resto de la plantilla' : 'Plantilla'}</span>${rest.map(button).join('')}`;
    return `<div class="picker" data-group="${name}">${html}</div>`;
  }
  function bindPickers(root, values) {
    root.querySelectorAll('[data-pick]').forEach(btn => btn.addEventListener('click', () => {
      const name = btn.dataset.pick;
      values[name] = btn.dataset.value;
      root.querySelectorAll(`[data-pick="${name}"]`).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      if (values.onChange) values.onChange(name);
    }));
  }
  function choiceHtml(name, options, selected) {
    return `<div class="choice">${options.map(([value, label]) => `<button type="button" data-choice="${name}" data-value="${esc(value)}" aria-pressed="${selected === value}">${esc(label)}</button>`).join('')}</div>`;
  }
  function bindChoices(root, values) {
    root.querySelectorAll('[data-choice]').forEach(btn => btn.addEventListener('click', () => {
      values[btn.dataset.choice] = btn.dataset.value;
      root.querySelectorAll(`[data-choice="${btn.dataset.choice}"]`).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      if (values.onChange) values.onChange(btn.dataset.choice);
    }));
  }

  /* Foto opcional para la historia: hacerla ahora o elegir una del partido. */
  function photoFieldHtml(match) {
    const list = state.photos.get(match.id) || [];
    const thumbs = list.slice(0, 12).map(p => state.thumbs.has(p.thumb_path)
      ? `<button type="button" data-photo="${esc(p.full_path)}" aria-pressed="false"><img src="${esc(state.thumbs.get(p.thumb_path))}" alt="" /></button>` : '').join('');
    return `<label>Foto de fondo (opcional)</label>
      <label class="file-btn">Hacer o subir foto<input type="file" accept="image/*" capture="environment" data-photo-file /></label>
      ${thumbs ? `<p class="muted">O elige una del partido:</p><div class="thumbs">${thumbs}</div>` : ''}`;
  }
  function bindPhotoField(root, values) {
    root.querySelectorAll('[data-photo]').forEach(btn => btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      root.querySelectorAll('[data-photo]').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', String(on));
      values.photoPath = on ? btn.dataset.photo : '';
      values.photoFile = null;
    }));
    const input = root.querySelector('[data-photo-file]');
    if (input) input.addEventListener('change', () => {
      values.photoFile = input.files[0] || null;
      values.photoPath = '';
      root.querySelectorAll('[data-photo]').forEach(b => b.setAttribute('aria-pressed', 'false'));
      input.closest('.file-btn').firstChild.textContent = values.photoFile ? `Foto: ${values.photoFile.name}` : 'Hacer o subir foto';
    });
  }

  /* Registra el evento, y en segundo plano sube la foto y hace la historia. */
  async function registerEvent(match, event, values) {
    event.id = uid('ev');
    event.creado = new Date().toISOString();
    if (values && values.photoPath) event.foto = values.photoPath;
    addOp({ type: 'event', match: match.id, data: event });
    closeSheet();
    toast('Evento guardado');
    let photo;
    if (values && values.photoFile) {
      try {
        const uploaded = await uploadPhoto(match, values.photoFile, [event.jugador].filter(Boolean));
        photo = uploaded.canvas;
        addOp({ type: 'photo', match: match.id, event: event.id, data: uploaded.path });
      } catch (error) {
        toast(`La foto no se pudo subir (${error.message}); la historia va sin foto.`, true);
        photo = null;
      }
    }
    if (needsStory(event)) makeStory(match.id, event.id, photo);
  }

  /* ---------------- acciones del directo ---------------- */
  function goalSheet(match) {
    const values = { minute: minuteNow(match) };
    openSheet(`<h2>Gol de Bisontes</h2>
      <label>¿Quién marca?</label>${pickerHtml(match, 'scorer', '')}
      <label>Asistencia</label>${pickerHtml(match, 'assist', '', { none: 'Sin asistencia' })}
      <label for="f-min">Minuto</label><input id="f-min" value="${esc(values.minute)}" inputmode="numeric" />
      ${photoFieldHtml(match)}
      <div class="sheet-actions"><button type="button" value="close">Cancelar</button><button type="button" class="primary" data-ok>Registrar gol</button></div>`,
    sheet => {
      bindPickers(sheet, values);
      bindPhotoField(sheet, values);
      sheet.querySelector('[data-ok]').addEventListener('click', () => {
        if (!values.scorer) { toast('Elige quién ha marcado', true); return; }
        registerEvent(match, { tipo: 'gol', minuto: minuteText(sheet), jugador: values.scorer, ...(values.assist ? { asistente: values.assist } : {}) }, values);
      });
    });
  }
  function minuteText(sheet) {
    const raw = sheet.querySelector('#f-min').value.trim().replace(/'+$/, '');
    return raw ? `${raw}'` : '';
  }
  function againstSheet(match) {
    openSheet(`<h2>Gol del rival</h2>
      <label for="f-min">Minuto</label><input id="f-min" value="${esc(minuteNow(match))}" inputmode="numeric" />
      <div class="sheet-actions"><button type="button" value="close">Cancelar</button><button type="button" class="primary" data-ok>Registrar gol en contra</button></div>`,
    sheet => sheet.querySelector('[data-ok]').addEventListener('click', () => registerEvent(match, { tipo: 'gol_contra', minuto: minuteText(sheet) })));
  }
  function cardSheet(match, color) {
    const values = { color };
    openSheet(`<h2>Tarjeta</h2>
      ${choiceHtml('color', [['amarilla', 'Amarilla'], ['roja', 'Roja']], color)}
      <label>¿A quién?</label>${pickerHtml(match, 'player', '')}
      <label for="f-min">Minuto</label><input id="f-min" value="${esc(minuteNow(match))}" inputmode="numeric" />
      <div class="sheet-actions"><button type="button" value="close">Cancelar</button><button type="button" class="primary" data-ok>Registrar tarjeta</button></div>`,
    sheet => {
      bindChoices(sheet, values);
      bindPickers(sheet, values);
      sheet.querySelector('[data-ok]').addEventListener('click', () => {
        if (!values.player) { toast('Elige el jugador', true); return; }
        registerEvent(match, { tipo: 'tarjeta', tarjeta: values.color, minuto: minuteText(sheet), jugador: values.player });
      });
    });
  }
  function penaltySheet(match) {
    const values = { side: '', result: '' };
    const draw = () => openSheet(`<h2>Penalti</h2>
      <label>¿Para quién?</label>${choiceHtml('side', [['favor', 'A favor'], ['contra', 'En contra']], values.side)}
      ${values.side === 'favor' ? `<label>¿Quién lo tira?</label>${pickerHtml(match, 'taker', values.taker || '')}` : ''}
      <label>Resultado</label>${choiceHtml('result', [['gol', 'Gol'], ['fallado', 'Fallado / parado']], values.result)}
      <label for="f-min">Minuto</label><input id="f-min" value="${esc(values.minute || minuteNow(match))}" inputmode="numeric" />
      ${values.side === 'favor' && values.result === 'gol' ? photoFieldHtml(match) : ''}
      <div class="sheet-actions"><button type="button" value="close">Cancelar</button><button type="button" class="primary" data-ok>Registrar penalti</button></div>`,
    sheet => {
      values.onChange = name => { values.minute = sheet.querySelector('#f-min').value; if (name === 'side' || name === 'result') draw(); };
      bindChoices(sheet, values);
      bindPickers(sheet, values);
      bindPhotoField(sheet, values);
      sheet.querySelector('[data-ok]').addEventListener('click', () => {
        if (!values.side) { toast('Elige si es a favor o en contra', true); return; }
        if (!values.result) { toast('Elige el resultado', true); return; }
        if (values.side === 'favor' && !values.taker) { toast('Elige quién lo tira', true); return; }
        registerEvent(match, { tipo: 'penalti', lado: values.side, resultado: values.result, minuto: minuteText(sheet), ...(values.taker && values.side === 'favor' ? { jugador: values.taker } : {}) }, values);
      });
    });
    draw();
  }
  function voidSheet(match, event) {
    const values = { reason: '' };
    openSheet(`<h2>Anular gol</h2>
      <p class="muted">Se quita del marcador y se publica la historia de gol anulado.</p>
      <label>Motivo</label>${choiceHtml('reason', REASONS.map(r => [r, r]), '')}
      <div class="sheet-actions"><button type="button" value="close">Cancelar</button><button type="button" class="primary" data-ok>Anular gol</button></div>`,
    sheet => {
      bindChoices(sheet, values);
      sheet.querySelector('[data-ok]').addEventListener('click', () => {
        if (!values.reason) { toast('Elige el motivo', true); return; }
        addOp({ type: 'void', match: match.id, event: event.id, data: { motivo: values.reason, en: new Date().toISOString() } });
        closeSheet();
        toast('Gol anulado');
        makeStory(match.id, event.id);
      });
    });
  }
  function nextState(match) {
    return { previa: ['primera', 'Empieza el partido'], primera: ['descanso', 'Descanso'], descanso: ['segunda', 'Empieza la 2.ª parte'], segunda: ['final', 'Final del partido'] }[match.estado || 'previa'];
  }
  function changeState(match, estado) {
    const now = new Date().toISOString();
    const event = { id: uid('ev'), tipo: 'estado', valor: estado, creado: now, minuto: estado === 'descanso' ? `${match.parte || 45}'` : '' };
    addOp({ type: 'state', match: match.id, data: { estado, en: now, evento: event } });
    if (needsStory(event)) makeStory(match.id, event.id, null);
  }

  /* ---------------- pantallas ---------------- */
  function renderSync() {
    const el = $('#sync');
    if (!el) return;
    const n = state.ops.length;
    if (!n) { el.textContent = state.server.loaded ? 'Guardado ✓' : ''; el.className = 'sync'; return; }
    if (state.syncError) { el.textContent = `${n} sin guardar (${state.syncError === 'sin conexión' ? 'sin conexión' : 'reintentando'})`; el.className = 'sync offline'; return; }
    el.textContent = `Guardando ${n}…`;
    el.className = 'sync pending';
  }

  function show(screen) {
    ['login', 'list', 'match'].forEach(id => { $(`#${id}`).hidden = id !== screen; });
  }

  function render() {
    if (!state.server.loaded) return;
    renderSync();
    const match = currentMatch();
    if (state.current && !match) state.current = null;
    if (!state.current) {
      show('list');
      $('#title').textContent = 'Partidos';
      renderList();
      return;
    }
    show('match');
    $('#title').textContent = `vs ${match.rival}`;
    document.querySelectorAll('[data-tab]').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === state.tab)));
    ['live', 'lineup', 'photos', 'info'].forEach(t => { $(`#tab-${t}`).hidden = t !== state.tab; });
    if (state.tab === 'live') renderLive(match);
    if (state.tab === 'lineup') renderLineup(match);
    if (state.tab === 'photos') renderPhotos(match);
    if (state.tab === 'info') renderInfo(match);
  }

  function renderList() {
    const list = view().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    $('#matches').innerHTML = list.length ? list.map(m => {
      const s = score(m);
      const live = ['primera', 'descanso', 'segunda'].includes(m.estado);
      return `<button type="button" class="card" data-open="${esc(m.id)}">
        <strong>${m.local === false ? `${esc(m.rival)} – Bisontes DUX` : `Bisontes DUX – ${esc(m.rival)}`}</strong>
        <span class="meta">${esc(when(m.fecha))}${m.campo ? ` · ${esc(m.campo)}` : ''}</span><br />
        <span class="chip${live ? ' live' : ''}">${esc(STATE_LABEL[m.estado || 'previa'])}</span>
        ${m.estado && m.estado !== 'previa' ? ` <b>${m.local === false ? `${s.contra}-${s.favor}` : `${s.favor}-${s.contra}`}</b>` : ''}
      </button>`;
    }).join('') : '<p class="muted">Todavía no hay partidos. Crea el primero.</p>';
    $('#matches').querySelectorAll('[data-open]').forEach(btn => btn.addEventListener('click', () => {
      state.current = btn.dataset.open;
      state.tab = 'live';
      state.draftLineup = null;
      render();
      const match = currentMatch();
      loadPhotos(match).then(() => render()).catch(() => { /* sin fotos */ });
    }));
  }

  function storyChip(story) {
    if (!story) return '';
    if (story.estado === 'publicada') return '<span class="chip ok">Publicada</span>';
    if (story.estado === 'error') return `<span class="chip err" title="${esc(story.error)}">Historia sin publicar</span>`;
    return '<span class="chip">Historia lista</span>';
  }

  function eventText(match, e) {
    switch (e.tipo) {
      case 'estado': return { primera: 'Empieza el partido', descanso: 'Descanso', segunda: 'Empieza la 2.ª parte', final: 'Final del partido' }[e.valor];
      case 'gol': return `Gol de ${person(e.jugador).short}${e.asistente ? ` (asist. ${person(e.asistente).short})` : ''}`;
      case 'gol_contra': return `Gol de ${match.rival || 'rival'}`;
      case 'tarjeta': return `Tarjeta ${e.tarjeta} · ${person(e.jugador).short}`;
      case 'penalti': return `Penalti ${e.lado === 'favor' ? `a favor (${person(e.jugador).short})` : 'en contra'} · ${e.resultado === 'gol' ? 'gol' : 'fallado'}`;
      default: return e.tipo;
    }
  }
  function isGoal(e) {
    return e.tipo === 'gol' || e.tipo === 'gol_contra' || (e.tipo === 'penalti' && e.resultado === 'gol');
  }

  function renderLive(match) {
    const s = score(match);
    const home = match.local !== false;
    const next = nextState(match);
    const playing = ['primera', 'segunda'].includes(match.estado);
    const events = (match.eventos || []).slice().sort((a, b) => String(b.creado).localeCompare(String(a.creado)));
    $('#tab-live').innerHTML = `
      <div class="score">
        <div class="teams"><span>${home ? 'BISONTES DUX' : esc(match.rival)}</span>
        <span class="num">${home ? `${s.favor}-${s.contra}` : `${s.contra}-${s.favor}`}</span>
        <span>${home ? esc(match.rival) : 'BISONTES DUX'}</span></div>
        <div class="clock" id="clock">${esc(STATE_LABEL[match.estado || 'previa'])}${playing ? ` · ${esc(minuteNow(match))}` : ''}</div>
      </div>
      ${next ? `<button type="button" class="state-btn" data-state="${next[0]}">${next[1]}</button>` : ''}
      <div class="actions">
        <button type="button" class="goal" data-act="goal">Gol de Bisontes</button>
        <button type="button" data-act="against">Gol en contra</button>
        <button type="button" data-act="penalty">Penalti</button>
        <button type="button" class="yellow" data-act="yellow">Amarilla</button>
        <button type="button" class="red" data-act="red">Roja</button>
      </div>
      <label class="toggle"><input type="checkbox" id="auto" ${autoPublish() ? 'checked' : ''} /> Publicar historias en Instagram automáticamente</label>
      <ul class="timeline">${events.map(e => `<li>
        <div class="head"><span class="min">${esc(e.minuto || '')}</span>
        <span class="what${e.anulado ? ' void' : ''}">${esc(eventText(match, e))}</span></div>
        ${e.anulado ? `<p class="muted">Anulado: ${esc(e.anulado.motivo.toLowerCase())}</p>` : ''}
        <div class="tools">${storyChip(e.historia)}
          ${e.historia ? `<button type="button" data-view="${esc(e.id)}">Ver historia</button><button type="button" data-share="${esc(e.id)}">Compartir</button>` : ''}
          ${needsStory(e) ? `<button type="button" data-redo="${esc(e.id)}">${e.historia ? 'Rehacer historia' : 'Crear historia'}</button>` : ''}
          ${isGoal(e) && !e.anulado ? `<button type="button" data-void="${esc(e.id)}">Gol anulado</button>` : ''}
          <button type="button" class="danger" data-remove="${esc(e.id)}">Borrar</button>
        </div></li>`).join('')}</ul>`;
    const root = $('#tab-live');
    root.querySelectorAll('[data-state]').forEach(b => b.addEventListener('click', () => changeState(match, b.dataset.state)));
    const acts = { goal: () => goalSheet(match), against: () => againstSheet(match), penalty: () => penaltySheet(match), yellow: () => cardSheet(match, 'amarilla'), red: () => cardSheet(match, 'roja') };
    root.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', acts[b.dataset.act]));
    root.querySelector('#auto').addEventListener('change', e => {
      try { localStorage.setItem(AUTO_KEY, e.target.checked ? 'si' : 'no'); } catch (err) { /* nada */ }
    });
    root.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => previewStory(match.id, b.dataset.view)));
    root.querySelectorAll('[data-share]').forEach(b => b.addEventListener('click', () => shareStory(match.id, b.dataset.share)));
    root.querySelectorAll('[data-redo]').forEach(b => b.addEventListener('click', () => { b.disabled = true; state.stories.delete(b.dataset.redo); makeStory(match.id, b.dataset.redo); }));
    root.querySelectorAll('[data-void]').forEach(b => b.addEventListener('click', () => voidSheet(match, match.eventos.find(e => e.id === b.dataset.void))));
    root.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
      if (!confirm('¿Borrar este evento? (si ya se publicó su historia en Instagram, bórrala allí a mano)')) return;
      addOp({ type: 'remove', match: match.id, event: b.dataset.remove });
    }));
  }

  /* ---------- 11 inicial ---------- */
  function lineupDraft(match) {
    if (!state.draftLineup || state.draftLineup.match !== match.id) {
      const saved = match.once || {};
      state.draftLineup = {
        match: match.id, dirty: false,
        formacion: saved.formacion || '4-4-2',
        titulares: (saved.titulares || []).concat(Array(11).fill(null)).slice(0, 11),
        suplentes: (saved.suplentes || []).slice(),
        capitan: saved.capitan || null
      };
    }
    return state.draftLineup;
  }
  function renderLineup(match) {
    const d = lineupDraft(match);
    const slots = H.FORMATIONS[d.formacion];
    const placed = d.titulares.filter(Boolean);
    const story = match.once && match.once.historia;
    $('#tab-lineup').innerHTML = `
      <label for="formation">Sistema</label>
      <select id="formation">${Object.keys(H.FORMATIONS).map(f => `<option${f === d.formacion ? ' selected' : ''}>${f}</option>`).join('')}</select>
      <p class="muted">Toca cada posición para poner un jugador. ${placed.length}/11</p>
      <div class="pitch"><span class="box box-top"></span><span class="box box-bottom"></span>
        ${slots.map(([x, y], i) => {
          const slug = d.titulares[i];
          const p = slug ? person(slug) : null;
          return `<button type="button" class="slot${p ? '' : ' empty'}" style="left:${x}%;top:${y}%" data-slot="${i}">
            <span class="dot">${p ? slotFace(p) : '+'}</span>
            <span class="name">${p ? esc(p.short) : ''}${p && d.capitan === slug ? '<span class="cap">C</span>' : ''}</span></button>`;
        }).join('')}
      </div>
      <label>Suplentes (toca para convocar)</label>
      <div class="bench">${players().filter(p => !placed.includes(p.slug)).map(p => `<button type="button" data-bench="${esc(p.slug)}" aria-pressed="${d.suplentes.includes(p.slug)}">${esc(p.dorsal ?? '')} ${esc(p.short)}</button>`).join('')}</div>
      <label for="captain">Capitán</label>
      <select id="captain"><option value="">—</option>${placed.map(s => `<option value="${esc(s)}"${d.capitan === s ? ' selected' : ''}>${esc(person(s).short)}</option>`).join('')}</select>
      <button type="button" class="primary big" id="save-lineup">${d.dirty ? 'Guardar 11 inicial *' : 'Guardar 11 inicial'}</button>
      <button type="button" class="big" id="story-lineup" ${placed.length < 11 ? 'disabled' : ''}>Crear historia del 11 inicial</button>
      ${story ? `<div class="tools" style="margin-top:10px">${storyChip(story)} <button type="button" data-view-once>Ver</button> <button type="button" data-share-once>Compartir</button></div>` : ''}
      <p class="muted">La historia del 11 no se publica sola: revísala y compártela tú.</p>`;
    const root = $('#tab-lineup');
    const touched = () => { d.dirty = true; renderLineup(match); };
    root.querySelector('#formation').addEventListener('change', e => { d.formacion = e.target.value; touched(); });
    root.querySelector('#captain').addEventListener('change', e => { d.capitan = e.target.value || null; touched(); });
    root.querySelectorAll('[data-bench]').forEach(b => b.addEventListener('click', () => {
      const slug = b.dataset.bench;
      d.suplentes = d.suplentes.includes(slug) ? d.suplentes.filter(s => s !== slug) : d.suplentes.concat(slug);
      touched();
    }));
    root.querySelectorAll('[data-slot]').forEach(b => b.addEventListener('click', () => slotSheet(match, d, Number(b.dataset.slot))));
    root.querySelector('#save-lineup').addEventListener('click', () => saveLineup(match, d));
    root.querySelector('#story-lineup').addEventListener('click', async e => {
      e.target.disabled = true;
      if (d.dirty) saveLineup(match, d);
      await makeStory(match.id, 'once');
      previewStory(match.id, 'once');
    });
    const viewBtn = root.querySelector('[data-view-once]');
    if (viewBtn) viewBtn.addEventListener('click', () => previewStory(match.id, 'once'));
    const shareBtn = root.querySelector('[data-share-once]');
    if (shareBtn) shareBtn.addEventListener('click', () => shareStory(match.id, 'once'));
  }
  /* Foto del jugador en su posición; si no hay foto, su dorsal. */
  function slotFace(p) {
    const [first, second] = H.photoSources(p.photo);
    const number = `<b>${esc(p.dorsal ?? '·')}</b>`;
    if (!first) return number;
    return `<span class="face"><img src="${esc(first)}" alt="" data-fallback="${esc(second || '')}" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback='';}else{this.parentNode.remove();}" /></span>${number}`;
  }
  function saveLineup(match, d) {
    addOp({ type: 'lineup', match: match.id, data: { formacion: d.formacion, titulares: d.titulares.slice(), suplentes: d.suplentes.filter(s => !d.titulares.includes(s)), capitan: d.capitan, ...(match.once && match.once.historia ? { historia: match.once.historia } : {}) } });
    d.dirty = false;
    toast('11 inicial guardado');
  }
  function slotSheet(match, d, index) {
    const current = d.titulares[index];
    const others = d.titulares.filter((s, i) => s && i !== index);
    const list = players().filter(p => !others.includes(p.slug));
    openSheet(`<h2>Posición ${index + 1}</h2>
      <div class="picker">${list.map(p => `<button type="button" data-slug="${esc(p.slug)}" aria-pressed="${current === p.slug}"><b>${esc(p.dorsal ?? '')}</b>${esc(p.short)} <small>${esc(p.position || '')}</small></button>`).join('')}</div>
      <div class="sheet-actions"><button type="button" value="close">Cerrar</button><button type="button" data-clear ${current ? '' : 'disabled'}>Vaciar posición</button></div>`,
    sheet => {
      sheet.querySelectorAll('[data-slug]').forEach(b => b.addEventListener('click', () => {
        d.titulares[index] = b.dataset.slug;
        d.suplentes = d.suplentes.filter(s => s !== b.dataset.slug);
        d.dirty = true;
        closeSheet();
        renderLineup(match);
      }));
      sheet.querySelector('[data-clear]').addEventListener('click', () => {
        if (d.capitan === d.titulares[index]) d.capitan = null;
        d.titulares[index] = null;
        d.dirty = true;
        closeSheet();
        renderLineup(match);
      });
    });
  }

  /* ---------- fotos ---------- */
  function renderPhotos(match) {
    const list = state.photos.get(match.id);
    $('#tab-photos').innerHTML = `
      <label class="file-btn">Subir fotos del partido<input type="file" accept="image/*" multiple id="photo-input" /></label>
      <p class="muted">Van a la galería privada con el partido «${esc(match.galeria)}». Destácalas para la web desde la galería.</p>
      <p id="photo-status" class="status"></p>
      <div class="thumbs">${(list || []).map(p => state.thumbs.has(p.thumb_path) ? `<button type="button"><img src="${esc(state.thumbs.get(p.thumb_path))}" alt="" /></button>` : '').join('')}</div>
      ${list ? '' : '<p class="muted">Cargando fotos…</p>'}`;
    if (!list) loadPhotos(match).then(() => render()).catch(error => { $('#photo-status').textContent = error.message; });
    $('#photo-input').addEventListener('change', async e => {
      const files = [...e.target.files];
      const status = $('#photo-status');
      let done = 0;
      for (const file of files) {
        status.textContent = `Subiendo ${done + 1} de ${files.length}…`;
        try { await uploadPhoto(match, file, []); done++; } catch (error) { status.textContent = error.message; status.className = 'status err'; }
      }
      await loadPhotos(match, true);
      render();
      toast(`${done} foto${done === 1 ? '' : 's'} subida${done === 1 ? '' : 's'}`);
    });
  }

  /* ---------- datos del partido ---------- */
  function matchFormHtml(m) {
    return `<label for="m-rival">Rival</label><input id="m-rival" value="${esc(m.rival)}" required />
      <div class="row2"><div><label for="m-fecha">Fecha y hora</label><input id="m-fecha" type="datetime-local" value="${esc(m.fecha)}" /></div>
      <div><label for="m-local">Jugamos</label><select id="m-local"><option value="1"${m.local !== false ? ' selected' : ''}>En casa</option><option value="0"${m.local === false ? ' selected' : ''}>Fuera</option></select></div></div>
      <label for="m-campo">Campo</label><input id="m-campo" value="${esc(m.campo)}" placeholder="Orcasur" />
      <label for="m-comp">Competición</label><input id="m-comp" value="${esc(m.competicion)}" />
      <label for="m-parte">Minutos por parte</label><input id="m-parte" type="number" min="10" max="60" value="${esc(m.parte || 45)}" />
      <label for="m-galeria">Nombre en la galería de fotos</label><input id="m-galeria" value="${esc(m.galeria)}" />`;
  }
  function readMatchForm(root) {
    const rival = root.querySelector('#m-rival').value.trim();
    const fecha = root.querySelector('#m-fecha').value;
    return {
      rival, fecha, local: root.querySelector('#m-local').value === '1',
      campo: root.querySelector('#m-campo').value.trim(), competicion: root.querySelector('#m-comp').value.trim(),
      parte: Number(root.querySelector('#m-parte').value) || 45,
      galeria: root.querySelector('#m-galeria').value.trim() || defaultGallery(rival, fecha)
    };
  }
  function defaultGallery(rival, fecha) {
    const day = fecha ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(fecha)) : '';
    return `Bisontes DUX – ${rival}${day ? ` · ${day}` : ''}`;
  }
  function renderInfo(match) {
    $('#tab-info').innerHTML = `${matchFormHtml(match)}
      <button type="button" class="primary big" id="save-info">Guardar datos</button>
      <button type="button" class="big danger" id="delete-match">Borrar partido</button>`;
    const root = $('#tab-info');
    root.querySelector('#save-info').addEventListener('click', () => {
      const data = readMatchForm(root);
      if (!data.rival) { toast('Falta el rival', true); return; }
      addOp({ type: 'edit', match: match.id, data });
      toast('Datos guardados');
    });
    root.querySelector('#delete-match').addEventListener('click', () => {
      if (!confirm(`¿Borrar el partido contra ${match.rival}? Las fotos de la galería no se borran.`)) return;
      addOp({ type: 'delete', match: match.id });
      state.current = null;
      render();
    });
  }
  function newMatchSheet() {
    const draft = { rival: '', fecha: '', local: true, campo: 'Orcasur', competicion: 'Liga municipal de Orcasur', parte: 45, galeria: '' };
    openSheet(`<h2>Nuevo partido</h2>${matchFormHtml(draft)}
      <p class="muted">Si dejas vacío el nombre en la galería, se pone «Bisontes DUX – Rival · fecha».</p>
      <div class="sheet-actions"><button type="button" value="close">Cancelar</button><button type="button" class="primary" data-ok>Crear partido</button></div>`,
    sheet => sheet.querySelector('[data-ok]').addEventListener('click', () => {
      const data = readMatchForm(sheet);
      if (!data.rival) { toast('Falta el rival', true); return; }
      const match = { id: uid('p'), ...data, estado: 'previa', tiempos: {}, once: null, eventos: [] };
      addOp({ type: 'create', match: match.id, data: match });
      closeSheet();
      state.current = match.id;
      state.tab = 'lineup';
      render();
    }));
  }

  /* ---------------- arranque ---------------- */
  async function enter() {
    const { data: isAdmin, error } = await client.rpc('gallery_is_admin');
    if (error) throw error;
    if (isAdmin !== true) {
      await client.auth.signOut({ scope: 'local' });
      throw new Error('Tu cuenta no es admin.');
    }
    $('#sync').textContent = 'Cargando…';
    await Promise.all([loadPeople(), loadMatches()]);
    render();
    sync();
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
  $('#new-match').addEventListener('click', newMatchSheet);
  document.querySelectorAll('[data-tab]').forEach(t => t.addEventListener('click', () => {
    if (state.tab === 'lineup' && state.draftLineup && state.draftLineup.dirty && t.dataset.tab !== 'lineup' && !confirm('El 11 inicial tiene cambios sin guardar. ¿Salir igualmente?')) return;
    state.tab = t.dataset.tab;
    render();
  }));
  $('.back').addEventListener('click', e => {
    if (state.current) { e.preventDefault(); state.current = null; render(); }
  });
  setInterval(() => {
    const match = state.current && state.tab === 'live' ? currentMatch() : null;
    const clock = $('#clock');
    if (match && clock && ['primera', 'segunda'].includes(match.estado)) clock.textContent = `${STATE_LABEL[match.estado]} · ${minuteNow(match)}`;
  }, 15000);
  window.addEventListener('beforeunload', e => {
    if (state.ops.length || (state.draftLineup && state.draftLineup.dirty)) { e.preventDefault(); e.returnValue = ''; }
  });

  if (!client) {
    show('login');
    $('#login-status').textContent = 'No se ha podido conectar con Supabase.';
  } else {
    client.auth.getSession().then(({ data }) => {
      if (!data.session) { show('login'); return; }
      enter().catch(error => { show('login'); $('#login-status').textContent = error.message; $('#login-status').className = 'status err'; });
    });
  }
}());
