(() => {
  for (const figure of document.querySelectorAll('[data-fourlife-compare]')) {
    const stage = figure.querySelector('.fl-compare__stage');
    const input = figure.querySelector('input[type="range"]');
    const divider = figure.querySelector('.fl-compare__divider');
    if (!stage || !input || !divider || !('PointerEvent' in window)) continue;

    function sync() {
      stage.style.setProperty('--split', input.value + '%');
      input.setAttribute('aria-valuetext', input.value + '% del pavimento originale');
    }
    function slide(clientX) {
      const {left, width} = stage.getBoundingClientRect();
      if (!width) return;
      input.value = String(Math.round(Math.max(0, Math.min(100, (clientX - left) / width * 100))));
      sync();
    }

    let drag = null;
    stage.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false };
    });
    stage.addEventListener('pointermove', event => {
      if (event.pointerId !== drag?.id) return;
      if (!drag.active) {
        const dx = Math.abs(event.clientX - drag.x);
        const dy = Math.abs(event.clientY - drag.y);
        if (dy > dx && dy > 5) { drag = null; return; }
        if (dx < 5) return;
        drag.active = true;
        stage.setPointerCapture(event.pointerId);
      }
      slide(event.clientX);
    });
    stage.addEventListener('pointerup', event => {
      if (event.pointerId !== drag?.id) return;
      drag = null;
      slide(event.clientX);
      if (event.pointerType === 'mouse') input.focus({preventScroll: true});
    });
    stage.addEventListener('pointercancel', () => { drag = null; });
    stage.addEventListener('pointerleave', () => { if (!drag?.active) drag = null; });
    stage.addEventListener('lostpointercapture', event => {
      if (event.target === stage && event.pointerId === drag?.id) drag = null;
    });
    input.addEventListener('input', sync);

    sync();
    input.hidden = false;
    divider.hidden = false;
    const notes = figure.querySelectorAll('.fl-compare__note span');
    if (notes.length === 2) {
      notes[0].hidden = false;
      notes[1].hidden = true;
    }
    figure.classList.add('is-ready');
  }
})();
