/* =========================================================
   UI — pannello "Chiama la sede", banner cookie, modulo dimostrativo
   Nessuno script di terze parti, nessun tracciamento, nessun invio di dati.
   ========================================================= */
(() => {
  'use strict';

  /* ---------- Pannello "Chiama la sede" ----------
     Pulsanti generici (hero, barra mobile, menu): data-call.
     Su mobile è un foglio dal basso con le due sedi; su desktop
     mostra i numeri ben leggibili (i link tel: restano cliccabili). */
  const sheet = document.getElementById('call-sheet');
  if (sheet && typeof sheet.showModal === 'function') {
    const close = sheet.querySelector('.call-sheet__close');
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-call]');
      if (!trigger) return;
      e.preventDefault();
      sheet.showModal();
    });
    close.addEventListener('click', () => sheet.close());
    // clic sullo sfondo: chiude
    sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });
  } else if (sheet) {
    // Browser senza <dialog>: il pulsante porta ai numeri nella sezione contatti o nel footer
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-call]')) return;
      const dest = document.getElementById('contatti') || document.querySelector('.legal');
      if (dest) dest.scrollIntoView({ block: 'start' });
    });
  }

  /* ---------- Banner cookie ----------
     In questa anteprima non ci sono cookie di statistica o marketing:
     la scelta viene solo ricordata nel browser (localStorage).
     "Accetta" e "Rifiuta" hanno lo stesso peso visivo. */
  const KEY = 'lz-cookie-preferenze';
  const banner = document.getElementById('cookie-banner');
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { return null; } };
  const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify({ ...v, data: new Date().toISOString() })); } catch (_) { /* archiviazione non disponibile */ } };

  if (banner) {
    const prefs = banner.querySelector('.cookie__prefs');
    const stats = banner.querySelector('[name="cookie-stat"]');
    const mkt = banner.querySelector('[name="cookie-mkt"]');
    const show = () => {
      const cur = read();
      if (stats) stats.checked = !!(cur && cur.statistiche);
      if (mkt) mkt.checked = !!(cur && cur.marketing);
      banner.hidden = false;
    };
    const hide = () => { banner.hidden = true; prefs.hidden = true; };
    if (!read()) show();

    banner.querySelector('.cookie__yes').addEventListener('click', () => { save({ statistiche: true, marketing: true }); hide(); });
    banner.querySelector('.cookie__no').addEventListener('click', () => { save({ statistiche: false, marketing: false }); hide(); });
    banner.querySelector('.cookie__custom').addEventListener('click', (e) => {
      if (prefs.hidden) { prefs.hidden = false; e.currentTarget.textContent = 'Salva le preferenze'; return; }
      save({ statistiche: !!(stats && stats.checked), marketing: !!(mkt && mkt.checked) });
      e.currentTarget.textContent = 'Personalizza';
      hide();
    });
    document.querySelectorAll('[data-cookie-prefs]').forEach((b) => b.addEventListener('click', () => {
      show();
      prefs.hidden = false;
      banner.querySelector('.cookie__custom').textContent = 'Salva le preferenze';
      banner.querySelector('.cookie__custom').focus();
    }));
  }

  /* ---------- Modulo dimostrativo: nessun dato viene inviato ---------- */
  document.querySelectorAll('form[data-demo-form]').forEach((form) => {
    const status = form.querySelector('.form__status');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      status.textContent = 'Modulo dimostrativo: nessun dato inviato.';
      form.reset();
    });
  });
})();
