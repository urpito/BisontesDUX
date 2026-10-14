/* ============================================================
   BISONTES DUX — galería: lo común a la pública y la privada
   Conexión con Supabase (js/galeria-config.js), plantilla que
   incrusta generate-site.mjs, rejilla por partido y visor.
   ============================================================ */
(function () {
  'use strict';

  const SITE = '/BisontesDUX/';
  const BUCKETS = { public: 'galeria-publica', private: 'galeria-privada' };
  const config = window.BISONTES_GALERIA || {};
  let client = null;

  function isConfigured() {
    return Boolean(config.supabaseUrl && config.supabaseKey && window.supabase && window.supabase.createClient);
  }

  function getClient() {
    if (!client && isConfigured()) {
      client = window.supabase.createClient(config.supabaseUrl, config.supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'bisontes-galeria' }
      });
    }
    return client;
  }

  /* Plantilla (jugadores y staff) incrustada en la página al generar la web. */
  const rosterNode = document.getElementById('galeria-roster');
  const roster = rosterNode ? JSON.parse(rosterNode.textContent) : [];
  const people = new Map(roster.map(person => [person.slug, person]));

  function personName(slug) {
    const person = people.get(slug);
    return person ? person.name : slug;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
    ));
  }

  function slugify(value) {
    return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${String(iso).slice(0, 10)}T00:00:00Z`));
  }

  function publicUrl(path) {
    return getClient().storage.from(BUCKETS.public).getPublicUrl(path).data.publicUrl;
  }

  /* Agrupa por partido/evento y fecha, respetando el orden recibido. */
  function groupPhotos(photos) {
    const groups = new Map();
    for (const photo of photos) {
      const key = `${photo.event || ''}|${photo.taken_on || ''}`;
      if (!groups.has(key)) groups.set(key, { title: photo.event || 'Otras fotos', date: photo.taken_on || '', photos: [] });
      groups.get(key).photos.push(photo);
    }
    return [...groups.values()];
  }

  function photoAlt(photo) {
    if (photo.caption) return photo.caption;
    const names = (photo.players || []).map(personName);
    return `Foto de ${photo.event || 'Bisontes DUX'}${names.length ? `, con ${names.join(', ')}` : ''}`;
  }

  function captionHtml(photo) {
    const meta = [photo.event, formatDate(photo.taken_on)].filter(Boolean).map(esc).join(' · ');
    const names = (photo.players || [])
      .filter(slug => people.has(slug))
      .map(slug => `<a href="${SITE}jugadores/${esc(slug)}/">${esc(personName(slug))}</a>`)
      .join(', ');
    return `${meta ? `<p class="gallery-viewer__meta">${meta}</p>` : ''}`
      + `${photo.caption ? `<p>${esc(photo.caption)}</p>` : ''}`
      + `${names ? `<p class="gallery-viewer__people">Salen: ${names}</p>` : ''}`;
  }

  /* Rejilla de miniaturas agrupada por partido. thumbUrl(photo) → URL o ''. */
  function galleryHtml(photos, thumbUrl, options = {}) {
    return groupPhotos(photos).map((group, index) => `
      <section class="gallery-group" aria-labelledby="galeria-grupo-${index}">
        <header class="gallery-group__head">
          <h2 id="galeria-grupo-${index}">${esc(group.title)}</h2>
          ${group.date ? `<time datetime="${esc(group.date)}">${formatDate(group.date)}</time>` : ''}
          <span class="gallery-group__count">${group.photos.length} ${group.photos.length === 1 ? 'foto' : 'fotos'}</span>
        </header>
        <ul class="gallery-grid">
          ${group.photos.map(photo => {
            const src = thumbUrl(photo);
            return `<li><button type="button" class="gallery-thumb" data-photo="${esc(photo.id)}" aria-label="Ver en grande: ${esc(photoAlt(photo))}">
              ${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" />` : '<span class="gallery-thumb__missing">Sin vista previa</span>'}
              ${options.badge && photo.is_public ? '<span class="gallery-thumb__flag">Pública</span>' : ''}
            </button></li>`;
          }).join('')}
        </ul>
      </section>`).join('');
  }

  function errorMessage(error) {
    if (!error) return 'Algo ha fallado. Inténtalo de nuevo.';
    const text = `${error.code || ''} ${error.message || error}`;
    if (/PGRST205|42P01|Could not find the table|does not exist/i.test(text)) return 'La base de datos de la galería todavía no está preparada: falta ejecutar supabase/galeria.sql.';
    if (/Invalid login credentials/i.test(text)) return 'Correo o contraseña incorrectos.';
    if (/already registered|already been registered|already exists/i.test(text) && /user/i.test(text)) return 'Ya hay una cuenta con ese correo: entra con tu contraseña.';
    if (/Email not confirmed/i.test(text)) return 'Falta confirmar el correo de esta cuenta.';
    if (/rate limit|too many/i.test(text)) return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.';
    if (/weak_password|Password should|at least 8|al menos 8/i.test(text)) return 'La contraseña tiene que tener al menos 8 caracteres.';
    if (/Failed to fetch|NetworkError|Load failed|network/i.test(text)) return 'No hay conexión con la galería. Revisa tu internet y vuelve a probar.';
    if (/row-level security|permission denied|42501|Unauthorized|not allowed/i.test(text)) return 'No tienes permiso para hacer eso.';
    if (/Payload too large|maximum allowed size|exceeded/i.test(text)) return 'La foto pesa demasiado.';
    return error.message || String(error);
  }

  /* ---------------- visor a pantalla completa ----------------
     options.thumb(photo)   → URL inmediata (miniatura ya cargada)
     options.resolve(photo) → Promise con la URL grande
     options.caption(photo) → HTML del pie
     options.actions(photo) → [{ label, run(photo), danger }]       */
  function createViewer(options) {
    const dialog = document.createElement('dialog');
    dialog.className = 'gallery-viewer';
    dialog.setAttribute('aria-label', 'Visor de fotos');
    dialog.innerHTML = `
      <div class="gallery-viewer__bar">
        <p class="gallery-viewer__count" aria-live="polite"></p>
        <div class="gallery-viewer__actions"></div>
        <button type="button" class="gallery-viewer__close" data-viewer="close" aria-label="Cerrar el visor">✕</button>
      </div>
      <figure class="gallery-viewer__figure">
        <div class="gallery-viewer__stage">
          <button type="button" class="gallery-viewer__nav gallery-viewer__nav--prev" data-viewer="prev" aria-label="Foto anterior">‹</button>
          <button type="button" class="gallery-viewer__nav gallery-viewer__nav--next" data-viewer="next" aria-label="Foto siguiente">›</button>
        </div>
        <figcaption class="gallery-viewer__caption"></figcaption>
      </figure>`;
    document.body.appendChild(dialog);

    /* La imagen se crea aquí y solo recibe src al abrir una foto. */
    const img = new Image();
    img.className = 'gallery-viewer__img';
    img.alt = '';
    dialog.querySelector('.gallery-viewer__stage').prepend(img);
    const count = dialog.querySelector('.gallery-viewer__count');
    const caption = dialog.querySelector('.gallery-viewer__caption');
    const actions = dialog.querySelector('.gallery-viewer__actions');
    const navs = dialog.querySelectorAll('.gallery-viewer__nav');
    let list = [];
    let index = 0;
    let token = 0;
    let opener = null;

    async function show() {
      const photo = list[index];
      if (!photo) { if (dialog.open) dialog.close(); return; }
      const mine = ++token;
      count.textContent = list.length > 1 ? `${index + 1} / ${list.length}` : '';
      caption.innerHTML = options.caption ? options.caption(photo) : '';
      actions.replaceChildren(...(options.actions ? options.actions(photo) : []).map(action => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `gallery-viewer__action${action.danger ? ' is-danger' : ''}`;
        button.textContent = action.label;
        button.addEventListener('click', () => action.run(photo));
        return button;
      }));
      navs.forEach(nav => { nav.hidden = list.length < 2; });
      img.alt = photoAlt(photo);
      const thumb = options.thumb ? options.thumb(photo) : '';
      if (thumb) img.src = thumb; else img.removeAttribute('src');
      img.classList.add('is-loading');
      try {
        const full = await options.resolve(photo);
        if (mine !== token) return;
        const loader = new Image();
        loader.src = full;
        await loader.decode();
        if (mine !== token) return;
        img.src = full;
      } catch (error) {
        if (mine === token) caption.insertAdjacentHTML('beforeend', '<p class="gallery-viewer__error">No se ha podido cargar la foto en grande.</p>');
      } finally {
        if (mine === token) img.classList.remove('is-loading');
      }
    }

    function step(delta) {
      if (list.length < 2) return;
      index = (index + delta + list.length) % list.length;
      show();
    }

    dialog.addEventListener('click', event => {
      const action = event.target.closest('[data-viewer]');
      if (action) {
        if (action.dataset.viewer === 'close') dialog.close();
        else step(action.dataset.viewer === 'prev' ? -1 : 1);
      } else if (event.target === dialog) {
        dialog.close();
      }
    });
    dialog.addEventListener('keydown', event => {
      if (event.target.closest('input, select, textarea')) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    });
    let touchX = null;
    let touchY = null;
    dialog.addEventListener('touchstart', event => {
      touchX = event.touches[0].clientX;
      touchY = event.touches[0].clientY;
    }, { passive: true });
    dialog.addEventListener('touchend', event => {
      if (touchX === null) return;
      const dx = event.changedTouches[0].clientX - touchX;
      const dy = event.changedTouches[0].clientY - touchY;
      touchX = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    }, { passive: true });
    dialog.addEventListener('close', () => {
      token++;
      img.removeAttribute('src');
      if (opener && opener.isConnected) opener.focus();
    });

    return {
      open(photos, start) {
        list = photos;
        index = Math.max(0, Math.min(start, photos.length - 1));
        opener = document.activeElement;
        if (!dialog.open) dialog.showModal();
        show();
      },
      /* Tras editar o borrar: sigue en la misma foto si todavía está en la lista. */
      update(photos) {
        if (!dialog.open) return;
        const id = list[index] && list[index].id;
        list = photos;
        const at = list.findIndex(photo => photo.id === id);
        index = at >= 0 ? at : Math.min(index, list.length - 1);
        show();
      },
      close() { if (dialog.open) dialog.close(); }
    };
  }

  window.BisontesGaleria = {
    SITE, BUCKETS, roster, people, personName, isConfigured, getClient,
    esc, slugify, formatDate, publicUrl, groupPhotos, photoAlt, captionHtml, galleryHtml, errorMessage, createViewer
  };
}());
