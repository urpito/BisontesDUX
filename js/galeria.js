/* ============================================================
   BISONTES DUX — galería pública (/galeria/)
   Solo las fotos que un admin marca como «destacadas» en la
   galería privada. Sin cuenta: únicamente lectura.
   ============================================================ */
(function () {
  'use strict';

  const G = window.BisontesGaleria;
  const root = document.getElementById('galeria-publica');
  if (!G || !root) return;

  let photos = [];
  let player = '';

  function message(text) {
    root.innerHTML = `<p class="gallery-empty">${G.esc(text)}</p>`;
  }

  if (!G.isConfigured()) {
    message('Muy pronto: aquí estarán las mejores fotos de los partidos de la manada.');
    return;
  }

  const viewer = G.createViewer({
    thumb: photo => G.publicUrl(photo.thumb_path),
    resolve: async photo => G.publicUrl(photo.full_path),
    caption: G.captionHtml
  });

  function visible() {
    return player ? photos.filter(photo => photo.players.includes(player)) : photos;
  }

  function render() {
    if (!photos.length) {
      message('Todavía no hay fotos destacadas. ¡Vuelve después del próximo partido!');
      return;
    }
    const tagged = [...new Set(photos.flatMap(photo => photo.players))]
      .filter(slug => G.people.has(slug))
      .sort((a, b) => G.personName(a).localeCompare(G.personName(b), 'es'));
    const chips = tagged.length
      ? `<div class="roster-filter gallery-chips" role="group" aria-label="Filtrar por jugador">
          <button type="button" class="roster-filter__btn" data-player="" aria-pressed="${!player}">Todas</button>
          ${tagged.map(slug => `<button type="button" class="roster-filter__btn" data-player="${G.esc(slug)}" aria-pressed="${player === slug}">${G.esc(G.personName(slug))}</button>`).join('')}
        </div>`
      : '';
    root.innerHTML = chips + G.galleryHtml(visible(), photo => G.publicUrl(photo.thumb_path));
  }

  root.addEventListener('click', event => {
    const chip = event.target.closest('[data-player]');
    if (chip) {
      player = chip.dataset.player;
      render();
      root.querySelector(`[data-player="${CSS.escape(player)}"]`).focus();
      return;
    }
    const thumb = event.target.closest('[data-photo]');
    if (thumb) {
      const list = visible();
      viewer.open(list, list.findIndex(photo => photo.id === thumb.dataset.photo));
    }
  });

  (async function load() {
    const { data, error } = await G.getClient()
      .from('gallery_photos')
      .select('id, full_path, thumb_path, width, height, event, taken_on, caption, players')
      .eq('is_public', true)
      .order('taken_on', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) {
      message('No se han podido cargar las fotos ahora mismo. Vuelve a intentarlo en un rato.');
      return;
    }
    photos = data || [];
    render();
  }());
}());
