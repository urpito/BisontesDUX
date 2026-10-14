/* ============================================================
   BISONTES DUX — reconocimiento de jugadores en las fotos
   Gratis y en el propio navegador del admin (nada sale a terceros):
   · Human (MIT): personas y caras, y una «huella» numérica de cada cara.
   · Tesseract.js (Apache 2.0): lee el dorsal en el torso de cada persona.
   Las caras se comparan solo con las de jugadores que hayan dado su
   permiso (tabla gallery_face_consent); sin permiso, solo el dorsal.
   Se carga bajo demanda, únicamente cuando un admin sube fotos.
   ============================================================ */
(function () {
  'use strict';

  const LIBS = {
    human: {
      src: 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/dist/human.js',
      integrity: 'sha384-vASLsXJSh9FIgw41jM2fwBSF2MoEPlegwV4SO9G3NeyRMcWf7XjSdYvU6MlwOfQl'
    },
    tesseract: {
      src: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js',
      integrity: 'sha384-2BQ3U3OdKOb0Uczxqr41I9UvZkzr4V9Hv8uSzMMZAlmhsFClvdZX5wi5fDCzG+tM'
    }
  };
  const MODELS = 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/';
  const ANALYSIS_MAX = 1600;      /* lado mayor de la imagen que se analiza */
  const FACE_MATCH = 0.6;         /* parecido mínimo para dar una cara por buena (0–1) */
  /* Confianza mínima del dorsal leído (0–100). Los dorsales de verdad salen al 90+; una cifra
     suelta se confunde más con trozos de letras o del escudo, así que se le exige más. */
  const OCR_CONFIDENCE = { 1: 85, 2: 70 };

  let ready = null;
  let human = null;
  let ocr = null;

  function loadScript({ src, integrity }) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.integrity = integrity;
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = () => reject(new Error('No se ha podido cargar el reconocimiento. Revisa la conexión.'));
      document.head.appendChild(script);
    });
  }

  /* Descarga librerías y modelos (unos 20 MB la primera vez; luego quedan en caché). */
  function prepare() {
    if (!ready) {
      ready = (async () => {
        await Promise.all([loadScript(LIBS.human), loadScript(LIBS.tesseract)]);
        const HumanClass = window.Human.Human || window.Human.default || window.Human;
        human = new HumanClass({
          modelBasePath: MODELS,
          debug: false,
          cacheSensitivity: 0,
          filter: { enabled: false },
          face: {
            enabled: true,
            detector: { rotation: false, maxDetected: 25, minConfidence: 0.4, return: false },
            mesh: { enabled: true },
            iris: { enabled: false },
            description: { enabled: true },
            emotion: { enabled: false },
            antispoof: { enabled: false },
            liveness: { enabled: false }
          },
          body: { enabled: false },
          hand: { enabled: false },
          gesture: { enabled: false },
          segmentation: { enabled: false },
          object: { enabled: true, modelPath: 'centernet.json', minConfidence: 0.3, maxDetected: 25 }
        });
        await human.load();
        ocr = await window.Tesseract.createWorker('eng', 1);
        await ocr.setParameters({ tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: '7' });
      })().catch(error => { ready = null; throw error; });
    }
    return ready;
  }

  function scaled(source, width, height, maxSide) {
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  const BAND_HEIGHT = 300;   /* alto al que se normaliza el torso */

  /* Torso de la persona (donde va el dorsal) en gris y su umbral de Otsu. */
  function torso(canvas, [x, y, w, h]) {
    const sx = x + w * 0.08;
    const sy = y + h * 0.12;
    const sw = w * 0.84;
    const sh = h * 0.68;
    const width = Math.max(1, Math.round(sw * (BAND_HEIGHT / Math.max(1, sh))));
    const crop = document.createElement('canvas');
    crop.width = width;
    crop.height = BAND_HEIGHT;
    const context = crop.getContext('2d', { willReadFrequently: true });
    context.drawImage(canvas, sx, sy, sw, sh, 0, 0, width, BAND_HEIGHT);
    const px = context.getImageData(0, 0, width, BAND_HEIGHT).data;
    const gray = new Uint8Array(width * BAND_HEIGHT);
    const histogram = new Array(256).fill(0);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      gray[j] = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
      histogram[gray[j]]++;
    }
    const threshold = otsu(histogram, 0, 255);
    /* Segundo umbral dentro de lo claro: separa un número blanco de una camiseta clara. */
    return { gray, width, threshold, high: otsu(histogram, threshold + 1, 255) };
  }

  function otsu(histogram, from, to) {
    let total = 0;
    let sum = 0;
    for (let t = from; t <= to; t++) { total += histogram[t]; sum += t * histogram[t]; }
    let sumBack = 0;
    let weightBack = 0;
    let bestVariance = 0;
    let threshold = Math.round((from + to) / 2);
    for (let t = from; t <= to; t++) {
      weightBack += histogram[t];
      if (!weightBack) continue;
      const weightFore = total - weightBack;
      if (!weightFore) break;
      sumBack += t * histogram[t];
      const variance = weightBack * weightFore * ((sumBack / weightBack) - ((sum - sumBack) / weightFore)) ** 2;
      if (variance > bestVariance) { bestVariance = variance; threshold = t; }
    }
    return threshold;
  }

  /* Manchas que parecen dígitos (alto razonable, más altas que anchas, bastante «tinta»),
     agrupadas de una en una o de dos en dos si están juntas y tienen el mismo alto. */
  function digitGroups(mask, width) {
    const height = BAND_HEIGHT;
    const label = new Int32Array(width * height);
    const blobs = [];
    for (let start = 0; start < mask.length; start++) {
      if (!mask[start] || label[start]) continue;
      const blob = { x0: width, y0: height, x1: 0, y1: 0, area: 0 };
      const stack = [start];
      label[start] = blobs.length + 1;
      while (stack.length) {
        const index = stack.pop();
        const px = index % width;
        const py = (index - px) / width;
        blob.area++;
        if (px < blob.x0) blob.x0 = px;
        if (px > blob.x1) blob.x1 = px;
        if (py < blob.y0) blob.y0 = py;
        if (py > blob.y1) blob.y1 = py;
        for (const next of [index - 1, index + 1, index - width, index + width]) {
          if (next < 0 || next >= mask.length || label[next] || !mask[next]) continue;
          if ((next === index - 1 && px === 0) || (next === index + 1 && px === width - 1)) continue;
          label[next] = blobs.length + 1;
          stack.push(next);
        }
      }
      blobs.push(blob);
    }
    const digits = blobs.filter(b => {
      const w = b.x1 - b.x0 + 1;
      const h = b.y1 - b.y0 + 1;
      return h >= height * 0.08 && h <= height * 0.5 && w <= h * 1.1 && w >= h * 0.12 && b.area / (w * h) > 0.18;
    }).sort((a, b) => a.x0 - b.x0);
    /* Una cifra con otra igual al lado solo se lee como pareja (el «11» no es un «1»). */
    const pairs = [];
    const paired = new Set();
    for (let i = 0; i < digits.length - 1; i++) {
      const a = digits[i];
      const b = digits[i + 1];
      const ha = a.y1 - a.y0;
      const hb = b.y1 - b.y0;
      const overlap = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (Math.abs(ha - hb) < Math.max(ha, hb) * 0.25 && overlap > Math.min(ha, hb) * 0.6 && b.x0 - a.x1 < Math.max(ha, hb) * 0.6) {
        pairs.push([a, b]);
        paired.add(a);
        paired.add(b);
      }
    }
    const groups = [...digits.filter(d => !paired.has(d)).map(d => [d]), ...pairs];
    return groups.map(group => ({
      x0: Math.min(...group.map(b => b.x0)), y0: Math.min(...group.map(b => b.y0)),
      x1: Math.max(...group.map(b => b.x1)), y1: Math.max(...group.map(b => b.y1)), size: group.length
    }));
  }

  /* Recorte de un grupo en negro sobre blanco y con margen: así es como mejor lee Tesseract. */
  function groupCanvas(mask, width, g) {
    const pad = Math.round((g.y1 - g.y0) * 0.35) + 4;
    const w = g.x1 - g.x0 + 1 + pad * 2;
    const h = g.y1 - g.y0 + 1 + pad * 2;
    const crop = document.createElement('canvas');
    crop.width = w;
    crop.height = h;
    const context = crop.getContext('2d');
    const image = context.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = g.x0 - pad + x;
        const sy = g.y0 - pad + y;
        const ink = sx >= g.x0 && sx <= g.x1 && sy >= g.y0 && sy <= g.y1 && mask[sy * width + sx];
        const i = (y * w + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = ink ? 0 : 255;
        image.data[i + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    return crop;
  }

  /* Prueba dígitos oscuros y claros; se queda con la lectura más segura que sea un dorsal
     de la plantilla (prefiriendo dos cifras a una suelta que pueda ser parte de otra). */
  async function readNumber(canvas, box, dorsals, reads) {
    const { gray, width, threshold, high } = torso(canvas, box);
    let best = null;
    for (const [dark, cut] of [[true, threshold], [false, threshold], [false, high]]) {
      const mask = new Uint8Array(gray.length);
      for (let i = 0; i < gray.length; i++) mask[i] = dark ? gray[i] <= cut : gray[i] > cut;
      const groups = digitGroups(mask, width).sort((a, b) => b.size - a.size || (b.y1 - b.y0) - (a.y1 - a.y0)).slice(0, 8);
      for (const group of groups) {
        const { data } = await ocr.recognize(groupCanvas(mask, width, group));
        const text = String(data.text || '').replace(/\D/g, '');
        reads.push(`${dark ? 'oscuro' : 'claro'} ${group.size}: ${text || '·'} (${Math.round(data.confidence)})`);
        if (!text || !dorsals.has(text) || data.confidence < OCR_CONFIDENCE[text.length]) continue;
        const score = data.confidence + (text.length === group.size ? 20 : 0) + (group.size === 2 ? 10 : 0);
        if (!best || score > best.score) best = { number: text, confidence: Math.round(data.confidence), score };
      }
    }
    return best;
  }

  function bestFace(embedding, known) {
    let best = null;
    for (const item of known) {
      const score = human.match.similarity(embedding, item.embedding);
      if (score >= FACE_MATCH && (!best || score > best.score)) best = { slug: item.player_slug, score };
    }
    return best;
  }

  function inside(face, person) {
    const [fx, fy, fw, fh] = face.box;
    const [px, py, pw, ph] = person.box;
    const cx = fx + fw / 2;
    const cy = fy + fh / 2;
    return cx >= px && cx <= px + pw && cy >= py && cy <= py + ph * 0.35;
  }

  /* source: ImageBitmap o <img>. ctx.roster: [{slug, dorsal}], ctx.known: [{player_slug, embedding}],
     ctx.consent: Set de slugs con permiso. Devuelve quién sale y qué caras se pueden aprender. */
  async function analyze(source, width, height, ctx) {
    await prepare();
    const canvas = scaled(source, width, height, ANALYSIS_MAX);
    const result = await human.detect(canvas);
    const bySlugDorsal = new Map(ctx.roster.filter(person => person.dorsal != null).map(person => [String(person.dorsal), person.slug]));
    const dorsals = new Set(bySlugDorsal.keys());
    const persons = (result.object || []).filter(item => item.label === 'person');
    const faces = (result.face || []).filter(face => Array.isArray(face.embedding) && face.embedding.length);
    const found = new Map();      /* slug → 'dorsal' | 'cara' */
    const learn = [];
    const reads = [];

    for (const face of faces) {
      const match = bestFace(face.embedding, ctx.known);
      face.match = match && ctx.consent.has(match.slug) ? match : null;
      if (face.match) found.set(face.match.slug, 'cara');
    }
    for (const person of persons) {
      const read = await readNumber(canvas, person.box, dorsals, reads);
      if (!read) continue;
      const slug = bySlugDorsal.get(read.number);
      found.set(slug, 'dorsal');
      /* Aprende la cara de esa persona si el dorsal lo identifica y hay permiso. */
      const own = faces.filter(face => inside(face, person));
      if (own.length === 1 && ctx.consent.has(slug) && (!own[0].match || own[0].match.slug === slug)) {
        learn.push({ player_slug: slug, embedding: Array.from(own[0].embedding) });
      }
    }
    return { players: [...found.keys()], how: Object.fromEntries(found), learn, stats: { persons: persons.length, faces: faces.length, reads, boxes: persons.map(person => person.box.map(Math.round)) } };
  }

  /* Para ajustar el umbral de parecido con fotos reales: «huellas» de las caras de una imagen. */
  async function faceEmbeddings(source, width, height) {
    await prepare();
    const result = await human.detect(scaled(source, width, height, ANALYSIS_MAX));
    return (result.face || []).filter(face => face.embedding && face.embedding.length).map(face => Array.from(face.embedding));
  }

  function similarity(a, b) {
    return human.match.similarity(a, b);
  }

  window.BisontesReconocimiento = { prepare, analyze, faceEmbeddings, similarity };
}());
