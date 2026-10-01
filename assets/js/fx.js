/* =========================================================
   FX — effetti condivisi (home e pagina sede)
   Titoli rivelati, schede in sequenza, frase parola per parola,
   header chiaro/scuro, menu mobile, scorrimento alle sezioni,
   pulsanti magnetici, cursore, particelle.
   Solo transform e opacity. Tutto si disattiva con "riduci movimento".
   ========================================================= */
(() => {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Titoli che entrano parola per parola (data-reveal) ---------- */

  const revealEls = Array.from(document.querySelectorAll('[data-reveal]'));
  let wordIndex = 0;
  const wrapReveal = (node, host) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const outer = document.createElement('span');
          outer.className = 'rw';
          outer.setAttribute('aria-hidden', 'true');
          const inner = document.createElement('span');
          inner.style.setProperty('--i', wordIndex++);
          inner.textContent = part;
          outer.appendChild(inner);
          frag.appendChild(outer);
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === 1) {
        wrapReveal(child, host);
      }
    });
  };
  revealEls.forEach((el) => {
    wordIndex = 0;
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    wrapReveal(el, el);
  });

  const staggerEls = Array.from(document.querySelectorAll('[data-stagger]'));
  staggerEls.forEach((el) => Array.from(el.children).forEach((c, i) => c.style.setProperty('--i', i)));

  if (reduced || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-revealed'));
    staggerEls.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add(en.target.hasAttribute('data-stagger') ? 'is-in' : 'is-revealed');
        io.unobserve(en.target);
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
    revealEls.concat(staggerEls).forEach((el) => io.observe(el));
  }

  /* ---------- Frase che si accende parola per parola con lo scroll (.bridge) ---------- */

  const bridge = document.querySelector('.bridge');
  const bridgeText = bridge && bridge.querySelector('[data-scroll-words]');
  const bridgeLine = bridge && bridge.querySelector('.bridge__line span');
  let words = [];

  if (bridgeText) {
    // testo completo per i lettori di schermo (le parole animate sono aria-hidden)
    const sr = document.createElement('span');
    sr.className = 'visually-hidden';
    sr.textContent = bridgeText.textContent.replace(/\s+/g, ' ').trim();
    const wrapWords = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement('span');
            s.className = 'sw';
            s.setAttribute('aria-hidden', 'true');
            s.textContent = part;
            frag.appendChild(s);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          wrapWords(child);
        }
      });
    };
    wrapWords(bridgeText);
    bridgeText.prepend(sr);
    words = Array.from(bridgeText.querySelectorAll('.sw'));
  }

  let bridgeVisible = false;
  let bridgeRaf = 0;
  function updateBridge() {
    bridgeRaf = 0;
    const r = bridge.getBoundingClientRect();
    const vh = window.innerHeight;
    // 0 quando la sezione entra dal basso, 1 quando il testo è al centro dello schermo
    const p = Math.max(0, Math.min(1, (vh * 0.9 - r.top) / (vh * 0.9 - (vh * 0.5 - r.height * 0.5) + 1)));
    const n = words.length;
    words.forEach((w, k) => {
      const t = Math.max(0, Math.min(1, p * (n + 1) - k));
      w.style.setProperty('--o', (0.16 + 0.84 * t).toFixed(3));
    });
    if (bridgeLine) {
      const lp = Math.max(0, Math.min(1, (vh * 0.75 - r.top - r.height * 0.5) / (r.height * 0.6)));
      bridgeLine.style.setProperty('--line', lp.toFixed(3));
    }
  }

  if (bridge && words.length && !reduced && 'IntersectionObserver' in window) {
    words.forEach((w) => w.style.setProperty('--o', '0.16'));
    if (bridgeLine) bridgeLine.style.setProperty('--line', '0');
    new IntersectionObserver((entries) => {
      entries.forEach((en) => { bridgeVisible = en.isIntersecting; if (bridgeVisible) updateBridge(); });
    }).observe(bridge);
    window.addEventListener('scroll', () => {
      if (bridgeVisible && !bridgeRaf) bridgeRaf = requestAnimationFrame(updateBridge);
    }, { passive: true });
  }

  /* ---------- Header: chiaro sulle sezioni scure, scuro sulle chiare (data-header-theme) ---------- */

  const topbar = document.getElementById('topbar');
  const tourEl = document.getElementById('tour');
  let hdrRaf = 0;
  function updateHeader() {
    hdrRaf = 0;
    if (!topbar) return;
    const r = topbar.getBoundingClientRect();
    const y = Math.min(window.innerHeight - 1, r.bottom + 2);
    const stack = document.elementsFromPoint(window.innerWidth / 2, y);
    let theme = 'dark';
    for (const el of stack) {
      if (topbar.contains(el)) continue;
      const host = el.closest('[data-header-theme]');
      if (host) { theme = host.getAttribute('data-header-theme'); break; }
    }
    topbar.classList.toggle('is-light', theme === 'light');
    // fondo dell'header: trasparente sul video, pieno dopo
    const past = tourEl ? tourEl.getBoundingClientRect().bottom < r.bottom : window.scrollY > 40;
    topbar.classList.toggle('is-scrolled', past);
  }
  const requestHeader = () => { if (!hdrRaf) hdrRaf = requestAnimationFrame(updateHeader); };
  window.addEventListener('scroll', requestHeader, { passive: true });
  window.addEventListener('resize', requestHeader, { passive: true });
  requestHeader();

  /* ---------- Scorrimento morbido alle sezioni (link #...) ---------- */

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    if (history.replaceState) history.replaceState(null, '', `#${id}`);
  });

  /* ---------- Menu a tutto schermo (mobile) ---------- */

  const menuBtn = document.querySelector('.topbar__menu');
  const menu = document.getElementById('site-menu');
  if (menuBtn && menu) {
    const closeBtn = menu.querySelector('.site-menu__close');
    const focusables = () => Array.from(menu.querySelectorAll('a, button'));
    const openMenu = () => {
      menu.hidden = false;
      menuBtn.setAttribute('aria-expanded', 'true');
      document.documentElement.style.overflow = 'hidden';
      if (!reduced && menu.animate) {
        menu.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
        Array.from(menu.querySelectorAll('.site-menu__nav a, .site-menu__cta > *')).forEach((a, k) => a.animate(
          [{ opacity: 0, transform: 'translate3d(0,14px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }],
          { duration: 520, delay: 80 + k * 55, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }
        ));
      }
      closeBtn.focus({ preventScroll: true });
    };
    const closeMenu = (restoreFocus) => {
      if (menu.hidden) return;
      menu.hidden = true;
      menuBtn.setAttribute('aria-expanded', 'false');
      document.documentElement.style.overflow = '';
      if (restoreFocus) menuBtn.focus({ preventScroll: true });
    };
    menuBtn.addEventListener('click', openMenu);
    closeBtn.addEventListener('click', () => closeMenu(true));
    menu.addEventListener('click', (e) => { if (e.target.closest('a, [data-call]')) closeMenu(false); });
    document.addEventListener('keydown', (e) => {
      if (menu.hidden) return;
      if (e.key === 'Escape') closeMenu(true);
      if (e.key === 'Tab') { // il focus resta dentro al menu
        const f = focusables();
        const first = f[0]; const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------- Particelle leggere nelle sezioni scure (poche, lente) ---------- */

  if (!reduced) {
    document.querySelectorAll('[data-particles]').forEach((host) => {
      const canvas = document.createElement('canvas');
      canvas.className = 'particles';
      canvas.setAttribute('aria-hidden', 'true');
      host.prepend(canvas);
      const ctx = canvas.getContext('2d');
      const count = parseInt(host.getAttribute('data-particles'), 10) || 36;
      const rgb = getComputedStyle(document.documentElement).getPropertyValue('--c-accent-rgb').trim() || '185, 243, 69';
      let w = 0; let h = 0; let dpr = 1; let dots = []; let running = false; let raf = 0;
      const resize = () => {
        dpr = Math.min(2, window.devicePixelRatio || 1);
        w = host.offsetWidth; h = host.offsetHeight;
        canvas.width = w * dpr; canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (!dots.length) {
          dots = Array.from({ length: count }, () => ({
            x: Math.random(), y: Math.random(),
            r: 0.6 + Math.random() * 1.4,
            vx: (Math.random() - 0.5) * 0.00006, vy: -0.00003 - Math.random() * 0.00006,
            a: 0.15 + Math.random() * 0.45
          }));
        }
      };
      const draw = () => {
        ctx.clearRect(0, 0, w, h);
        for (const d of dots) {
          d.x += d.vx * 16; d.y += d.vy * 16;
          if (d.y < -0.02) { d.y = 1.02; d.x = Math.random(); }
          if (d.x < -0.02) d.x = 1.02; else if (d.x > 1.02) d.x = -0.02;
          ctx.beginPath();
          ctx.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb}, ${d.a})`;
          ctx.fill();
        }
        raf = running ? requestAnimationFrame(draw) : 0;
      };
      resize();
      window.addEventListener('resize', resize, { passive: true });
      new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          running = en.isIntersecting && !document.hidden;
          if (running && !raf) raf = requestAnimationFrame(draw);
        });
      }).observe(host);
    });
  }

  /* ---------- Carosello dei trattamenti: frecce, tastiera, trascinamento col mouse ---------- */

  document.querySelectorAll('.cure-carousel').forEach((wrap) => {
    const track = wrap.querySelector('.cure-grid');
    const prev = wrap.querySelector('.cure-arrow--prev');
    const next = wrap.querySelector('.cure-arrow--next');
    const step = () => {
      const card = track.querySelector('.cure-card');
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const perView = Math.max(1, Math.round(track.clientWidth / (card.offsetWidth + gap)));
      return (card.offsetWidth + gap) * Math.max(1, perView - (perView > 2 ? 1 : 0));
    };
    const go = (dir) => track.scrollBy({ left: dir * step(), behavior: reduced ? 'auto' : 'smooth' });
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = track.scrollWidth - track.clientWidth - 2;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max;
      wrap.classList.toggle('has-prev', !prev.disabled);
      wrap.classList.toggle('has-next', !next.disabled);
    };
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    track.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    // ricalcola quando cambia la misura (anche quando arriva il CSS caricato in differita)
    if ('ResizeObserver' in window) new ResizeObserver(update).observe(track);
    else window.addEventListener('resize', update, { passive: true });
    window.addEventListener('load', update, { once: true });
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });
    update();

    // trascinamento col mouse (sul touch scorre già nativamente)
    let down = false; let startX = 0; let startLeft = 0; let moved = false;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft;
    });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 4) { moved = true; track.classList.add('is-dragging'); }
      if (moved) track.scrollLeft = startLeft - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      if (!moved) return;
      // aggancio alla scheda più vicina
      const left = track.scrollLeft;
      track.classList.remove('is-dragging');
      track.scrollLeft = left;
      const card = track.querySelector('.cure-card');
      const w = card.offsetWidth + (parseFloat(getComputedStyle(track).columnGap) || 0);
      track.scrollTo({ left: Math.round(left / w) * w, behavior: reduced ? 'auto' : 'smooth' });
    });
    track.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  });

  if (reduced || !finePointer) return;

  /* ---------- Pulsanti magnetici (solo desktop con mouse) ---------- */

  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.transform = `translate3d(${(dx * 8).toFixed(1)}px, ${(dy * 6).toFixed(1)}px, 0)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });

  /* ---------- Cursore personalizzato: si espande sugli elementi interattivi ---------- */

  const cursor = document.querySelector('.cursor');
  if (!cursor) return;
  const dot = cursor.querySelector('.cursor__dot');
  const ring = cursor.querySelector('.cursor__ring');
  const label = cursor.querySelector('.cursor__label');
  document.documentElement.classList.add('has-cursor');

  let mx = -100; let my = -100; let rx = -100; let ry = -100;
  let raf = 0;
  const INTERACTIVE = 'a, button, [role="tab"], input, select, label, .team__stage';

  function loop() {
    rx += (mx - rx) * 0.2;
    ry += (my - ry) * 0.2;
    ring.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0)`;
    label.style.left = `${rx.toFixed(1)}px`;
    label.style.top = `${ry.toFixed(1)}px`;
    raf = (Math.abs(mx - rx) > 0.1 || Math.abs(my - ry) > 0.1) ? requestAnimationFrame(loop) : 0;
  }

  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
    cursor.classList.remove('is-hidden');
    const el = e.target.closest ? e.target.closest(INTERACTIVE) : null;
    const tagged = e.target.closest ? e.target.closest('[data-cursor]') : null;
    const text = tagged ? tagged.getAttribute('data-cursor') : '';
    cursor.classList.toggle('is-hover', !!el);
    cursor.classList.toggle('is-label', !!text);
    if (text && label.textContent !== text) label.textContent = text;
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
  document.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
  document.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
  document.documentElement.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
})();
