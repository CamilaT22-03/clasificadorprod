// Detector de botellas con COCO-SSD (corre en el navegador, nada se sube).
(() => {
  const UMBRAL = 0.5;        // mínimo para aceptar una detección
  const POCO_SEGURO = 0.6;   // debajo de esto se avisa
  const FRAMES_CONFIRMA = 3; // cuadros seguidos antes de registrar (evita parpadeos)
  const OLVIDO_MS = 1500;    // tiempo sin verla para olvidar una botella

  const $ = id => document.getElementById(id);
  const video = $('video'), foto = $('foto'), canvas = $('overlay'), ctx = canvas.getContext('2d');
  const estado = $('estado'), nVista = $('n-vista'), nToma = $('n-toma'), placeholder = $('placeholder');

  let modelo = null, stream = null, corriendo = false, fuente = null;
  let pistas = [], totalToma = 0, ultimas = [];

  const msg = t => { estado.textContent = t; };

  function iou(a, b) {
    const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]);
    const x2 = Math.min(a[0] + a[2], b[0] + b[2]), y2 = Math.min(a[1] + a[3], b[1] + b[3]);
    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    return inter / (a[2] * a[3] + b[2] * b[3] - inter || 1);
  }

  function ajustarCanvas(el) {
    const w = el.videoWidth || el.naturalWidth, h = el.videoHeight || el.naturalHeight;
    canvas.width = w; canvas.height = h;
  }

  function dibujar(dets) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = Math.max(2, canvas.width / 200);
    ctx.font = `${Math.max(14, canvas.width / 40)}px system-ui`;
    for (const d of dets) {
      const seguro = d.score >= POCO_SEGURO;
      ctx.strokeStyle = seguro ? '#2e9e4f' : '#f2b705';
      ctx.fillStyle = ctx.strokeStyle;
      const [x, y, w, h] = d.bbox;
      ctx.strokeRect(x, y, w, h);
      const t = `Botella ${Math.round(d.score * 100)}%${seguro ? '' : ' (poco seguro)'}`;
      ctx.fillRect(x, Math.max(0, y - 22), ctx.measureText(t).width + 10, 22);
      ctx.fillStyle = '#fff';
      ctx.fillText(t, x + 5, Math.max(16, y - 5));
    }
  }

  async function detectar(el) {
    const todas = await modelo.detect(el);
    return todas.filter(d => d.class === 'bottle' && d.score >= UMBRAL);
  }

  function registrar(dets) {
    if (!dets.length) return;
    const conf = dets.reduce((s, d) => s + d.score, 0) / dets.length;
    Inventario.agregar({
      cantidad: dets.length,
      confianza: conf,
      cajas: dets.map(d => d.bbox.map(n => Math.round(n)))
    });
    totalToma += dets.length;
    nToma.textContent = totalToma;
  }

  // Seguimiento simple: la misma botella no se registra dos veces mientras siga a la vista.
  function seguir(dets) {
    const ahora = performance.now();
    const nuevas = [];
    for (const d of dets) {
      let mejor = null, mejorIou = 0.3;
      for (const p of pistas) {
        const v = iou(p.bbox, d.bbox);
        if (v > mejorIou) { mejor = p; mejorIou = v; }
      }
      if (mejor) {
        mejor.bbox = d.bbox; mejor.visto = ahora; mejor.frames++; mejor.det = d;
      } else {
        pistas.push({ bbox: d.bbox, visto: ahora, frames: 1, registrada: false, det: d });
      }
    }
    for (const p of pistas) {
      if (!p.registrada && p.frames >= FRAMES_CONFIRMA) { p.registrada = true; nuevas.push(p.det); }
    }
    pistas = pistas.filter(p => ahora - p.visto < OLVIDO_MS);
    registrar(nuevas);
  }

  async function bucle() {
    if (!corriendo) return;
    if (video.readyState >= 2 && !video.paused && !video.ended) {
      ultimas = await detectar(video);
      dibujar(ultimas);
      nVista.textContent = ultimas.length;
      seguir(ultimas);
      msg(ultimas.length ? `Veo ${ultimas.length} botella${ultimas.length > 1 ? 's' : ''}` : 'Buscando botellas…');
    }
    requestAnimationFrame(bucle);
  }

  function detener() {
    corriendo = false;
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    video.pause(); video.removeAttribute('src'); video.srcObject = null;
    video.hidden = true;
  }

  function nuevaToma() {
    pistas = []; totalToma = 0; ultimas = [];
    nToma.textContent = 0; nVista.textContent = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function iniciarCamara() {
    if (!modelo) return msg('El modelo aún se está cargando…');
    detener(); foto.hidden = true; nuevaToma();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch {
      return msg('No pude abrir la cámara. Revisa el permiso y usa http(s), no un archivo local.');
    }
    video.srcObject = stream; video.hidden = false; placeholder.hidden = true;
    await video.play();
    ajustarCanvas(video);
    fuente = 'camara'; corriendo = true; bucle();
  }

  async function cargarVideo(file) {
    if (!modelo) return msg('El modelo aún se está cargando…');
    detener(); foto.hidden = true; nuevaToma();
    video.src = URL.createObjectURL(file);
    video.muted = true; video.hidden = false; placeholder.hidden = true;
    await video.play().catch(() => {});
    video.onloadedmetadata = () => ajustarCanvas(video);
    ajustarCanvas(video);
    fuente = 'video'; corriendo = true; bucle();
  }

  async function cargarFoto(file) {
    if (!modelo) return msg('El modelo aún se está cargando…');
    if (file.size > 12 * 1024 * 1024) return msg('La foto pesa más de 12 MB.');
    detener(); nuevaToma();
    foto.src = URL.createObjectURL(file);
    await foto.decode().catch(() => {});
    foto.hidden = false; placeholder.hidden = true;
    ajustarCanvas(foto);
    msg('Analizando…');
    const dets = await detectar(foto);
    dibujar(dets);
    ultimas = dets;
    nVista.textContent = dets.length;
    fuente = 'foto';
    if (dets.length) {
      registrar(dets);
      const poco = dets.some(d => d.score < POCO_SEGURO);
      msg(`${dets.length} botella${dets.length > 1 ? 's' : ''} registrada${dets.length > 1 ? 's' : ''}${poco ? ' (alguna poco segura)' : ''}.`);
    } else {
      msg('No encontré botellas en esta imagen.');
    }
  }

  function registrarAhora() {
    if (!ultimas.length) return msg('No hay botellas a la vista para registrar.');
    const pendientes = pistas.filter(p => !p.registrada);
    if (fuente === 'foto' || !pistas.length) {
      registrar(ultimas);
    } else if (pendientes.length) {
      pendientes.forEach(p => { p.registrada = true; });
      registrar(pendientes.map(p => p.det));
    } else {
      return msg('Las botellas a la vista ya están registradas.');
    }
    msg('Registro forzado.');
  }

  async function cargarModelo() {
    try {
      modelo = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      msg('Listo. Elige Cámara, Foto o Video.');
    } catch {
      msg('No pude cargar el modelo. Revisa tu conexión y recarga.');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('btn-camara').onclick = iniciarCamara;
    $('in-foto').onchange = e => e.target.files[0] && cargarFoto(e.target.files[0]);
    $('in-video').onchange = e => e.target.files[0] && cargarVideo(e.target.files[0]);
    $('btn-registrar').onclick = registrarAhora;
    $('btn-nueva').onclick = () => { nuevaToma(); msg('Nueva toma lista.'); };
    cargarModelo();
  });
})();
