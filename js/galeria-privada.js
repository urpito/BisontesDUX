/* ============================================================
   BISONTES DUX — galería privada (/galeria/privada/)
   Cuentas con Supabase Auth. Jugadores e invitados ven todas las
   fotos y filtran las suyas; los admins suben, editan, destacan,
   borran y dan accesos (también con fecha de fin).
   Ojo: los permisos de verdad los ponen las reglas de
   supabase/galeria.sql; este archivo solo decide qué se pinta.
   ============================================================ */
(function () {
  'use strict';

  const G = window.BisontesGaleria;
  const app = document.getElementById('galeria-app');
  if (!G || !app) return;

  const ROLE_LABELS = { pending: 'Pendiente', player: 'Jugador', guest: 'Invitado', admin: 'Admin', blocked: 'Sin acceso' };
  const SIGN_TTL = 60 * 60;   /* enlaces firmados de las fotos privadas: 1 hora */
  const FULL_MAX = 2048;      /* lado mayor de la foto grande (JPG, para descargar) */
  const THUMB_MAX = 720;      /* lado mayor de la miniatura (WebP) */
  const FACES_PER_PLAYER = 30; /* caras aprendidas que se guardan de cada jugador (las más recientes) */

  const state = {
    me: null,                 /* fila de gallery_members de quien ha entrado */
    photos: [],
    members: [],
    consent: new Set(),       /* jugadores con permiso de reconocimiento facial */
    faceCounts: {},           /* caras aprendidas por jugador */
    urls: new Map(),          /* ruta privada → { url, expires } */
    filters: { event: '', player: '' }
  };
  const esc = G.esc;
  const $ = selector => app.querySelector(selector);
  const isAdmin = () => Boolean(state.me && state.me.role === 'admin');
  const LOGOUT = '<button type="button" class="btn btn-dark" data-act="logout">Cerrar sesión</button>';

  let client = null;
  let viewer = null;
  let editor = null;
  let currentUser;            /* undefined hasta el primer aviso de Supabase */
  let routeToken = 0;
  let renderToken = 0;
  let uploading = false;

  /* ---------------- utilidades ---------------- */
  function loadingHtml(text) {
    return `<p class="gallery-loading">${esc(text)}</p>`;
  }

  /* text puede llevar HTML: escápalo antes de pasarlo. */
  function notice(title, text, actions = '') {
    return `<section class="gallery-card gallery-notice">
      <h2 class="font-display">${esc(title)}</h2>
      <p>${text}</p>
      ${actions ? `<div class="gallery-actions">${actions}</div>` : ''}
    </section>`;
  }

  function setStatus(node, text, kind = '') {
    if (!node) return;
    node.textContent = text;
    node.className = `form-status${kind ? ` form-status--${kind}` : ''}`;
  }

  async function busy(button, task) {
    if (button) button.disabled = true;
    try { return await task(); } finally { if (button) button.disabled = false; }
  }

  function clean(value) {
    const text = String(value || '').trim();
    return text || null;
  }

  function formatDay(iso) {
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
  }

  /* <input type="date"> trabaja con días; la base de datos guarda el final de ese día. */
  function endOfDay(day) {
    return new Date(`${day}T23:59:59`).toISOString();
  }

  function dayValue(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function rosterOptions(selected) {
    const option = person => `<option value="${esc(person.slug)}"${person.slug === selected ? ' selected' : ''}>${esc(person.label)}</option>`;
    return `<optgroup label="Jugadores">${G.roster.filter(person => !person.staff).map(option).join('')}</optgroup>`
      + `<optgroup label="Cuerpo técnico y club">${G.roster.filter(person => person.staff).map(option).join('')}</optgroup>`;
  }

  function peopleCheckboxes(selected) {
    return G.roster.map(person => `<label class="gallery-person"><input type="checkbox" name="players" value="${esc(person.slug)}"${selected.includes(person.slug) ? ' checked' : ''} /><span>${esc(person.label)}</span></label>`).join('');
  }

  function sortPhotos() {
    state.photos.sort((a, b) => (b.taken_on || '').localeCompare(a.taken_on || '')
      || String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }

  /* ---------------- enlaces de las fotos ---------------- */
  function cachedUrl(path) {
    const hit = state.urls.get(path);
    return hit && hit.expires > Date.now() ? hit.url : '';
  }

  function rememberUrl(path, url) {
    state.urls.set(path, { url, expires: Date.now() + (SIGN_TTL - 120) * 1000 });
  }

  async function signThumbs(photos) {
    const paths = photos.filter(photo => !photo.is_public && !cachedUrl(photo.thumb_path)).map(photo => photo.thumb_path);
    for (let i = 0; i < paths.length; i += 100) {
      const { data, error } = await client.storage.from(G.BUCKETS.private).createSignedUrls(paths.slice(i, i + 100), SIGN_TTL);
      if (error) continue; /* se verá «Sin vista previa» */
      for (const item of data) if (item.signedUrl) rememberUrl(item.path, item.signedUrl);
    }
  }

  function thumbUrl(photo) {
    return photo.is_public ? G.publicUrl(photo.thumb_path) : cachedUrl(photo.thumb_path);
  }

  async function fullUrl(photo) {
    if (photo.is_public) return G.publicUrl(photo.full_path);
    const hit = cachedUrl(photo.full_path);
    if (hit) return hit;
    const { data, error } = await client.storage.from(G.BUCKETS.private).createSignedUrl(photo.full_path, SIGN_TTL);
    if (error) throw error;
    rememberUrl(photo.full_path, data.signedUrl);
    return data.signedUrl;
  }

  async function download(photo) {
    const extension = photo.full_path.split('.').pop();
    const name = `bisontes-dux-${G.slugify(photo.event || 'foto') || 'foto'}-${photo.id.slice(0, 8)}.${extension}`;
    let url;
    if (photo.is_public) {
      url = client.storage.from(G.BUCKETS.public).getPublicUrl(photo.full_path, { download: name }).data.publicUrl;
    } else {
      const { data, error } = await client.storage.from(G.BUCKETS.private).createSignedUrl(photo.full_path, 120, { download: name });
      if (error) { window.alert(G.errorMessage(error)); return; }
      url = data.signedUrl;
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  /* ---------------- quién ha entrado ---------------- */
  async function route(session) {
    const mine = ++routeToken;
    if (viewer) viewer.close();
    if (editor && editor.open) editor.close();
    if (!session) {
      state.me = null;
      renderAuth();
      return;
    }
    app.innerHTML = loadingHtml('Entrando…');
    const { data, error } = await client.from('gallery_members').select('*').eq('user_id', session.user.id).maybeSingle();
    if (mine !== routeToken) return;
    if (error) {
      app.innerHTML = notice('No se ha podido entrar', esc(G.errorMessage(error)), LOGOUT);
      return;
    }
    state.me = data;
    if (!data) {
      app.innerHTML = notice('Cuenta sin ficha de acceso', 'Tu cuenta existe, pero no tiene ficha en la galería. Pide a un admin del club que lo revise.', LOGOUT);
    } else if (data.role === 'pending') {
      const asked = data.player_slug ? ` como <strong>${esc(G.personName(data.player_slug))}</strong>` : '';
      app.innerHTML = notice('Solicitud enviada',
        `Hola${data.name ? `, ${esc(data.name)}` : ''}. Has pedido acceso${asked} con <strong>${esc(data.email)}</strong>. Cuando un admin del club lo apruebe, al entrar verás todas las fotos.`,
        `<button type="button" class="btn btn-outline" data-act="recheck">Comprobar otra vez</button>${LOGOUT}`);
    } else if (data.role === 'blocked') {
      app.innerHTML = notice('Sin acceso', 'Tu acceso a la galería privada está retirado. Si crees que es un error, habla con un admin del club.', LOGOUT);
    } else if (data.expires_at && new Date(data.expires_at) <= new Date()) {
      app.innerHTML = notice('Acceso caducado', `Tu acceso terminó el ${esc(formatDay(data.expires_at))}. Si necesitas más tiempo, pídeselo a un admin del club.`, LOGOUT);
    } else {
      renderGallery();
    }
  }

  async function recheck() {
    const { data } = await client.auth.getSession();
    route(data.session);
  }

  /* ---------------- entrar / crear cuenta ---------------- */
  function renderAuth() {
    app.innerHTML = `
      <section class="gallery-card gallery-auth">
        <div class="gallery-auth__tabs" role="tablist" aria-label="Acceso a la galería">
          <button type="button" role="tab" id="tab-login" data-mode="login" aria-selected="true" aria-controls="form-login">Entrar</button>
          <button type="button" role="tab" id="tab-signup" data-mode="signup" aria-selected="false" aria-controls="form-signup">Crear cuenta</button>
        </div>
        <form id="form-login" class="gallery-form" role="tabpanel" aria-labelledby="tab-login">
          <div class="form-field"><label for="login-email">Correo</label><input id="login-email" type="email" name="email" autocomplete="email" required /></div>
          <div class="form-field"><label for="login-password">Contraseña</label><input id="login-password" type="password" name="password" autocomplete="current-password" required /></div>
          <button class="btn btn-dark" type="submit">Entrar</button>
          <p class="gallery-hint">¿Has olvidado la contraseña? Pide a un admin del club que te ponga una nueva.</p>
        </form>
        <form id="form-signup" class="gallery-form" role="tabpanel" aria-labelledby="tab-signup" hidden>
          <div class="form-field"><label for="signup-name">Nombre y apellido</label><input id="signup-name" name="name" autocomplete="name" maxlength="80" required /></div>
          <div class="form-field"><label for="signup-player">¿Quién eres?</label>
            <select id="signup-player" name="player" required>
              <option value="" disabled selected>Elige tu nombre</option>
              <option value="none">No soy jugador del club</option>
              ${rosterOptions('')}
            </select></div>
          <div class="form-field"><label for="signup-email">Correo</label><input id="signup-email" type="email" name="email" autocomplete="email" required /></div>
          <div class="form-field"><label for="signup-password">Contraseña (mínimo 8 caracteres)</label><input id="signup-password" type="password" name="password" autocomplete="new-password" minlength="8" required /></div>
          <button class="btn btn-dark" type="submit">Pedir acceso</button>
          <p class="gallery-hint">Un admin del club revisará tu solicitud antes de que puedas ver las fotos.</p>
        </form>
        <p class="form-status" role="status"></p>
      </section>`;
  }

  function switchMode(mode) {
    app.querySelectorAll('[data-mode]').forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.mode === mode)));
    $('#form-login').hidden = mode !== 'login';
    $('#form-signup').hidden = mode !== 'signup';
    setStatus($('.gallery-auth .form-status'), '');
    const first = $(mode === 'login' ? '#login-email' : '#signup-name');
    if (first) first.focus();
  }

  async function login(form) {
    const data = new FormData(form);
    const status = $('.gallery-auth .form-status');
    await busy(form.querySelector('[type="submit"]'), async () => {
      setStatus(status, 'Entrando…');
      const { error } = await client.auth.signInWithPassword({
        email: String(data.get('email')).trim(),
        password: String(data.get('password'))
      });
      if (error) setStatus(status, G.errorMessage(error), 'err');
    });
  }

  async function signup(form) {
    const data = new FormData(form);
    const status = $('.gallery-auth .form-status');
    const player = String(data.get('player') || '');
    if (String(data.get('password')).length < 8) { setStatus(status, 'La contraseña tiene que tener al menos 8 caracteres.', 'err'); return; }
    await busy(form.querySelector('[type="submit"]'), async () => {
      setStatus(status, 'Creando la cuenta…');
      const { data: result, error } = await client.auth.signUp({
        email: String(data.get('email')).trim(),
        password: String(data.get('password')),
        options: { data: { name: String(data.get('name')).trim(), player_slug: player === 'none' ? '' : player } }
      });
      if (error) setStatus(status, G.errorMessage(error), 'err');
      else if (!result.session) setStatus(status, 'Cuenta creada. Revisa tu correo para confirmarla y después entra con tu contraseña.', 'ok');
    });
  }

  /* ---------------- galería ---------------- */
  function renderGallery() {
    const me = state.me;
    const admin = isAdmin();
    const until = me.expires_at ? ` · acceso hasta el ${esc(formatDay(me.expires_at))}` : '';
    const tab = (id, label, selected) => `<button type="button" class="roster-filter__btn" role="tab" id="tab-${id}" data-tab="${id}" aria-selected="${selected}" aria-controls="panel-${id}">${label}</button>`;
    app.innerHTML = `
      <div class="gallery-account">
        <p>Hola, <strong>${esc(me.name || me.email)}</strong> · ${ROLE_LABELS[me.role]}${until}</p>
        <div class="gallery-account__actions">
          <button type="button" class="gallery-link" data-act="toggle-password" aria-expanded="false" aria-controls="form-password">Cambiar contraseña</button>
          <button type="button" class="gallery-link" data-act="logout">Cerrar sesión</button>
        </div>
      </div>
      <form id="form-password" class="gallery-card gallery-form" hidden>
        <div class="form-grid">
          <div class="form-field"><label for="password-new">Contraseña nueva</label><input id="password-new" type="password" name="password" autocomplete="new-password" minlength="8" required /></div>
          <div class="form-field"><label for="password-repeat">Repítela</label><input id="password-repeat" type="password" name="repeat" autocomplete="new-password" minlength="8" required /></div>
        </div>
        <button class="btn btn-dark" type="submit">Guardar contraseña</button>
        <p class="form-status" role="status"></p>
      </form>
      ${admin ? `<div class="roster-filter gallery-tabs" role="tablist" aria-label="Secciones de la galería privada">
        ${tab('fotos', 'Fotos', true)}${tab('subir', 'Subir fotos', false)}${tab('accesos', 'Accesos <span class="gallery-badge" hidden></span>', false)}
      </div>` : ''}
      <section id="panel-fotos" data-panel="fotos"${admin ? ' role="tabpanel" aria-labelledby="tab-fotos"' : ''}>
        <div class="gallery-filters"></div>
        <div class="gallery-results">${loadingHtml('Cargando fotos…')}</div>
      </section>
      ${admin ? `<section id="panel-subir" data-panel="subir" role="tabpanel" aria-labelledby="tab-subir" hidden>${uploadFormHtml()}</section>
      <section id="panel-accesos" data-panel="accesos" role="tabpanel" aria-labelledby="tab-accesos" hidden>
        <div class="gallery-card gallery-members">${loadingHtml('Cargando accesos…')}</div>
        <div class="gallery-card gallery-consent">${loadingHtml('Cargando permisos…')}</div>
      </section>` : ''}`;
    loadPhotos();
    if (admin) loadMembers();
  }

  function showTab(tab) {
    app.querySelectorAll('[data-tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.tab === tab)));
    app.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== tab; });
    if (tab === 'accesos') loadMembers();
  }

  async function loadPhotos() {
    const { data, error } = await client.from('gallery_photos').select('*')
      .order('taken_on', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    const results = $('.gallery-results');
    if (!results) return;
    if (error) {
      results.innerHTML = `<p class="form-status form-status--err">${esc(G.errorMessage(error))}</p>`;
      return;
    }
    state.photos = data || [];
    renderFilters();
    renderPhotos();
    updateEventList();
  }

  function filtered() {
    return state.photos.filter(photo => (!state.filters.event || photo.event === state.filters.event)
      && (!state.filters.player || photo.players.includes(state.filters.player)));
  }

  function renderFilters() {
    const box = $('.gallery-filters');
    if (!box) return;
    if (!state.photos.length) { box.innerHTML = ''; return; }
    const events = [...new Set(state.photos.map(photo => photo.event).filter(Boolean))];
    if (state.filters.event && !events.includes(state.filters.event)) state.filters.event = '';
    const tagged = new Set(state.photos.flatMap(photo => photo.players));
    const mine = state.me.player_slug;
    if (mine) tagged.add(mine);
    const people = G.roster.filter(person => tagged.has(person.slug));
    box.innerHTML = `
      <div class="form-field"><label for="filter-event">Partido o evento</label>
        <select id="filter-event" data-filter="event"><option value="">Todos</option>${events.map(event => `<option value="${esc(event)}"${event === state.filters.event ? ' selected' : ''}>${esc(event)}</option>`).join('')}</select></div>
      <div class="form-field"><label for="filter-player">Jugador</label>
        <select id="filter-player" data-filter="player"><option value="">Todos</option>${people.map(person => `<option value="${esc(person.slug)}"${person.slug === state.filters.player ? ' selected' : ''}>${esc(person.label)}</option>`).join('')}</select></div>
      ${mine ? `<button type="button" class="roster-filter__btn" data-act="mine" aria-pressed="${state.filters.player === mine}">Solo mis fotos</button>` : ''}
      <p class="gallery-count" aria-live="polite"></p>`;
  }

  async function renderPhotos() {
    const results = $('.gallery-results');
    if (!results) return;
    const mine = ++renderToken;
    const list = filtered();
    const count = $('.gallery-count');
    if (count) count.textContent = `${list.length} ${list.length === 1 ? 'foto' : 'fotos'}`;
    const mineButton = $('[data-act="mine"]');
    if (mineButton) mineButton.setAttribute('aria-pressed', String(state.filters.player === state.me.player_slug));
    if (!state.photos.length) {
      results.innerHTML = `<p class="gallery-empty">${isAdmin() ? 'Todavía no hay fotos. Súbelas desde «Subir fotos».' : 'Todavía no hay fotos. ¡Pronto estarán las del próximo partido!'}</p>`;
      return;
    }
    if (!list.length) {
      const own = state.filters.player && state.filters.player === state.me.player_slug && !state.filters.event;
      results.innerHTML = `<p class="gallery-empty">${own ? 'Todavía no hay fotos en las que salgas tú.' : 'No hay fotos con ese filtro.'}</p>`;
      return;
    }
    await signThumbs(list);
    if (mine !== renderToken) return;
    results.innerHTML = G.galleryHtml(list, thumbUrl, { badge: isAdmin() });
  }

  async function afterPhotosChanged() {
    sortPhotos();
    renderFilters();
    updateEventList();
    await renderPhotos();
    viewer.update(filtered());
  }

  function viewerActions() {
    const actions = [{ label: 'Descargar', run: download }];
    if (isAdmin()) actions.push({ label: 'Editar', run: openEditor });
    return actions;
  }

  /* ---------------- subir fotos (admins) ---------------- */
  function uploadFormHtml() {
    return `<form id="form-upload" class="gallery-card gallery-form">
      <h2 class="font-display">Subir fotos</h2>
      <div class="form-field"><label for="upload-files">Fotos</label><input id="upload-files" type="file" name="files" accept="image/*" multiple /></div>
      <div class="form-grid">
        <div class="form-field"><label for="upload-event">Partido o evento</label><input id="upload-event" name="event" list="gallery-events" maxlength="120" placeholder="Jornada 3 · Bisontes DUX – Rival" /></div>
        <div class="form-field"><label for="upload-date">Fecha</label><input id="upload-date" type="date" name="taken_on" /></div>
        <div class="form-field form-field--full"><label for="upload-caption">Pie de foto (opcional)</label><input id="upload-caption" name="caption" maxlength="200" /></div>
      </div>
      <label class="gallery-check"><input type="checkbox" name="recognize" checked /> Reconocer automáticamente quién sale (dorsales y, con permiso, caras)</label>
      <p class="gallery-hint">Se hace gratis en este dispositivo: las fotos no se envían a ninguna IA externa. La primera vez descarga unos 20&nbsp;MB. Si se equivoca, se corrige en «Editar».</p>
      <details class="gallery-manual"><summary>Añadir jugadores a mano (opcional)</summary>
        <fieldset class="gallery-people"><legend>Quién sale <span>(se suma a lo reconocido, en todas las fotos)</span></legend>${peopleCheckboxes([])}</fieldset>
      </details>
      <label class="gallery-check"><input type="checkbox" name="is_public" /> Destacadas: mostrarlas también en la galería pública</label>
      <p class="gallery-hint">Solo fotos de jugadores que hayan firmado la autorización de imagen. Antes de subirlas se reducen y se les quitan los datos de ubicación.</p>
      <button class="btn btn-dark" type="submit">Subir fotos</button>
      <p class="form-status" role="status"></p>
      <ol class="gallery-progress"></ol>
      <datalist id="gallery-events"></datalist>
    </form>`;
  }

  function updateEventList() {
    const list = document.getElementById('gallery-events');
    if (list) list.innerHTML = [...new Set(state.photos.map(photo => photo.event).filter(Boolean))].map(event => `<option value="${esc(event)}"></option>`).join('');
  }

  /* Lee la foto respetando la orientación de la cámara. */
  async function decodeImage(file) {
    if ('createImageBitmap' in window) {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
      } catch (error) { /* se prueba con <img> */ }
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch (error) {
      URL.revokeObjectURL(url);
      throw new Error(`No se puede leer «${file.name}». Si es una foto HEIC del iPhone, guárdala como JPG y vuelve a probar.`);
    }
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
  }

  /* Redibujar en un canvas reduce el tamaño y descarta los metadatos (GPS incluido). */
  function encode(picture, maxSide, type, quality) {
    const scale = Math.min(1, maxSide / Math.max(picture.width, picture.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(picture.width * scale));
    canvas.height = Math.max(1, Math.round(picture.height * scale));
    const context = canvas.getContext('2d');
    context.imageSmoothingQuality = 'high';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(picture.source, 0, 0, canvas.width, canvas.height);
    const toBlob = format => new Promise(resolve => canvas.toBlob(resolve, format, quality));
    return toBlob(type).then(async blob => {
      /* Safari no sabe generar WebP: entonces la miniatura va en JPG. */
      if (blob && blob.type !== type) blob = await toBlob('image/jpeg');
      if (!blob) throw new Error('No se ha podido preparar la foto.');
      return { blob, width: canvas.width, height: canvas.height };
    });
  }

  async function removeFiles(bucket, paths) {
    if (!paths.length) return true;
    const { error } = await client.storage.from(bucket).remove(paths);
    return !error;
  }

  /* ---------------- reconocimiento (se carga solo al subir) ---------------- */
  let recognizer = null;

  function loadRecognizer() {
    if (!recognizer) {
      recognizer = new Promise((resolve, reject) => {
        if (window.BisontesReconocimiento) { resolve(window.BisontesReconocimiento); return; }
        const script = document.createElement('script');
        script.src = `${G.SITE}js/galeria-reconocimiento.js`;
        script.onload = () => resolve(window.BisontesReconocimiento);
        script.onerror = () => reject(new Error('No se ha podido cargar el reconocimiento.'));
        document.head.appendChild(script);
      }).then(async R => { await R.prepare(); return R; })
        .catch(error => { recognizer = null; throw error; });
    }
    return recognizer;
  }

  /* Caras ya aprendidas y quién ha dado permiso (solo lo pueden leer los admins). */
  async function recognitionContext() {
    const [faces, consent] = await Promise.all([
      client.from('gallery_faces').select('player_slug, embedding'),
      client.from('gallery_face_consent').select('player_slug')
    ]);
    if (faces.error) throw faces.error;
    if (consent.error) throw consent.error;
    return { roster: G.roster, known: faces.data || [], consent: new Set((consent.data || []).map(row => row.player_slug)) };
  }

  /* Guarda las caras aprendidas de una foto y deja como mucho FACES_PER_PLAYER por jugador. */
  async function learnFaces(photoId, learned, ctx) {
    if (!learned.length) return;
    const rows = learned.map(item => ({ player_slug: item.player_slug, photo_id: photoId, embedding: item.embedding }));
    const { error } = await client.from('gallery_faces').insert(rows);
    if (error) return;
    ctx.known.push(...learned);
    for (const slug of new Set(learned.map(item => item.player_slug))) {
      const { data } = await client.from('gallery_faces').select('id').eq('player_slug', slug).order('created_at', { ascending: false });
      const extra = (data || []).slice(FACES_PER_PLAYER).map(row => row.id);
      if (extra.length) await client.from('gallery_faces').delete().in('id', extra);
    }
  }

  async function uploadOne(file, meta, recog) {
    const picture = await decodeImage(file);
    let full;
    let thumb;
    let found = null;
    try {
      full = await encode(picture, FULL_MAX, 'image/jpeg', 0.86);
      thumb = await encode(picture, THUMB_MAX, 'image/webp', 0.8);
      if (recog) {
        try {
          found = await recog.R.analyze(picture.source, picture.width, picture.height, recog.ctx);
        } catch (error) { found = null; /* la foto se sube igual, sin etiquetas automáticas */ }
      }
    } finally {
      picture.release();
    }
    const players = [...new Set([...meta.players, ...(found ? found.players : [])])];
    const id = crypto.randomUUID();
    const extension = blob => (blob.type === 'image/webp' ? 'webp' : 'jpg');
    const fullPath = `${id}/full.${extension(full.blob)}`;
    const thumbPath = `${id}/thumb.${extension(thumb.blob)}`;
    const uploaded = { [G.BUCKETS.private]: [], [G.BUCKETS.public]: [] };
    try {
      for (const bucket of meta.is_public ? [G.BUCKETS.private, G.BUCKETS.public] : [G.BUCKETS.private]) {
        for (const [path, item] of [[fullPath, full], [thumbPath, thumb]]) {
          const { error } = await client.storage.from(bucket).upload(path, item.blob, { contentType: item.blob.type, cacheControl: '31536000', upsert: false });
          if (error) throw error;
          uploaded[bucket].push(path);
        }
      }
      const { data, error } = await client.from('gallery_photos').insert({
        id, full_path: fullPath, thumb_path: thumbPath, width: full.width, height: full.height,
        event: meta.event, taken_on: meta.taken_on, caption: meta.caption, players, is_public: meta.is_public
      }).select().single();
      if (error) throw error;
      if (found) await learnFaces(id, found.learn, recog.ctx);
      return { photo: data, found };
    } catch (error) {
      await removeFiles(G.BUCKETS.private, uploaded[G.BUCKETS.private]);
      await removeFiles(G.BUCKETS.public, uploaded[G.BUCKETS.public]);
      throw error;
    }
  }

  async function upload(form) {
    const files = [...form.elements.files.files];
    const status = form.querySelector('.form-status');
    if (!files.length) { setStatus(status, 'Elige al menos una foto.', 'err'); return; }
    const data = new FormData(form);
    const meta = {
      event: clean(data.get('event')),
      taken_on: data.get('taken_on') || null,
      caption: clean(data.get('caption')),
      players: data.getAll('players'),
      is_public: data.get('is_public') === 'on'
    };
    const progress = form.querySelector('.gallery-progress');
    progress.innerHTML = files.map((file, index) => `<li data-file="${index}"><span>${esc(file.name)}</span><em>En cola</em></li>`).join('');
    const mark = (index, text, kind = '') => {
      const label = progress.querySelector(`[data-file="${index}"] em`);
      label.textContent = text;
      label.className = kind;
    };
    let done = 0;
    let recog = null;
    let recogProblem = '';
    uploading = true;
    await busy(form.querySelector('[type="submit"]'), async () => {
      if (data.get('recognize') === 'on') {
        setStatus(status, 'Preparando el reconocimiento (la primera vez tarda un poco)…');
        try {
          recog = { R: await loadRecognizer(), ctx: await recognitionContext() };
        } catch (error) {
          recogProblem = ` No se ha podido usar el reconocimiento (${G.errorMessage(error)}): añade quién sale en «Editar».`;
        }
      }
      for (const [index, file] of files.entries()) {
        mark(index, recog ? 'Reconociendo y subiendo…' : 'Subiendo…');
        setStatus(status, `Subiendo ${index + 1} de ${files.length}…`);
        try {
          const { photo, found } = await uploadOne(file, meta, recog);
          state.photos.push(photo);
          done++;
          const names = found ? found.players.map(G.personName) : [];
          mark(index, recog ? `Subida ✓ · ${names.length ? names.join(', ') : 'sin reconocer a nadie'}` : 'Subida ✓', 'is-ok');
        } catch (error) {
          mark(index, G.errorMessage(error), 'is-error');
        }
      }
    });
    uploading = false;
    const failed = files.length - done;
    setStatus(status, (failed
      ? `Se han subido ${done} de ${files.length}. Revisa las que han fallado.`
      : `¡Listo! ${done} ${done === 1 ? 'foto subida' : 'fotos subidas'}. Ya están en «Fotos».`) + recogProblem, failed || recogProblem ? 'err' : 'ok');
    if (done) {
      form.elements.files.value = '';
      await afterPhotosChanged();
    }
  }

  /* ---------------- editar una foto (admins) ---------------- */
  function openEditor(photo) {
    if (!editor) {
      editor = document.createElement('dialog');
      editor.className = 'gallery-editor';
      editor.setAttribute('aria-labelledby', 'gallery-editor-title');
      document.body.appendChild(editor);
      editor.addEventListener('submit', event => {
        event.preventDefault();
        saveEdit(event.target);
      });
      editor.addEventListener('click', event => {
        const action = event.target.closest('[data-edit]');
        if (!action) return;
        if (action.dataset.edit === 'cancel') editor.close();
        if (action.dataset.edit === 'delete') deletePhoto(action);
      });
    }
    editor.dataset.photo = photo.id;
    editor.innerHTML = `<form class="gallery-form">
      <h2 id="gallery-editor-title" class="font-display">Editar foto</h2>
      <div class="form-grid">
        <div class="form-field"><label for="edit-event">Partido o evento</label><input id="edit-event" name="event" list="gallery-events" maxlength="120" value="${esc(photo.event || '')}" /></div>
        <div class="form-field"><label for="edit-date">Fecha</label><input id="edit-date" type="date" name="taken_on" value="${esc(photo.taken_on || '')}" /></div>
        <div class="form-field form-field--full"><label for="edit-caption">Pie de foto</label><input id="edit-caption" name="caption" maxlength="200" value="${esc(photo.caption || '')}" /></div>
      </div>
      <fieldset class="gallery-people"><legend>Quién sale</legend>${peopleCheckboxes(photo.players)}</fieldset>
      <label class="gallery-check"><input type="checkbox" name="is_public"${photo.is_public ? ' checked' : ''} /> Destacada: también en la galería pública</label>
      <p class="gallery-hint">Solo fotos de jugadores que hayan firmado la autorización de imagen.</p>
      <div class="gallery-actions">
        <button class="btn btn-dark" type="submit">Guardar</button>
        <button class="btn btn-outline" type="button" data-edit="cancel">Cancelar</button>
        <button class="gallery-link is-danger" type="button" data-edit="delete">Borrar foto</button>
      </div>
      <p class="form-status" role="status"></p>
    </form>`;
    editor.showModal();
  }

  async function copyToPublic(photo) {
    for (const path of [photo.full_path, photo.thumb_path]) {
      const { error } = await client.storage.from(G.BUCKETS.private).copy(path, path, { destinationBucket: G.BUCKETS.public });
      if (error && !/exists|duplicate/i.test(error.message || '')) throw error;
    }
  }

  async function saveEdit(form) {
    const photo = state.photos.find(item => item.id === editor.dataset.photo);
    if (!photo) return;
    const data = new FormData(form);
    const wantPublic = data.get('is_public') === 'on';
    const status = form.querySelector('.form-status');
    const paths = [photo.full_path, photo.thumb_path];
    await busy(form.querySelector('[type="submit"]'), async () => {
      try {
        if (wantPublic && !photo.is_public) await copyToPublic(photo);
        const { data: row, error } = await client.from('gallery_photos').update({
          event: clean(data.get('event')),
          taken_on: data.get('taken_on') || null,
          caption: clean(data.get('caption')),
          players: data.getAll('players'),
          is_public: wantPublic
        }).eq('id', photo.id).select().single();
        if (error) {
          if (wantPublic && !photo.is_public) await removeFiles(G.BUCKETS.public, paths);
          throw error;
        }
        /* Al dejar de ser destacada se borra la copia pública (si no había, no pasa nada). */
        const removed = wantPublic || await removeFiles(G.BUCKETS.public, paths);
        state.photos = state.photos.map(item => (item.id === row.id ? row : item));
        editor.close();
        await afterPhotosChanged();
        if (!removed && photo.is_public) window.alert('La foto ya no sale en la galería pública, pero no se ha podido borrar su copia pública. Ábrela, pulsa «Editar» y guarda otra vez para reintentarlo.');
      } catch (error) {
        setStatus(status, G.errorMessage(error), 'err');
      }
    });
  }

  async function deletePhoto(button) {
    const photo = state.photos.find(item => item.id === editor.dataset.photo);
    if (!photo) return;
    if (!window.confirm('¿Borrar esta foto para siempre? Desaparece de la galería privada y, si era destacada, también de la pública.')) return;
    const status = editor.querySelector('.form-status');
    await busy(button, async () => {
      const { error } = await client.from('gallery_photos').delete().eq('id', photo.id);
      if (error) { setStatus(status, G.errorMessage(error), 'err'); return; }
      const paths = [photo.full_path, photo.thumb_path];
      await removeFiles(G.BUCKETS.private, paths);
      await removeFiles(G.BUCKETS.public, paths);
      state.photos = state.photos.filter(item => item.id !== photo.id);
      editor.close();
      await afterPhotosChanged();
    });
  }

  /* ---------------- accesos (admins) ---------------- */
  async function loadMembers() {
    const { data, error } = await client.from('gallery_members').select('*').order('created_at', { ascending: true });
    const box = $('.gallery-members');
    if (!box) return;
    if (error) {
      box.innerHTML = `<p class="form-status form-status--err">${esc(G.errorMessage(error))}</p>`;
      return;
    }
    state.members = data || [];
    renderMembers();
    loadConsent();
  }

  /* Permisos de reconocimiento facial y cuántas caras se han aprendido de cada uno. */
  async function loadConsent() {
    const box = $('.gallery-consent');
    if (!box) return;
    const [consent, faces] = await Promise.all([
      client.from('gallery_face_consent').select('player_slug'),
      client.from('gallery_faces').select('player_slug')
    ]);
    if (consent.error || faces.error) {
      box.innerHTML = `<p class="form-status form-status--err">${esc(G.errorMessage(consent.error || faces.error))}</p>`;
      return;
    }
    state.consent = new Set(consent.data.map(row => row.player_slug));
    state.faceCounts = faces.data.reduce((counts, row) => ({ ...counts, [row.player_slug]: (counts[row.player_slug] || 0) + 1 }), {});
    renderConsent();
  }

  function renderConsent() {
    const box = $('.gallery-consent');
    if (!box) return;
    box.innerHTML = `
      <h2 class="font-display">Reconocimiento facial</h2>
      <p class="gallery-hint">Al subir fotos se reconoce a cada jugador por su <strong>dorsal</strong>, sin pedir nada. La <strong>cara</strong> solo se usa con quien haya firmado el permiso (sus padres si es menor de 14), porque es un dato biométrico. Márcalo aquí cuando lo tengas firmado: desde entonces la galería aprende su cara de las fotos en que se le lea el dorsal y le reconoce aunque salga de espaldas al número. Al desmarcarlo se borran sus caras aprendidas.</p>
      <p class="form-status" role="status"></p>
      <div class="gallery-people">${G.roster.map(person => {
        const count = state.faceCounts[person.slug] || 0;
        return `<label class="gallery-person"><input type="checkbox" data-consent="${esc(person.slug)}"${state.consent.has(person.slug) ? ' checked' : ''} /><span>${esc(person.label)}${count ? ` · ${count} ${count === 1 ? 'cara' : 'caras'}` : ''}</span></label>`;
      }).join('')}</div>`;
  }

  async function toggleConsent(input) {
    const slug = input.dataset.consent;
    const status = $('.gallery-consent .form-status');
    const name = G.personName(slug);
    if (input.checked) {
      const { error } = await client.from('gallery_face_consent').insert({ player_slug: slug });
      if (error) { input.checked = false; setStatus(status, G.errorMessage(error), 'err'); return; }
      state.consent.add(slug);
      setStatus(status, `Permiso de ${name} guardado: la galería irá aprendiendo su cara.`, 'ok');
      return;
    }
    if (!window.confirm(`¿Quitar el permiso de ${name}? Se borrarán todas sus caras aprendidas y solo se le reconocerá por el dorsal.`)) { input.checked = true; return; }
    const { error } = await client.from('gallery_face_consent').delete().eq('player_slug', slug);
    if (error) { input.checked = true; setStatus(status, G.errorMessage(error), 'err'); return; }
    state.consent.delete(slug);
    delete state.faceCounts[slug];
    renderConsent();
    setStatus($('.gallery-consent .form-status'), `Permiso de ${name} retirado y sus caras borradas.`, 'ok');
  }

  function memberForm(member) {
    const id = esc(member.user_id);
    const expired = member.expires_at && new Date(member.expires_at) <= new Date();
    const asked = member.role === 'pending' && member.player_slug ? `<span class="gallery-member__asked">Dice ser ${esc(G.personName(member.player_slug))}</span>` : '';
    const who = `<div class="gallery-member__who">
        <strong>${esc(member.name || 'Sin nombre')}</strong>
        <span class="gallery-member__email">${esc(member.email)}</span>
        <span class="gallery-tag gallery-tag--${esc(member.role)}">${ROLE_LABELS[member.role] || esc(member.role)}${expired ? ' · caducado' : ''}</span>
        ${asked}
      </div>`;
    if (member.user_id === state.me.user_id) return `<div class="gallery-member">${who}<p class="gallery-hint">Esta es tu cuenta.</p></div>`;
    const role = ['player', 'guest', 'admin'].includes(member.role) ? member.role : (member.player_slug ? 'player' : 'guest');
    const option = (value, label) => `<option value="${value}"${role === value ? ' selected' : ''}>${label}</option>`;
    const submit = member.role === 'pending' ? 'Aprobar' : member.role === 'blocked' ? 'Devolver acceso' : 'Guardar';
    return `<form class="gallery-member" data-member="${id}">
      ${who}
      <div class="gallery-member__controls">
        <div class="form-field"><label for="role-${id}">Entra como</label>
          <select id="role-${id}" name="role">${option('player', 'Jugador')}${option('guest', 'Invitado')}${option('admin', 'Admin')}</select></div>
        <div class="form-field"><label for="slug-${id}">Su ficha</label>
          <select id="slug-${id}" name="player_slug"><option value="">Ninguna</option>${rosterOptions(member.player_slug)}</select></div>
        <div class="form-field"><label for="until-${id}">Acceso hasta</label>
          <input id="until-${id}" type="date" name="expires_at" value="${dayValue(member.expires_at)}" /></div>
      </div>
      <div class="gallery-actions">
        <button class="btn btn-dark" type="submit">${submit}</button>
        ${member.role !== 'blocked' ? `<button class="btn btn-outline" type="button" data-act="block">${member.role === 'pending' ? 'Rechazar' : 'Quitar acceso'}</button>` : ''}
        ${['player', 'guest', 'admin'].includes(member.role) ? '<button class="gallery-link" type="button" data-act="reset-password">Poner contraseña nueva</button>' : ''}
      </div>
    </form>`;
  }

  function renderMembers() {
    const box = $('.gallery-members');
    if (!box) return;
    const pending = state.members.filter(member => member.role === 'pending');
    const active = state.members.filter(member => ['admin', 'player', 'guest'].includes(member.role));
    const blocked = state.members.filter(member => member.role === 'blocked');
    const badge = $('.gallery-badge');
    if (badge) {
      badge.hidden = !pending.length;
      badge.textContent = pending.length;
    }
    box.innerHTML = `
      <h2 class="font-display">Accesos</h2>
      <p class="gallery-hint">Cada persona crea su cuenta en esta página y aquí decides qué puede ver. Para un <strong>acceso puntual</strong> (una familia, un fotógrafo…), apruébala como invitado y pon «Acceso hasta»: ese día deja de ver las fotos. Si lo dejas vacío, el acceso no caduca.</p>
      <p class="form-status" role="status"></p>
      <h3>Solicitudes pendientes (${pending.length})</h3>
      ${pending.length ? pending.map(memberForm).join('') : '<p class="gallery-hint">No hay solicitudes nuevas.</p>'}
      <h3>Con acceso (${active.length})</h3>
      ${active.map(memberForm).join('')}
      ${blocked.length ? `<details class="gallery-blocked"><summary>Sin acceso (${blocked.length})</summary>${blocked.map(memberForm).join('')}</details>` : ''}`;
  }

  function memberStatus(text, kind) {
    setStatus($('.gallery-members .form-status'), text, kind);
  }

  async function updateMember(id, changes, button, okText) {
    await busy(button, async () => {
      const { data, error } = await client.from('gallery_members').update(changes).eq('user_id', id).select().single();
      if (error) { memberStatus(G.errorMessage(error), 'err'); return; }
      state.members = state.members.map(member => (member.user_id === id ? data : member));
      renderMembers();
      memberStatus(okText, 'ok');
    });
  }

  function memberName(id) {
    const member = state.members.find(item => item.user_id === id);
    return member ? (member.name || member.email) : '';
  }

  function saveMember(form) {
    const data = new FormData(form);
    const role = data.get('role');
    const day = data.get('expires_at');
    if (role === 'guest' && !day) {
      memberStatus('Pon «Acceso hasta» para el invitado: ese día dejará de ver las fotos.', 'err');
      form.querySelector('[name="expires_at"]').focus();
      return;
    }
    if (day && new Date(endOfDay(day)) <= new Date()) {
      memberStatus('Esa fecha ya ha pasado: elige un día de hoy en adelante.', 'err');
      form.querySelector('[name="expires_at"]').focus();
      return;
    }
    const id = form.dataset.member;
    updateMember(id, { role, player_slug: data.get('player_slug') || null, expires_at: day ? endOfDay(day) : null },
      form.querySelector('[type="submit"]'), `Guardado: ${memberName(id)} entra como ${ROLE_LABELS[role].toLowerCase()}${day ? ` hasta el ${formatDay(endOfDay(day))}` : ''}.`);
  }

  function blockMember(form, button) {
    const id = form.dataset.member;
    const member = state.members.find(item => item.user_id === id);
    if (member.role !== 'pending' && !window.confirm(`¿Quitar el acceso a ${memberName(id)}? Dejará de ver las fotos al momento.`)) return;
    updateMember(id, { role: 'blocked' }, button, member.role === 'pending' ? `Solicitud de ${memberName(id)} rechazada.` : `${memberName(id)} ya no tiene acceso.`);
  }

  async function resetPassword(form, button) {
    const id = form.dataset.member;
    const password = window.prompt(`Contraseña nueva para ${memberName(id)} (mínimo 8 caracteres). Pásasela en persona o por privado.`);
    if (password === null) return;
    if (password.length < 8) { memberStatus('La contraseña tiene que tener al menos 8 caracteres.', 'err'); return; }
    await busy(button, async () => {
      const { error } = await client.rpc('gallery_admin_set_password', { target_user: id, new_password: password });
      memberStatus(error ? G.errorMessage(error) : `Contraseña cambiada: ${memberName(id)} ya puede entrar con ella.`, error ? 'err' : 'ok');
    });
  }

  async function changePassword(form) {
    const data = new FormData(form);
    const status = form.querySelector('.form-status');
    if (String(data.get('password')).length < 8) { setStatus(status, 'La contraseña tiene que tener al menos 8 caracteres.', 'err'); return; }
    if (data.get('password') !== data.get('repeat')) { setStatus(status, 'Las dos contraseñas no coinciden.', 'err'); return; }
    await busy(form.querySelector('[type="submit"]'), async () => {
      const { error } = await client.auth.updateUser({ password: String(data.get('password')) });
      if (error) { setStatus(status, G.errorMessage(error), 'err'); return; }
      form.reset();
      setStatus(status, 'Contraseña cambiada.', 'ok');
    });
  }

  /* ---------------- eventos ---------------- */
  app.addEventListener('click', event => {
    const target = event.target.closest('[data-act], [data-tab], [data-mode], [data-photo]');
    if (!target) return;
    if (target.dataset.mode) { switchMode(target.dataset.mode); return; }
    if (target.dataset.tab) { showTab(target.dataset.tab); return; }
    if (target.dataset.photo) {
      const list = filtered();
      viewer.open(list, list.findIndex(photo => photo.id === target.dataset.photo));
      return;
    }
    switch (target.dataset.act) {
      case 'logout':
        client.auth.signOut({ scope: 'local' });
        break;
      case 'recheck':
        recheck();
        break;
      case 'toggle-password': {
        const form = $('#form-password');
        form.hidden = !form.hidden;
        target.setAttribute('aria-expanded', String(!form.hidden));
        if (!form.hidden) form.querySelector('input').focus();
        break;
      }
      case 'mine': {
        const mine = state.me.player_slug;
        state.filters.player = state.filters.player === mine ? '' : mine;
        const select = $('#filter-player');
        if (select) select.value = state.filters.player;
        renderPhotos();
        break;
      }
      case 'block':
        blockMember(target.closest('form'), target);
        break;
      case 'reset-password':
        resetPassword(target.closest('form'), target);
        break;
      default:
    }
  });

  app.addEventListener('change', event => {
    if (event.target.dataset.consent) { toggleConsent(event.target); return; }
    const filter = event.target.dataset.filter;
    if (!filter) return;
    state.filters[filter] = event.target.value;
    renderPhotos();
  });

  app.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target;
    if (form.id === 'form-login') login(form);
    else if (form.id === 'form-signup') signup(form);
    else if (form.id === 'form-password') changePassword(form);
    else if (form.id === 'form-upload') upload(form);
    else if (form.dataset.member) saveMember(form);
  });

  window.addEventListener('beforeunload', event => {
    if (!uploading) return;
    event.preventDefault();
    event.returnValue = '';
  });

  /* ---------------- arranque ---------------- */
  if (!G.isConfigured()) {
    app.innerHTML = notice('Muy pronto', 'La galería privada todavía no está conectada. Cuando el club la active, aquí podrás entrar con tu cuenta.');
    return;
  }
  client = G.getClient();
  viewer = G.createViewer({ thumb: thumbUrl, resolve: fullUrl, caption: G.captionHtml, actions: viewerActions });
  /* Supabase avisa al cargar (INITIAL_SESSION), al entrar y al salir. Solo se repinta si
     cambia la persona; y nunca se llama a Supabase dentro del aviso (puede bloquearse). */
  client.auth.onAuthStateChange((event, session) => {
    const userId = session ? session.user.id : null;
    if (userId === currentUser) return;
    currentUser = userId;
    setTimeout(() => route(session), 0);
  });
}());
