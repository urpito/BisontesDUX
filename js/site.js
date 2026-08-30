/* Funciones compartidas: compartibilidad y arquitectura de analítica sin proveedor. */
(function () {
  'use strict';

  function track(eventName, detail) {
    const payload = Object.assign({ event: eventName, path: window.location.pathname }, detail || {});
    window.dispatchEvent(new CustomEvent('bisontesdux:analytics', { detail: payload }));
  }

  window.BisontesDUXAnalytics = { track };

  document.addEventListener('click', function (event) {
    const target = event.target.closest('[data-track]');
    if (!target) return;
    track(target.dataset.track, {
      player: target.dataset.player || undefined,
      platform: target.dataset.platform || undefined,
      sponsor: target.dataset.sponsor || undefined
    });
  });

  document.querySelectorAll('[data-native-share]').forEach(function (button) {
    button.addEventListener('click', async function () {
      const title = button.dataset.shareTitle || document.title;
      const url = button.dataset.shareUrl || window.location.href;

      try {
        if (navigator.share) {
          await navigator.share({ title: title, url: url });
          button.textContent = 'Compartido ✓';
        } else {
          await navigator.clipboard.writeText(url);
          button.textContent = 'Enlace copiado ✓';
        }
      } catch (error) {
        if (error.name !== 'AbortError') button.textContent = 'No se pudo compartir';
      }
    });
  });

  track('page_view', { title: document.title });
}());
