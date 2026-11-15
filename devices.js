(() => {
  const stage = document.querySelector('[data-device-stage]');
  if (!stage) return;
  const button = stage.querySelector('.dv-play');
  const label = button.querySelector('span');
  const count = stage.querySelector('.dv-count');
  const orderLabel = stage.querySelector('.dv-order-label');
  const orderNumber = stage.querySelector('.dv-order-number');
  const orderLink = stage.querySelector('.dv-order-link');
  const fulfil = stage.querySelector('.dv-fulfil');
  const receipt = stage.querySelector('.dv-receipt-state');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');

  const sequence = [
    [0, 'shop', 'rest'],
    [750, 'shop', 'phone-in'],
    [1600, 'shop', 'phone-hit'],
    [2550, 'shop', 'phone-click'],
    [2830, 'received', 'rest'],
    [4250, 'received', 'open-in'],
    [4900, 'received', 'open-hit'],
    [5860, 'received', 'open-click'],
    [6110, 'order', 'rest'],
    [7350, 'order', 'prepare-in'],
    [8000, 'order', 'prepare-hit'],
    [8990, 'order', 'prepare-click'],
    [9260, 'ready', 'rest'],
    [11100, 'ready', 'rest']
  ];
  const duration = sequence[sequence.length - 1][0];
  let visible = true;
  let paused = false;
  let finished = false;
  let held = 0;
  let start = null;
  let index = -1;
  let timer = null;
  let frame = null;
  let point = null;

  function draw(step) {
    if (step === index) return;
    index = step;
    const [, view, cue] = sequence[step];
    stage.dataset.view = view;
    stage.dataset.cue = cue;
    count.textContent = view === 'shop' ? '7' : '8';
    orderLabel.textContent = view === 'shop' ? 'Ultimo ordine' : 'Nuovo ordine';
    orderNumber.textContent = view === 'shop' ? '#1047' : '#1048';
    orderLink.textContent = view === 'shop' ? 'Pronto' : 'Gestisci ↗';
    fulfil.firstChild.nodeValue = view === 'ready' ? 'In preparazione ' : 'Prepara ordine ';
    fulfil.lastElementChild.textContent = view === 'ready' ? '✓' : '→';
    receipt.textContent = view === 'ready' ? 'In preparazione' : 'Ricevuto';
  }

  function buttonState() {
    const text = finished ? 'Ripeti' : paused ? 'Riprendi' : 'Pausa';
    label.textContent = text;
    button.dataset.action = finished || paused ? 'play' : 'pause';
    button.setAttribute('aria-label', text + ' animazione dell’ordine');
    button.hidden = reduced.matches;
  }

  function stop() {
    if (start !== null) held += performance.now() - start;
    start = null;
    clearTimeout(timer);
    timer = null;
    stage.style.setProperty('--dv-running','paused');
  }

  function tick() {
    if (start === null) return;
    const t = held + performance.now() - start;
    let next = index + 1;
    while (next < sequence.length && sequence[next][0] <= t) next++;
    draw(next - 1);
    if (t >= duration) {
      stop();
      finished = true;
      buttonState();
      return;
    }
    timer = setTimeout(tick, Math.max(1, sequence[next][0] - t));
  }

  function sync() {
    if (reduced.matches) {
      stop();
      draw(4);
    } else if (!visible || document.hidden || paused || finished) {
      stop();
    } else if (start === null) {
      start = performance.now();
      stage.style.setProperty('--dv-running','running');
      tick();
    }
    buttonState();
  }

  button.addEventListener('click', () => {
    if (finished) { held = 0; finished = false; index = -1; }
    else paused = !paused;
    sync();
  });
  reduced.addEventListener('change', () => {
    stop();
    held = 0;
    index = -1;
    paused = false;
    finished = false;
    sync();
  });
  document.addEventListener('visibilitychange',sync);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      sync();
    }, {threshold: 0});
    observer.observe(stage);
  }

  function setAngles(x,y) {
    stage.style.setProperty('--dv-yaw',x.toFixed(2)+'deg');
    stage.style.setProperty('--dv-pitch',y.toFixed(2)+'deg');
  }
  stage.addEventListener('pointermove', event => {
    if (!pointer.matches || reduced.matches || !visible || document.hidden || paused) return;
    point = {x:event.clientX,y:event.clientY};
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      const box = stage.getBoundingClientRect();
      if (point && box.width && box.height) {
        setAngles((point.x-box.left-box.width/2)/box.width*7,(box.top+box.height/2-point.y)/box.height*5);
      }
    });
  }, {passive:true});
  stage.addEventListener('pointerleave', () => { point = null; setAngles(0,0); });
  sync();
})();
