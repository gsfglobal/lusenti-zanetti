/* =========================================================
   I MEDICI — carosello dei ritratti + scheda profilo
   Il ritratto al centro è l'attivo: si illumina, cresce e avanza.
   Legge window.teamMembers (team-data.js). Vanilla JS, nessuna dipendenza.
   ========================================================= */
(() => {
  'use strict';

  const section = document.getElementById('medici');
  const members = Array.isArray(window.teamMembers) ? window.teamMembers : [];
  if (!section) return;
  if (!members.length) { section.hidden = true; return; }
  const N = members.length;

  const $ = (sel) => section.querySelector(sel);
  const stage = $('.team__stage');
  const track = $('.team__track');
  const depthEl = $('.team__depth');
  const bg = $('.team__bg');
  const panel = $('.team__info');
  const prevBtn = $('.team__arrow--prev');
  const nextBtn = $('.team__arrow--next');
  const fields = {
    index: $('[data-team="index"]'),
    total: $('[data-team="total"]'),
    name: $('[data-team="name"]'),
    role: $('[data-team="role"]')
  };
  const textEls = [fields.name, fields.role];

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileQuery = window.matchMedia('(max-width: 760px)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let reduced = motionQuery.matches;
  const onMotion = (e) => { reduced = e.matches; resetDepth(); kick(); };
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotion);
  else if (motionQuery.addListener) motionQuery.addListener(onMotion);

  const pad = (n) => String(n).padStart(2, '0');
  const EASE_OUT = 'cubic-bezier(.16, 1, .3, 1)';
  const EASE_IN_OUT = 'cubic-bezier(.4, 0, .2, 1)';
  const clampIdx = (i) => Math.max(0, Math.min(N - 1, i));

  /* ---------- Ritratti: ogni ritratto è direttamente il pulsante ---------- */

  let suppressClick = false;

  const figures = members.map((m, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'team-figure';
    btn.id = `team-tab-${i}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-controls', 'team-panel');
    btn.setAttribute('aria-selected', 'false');
    btn.setAttribute('aria-label', m.name);
    btn.tabIndex = -1;

    const img = document.createElement('img');
    img.alt = m.alt || '';
    img.width = 720;
    img.height = 960;
    img.decoding = 'async';
    img.loading = 'lazy';
    img.draggable = false;
    if (m.image) {
      img.src = m.image;
      img.addEventListener('error', () => { img.remove(); btn.classList.add('team-figure--empty'); });
    } else {
      btn.classList.add('team-figure--empty');
    }

    const shadow = document.createElement('span');
    shadow.className = 'team-figure__shadow';
    shadow.setAttribute('aria-hidden', 'true');

    if (m.image) btn.append(img);
    btn.append(shadow);
    btn.addEventListener('click', (e) => {
      if (suppressClick) { e.preventDefault(); return; }
      if (i === target) openDossier(true, btn);
      else goTo(i);
    });
    track.appendChild(btn);
    return { btn, img, shadow, last: {} };
  });

  if (fields.total) fields.total.textContent = pad(N);
  const wordSpan = $('.team__word span');
  const indexBar = $('.team__index-bar span');

  /* ---------- Stato del movimento ---------- */

  const startIndex = Number.isInteger(window.TEAM_START) ? clampIdx(window.TEAM_START) : 0;
  let pos = startIndex;      // posizione continua della fila (in "medici")
  let target = startIndex;   // medico su cui agganciarsi
  let vel = 0;
  let spacing = 300;         // distanza in px tra due ritratti vicini
  const OMEGA = 9;           // molla criticamente smorzata: ~600 ms, partenza e arrivo morbidi

  let figH = 500;
  function measure() {
    const el = figures[0].btn;
    const w = el.offsetWidth || 300;
    figH = el.offsetHeight || 500;
    const factor = parseFloat(getComputedStyle(section).getPropertyValue('--spacing-factor')) || 1;
    spacing = w * factor;
  }

  // Valori in funzione della distanza dal centro (0 = attivo, 1 = vicino, 2+ = lontani)
  function at(x, ys) {
    const last = ys.length - 1;
    if (x <= 0) return ys[0];
    if (x >= last) return ys[last];
    const k = Math.floor(x);
    return ys[k] + (ys[k + 1] - ys[k]) * (x - k);
  }
  const SCALE = [1, 0.78, 0.64];
  const OFFSET = [0, 1, 1.8];
  const LIFT = [0.012, -0.04, -0.07];     // in altezze ritratto: l'attivo avanza, gli altri arretrano
  const BRIGHT = [1, 0.42, 0.3];
  const SAT = [1, 0.4, 0.3];
  const OPACITY = [1, 0.95, 0];
  const BLUR = [0, 0.8, 2];
  const RING = [1, 0, 0];

  let dossierMix = 0;      // 0 = scheda chiusa, 1 = aperta (animato)
  let dossierTarget = 0;

  function layout() {
    const allowBlur = !mobileQuery.matches;
    if (wordSpan) wordSpan.style.transform = `translate3d(${((startIndex - pos) * 40).toFixed(1)}px, 0, 0)`;
    if (indexBar) indexBar.style.transform = `scaleX(${N > 1 ? Math.max(0, Math.min(1, (pos + 1) / N)).toFixed(4) : 1})`;
    for (let i = 0; i < N; i++) {
      const f = figures[i];
      const d = i - pos;
      const ad = Math.abs(d);
      if (ad > 2.2) {
        if (f.last.hidden !== true) { f.btn.style.visibility = 'hidden'; f.last.hidden = true; }
        continue;
      }
      if (f.last.hidden !== false) { f.btn.style.visibility = ''; f.last.hidden = false; }

      const x = Math.sign(d) * at(ad, OFFSET) * spacing;
      const y = at(ad, LIFT) * figH;
      const tr = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${at(ad, SCALE).toFixed(4)})`;
      if (tr !== f.last.tr) { f.btn.style.transform = tr; f.last.tr = tr; }

      const blur = allowBlur ? at(ad, BLUR) : 0;
      const dim = 1 - 0.5 * dossierMix * Math.min(ad, 1); // con la scheda aperta l'altro si spegne ancora
      const flt = `brightness(${(at(ad, BRIGHT) * dim).toFixed(3)}) saturate(${at(ad, SAT).toFixed(3)})${blur > 0.05 ? ` blur(${blur.toFixed(2)}px)` : ''}`;
      if (flt !== f.last.flt) { f.btn.style.filter = flt; f.last.flt = flt; }

      const op = at(ad, OPACITY).toFixed(3);
      if (op !== f.last.op) { f.btn.style.opacity = op; f.last.op = op; }

      const so = at(ad, RING).toFixed(3);
      if (so !== f.last.so) { f.shadow.style.opacity = so; f.last.so = so; }

      const z = String(100 - Math.round(ad * 10));
      if (z !== f.last.z) { f.btn.style.zIndex = z; f.last.z = z; }
    }
  }

  /* ---------- Medico attivo e testi ---------- */

  let infoIndex = -1;
  let token = 0;

  function cancelAnims(el) {
    if (el && el.getAnimations) el.getAnimations().forEach((a) => a.cancel());
  }

  // Nome composto su righe: titolo in corsivo piccolo, poi nome e cognome
  function composeName(el, full) {
    el.textContent = '';
    el.setAttribute('aria-label', full);
    const parts = (full || '').trim().split(/\s+/);
    const title = parts.length > 1 && /\.$|^Dott|^Dr/i.test(parts[0]) ? parts.shift() : '';
    const last = parts.length > 1 ? parts.pop() : '';
    const lines = [];
    if (title) lines.push([title, 'nm-title']);
    lines.push([parts.join(' '), '']);
    if (last) lines.push([last, '']);
    lines.forEach(([text, cls], k) => {
      const ln = document.createElement('span');
      ln.className = 'ln' + (cls ? ' ' + cls : '');
      ln.setAttribute('aria-hidden', 'true');
      const inner = document.createElement('span');
      inner.textContent = text;
      ln.appendChild(inner);
      el.appendChild(ln);
      if (k < lines.length - 1) el.appendChild(document.createTextNode(' '));
    });
  }

  function fillInfo(i) {
    const m = members[i];
    if (fields.index) fields.index.textContent = pad(i + 1);
    composeName(fields.name, m.name || '');
    fields.role.textContent = m.role || '';
  }

  function setActive(i) {
    if (i === infoIndex) return;
    const first = infoIndex < 0;
    infoIndex = i;

    figures.forEach((f, k) => {
      const on = k === i;
      f.btn.setAttribute('aria-selected', on ? 'true' : 'false');
      f.btn.tabIndex = on ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', figures[i].btn.id);
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === N - 1;
    if (dossierOpen) swapDossier(i);

    if (first || !fields.name.animate) { fillInfo(i); return; }

    const t = ++token;
    textEls.forEach(cancelAnims);

    if (reduced) {
      fillInfo(i);
      return;
    }

    // Testo: dissolvenza + leggero movimento verticale → nitido
    const exits = textEls.map((el) => el.animate(
      [
        { opacity: 1, transform: 'translate3d(0,0,0)', filter: 'blur(0px)' },
        { opacity: 0, transform: 'translate3d(0,-6px,0)', filter: 'blur(3px)' }
      ],
      { duration: 150, easing: EASE_IN_OUT, fill: 'forwards' }
    ));
    Promise.all(exits.map((a) => a.finished.catch(() => {}))).then(() => {
      if (t !== token) return;
      fillInfo(i);
      textEls.forEach((el, k) => {
        cancelAnims(el);
        if (el === fields.name) {
          // il nome entra riga per riga, dietro una maschera
          el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'backwards' });
          Array.from(el.querySelectorAll('.ln > span')).forEach((ln, j) => ln.animate(
            [{ transform: 'translate3d(0,105%,0)' }, { transform: 'translate3d(0,0,0)' }],
            { duration: 720, delay: j * 70, easing: EASE_OUT, fill: 'backwards' }
          ));
          return;
        }
        el.animate(
          [
            { opacity: 0, transform: 'translate3d(0,10px,0)', filter: 'blur(6px)' },
            { opacity: 1, transform: 'translate3d(0,0,0)', filter: 'blur(0px)' }
          ],
          { duration: 460, delay: 120 + k * 50, easing: EASE_OUT, fill: 'backwards' }
        );
      });
    });
  }

  /* ---------- Loop (gira solo mentre qualcosa si muove) ---------- */

  let raf = 0;
  let lastT = 0;
  let dragging = false;
  let wheelActive = false;

  function frame(now) {
    // Tempo reale anche se il dispositivo scende sotto i 60 fps (sotto-passi da 1/120 s)
    let remaining = Math.min(0.25, Math.max(0, (now - lastT) / 1000));
    lastT = now;

    if (!dragging && !wheelActive) {
      if (reduced) {
        pos = target;
        vel = 0;
      } else {
        while (remaining > 0) {
          const h = Math.min(remaining, 1 / 120);
          const acc = -OMEGA * OMEGA * (pos - target) - 2 * OMEGA * vel;
          vel += acc * h;
          pos += vel * h;
          remaining -= h;
        }
        if (Math.abs(pos - target) < 0.0005 && Math.abs(vel) < 0.002) { pos = target; vel = 0; }
      }
    }

    dossierMix += (dossierTarget - dossierMix) * (reduced ? 1 : 0.14);
    if (Math.abs(dossierTarget - dossierMix) < 0.002) dossierMix = dossierTarget;

    layout();
    setActive(dragging || wheelActive ? clampIdx(Math.round(pos)) : target);

    raf = (dragging || wheelActive || pos !== target || dossierMix !== dossierTarget) ? requestAnimationFrame(frame) : 0;
  }

  function kick() {
    if (raf) return;
    lastT = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function goTo(i) {
    target = clampIdx(i);
    kick();
  }

  // Resistenza elastica oltre il primo e l'ultimo
  function rubber(raw) {
    if (raw < 0) return raw * 0.35;
    if (raw > N - 1) return N - 1 + (raw - (N - 1)) * 0.35;
    return raw;
  }

  /* ---------- Trascinamento (mouse, touch, penna) ---------- */

  let pressed = false;
  let moved = false;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let startPos = 0;
  let samples = [];

  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('.team__arrow')) return;
    pressed = true;
    moved = false;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    startPos = pos;
    samples = [{ t: performance.now(), x: e.clientX }];
  });

  stage.addEventListener('pointermove', (e) => {
    if (!pressed || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!moved) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) { pressed = false; return; } // gesto verticale: scorre la pagina
      moved = true;
      dragging = true;
      vel = 0;
      stage.classList.add('is-dragging');
      try { stage.setPointerCapture(pointerId); } catch (_) { /* non supportato */ }
    }
    pos = rubber(startPos - dx / spacing);
    const now = performance.now();
    samples.push({ t: now, x: e.clientX });
    while (samples.length > 2 && now - samples[0].t > 100) samples.shift();
    kick();
  });

  function endDrag() {
    if (!pressed) return;
    pressed = false;
    if (!moved) return;
    dragging = false;
    stage.classList.remove('is-dragging');
    const a = samples[0];
    const b = samples[samples.length - 1];
    const dtS = Math.max(0.016, (b.t - a.t) / 1000);
    vel = Math.max(-10, Math.min(10, -((b.x - a.x) / spacing) / dtS));
    target = clampIdx(Math.round(pos + vel * 0.16));
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    kick();
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('lostpointercapture', endDrag);

  /* ---------- Trackpad (scorrimento orizzontale) ---------- */

  let wheelRaw = 0;
  let wheelTimer = 0;
  stage.addEventListener('wheel', (e) => {
    if (e.ctrlKey || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // verticale: la pagina scorre
    e.preventDefault();
    if (!wheelActive) { wheelActive = true; wheelRaw = pos; vel = 0; }
    const unit = e.deltaMode === 1 ? 16 : 1;
    wheelRaw += (e.deltaX * unit) / spacing;
    wheelRaw = Math.max(-0.6, Math.min(N - 0.4, wheelRaw));
    pos = rubber(wheelRaw);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      wheelActive = false;
      target = clampIdx(Math.round(pos));
      kick();
    }, 140);
    kick();
  }, { passive: false });

  /* ---------- Frecce e tastiera ---------- */

  prevBtn.addEventListener('click', () => goTo(target - 1));
  nextBtn.addEventListener('click', () => goTo(target + 1));

  track.addEventListener('keydown', (e) => {
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = target + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = target - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = N - 1;
    if (next === null) return;
    e.preventDefault();
    goTo(next);
    figures[target].btn.focus({ preventScroll: true });
  });

  /* ---------- Profondità al movimento del mouse (solo desktop) ---------- */

  let depthRaf = 0;
  let tx = 0; let ty = 0; let cx = 0; let cy = 0;

  function applyDepth() {
    bg.style.transform = `translate3d(${(-cx * 4).toFixed(2)}px, ${(-cy * 3).toFixed(2)}px, 0)`;
    depthEl.style.transform = `translate3d(${(cx * 6).toFixed(2)}px, ${(cy * 3).toFixed(2)}px, 0)`;
  }

  function depthTick() {
    cx += (tx - cx) * 0.08;
    cy += (ty - cy) * 0.08;
    if (Math.abs(tx - cx) < 0.001 && Math.abs(ty - cy) < 0.001) { cx = tx; cy = ty; }
    applyDepth();
    depthRaf = (cx !== tx || cy !== ty) ? requestAnimationFrame(depthTick) : 0;
  }

  function resetDepth() {
    tx = 0; ty = 0; cx = 0; cy = 0;
    if (depthRaf) { cancelAnimationFrame(depthRaf); depthRaf = 0; }
    bg.style.transform = '';
    depthEl.style.transform = '';
  }

  section.addEventListener('pointermove', (e) => {
    if (reduced || dragging || !finePointer.matches || e.pointerType !== 'mouse') return;
    const r = section.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (!depthRaf) depthRaf = requestAnimationFrame(depthTick);
  });
  section.addEventListener('pointerleave', () => {
    if (reduced || !finePointer.matches) return;
    tx = 0; ty = 0;
    if (!depthRaf) depthRaf = requestAnimationFrame(depthTick);
  });

  /* ---------- Entrata, resize ---------- */

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { section.classList.add('is-in'); io.disconnect(); }
      });
    }, { threshold: 0.2 });
    io.observe(section);
  } else {
    section.classList.add('is-in');
  }

  const onResize = () => { measure(); figures.forEach((f) => { f.last = {}; }); layout(); };
  window.addEventListener('resize', onResize, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(stage);

  /* ---------- Scheda del medico ---------- */

  const dossier = $('.dossier');
  const backdrop = $('.dossier-backdrop');
  const moreBtn = $('.team__more');
  const closeBtn = dossier && dossier.querySelector('.dossier__close');
  const dq = (sel) => dossier.querySelector(sel);
  const D_ = dossier ? {
    body: dq('.dossier__body'),
    media: dq('.dossier__media'),
    img: dq('.dossier__media img'),
    name: dq('.dossier__name'),
    role: dq('.dossier__role'),
    areas: dq('[data-dossier="areas"]'),
    education: dq('[data-dossier="education"]')
  } : null;

  let dossierOpen = false;
  let dossierPinned = false;
  let closeTimer = 0;
  let dossierToken = 0;
  let lastTrigger = null;

  const PLACEHOLDER = '[da completare con i vostri dati]';

  function list(el, items) {
    el.textContent = '';
    if (!items || !items.length) {
      const li = document.createElement('li');
      const ph = document.createElement('span');
      ph.className = 'ph';
      ph.textContent = PLACEHOLDER;
      li.appendChild(ph);
      el.appendChild(li);
      return;
    }
    items.forEach((t) => { const li = document.createElement('li'); li.textContent = t; el.appendChild(li); });
  }

  function fillDossier(i) {
    const m = members[i];
    D_.media.hidden = !m.image;
    if (m.image) { D_.img.src = m.image; D_.img.alt = ''; }
    composeName(D_.name, m.name);
    D_.role.textContent = m.role || '';
    list(D_.education, m.education);
    list(D_.areas, m.areas);
  }

  function setExpanded(v) {
    [fields.name, moreBtn].forEach((b) => b && b.setAttribute('aria-expanded', v ? 'true' : 'false'));
  }

  function openDossier(pinned, trigger) {
    if (!dossier) return;
    clearTimeout(closeTimer);
    if (pinned) dossierPinned = true;
    if (dossierOpen) {
      if (pinned && closeBtn) closeBtn.focus({ preventScroll: true });
      return;
    }
    dossierOpen = true;
    lastTrigger = trigger || fields.name;
    const mobile = mobileQuery.matches;
    fillDossier(infoIndex);
    dossier.hidden = false;
    dossier.setAttribute('aria-modal', mobile ? 'true' : 'false');
    section.classList.add('is-dossier');
    setExpanded(true);
    dossierTarget = 1;
    kick();
    if (mobile) {
      backdrop.hidden = false;
      document.documentElement.style.overflow = 'hidden';
    }
    if (!reduced && dossier.animate) {
      dossier.animate(
        mobile
          ? [{ transform: 'translate3d(0,100%,0)' }, { transform: 'translate3d(0,0,0)' }]
          : [{ opacity: 0, transform: 'translate3d(-28px,0,0)', filter: 'blur(8px)' }, { opacity: 1, transform: 'translate3d(0,0,0)', filter: 'blur(0px)' }],
        { duration: mobile ? 460 : 520, easing: EASE_OUT }
      );
      if (mobile) backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
      Array.from(D_.body.children).forEach((el, k) => el.animate(
        [{ opacity: 0, transform: 'translate3d(0,12px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }],
        { duration: 440, delay: 110 + k * 45, easing: EASE_OUT, fill: 'backwards' }
      ));
    }
    if (pinned && closeBtn) closeBtn.focus({ preventScroll: true });
  }

  function closeDossier() {
    if (!dossierOpen) return;
    dossierOpen = false;
    dossierPinned = false;
    clearTimeout(closeTimer);
    section.classList.remove('is-dossier');
    setExpanded(false);
    dossierTarget = 0;
    kick();
    const mobile = !backdrop.hidden;
    const hadFocus = dossier.contains(document.activeElement);
    document.documentElement.style.overflow = '';
    const done = () => { if (!dossierOpen) { dossier.hidden = true; backdrop.hidden = true; } };
    if (reduced || !dossier.animate) done();
    else {
      if (mobile) backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
      const a = dossier.animate(
        mobile
          ? [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,100%,0)' }]
          : [{ opacity: 1, transform: 'translate3d(0,0,0)' }, { opacity: 0, transform: 'translate3d(-18px,0,0)' }],
        { duration: 280, easing: EASE_IN_OUT, fill: 'forwards' }
      );
      a.finished.then(() => { done(); a.cancel(); backdrop.getAnimations().forEach((x) => x.cancel()); }, done);
    }
    if (hadFocus && lastTrigger) lastTrigger.focus({ preventScroll: true });
  }

  // Cambio medico con la scheda aperta: il contenuto scorre, la scheda resta
  function swapDossier(i) {
    const t = ++dossierToken;
    if (reduced || !D_.body.animate) { fillDossier(i); return; }
    D_.body.getAnimations().forEach((a) => a.cancel());
    const out = D_.body.animate(
      [{ opacity: 1, transform: 'translate3d(0,0,0)' }, { opacity: 0, transform: 'translate3d(-10px,0,0)' }],
      { duration: 150, easing: EASE_IN_OUT, fill: 'forwards' }
    );
    out.finished.then(() => {
      if (t !== dossierToken) return;
      fillDossier(i);
      D_.body.scrollTop = 0;
      out.cancel();
      D_.body.animate(
        [{ opacity: 0, transform: 'translate3d(14px,0,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }],
        { duration: 380, easing: EASE_OUT }
      );
    }, () => {});
  }

  function scheduleClose() {
    if (dossierPinned) return;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(closeDossier, 220); // tolleranza: il mouse può passare dal nome alla scheda
  }

  if (dossier) {
    const hoverOK = (e) => e.pointerType === 'mouse' && finePointer.matches && !mobileQuery.matches;
    fields.name.addEventListener('pointerenter', (e) => { if (hoverOK(e)) openDossier(false, fields.name); });
    fields.name.addEventListener('pointerleave', (e) => { if (hoverOK(e)) scheduleClose(); });
    dossier.addEventListener('pointerenter', () => clearTimeout(closeTimer));
    dossier.addEventListener('pointerleave', (e) => { if (hoverOK(e)) scheduleClose(); });

    const toggle = (trigger) => {
      if (dossierOpen && dossierPinned) closeDossier();
      else openDossier(true, trigger);
    };
    fields.name.addEventListener('click', () => toggle(fields.name));
    moreBtn.addEventListener('click', () => toggle(moreBtn));
    closeBtn.addEventListener('click', closeDossier);
    backdrop.addEventListener('click', closeDossier);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dossierOpen) closeDossier(); });
    document.addEventListener('pointerdown', (e) => {
      if (!dossierOpen || !dossierPinned) return;
      if (!section.contains(e.target)) closeDossier();
    });

    // Mobile: trascinando verso il basso dalla parte alta del foglio si chiude
    let sheetY = null;
    dossier.addEventListener('pointerdown', (e) => {
      if (!mobileQuery.matches) return;
      const top = dossier.getBoundingClientRect().top;
      if (e.clientY - top < 56) sheetY = e.clientY;
    });
    dossier.addEventListener('pointermove', (e) => {
      if (sheetY === null) return;
      const dy = Math.max(0, e.clientY - sheetY);
      dossier.style.transform = `translate3d(0,${dy}px,0)`;
    });
    const endSheet = (e) => {
      if (sheetY === null) return;
      const dy = e.clientY - sheetY;
      sheetY = null;
      dossier.style.transform = '';
      if (dy > 80) closeDossier();
    };
    dossier.addEventListener('pointerup', endSheet);
    dossier.addEventListener('pointercancel', endSheet);
  }

  /* ---------- Avvio ---------- */

  measure();
  layout();
  setActive(startIndex);
})();
