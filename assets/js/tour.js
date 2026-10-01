/* =========================================================
   HERO — video controllato dallo scroll
   Vanilla JS, nessuna dipendenza. Nessun audio.
   ========================================================= */
(() => {
  'use strict';

  const CONFIG = {
    // Si carica UNA sola sorgente: orientamento + formato (WebM dove conviene, MP4 su Safari/iOS)
    sources: {
      landscape: { webm: 'assets/video/hero-desktop.webm', mp4: 'assets/video/hero-desktop.mp4' }, // 1280×720
      portrait: { webm: 'assets/video/hero-mobile.webm', mp4: 'assets/video/hero-mobile.mp4' }      // 720×1280 (9:16)
    },
    portraitQuery: '(max-aspect-ratio: 1/1)',
    smoothing: 0.15,   // currentTime += (target - currentTime) * 0.15 (tarato su 60 fps)
    fade: 0.022,       // durata di entrata/uscita dei testi, in frazione dello scroll
    hintFadeEnd: 0.05, // "Scorri per esplorare" sparisce entro il 5%
    endFrom: 0.9,      // finale: la scena sfuma nel colore della pagina
    unlockDelay: 1500  // ms di attesa prima di mostrare il pulsante di sblocco (Safari)
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t * t;
  const round = (v) => Math.round(v * 1000) / 1000;

  const tour = $('#tour');
  if (!tour) return;

  const stage = $('.tour__stage', tour);
  const video = $('.tour__video', tour);
  const fill = $('.progress__fill', tour);
  const ticksList = $('.progress__ticks', tour);
  const hint = $('.tour__hint', tour);
  const shadeEnd = $('.tour__shade-end', tour);
  const shade = $('.tour__shade', tour);
  const loading = $('.tour__loading', tour);
  const loadingBar = loading && loading.firstElementChild;
  const unlockBtn = $('.tour__unlock', tour);

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionQuery.matches;

  /* ---------- Scene ---------- */

  const scenes = Array.from(tour.querySelectorAll('.scene')).map((el, i, all) => ({
    el,
    index: i,
    first: i === 0,
    last: i === all.length - 1,
    from: parseFloat(el.dataset.from) || 0,
    to: parseFloat(el.dataset.to) || 1,
    video: parseFloat(el.dataset.video),          // secondo del video a inizio scena
    still: parseFloat(el.dataset.still) || 0,      // secondo mostrato con "riduci movimento"
    label: el.dataset.label || (el.querySelector('.scene__eyebrow') || {}).textContent || `Scena ${i + 1}`,
    focusables: Array.from(el.querySelectorAll('a, button')),
    lastIn: -1,
    lastOut: -1,
    active: null
  }));

  // Tacche della barra di avanzamento: una per scena, cliccabili da mouse e tastiera
  const ticks = scenes.map((scene) => {
    const li = document.createElement('li');
    li.style.setProperty('--at', scene.from);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.label = scene.label.replace(/^\d+\s*—\s*/, '');
    btn.setAttribute('aria-label', `Vai alla scena: ${btn.dataset.label}`);
    btn.addEventListener('click', () => goToScene(scene));
    li.appendChild(btn);
    ticksList.appendChild(li);
    return btn;
  });

  /* ---------- Misure (in cache, aggiornate solo al resize) ---------- */

  let sectionTop = 0;
  let scrollable = 1;

  function measure() {
    sectionTop = tour.getBoundingClientRect().top + window.scrollY;
    // Lo stage è sticky: resta fermo per (altezza sezione − altezza stage)
    scrollable = Math.max(1, tour.offsetHeight - stage.offsetHeight);
  }

  function readProgress() {
    return clamp01((window.scrollY - sectionTop) / scrollable);
  }

  /* ---------- Render dei testi e della UI ---------- */

  let lastP = -1;
  let lastActive = -1;
  let lastHint = -1;
  let lastEnd = -1;
  let lastShade = -1;

  function activeIndexAt(p) {
    for (let i = 0; i < scenes.length; i++) if (p < scenes[i].to) return i;
    return scenes.length - 1;
  }

  function render(p) {
    const F = CONFIG.fade;

    for (const s of scenes) {
      const vIn = s.first ? 1 : easeOut(clamp01((p - s.from) / F));
      const vOut = s.last ? 0 : easeIn(clamp01((p - (s.to - F)) / F));
      const rIn = round(vIn);
      const rOut = round(vOut);
      if (rIn !== s.lastIn) { s.el.style.setProperty('--in', rIn); s.lastIn = rIn; }
      if (rOut !== s.lastOut) { s.el.style.setProperty('--out', rOut); s.lastOut = rOut; }

      const visible = vIn > 0.5 && vOut < 0.5;
      if (visible !== s.active) {
        s.active = visible;
        s.el.classList.toggle('is-active', visible);
        // I link di una scena invisibile non devono ricevere il focus da tastiera
        s.focusables.forEach((f) => { f.tabIndex = visible ? 0 : -1; });
      }
    }

    const rp = round(p);
    if (rp !== lastP) { fill.style.setProperty('--p', rp); lastP = rp; }

    const active = activeIndexAt(p);
    if (active !== lastActive) {
      ticks.forEach((t, i) => {
        if (i === active) t.setAttribute('aria-current', 'step');
        else t.removeAttribute('aria-current');
      });
      lastActive = active;
    }

    const h = round(1 - clamp01(p / CONFIG.hintFadeEnd));
    if (h !== lastHint) { hint.style.setProperty('--hint', h); lastHint = h; }

    const e = round(clamp01((p - CONFIG.endFrom) / (1 - CONFIG.endFrom)));
    if (e !== lastEnd) { shadeEnd.style.setProperty('--end', e); lastEnd = e; }

    // La sfumatura scura resta sempre sotto i testi: contrasto garantito in ogni fotogramma
    let vis = 0;
    for (const sc of scenes) vis = Math.max(vis, sc.lastIn * (1 - sc.lastOut));
    const sh = round(0.55 + 0.45 * vis);
    if (sh !== lastShade) { shade.style.setProperty('--shade', sh); lastShade = sh; }
  }

  /* ---------- Sincronizzazione video ---------- */

  let duration = 0;
  let videoReady = false;
  let lastSeek = -1;
  let priming = false;
  let unlocked = false;
  let revealed = false;

  /*
   * Mappa scroll → tempo del video (attributo data-timeline, coppie "scroll:secondo").
   * Tra due punti il video avanza in modo lineare.
   */
  let timeline = null;

  function buildTimeline() {
    if (tour.dataset.timeline) {
      const pts = tour.dataset.timeline.split(',').map((pair) => pair.split(':').map(Number))
        .filter(([pp, t]) => Number.isFinite(pp) && Number.isFinite(t))
        .map(([pp, t]) => [pp, Math.min(t, duration)]);
      if (pts.length >= 2) { timeline = pts; return; }
    }
    timeline = null;
  }

  function timeAt(p) {
    if (!timeline) return p * duration;
    for (let i = 1; i < timeline.length; i++) {
      const [p1, t1] = timeline[i];
      if (p <= p1) {
        const [p0, t0] = timeline[i - 1];
        return t0 + (t1 - t0) * (p1 > p0 ? (p - p0) / (p1 - p0) : 1);
      }
    }
    return duration;
  }

  function desiredTime(p) {
    // Non arriviamo esattamente a "duration": alcuni browser mostrano un frame nero
    const max = duration - 0.05;
    if (reduced) {
      // Movimento ridotto: un fotogramma fisso rappresentativo per ogni scena
      return Math.min(scenes[activeIndexAt(p)].still, max);
    }
    return Math.max(0, Math.min(timeAt(p), max));
  }

  /** Ritorna true quando il video è allineato e non servono altri frame. */
  function syncVideo(p) {
    if (!videoReady || priming) return true;
    if (video.seeking) return false; // un seek alla volta: evita la coda di seek su Safari
    const t = desiredTime(p);
    if (Math.abs(t - lastSeek) < 1 / 60) return true; // già su questo fotogramma
    lastSeek = t;
    try { video.currentTime = t; } catch (_) { /* metadati non pronti */ }
    return false;
  }

  /* ---------- Loop con requestAnimationFrame (solo quando serve) ---------- */

  let rafId = 0;
  let lastFrame = 0;
  let current = 0;

  function requestTick() {
    if (rafId) return;
    lastFrame = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function tick(now) {
    const dt = Math.min(64, Math.max(1, now - lastFrame));
    lastFrame = now;

    const target = readProgress();
    if (reduced) {
      current = target;
    } else {
      // Interpolazione indipendente dal refresh rate (60/120 Hz): scorrimento morbido del tempo del video
      const k = 1 - Math.pow(1 - CONFIG.smoothing, dt / 16.667);
      current += (target - current) * k;
      if (Math.abs(target - current) < 0.00005) current = target;
    }

    render(current);
    const settled = syncVideo(current);

    rafId = (current !== target || !settled) ? requestAnimationFrame(tick) : 0;
  }

  /* ---------- Caricamento del video ---------- */

  function pickSource() {
    const set = window.matchMedia(CONFIG.portraitQuery).matches ? CONFIG.sources.portrait : CONFIG.sources.landscape;
    const apple = /Apple/.test(navigator.vendor || '');
    const vp9 = document.createElement('video').canPlayType('video/webm; codecs="vp9"') === 'probably';
    return !apple && vp9 && set.webm ? set.webm : set.mp4;
  }

  function setLoad(v) {
    if (loadingBar) loadingBar.style.setProperty('--load', round(v));
  }

  function finishLoading() {
    if (!loading) return;
    setLoad(1);
    loading.classList.add('is-done');
  }

  // Scarica l'intero file in memoria: i seek diventano istantanei (niente range request)
  async function fetchAsBlobUrl(src) {
    const res = await fetch(src, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const total = Number(res.headers.get('Content-Length')) || 0;
    const type = /\.webm$/.test(src) ? 'video/webm' : 'video/mp4';

    if (!res.body || !total) {
      const blob = await res.blob();
      return URL.createObjectURL(new Blob([blob], { type }));
    }

    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      setLoad(received / total);
    }
    const blob = new Blob(chunks, { type });
    chunks.length = 0;
    return URL.createObjectURL(blob);
  }

  let objectUrl = null;
  let fallbackSrc = null;

  function attach(url) {
    video.src = url;
    video.load();
  }

  video.addEventListener('error', () => {
    // 1) blob non riproducibile (es. policy del server): riprova col file diretto
    if (objectUrl && video.src === objectUrl && fallbackSrc) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
      attach(fallbackSrc);
      return;
    }
    // 2) WebM non decodificato: ripiega sull'MP4 equivalente
    if (/\.webm$/.test(fallbackSrc || '')) {
      fallbackSrc = fallbackSrc.replace(/\.webm$/, '.mp4');
      attach(fallbackSrc);
    }
  });

  video.addEventListener('loadedmetadata', () => {
    duration = video.duration || 0;
    buildTimeline();
    prime();
  });

  video.addEventListener('loadeddata', () => {
    videoReady = duration > 0;
    lastSeek = -1;
    requestTick();
  });

  video.addEventListener('seeked', reveal);

  // Il video non deve mai partire da solo
  video.addEventListener('play', () => { if (!priming) video.pause(); });

  function reveal() {
    if (revealed || video.readyState < 2) return;
    revealed = true;
    video.classList.add('is-ready');
    hideUnlock();
  }

  /*
   * iOS/Safari: alcuni dispositivi non disegnano i frame finché il video non è
   * stato avviato almeno una volta. Lo avviamo (muto) e lo fermiamo subito.
   */
  function prime() {
    if (unlocked || priming) return;
    priming = true;
    let result;
    try { result = video.play(); } catch (_) { result = null; }

    const done = (ok) => {
      priming = false;
      if (ok) {
        unlocked = true;
        video.pause();
        hideUnlock();
      } else {
        scheduleUnlockButton();
      }
      lastSeek = -1;
      if (video.readyState >= 2) videoReady = duration > 0;
      requestTick();
    };

    if (result && typeof result.then === 'function') {
      result.then(() => done(true), () => done(false));
    } else {
      done(!video.paused);
    }
  }

  let unlockTimer = 0;
  function scheduleUnlockButton() {
    if (!unlockBtn || unlockTimer) return;
    // Mostra il pulsante di sblocco solo se i frame non arrivano davvero
    unlockTimer = window.setTimeout(() => {
      unlockTimer = 0;
      if (!revealed) {
        unlockBtn.hidden = false;
        hint.style.visibility = 'hidden';
      }
    }, CONFIG.unlockDelay);
  }

  function hideUnlock() {
    if (unlockTimer) { clearTimeout(unlockTimer); unlockTimer = 0; }
    if (unlockBtn && !unlockBtn.hidden) {
      unlockBtn.hidden = true;
      hint.style.visibility = '';
    }
  }

  if (unlockBtn) {
    unlockBtn.addEventListener('click', () => {
      unlocked = false;
      if (video.readyState === 0) video.load();
      prime();
    });
  }

  // Qualsiasi gesto dell'utente è un'occasione per sbloccare il video su iOS
  const gestureUnlock = () => {
    if (unlocked) {
      ['touchend', 'pointerup', 'keydown'].forEach((ev) => window.removeEventListener(ev, gestureUnlock));
      return;
    }
    if (duration > 0) prime();
  };
  ['touchend', 'pointerup', 'keydown'].forEach((ev) => window.addEventListener(ev, gestureUnlock, { passive: true }));

  async function loadVideo() {
    const src = pickSource();
    fallbackSrc = src;
    let url = src;
    if (/^https?:$/.test(location.protocol) && 'fetch' in window && 'Blob' in window) {
      try {
        url = await fetchAsBlobUrl(src);
        objectUrl = url;
      } catch (_) {
        url = src; // fallback: streaming diretto del file
      }
    }
    finishLoading();
    attach(url);
  }

  /* ---------- Navigazione ---------- */

  function scrollToProgress(p) {
    measure();
    window.scrollTo({ top: sectionTop + p * scrollable, behavior: reduced ? 'auto' : 'smooth' });
  }

  function goToScene(scene) {
    const p = scene.first ? 0 : scene.last ? 1 : Math.min(scene.to - CONFIG.fade * 2, scene.from + CONFIG.fade * 2);
    scrollToProgress(p);
  }

  document.querySelectorAll('[data-replay]').forEach((btn) => {
    btn.addEventListener('click', () => {
      scrollToProgress(0);
      tour.focus({ preventScroll: true });
      if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    });
  });

  /* ---------- Eventi globali ---------- */

  const onResize = () => { measure(); requestTick(); };

  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('orientationchange', onResize, { passive: true });
  window.addEventListener('pageshow', onResize); // ritorno dalla cache back/forward
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(tour);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);

  const onMotionChange = (e) => { reduced = e.matches; lastSeek = -1; requestTick(); };
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange);
  else if (motionQuery.addListener) motionQuery.addListener(onMotionChange);

  /* ---------- Avvio ---------- */

  measure();
  current = readProgress();
  render(current);

  // Il video parte dopo il caricamento della pagina: nel frattempo resta il poster (immagine principale)
  let started = false;
  const go = () => { if (!started) { started = true; loadVideo(); } };
  const startVideo = () => {
    // appena il browser è libero (al massimo 1,2 s dopo il load), o subito al primo scroll
    if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 1200 });
    else setTimeout(go, 300);
    window.addEventListener('scroll', go, { once: true, passive: true });
  };
  if (document.readyState === 'complete') startVideo();
  else window.addEventListener('load', startVideo, { once: true });
})();
