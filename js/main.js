/* ============================================================
   BISONTES DUX — main.js  v2
   ============================================================ */

/* ----------------------------------------------------------
   CONFIG — FORMULARIOS
   --
   Pega aquí tu Access Key de https://web3forms.com  (es gratis).
   1. Entra en web3forms.com, pon el email del club y te llega la clave.
   2. Sustituye el texto de abajo por tu clave.
   Los formularios "Quiero jugar" y "Newsletter" la usan automáticamente.
   ---------------------------------------------------------- */
const WEB3FORMS_KEY = '17baff50-6d30-42f0-b53e-b4f62c5bf730';

/* NEWSLETTER con BREVO (recomendado para enviar campañas "Partido vs X").
   Cuando crees tu formulario en Brevo te darán una URL con esta forma:
       https://XXXXX.sibforms.com/serve/YYYYY
   Pégala aquí (entre las comillas) y los suscriptores entrarán SOLOS en
   tu lista de Brevo. Mientras siga como está, las altas te llegan al correo. */
const BREVO_FORM_ACTION = 'TU_URL_DE_BREVO_AQUI';

/* Helpers de formulario */
function postWeb3Forms(data) {
  return fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json());
}

function setFormStatus(el, type, msg) {
  if (!el) return;
  el.textContent = msg || '';
  el.className = 'form-status' + (type ? ' form-status--' + type : '');
}

/* ----------------------------------------------------------
   PLAYER CARDS
   ---------------------------------------------------------- */
function renderPlayers() {
  const grid = document.getElementById('players-grid');
  if (!grid || typeof players === 'undefined') return;

  /* El HTML estático generado es rastreable y funciona sin JavaScript. */
  if (grid.children.length) {
    observeElements(grid.querySelectorAll('.reveal'));
    fitPlayerNames();
    return;
  }

  grid.innerHTML = players.map((player, index) => {
    const dorsal  = player.dorsal !== undefined ? player.dorsal : index + 1;
    const imgPath = player.photo || `assets/jugador${dorsal}.png`;
    const delay   = (index % 4) * 0.08;
    const dorsalClass = isNaN(dorsal) ? 'player-card__dorsal player-card__dorsal--text' : 'player-card__dorsal';

    const fullName = player.name.includes(',')
      ? player.name.split(',').map(part => part.trim()).reverse().join(' ')
      : player.name;
    const slug = (player.slug || fullName).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    return `
      <a class="player-card reveal" href="/BisontesDUX/jugadores/${slug}/" target="_blank" rel="noopener" style="transition-delay:${delay}s" data-player-index="${index}">
        <div class="player-card__img-wrap" style="width:100%;height:100%;position:relative;">
          <img
            src="${imgPath}"
            alt="${player.name}"
            class="player-card__photo"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
          />
          <div class="player-card__silhouette">
            <svg viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:60%;opacity:.25;">
              <circle cx="50" cy="32" r="22" fill="#fff"/>
              <path d="M12 140 Q12 78 50 78 Q88 78 88 140Z" fill="#fff"/>
            </svg>
          </div>
          <span class="${dorsalClass}" aria-hidden="true">${dorsal}</span>
        </div>
        <div class="player-card__info">
          <span class="player-card__pos">${player.position}</span>
          <h3 class="player-card__name">${player.name}</h3>
          <span class="player-card__profile-link">Ver ficha oficial &rarr;</span>
        </div>
      </a>`;
  }).join('');

  observeElements(grid.querySelectorAll('.reveal'));
  fitPlayerNames();
}

/* ----------------------------------------------------------
   SPONSOR CARDS
   ---------------------------------------------------------- */
function renderSponsors() {
  const grid = document.getElementById('sponsors-grid');
  if (!grid || typeof sponsors === 'undefined') return;

  /* Cada patrocinador es una tarjeta; si tiene web, la tarjeta entera enlaza a ella. */
  grid.innerHTML = sponsors.map(s => {
    const principal = s.tier === 'principal';
    const logo = s.logo
      ? `<img src="${s.logo}" alt="Logo de ${s.name}" class="sponsor-logo-img" loading="lazy" decoding="async" />`
      : `<span class="sponsor-placeholder">${s.name}</span>`;
    const inner = `
      <span class="sponsor-logo-wrap">${logo}</span>
      <span class="sponsor-name">${s.name}</span>
      <span class="sponsor-tier-label${principal ? ' sponsor-tier-principal' : ''}">${principal ? 'Patrocinador principal' : 'Colaborador'}</span>
      ${s.description ? `<span class="sponsor-desc">${s.description}</span>` : ''}
      ${s.url ? '<span class="sponsor-link">Visitar web</span>' : ''}`;
    const cls = `sponsor-card${principal ? ' sponsor-card--principal' : ''}`;
    return s.url
      ? `<a class="${cls}" href="${s.url}" target="_blank" rel="sponsored noopener" data-track="sponsor_click" data-sponsor="${s.name}">${inner}</a>`
      : `<div class="${cls}">${inner}</div>`;
  }).join('');
}

/* ----------------------------------------------------------
   FIT TEXT — reduce font-size until text fits in one line
   ---------------------------------------------------------- */
function fitPlayerNames() {
  document.querySelectorAll('.player-card__name').forEach(el => {
    el.style.fontSize = '';
    el.style.fontSize = getComputedStyle(el).fontSize;
    while (el.scrollWidth > el.clientWidth && parseFloat(el.style.fontSize) > 12) {
      el.style.fontSize = (parseFloat(el.style.fontSize) - 0.5) + 'px';
    }
  });
}

/* ----------------------------------------------------------
   SCROLL REVEAL  (IntersectionObserver)
   ---------------------------------------------------------- */
let observer;

function observeElements(els) {
  if (!observer) return;
  els.forEach(el => observer.observe(el));
}

function initScrollReveal() {
  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => observer.observe(el));
}

/* ----------------------------------------------------------
   NAVBAR — transparent → solid on scroll
   ---------------------------------------------------------- */
function initNavbar() {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 50);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* Resalta el enlace del menú de la sección que se está viendo */
function initScrollSpy() {
  const links = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
  const map = links
    .map(a => ({ a, sec: document.querySelector(a.getAttribute('href')) }))
    .filter(x => x.sec);
  if (!map.length) return;

  const onScroll = () => {
    const y = window.scrollY + 120;
    let current = null;
    map.forEach(item => { if (item.sec.offsetTop <= y) current = item; });
    links.forEach(a => a.classList.remove('active'));
    if (current) current.a.classList.add('active');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ----------------------------------------------------------
   SMOOTH SCROLL
   ---------------------------------------------------------- */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ----------------------------------------------------------
   JOIN FORM
   ---------------------------------------------------------- */
function renderJoinForm() {
  const wrap = document.getElementById('join-fields');
  if (!wrap || typeof joinFormFields === 'undefined') return;

  wrap.innerHTML = joinFormFields.map(f => {
    const id   = 'f-' + f.name;
    const full = f.full ? ' form-field--full' : '';
    const req  = f.required ? ' required' : '';
    const ph   = f.placeholder ? ` placeholder="${f.placeholder}"` : '';

    let control;
    if (f.type === 'textarea') {
      control = `<textarea id="${id}" name="${f.name}" rows="4"${ph}${req}></textarea>`;
    } else if (f.type === 'select') {
      const opts = ['<option value="" disabled selected>Selecciona…</option>']
        .concat((f.options || []).map(o => `<option value="${o}">${o}</option>`))
        .join('');
      control = `<select id="${id}" name="${f.name}"${req}>${opts}</select>`;
    } else {
      control = `<input type="${f.type || 'text'}" id="${id}" name="${f.name}"${ph}${req} />`;
    }

    return `<div class="form-field${full}"><label for="${id}">${f.label}</label>${control}</div>`;
  }).join('');
}

function initJoinForm() {
  const form = document.getElementById('join-form');
  if (!form) return;
  const btn    = form.querySelector('button[type="submit"]');
  const status = document.getElementById('join-status');

  form.addEventListener('submit', async e => {
    e.preventDefault();

    if (WEB3FORMS_KEY.startsWith('TU_')) {
      setFormStatus(status, 'warn', 'Falta configurar la clave de Web3Forms en js/main.js (línea WEB3FORMS_KEY).');
      return;
    }
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Enviando…';
    setFormStatus(status, '', '');

    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await postWeb3Forms({
        access_key: WEB3FORMS_KEY,
        subject: 'Nuevo jugador quiere unirse — Bisontes DUX',
        from_name: 'Web Bisontes DUX',
        ...data
      });
      if (!res.success) throw new Error(res.message || 'error');
      form.reset();
      btn.innerHTML = '¡Recibido!';
            setFormStatus(status, 'ok', '¡Gracias! Hemos recibido tus datos. Nos pondremos en contacto contigo pronto.');
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = original;
      setFormStatus(status, 'err', 'No se pudo enviar. Inténtalo de nuevo o escríbenos a bisontes.dux@gmail.com');
    }
  });
}

/* ----------------------------------------------------------
   NEWSLETTER FORM
   ---------------------------------------------------------- */
/* iframe oculto donde Brevo recibe el envío sin que la página recargue */
function ensureBrevoSink() {
  let f = document.getElementById('brevo_sink');
  if (!f) {
    f = document.createElement('iframe');
    f.id = 'brevo_sink';
    f.name = 'brevo_sink';
    f.style.display = 'none';
    document.body.appendChild(f);
  }
  return f;
}

function initNewsletter() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;
  const btn    = form.querySelector('.btn-submit');
  const status = document.getElementById('newsletter-status');

  const brevoReady = !BREVO_FORM_ACTION.startsWith('TU_');
  const web3Ready  = !WEB3FORMS_KEY.startsWith('TU_');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    /* Opción 1 — Brevo: el suscriptor entra solo en tu lista */
    if (brevoReady) {
      ensureBrevoSink();
      form.action = BREVO_FORM_ACTION;
      form.method = 'POST';
      form.target = 'brevo_sink';
      btn.disabled = true;
      btn.textContent = 'Enviando…';
      setFormStatus(status, '', '');
      form.submit();
      setTimeout(() => {
        form.reset();
        btn.disabled = false;
        btn.textContent = '¡Suscrito! ✓';
        setFormStatus(status, 'ok', '¡Gracias! Revisa tu correo para confirmar la suscripción.');
      }, 900);
      return;
    }

    /* Opción 2 — Web3Forms: las altas llegan a tu buzón (fallback) */
    if (web3Ready) {
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Enviando…';
      setFormStatus(status, '', '');
      const data = Object.fromEntries(new FormData(form).entries());
      try {
        const res = await postWeb3Forms({
          access_key: WEB3FORMS_KEY,
          subject: 'Nueva suscripción a la newsletter — Bisontes DUX',
          from_name: 'Web Bisontes DUX',
          ...data
        });
        if (!res.success) throw new Error(res.message || 'error');
        form.reset();
        btn.textContent = '¡Suscrito! ✓';
        setFormStatus(status, 'ok', '¡Gracias por suscribirte! Pronto tendrás noticias del club.');
      } catch (err) {
        btn.disabled = false;
        btn.textContent = original;
        setFormStatus(status, 'err', 'No se pudo completar. Inténtalo de nuevo.');
      }
      return;
    }

    setFormStatus(status, 'warn', 'Falta configurar la newsletter en js/main.js.');
  });
}

/* ----------------------------------------------------------
   BARRA DE PROGRESO DE SCROLL
   ---------------------------------------------------------- */
function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;
  const update = () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

/* ----------------------------------------------------------
   HERO — tira de dorsales: cambia el jugador de la espalda
   ---------------------------------------------------------- */
function initDorsalStrip() {
  const shirt = document.querySelector('[data-shirt]');
  const buttons = Array.from(document.querySelectorAll('.dorsal-strip__btn'));
  if (!shirt || !buttons.length) return;
  const el = name => shirt.querySelector(`[data-shirt-${name}]`);
  const photo = el('photo'), shirtName = el('name'), num = el('num'), link = el('link'), fullName = el('fullname'), pos = el('pos');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Precarga las fotos para que el cambio sea instantáneo */
  buttons.forEach(btn => { const img = new Image(); img.src = btn.dataset.photo; });

  function show(btn) {
    if (btn.getAttribute('aria-pressed') === 'true') return;
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    const apply = () => {
      photo.src = btn.dataset.photo;
      photo.alt = `${btn.dataset.name}, ${btn.dataset.pos} de Bisontes DUX`;
      shirtName.textContent = btn.dataset.shirt;
      if (num) num.textContent = btn.dataset.num;
      fullName.textContent = btn.dataset.name;
      pos.textContent = btn.dataset.pos;
      link.href = btn.dataset.url;
    };
    if (reduce) { apply(); return; }
    shirt.classList.remove('is-pressing');
    shirt.classList.add('is-leaving');
    setTimeout(() => {
      apply();
      shirt.classList.remove('is-leaving');
      void shirt.offsetWidth;
      shirt.classList.add('is-pressing');
    }, 180);
  }

  buttons.forEach((btn, i) => {
    btn.addEventListener('click', () => show(btn));
    btn.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = buttons[(i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
      next.focus();
      show(next);
    });
  });
}

/* ----------------------------------------------------------
   PLANTILLA — filtro por posición
   ---------------------------------------------------------- */
function initRosterFilter() {
  const bar = document.querySelector('.roster-filter');
  const cards = Array.from(document.querySelectorAll('#players-grid .player-card'));
  if (!bar || !cards.length) return;
  bar.hidden = false;
  const buttons = Array.from(bar.querySelectorAll('[data-filter]'));
  buttons.forEach(btn => btn.addEventListener('click', () => {
    const filter = btn.dataset.filter;
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    cards.forEach(card => { card.hidden = filter !== 'todos' && card.dataset.group !== filter; });
  }));
}

/* ----------------------------------------------------------
   INIT
   ---------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initScrollSpy();
  initSmoothScroll();
  initScrollReveal();
  initScrollProgress();
  renderPlayers();
  initDorsalStrip();
  initRosterFilter();
  renderSponsors();
  renderJoinForm();
  initJoinForm();
  initNewsletter();
});

/* Al llegar desde otra página con #seccion (p. ej. /BisontesDUX/#plantilla), baja hasta ella
   cuando ya está todo cargado, para que el salto no se pierda. */
if (location.hash && 'scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('load', () => {
  const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (!target) return;
  const jump = () => target.scrollIntoView({ block: 'start' });
  jump();
  setTimeout(jump, 150);
});

window.addEventListener('resize', fitPlayerNames);
