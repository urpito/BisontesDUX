/* ============================================================
   BISONTES DUX — historias de Instagram (1080×1920)
   Se dibujan en el propio móvil con un canvas, con los datos del
   partido (marcador, minuto, jugador): nada lo escribe una IA, así
   que una historia automática nunca sale con un dato inventado.
   Para usar vuestra plantilla de Canva: exportad el fondo como PNG
   de 1080×1920 en assets/historias/<tipo>.png y se pinta debajo.
   ============================================================ */
(function () {
  'use strict';

  const W = 1080;
  const H = 1920;
  const C = { kit: '#545454', deep: '#3f3f3f', pink: '#FFC8DD', rib: '#F1B3CB', ink: '#161616', white: '#ffffff', yellow: '#f2c200', red: '#d0021b' };
  const DISPLAY = '"Big Shoulders Display", "Archivo", sans-serif';
  const TEXT = '"Archivo", system-ui, sans-serif';
  const SITE = '/';

  /* Posiciones de cada sistema (x, y en % del campo; la portería propia abajo). */
  const FORMATIONS = {
    '4-4-2': [[50, 90], [14, 70], [38, 74], [62, 74], [86, 70], [14, 46], [38, 50], [62, 50], [86, 46], [35, 22], [65, 22]],
    '4-3-3': [[50, 90], [14, 70], [38, 74], [62, 74], [86, 70], [25, 50], [50, 54], [75, 50], [16, 24], [50, 18], [84, 24]],
    '4-2-3-1': [[50, 90], [14, 70], [38, 74], [62, 74], [86, 70], [35, 57], [65, 57], [16, 36], [50, 38], [84, 36], [50, 16]],
    '3-5-2': [[50, 90], [25, 73], [50, 75], [75, 73], [9, 47], [30, 51], [50, 55], [70, 51], [91, 47], [35, 22], [65, 22]],
    '3-4-3': [[50, 90], [25, 73], [50, 75], [75, 73], [14, 48], [38, 51], [62, 51], [86, 48], [16, 24], [50, 18], [84, 24]],
    '5-3-2': [[50, 90], [8, 66], [29, 72], [50, 74], [71, 72], [92, 66], [25, 47], [50, 50], [75, 47], [35, 22], [65, 22]]
  };

  const cache = new Map();
  function loadImage(src) {
    if (!cache.has(src)) {
      cache.set(src, new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      }));
    }
    return cache.get(src);
  }

  /* Foto de un jugador: primero la versión WebP ligera de assets/optimized/, luego la original. */
  function photoSources(path) {
    if (!path) return [];
    if (/^(https?:|blob:|data:)/.test(path)) return [path];
    const base = path.replace(/^.*\//, '').replace(/\.[a-z]+$/i, '');
    return [`${SITE}assets/optimized/${base}.webp`, `${SITE}${path}`];
  }
  async function loadPhoto(path) {
    for (const src of photoSources(path)) {
      const img = await loadImage(src);
      if (img) return img;
    }
    return null;
  }

  /* Foto recortada dentro de un círculo, encuadrando cara y pecho. */
  function circlePhoto(ctx, img, x, y, r) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const side = Math.min(iw * 0.52, ih);
    const sx = (iw - side) / 2;
    const sy = ih * 0.02;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = C.white;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.drawImage(img, sx, sy, side, side, x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  async function fontsReady() {
    try {
      await Promise.all([
        document.fonts.load(`900 120px ${DISPLAY}`),
        document.fonts.load(`800 120px ${DISPLAY}`),
        document.fonts.load(`700 40px ${TEXT}`)
      ]);
    } catch (e) { /* sin fuentes web: se usan las del sistema */ }
  }

  /* Ajusta el tamaño para que el texto quepa en el ancho. */
  function fit(ctx, text, maxWidth, size, weight, family) {
    let s = size;
    do {
      ctx.font = `${weight} ${s}px ${family}`;
      if (ctx.measureText(text).width <= maxWidth) break;
      s -= 4;
    } while (s > 20);
    return s;
  }

  function cover(ctx, img, x, y, w, h) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 3, dw, dh);
  }

  function rib(ctx, y, h) {
    for (let x = 0; x < W; x += 10) {
      ctx.fillStyle = C.pink;
      ctx.fillRect(x, y, 6, h);
      ctx.fillStyle = C.rib;
      ctx.fillRect(x + 6, y, 4, h);
    }
  }

  function knit(ctx) {
    ctx.fillStyle = C.kit;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 2;
    for (let y = 0; y < H; y += 28) {
      ctx.beginPath();
      for (let x = 0; x < W; x += 20) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + 10, y + 14);
        ctx.lineTo(x + 20, y);
      }
      ctx.stroke();
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  async function background(ctx, kind, photo) {
    const template = await loadImage(`${SITE}assets/historias/${kind}.png`);
    if (photo) {
      ctx.fillStyle = C.deep;
      ctx.fillRect(0, 0, W, H);
      cover(ctx, photo, 0, 0, W, H);
      const shade = ctx.createLinearGradient(0, 0, 0, H);
      shade.addColorStop(0, 'rgba(22,22,22,0.55)');
      shade.addColorStop(0.22, 'rgba(22,22,22,0)');
      shade.addColorStop(0.45, 'rgba(22,22,22,0.05)');
      shade.addColorStop(0.62, 'rgba(22,22,22,0.75)');
      shade.addColorStop(1, 'rgba(22,22,22,0.95)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, W, H);
    } else {
      knit(ctx);
    }
    if (template) ctx.drawImage(template, 0, 0, W, H);
  }

  async function header(ctx, match) {
    rib(ctx, 0, 18);
    const crest = await loadImage(`${SITE}assets/logo.png`);
    ctx.save();
    ctx.beginPath();
    ctx.arc(140, 170, 70, 0, Math.PI * 2);
    ctx.fillStyle = C.white;
    ctx.fill();
    if (crest) {
      ctx.clip();
      ctx.drawImage(crest, 70, 100, 140, 140);
    }
    ctx.restore();
    ctx.fillStyle = C.white;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    fit(ctx, 'BISONTES DUX', 760, 64, 900, DISPLAY);
    ctx.fillText('BISONTES DUX', 240, 165);
    ctx.fillStyle = C.pink;
    const vs = `vs ${match.rival || 'rival'}`.toUpperCase();
    fit(ctx, vs, 760, 40, 800, DISPLAY);
    ctx.fillText(vs, 240, 215);
  }

  function scoreboard(ctx, match, score, y, big) {
    const home = match.local !== false;
    const left = home ? 'BISONTES DUX' : (match.rival || 'RIVAL').toUpperCase();
    const right = home ? (match.rival || 'RIVAL').toUpperCase() : 'BISONTES DUX';
    const nums = home ? `${score.favor} - ${score.contra}` : `${score.contra} - ${score.favor}`;
    const h = big ? 300 : 190;
    ctx.fillStyle = C.white;
    roundRect(ctx, 70, y, W - 140, h, 24);
    ctx.fill();
    ctx.fillStyle = C.pink;
    ctx.fillRect(70, y + h - 14, W - 140, 14);
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const numSize = big ? 170 : 110;
    ctx.font = `900 ${numSize}px ${DISPLAY}`;
    ctx.fillText(nums, W / 2, y + h / 2);
    const side = (W - 140 - ctx.measureText(nums).width) / 2 - 40;
    fit(ctx, left, side, big ? 52 : 40, 800, DISPLAY);
    ctx.fillText(left, 70 + 20 + side / 2, y + h / 2);
    fit(ctx, right, side, big ? 52 : 40, 800, DISPLAY);
    ctx.fillText(right, W - 70 - 20 - side / 2, y + h / 2);
    ctx.textBaseline = 'alphabetic';
  }

  function minutePill(ctx, text, x, y) {
    ctx.font = `900 64px ${DISPLAY}`;
    const w = ctx.measureText(text).width + 56;
    ctx.fillStyle = C.pink;
    roundRect(ctx, x, y - 64, w, 86, 43);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.fillText(text, x + 28, y);
    return w;
  }

  function title(ctx, text, y, color, size) {
    ctx.fillStyle = color || C.white;
    ctx.textAlign = 'left';
    fit(ctx, text, W - 160, size || 260, 900, DISPLAY);
    ctx.fillText(text, 80, y);
  }

  function line(ctx, text, y, size, color, weight, family) {
    ctx.fillStyle = color || C.white;
    ctx.textAlign = 'left';
    fit(ctx, text, W - 160, size, weight || 800, family || DISPLAY);
    ctx.fillText(text, 80, y);
  }

  function card(ctx, color, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.18);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, 10, 12, 170, 240, 16);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, 0, 0, 170, 240, 16);
    ctx.fill();
    ctx.restore();
  }

  /* ---------- tipos de historia ---------- */
  async function renderEvent(ctx, d) {
    const { match, score } = d;
    await background(ctx, d.kind, d.photo);
    await header(ctx, match);
    const hasPhoto = Boolean(d.photo);

    if (d.kind === 'descanso' || d.kind === 'final' || d.kind === 'inicio') {
      const label = { descanso: 'DESCANSO', final: 'FINAL', inicio: '¡ARRANCAMOS!' }[d.kind];
      title(ctx, label, hasPhoto ? 1240 : 820, C.pink, 280);
      if (d.kind === 'inicio') {
        line(ctx, (match.competicion || 'Partido').toUpperCase(), hasPhoto ? 1330 : 920, 64);
        if (match.campo) line(ctx, match.campo, hasPhoto ? 1400 : 990, 44, C.white, 600, TEXT);
      }
      scoreboard(ctx, match, score, hasPhoto ? 1480 : 1120, true);
      if (d.kind === 'final' && score.favor > score.contra) line(ctx, '¡VICTORIA DE LA MANADA!', hasPhoto ? 1880 : 1520, 70, C.pink);
      return;
    }

    let y = hasPhoto ? 1380 : 1250;
    const titles = { gol: 'GOL', gol_contra: 'GOL RIVAL', amarilla: 'AMARILLA', roja: 'ROJA', penalti: 'PENALTI', anulado: 'GOL ANULADO' };
    /* Sobre foto, el rosa se pierde contra la camiseta: allí el título va en blanco. */
    const accent = d.kind === 'gol' && !hasPhoto ? C.pink : C.white;
    if (d.kind === 'amarilla' || d.kind === 'roja') card(ctx, d.kind === 'amarilla' ? C.yellow : C.red, 760, 360);
    const size = d.kind === 'gol' ? 340 : 230;
    if (d.minute) minutePill(ctx, d.minute, 80, y - size * 0.78 - 40);
    title(ctx, titles[d.kind] || d.kind.toUpperCase(), y, accent, size);
    y += 110;
    if (d.player) { line(ctx, d.player.toUpperCase(), y, 110, C.white, 900); y += 80; }
    if (d.extra) { line(ctx, d.extra, y, 46, C.white, 600, TEXT); y += 64; }
    scoreboard(ctx, match, score, Math.max(y + 30, 1600), false);
  }

  async function renderLineup(ctx, d) {
    const { match, lineup, people } = d;
    await background(ctx, 'once', null);
    await header(ctx, match);
    title(ctx, '11 INICIAL', 430, C.pink, 170);
    line(ctx, (lineup.formacion || '').toUpperCase(), 495, 46, C.white, 800);

    const px = 90;
    const py = 540;
    const pw = W - 180;
    const ph = 1000;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 5;
    ctx.strokeRect(px, py, pw, ph);
    ctx.beginPath();
    ctx.moveTo(px, py + ph / 2); ctx.lineTo(px + pw, py + ph / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px + pw / 2, py + ph / 2, 110, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeRect(px + pw * 0.24, py + ph - 150, pw * 0.52, 150);
    ctx.strokeRect(px + pw * 0.24, py, pw * 0.52, 150);

    const slots = FORMATIONS[lineup.formacion] || FORMATIONS['4-4-2'];
    const photos = await Promise.all(lineup.titulares.map(slug => (slug ? loadPhoto((people.get(slug) || {}).photo) : null)));
    lineup.titulares.forEach((slug, i) => {
      if (!slug || !slots[i]) return;
      const person = people.get(slug) || { short: slug };
      const x = px + (slots[i][0] / 100) * pw;
      const y = py + (slots[i][1] / 100) * ph;
      const r = 60;
      const photo = photos[i];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = C.white;
      ctx.fill();
      if (photo) circlePhoto(ctx, photo, x, y, r);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.lineWidth = 8;
      ctx.strokeStyle = C.pink;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const dorsal = person.dorsal != null ? String(person.dorsal) : '·';
      if (photo) {
        /* Con foto, el dorsal va en una chapa rosa en la esquina. */
        ctx.beginPath();
        ctx.arc(x + r * 0.78, y + r * 0.62, 26, 0, Math.PI * 2);
        ctx.fillStyle = C.pink;
        ctx.fill();
        ctx.fillStyle = C.ink;
        ctx.font = `900 32px ${DISPLAY}`;
        ctx.fillText(dorsal, x + r * 0.78, y + r * 0.62 + 2);
      } else {
        ctx.fillStyle = C.ink;
        ctx.font = `900 60px ${DISPLAY}`;
        ctx.fillText(dorsal, x, y + 3);
      }
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = C.white;
      const name = person.short.toUpperCase() + (lineup.capitan === slug ? ' (C)' : '');
      fit(ctx, name, 220, 38, 800, DISPLAY);
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(22,22,22,0.6)';
      ctx.strokeText(name, x, y + r + 46);
      ctx.fillText(name, x, y + r + 46);
    });

    const bench = (lineup.suplentes || []).map(slug => (people.get(slug) || { short: slug }).short).join(' · ');
    if (bench) {
      ctx.textAlign = 'left';
      line(ctx, 'SUPLENTES', 1640, 50, C.pink, 900);
      ctx.fillStyle = C.white;
      ctx.font = `600 38px ${TEXT}`;
      wrap(ctx, bench, 80, 1700, W - 160, 50, 3);
    }
    if (match.fecha) {
      const when = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(match.fecha));
      line(ctx, `${when}${match.campo ? ` · ${match.campo}` : ''}`, 1880, 36, C.white, 600, TEXT);
    }
  }

  function wrap(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = text.split(' ');
    let current = '';
    let lines = 0;
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        ctx.fillText(current, x, y + lines * lineHeight);
        current = word;
        if (++lines >= maxLines) return;
      } else current = test;
    }
    if (current) ctx.fillText(current, x, y + lines * lineHeight);
  }

  /* d.kind: inicio, descanso, final, gol, gol_contra, amarilla, roja, penalti, anulado, once */
  async function render(d) {
    await fontsReady();
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (d.kind === 'once') await renderLineup(ctx, d);
    else await renderEvent(ctx, d);
    rib(ctx, H - 18, 18);
    return new Promise((resolve, reject) => canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('No se pudo crear la imagen'))), 'image/jpeg', 0.9));
  }

  window.BisontesHistorias = { render, FORMATIONS, loadImage, photoSources };
}());
