/* ============================================================
   BISONTES DUX — main.js  v2
   ============================================================ */

/* ----------------------------------------------------------
   MODAL GENÉRICO
   ---------------------------------------------------------- */
function openModal(html) {
  let overlay = document.getElementById('bx-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'bx-modal-overlay';
    overlay.innerHTML = `<div id="bx-modal-box"><button id="bx-modal-close" aria-label="Cerrar">&times;</button><div id="bx-modal-body"></div></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.getElementById('bx-modal-close').addEventListener('click', closeModal);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  }
  document.getElementById('bx-modal-body').innerHTML = html;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const overlay = document.getElementById('bx-modal-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

/* ----------------------------------------------------------
   PLAYER CARDS
   ---------------------------------------------------------- */
function renderPlayers() {
  const grid = document.getElementById('players-grid');
  if (!grid || typeof players === 'undefined') return;

  grid.innerHTML = players.map((player, index) => {
    const dorsal  = player.dorsal !== undefined ? player.dorsal : index + 1;
    const imgPath = player.photo || `assets/jugador${dorsal}.png`;
    const delay   = (index % 4) * 0.08;
    const dorsalClass = isNaN(dorsal) ? 'player-card__dorsal player-card__dorsal--text' : 'player-card__dorsal';

    return `
      <div class="player-card reveal" style="transition-delay:${delay}s" data-player-index="${index}">
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
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.player-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx    = parseInt(card.dataset.playerIndex);
      const player = players[idx];
      const dorsal  = player.dorsal !== undefined ? player.dorsal : idx + 1;
      const imgPath = player.photo || `assets/jugador${dorsal}.png`;
      const pmDorsalClass = isNaN(dorsal) ? 'pm-dorsal pm-dorsal--text' : 'pm-dorsal';

      openModal(`
        <div class="pm-card">
          <div class="pm-photo-wrap">
            <img src="${imgPath}" alt="${player.name}" class="pm-photo"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
            <div class="pm-silhouette">
              <svg viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:40%;opacity:.15;">
                <circle cx="50" cy="32" r="22" fill="#fff"/>
                <path d="M12 140 Q12 78 50 78 Q88 78 88 140Z" fill="#fff"/>
              </svg>
            </div>
            <span class="${pmDorsalClass}">${dorsal}</span>
            <div class="pm-info">
              <span class="pm-position">${player.position}</span>
              <h2 class="pm-name">${player.name}</h2>
              ${(player.age || player.nationality) ? `
              <div class="pm-stats-row">
                ${player.age         ? `<div class="pm-stat"><span class="pm-stat-label">Edad</span><span class="pm-stat-val">${player.age}</span></div>` : ''}
                ${player.nationality ? `<div class="pm-stat"><span class="pm-stat-label">Nac.</span><span class="pm-stat-val">${player.nationality}</span></div>` : ''}
              </div>` : ''}
              ${player.bio ? `<p class="pm-bio">${player.bio}</p>` : ''}
            </div>
          </div>
        </div>
      `);
    });
  });

  observeElements(grid.querySelectorAll('.reveal'));
  fitPlayerNames();
}

/* ----------------------------------------------------------
   SPONSOR CARDS
   ---------------------------------------------------------- */
function renderSponsors() {
  const grid = document.getElementById('sponsors-grid');
  if (!grid || typeof sponsors === 'undefined') return;

  grid.innerHTML = sponsors.map((s, i) => {
    const logoInner = s.logo
      ? `<img src="${s.logo}" alt="${s.name}" class="sponsor-logo-img" />`
      : `<div class="sponsor-placeholder">${s.name}</div>`;
    const imgEl = `<div class="sponsor-logo-wrap">${logoInner}</div>`;

    const tierLabel = s.tier === 'principal'
      ? `<span class="sponsor-tier-label sponsor-tier-principal">PATROCINADOR PRINCIPAL</span>`
      : s.tier === 'colaborador'
        ? `<span class="sponsor-tier-label sponsor-tier-colaborador">COLABORADOR</span>`
        : '';

    const inner = `
      ${tierLabel}
      ${imgEl}
      <span class="sponsor-name">${s.name}</span>
      ${s.description ? `<span class="sponsor-desc">${s.description}</span>` : ''}
    `;

    return `<div class="sponsor-card reveal" style="transition-delay:${i*0.06}s" data-sponsor-index="${i}">${inner}</div>`;
  }).join('');

  grid.querySelectorAll('.sponsor-card').forEach(card => {
    card.addEventListener('click', () => {
      const s = sponsors[parseInt(card.dataset.sponsorIndex)];
      const logoHtml = s.logo
        ? `<img src="${s.logo}" alt="${s.name}" class="sm-logo"/>`
        : `<div class="sm-logo-placeholder">${s.name}</div>`;
      const tierHtml = s.tier === 'principal'
        ? `<span class="sponsor-tier-label sponsor-tier-principal">PATROCINADOR PRINCIPAL</span>`
        : `<span class="sponsor-tier-label sponsor-tier-colaborador">COLABORADOR</span>`;

      openModal(`
        <div class="sm-card">
          ${tierHtml}
          <div class="sm-logo-wrap">${logoHtml}</div>
          <h2 class="sm-name">${s.name}</h2>
          ${s.description ? `<p class="sm-desc">${s.description}</p>` : ''}
          ${s.url ? `<a href="${s.url}" target="_blank" rel="noopener" class="sm-link">Ir a la web &rarr;</a>` : ''}
        </div>
      `);
    });
  });

  observeElements(grid.querySelectorAll('.reveal'));
}

/* ----------------------------------------------------------
   FIT TEXT — reduce font-size until text fits in one line
   ---------------------------------------------------------- */
function fitPlayerNames() {
  document.querySelectorAll('.player-card__name').forEach(el => {
    el.style.fontSize = '18px';
    while (el.scrollWidth > el.clientWidth && parseFloat(el.style.fontSize) > 10) {
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
function initJoinForm() {
  const form = document.getElementById('join-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.innerHTML = '✓ ¡Recibido! Nos ponemos en contacto';
    btn.disabled  = true;
    btn.style.background = '#3a9e5f';
  });
}

/* ----------------------------------------------------------
   NEWSLETTER FORM
   ---------------------------------------------------------- */
function initNewsletter() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('.btn-submit');
    btn.textContent = '¡Suscrito!';
    btn.disabled = true;
  });
}

/* ----------------------------------------------------------
   INIT
   ---------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initSmoothScroll();
  initScrollReveal();
  renderPlayers();
  renderSponsors();
  initJoinForm();
  initNewsletter();
});

window.addEventListener('resize', fitPlayerNames);
