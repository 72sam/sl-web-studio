(() => {
  const session = window.slEntrySession;
  const entry = document.getElementById('sl-entry');
  if (!session) return;
  if (!entry) {
    session.finish();
    return;
  }

  const root = document.documentElement;
  const elapsed = () => performance.now() - session.started;
  const pause = ms => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
  const nextPaint = () => new Promise(resolve => requestAnimationFrame(resolve));

  function decode(image) {
    if (!image) return Promise.resolve();
    if (typeof image.decode === 'function') return image.decode();
    if (image.complete) return Promise.resolve();
    return new Promise(resolve => {
      image.addEventListener('load', resolve, {once: true});
      image.addEventListener('error', resolve, {once: true});
    });
  }

  async function sceneReady() {
    const screen = document.querySelector('[data-device-stage] .dv-display');
    const poster = document.querySelector('[data-device-poster]');
    if (!screen && !poster) return;
    let posterDecoded = false;
    if (poster) {
      decode(poster).then(() => { posterDecoded = poster.naturalWidth > 0; }, () => {});
    }
    // The device stylesheet and its alternative still load independently.
    // Use whichever of the two is actually on screen first.
    while (window.slEntrySession === session && root.dataset.slEntry === 'loading') {
      const composed = screen?.offsetHeight > 1 && getComputedStyle(screen).position === 'absolute';
      if (composed || (posterDecoded && poster.offsetWidth > 0)) {
        await nextPaint();
        await nextPaint();
        return;
      }
      await pause(64);
    }
  }

  const readiness = [decode(document.querySelector('.topbar .brand img')), sceneReady()];
  if (document.fonts) {
    readiness.push(document.fonts.load('550 1em Montserrat', 'Siti web'));
    readiness.push(document.fonts.load('italic 400 1em Instrument', 'gestionali'));
  }

  const minimum = session.reduced ? 0 : 650;
  const latestExit = session.reduced ? 240 : 1520;
  const ready = Promise.all([Promise.allSettled(readiness), pause(minimum - elapsed())]);
  Promise.race([ready, pause(latestExit - elapsed())]).then(() => {
    if (window.slEntrySession !== session) return;
    root.dataset.slEntry = 'leaving';
    setTimeout(() => {
      if (window.slEntrySession === session) session.finish();
    }, session.reduced ? 90 : 290);
  });
})();
