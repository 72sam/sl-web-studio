(() => {
  const dialog = document.querySelector('.case-lightbox');
  const links = [...document.querySelectorAll('[data-enlarge]')];
  if (!dialog || !dialog.showModal || !links.length) return;

  const picture = dialog.querySelector('.case-stage img');
  const stage = picture.parentElement;
  const zoom = dialog.querySelector('[data-zoom]');
  const close = dialog.querySelector('[data-close]');
  let index = 0;
  let opener;

  function setZoom(active) {
    if (active && picture.naturalWidth && picture.naturalHeight) {
      const fit = Math.min(stage.clientWidth / picture.naturalWidth, stage.clientHeight / picture.naturalHeight);
      const detailWidth = Math.max(picture.naturalWidth, Math.round(picture.naturalWidth * fit * 2));
      picture.style.setProperty('--detail-width', detailWidth + 'px');
    }
    stage.classList.toggle('is-zoomed', active);
    zoom.setAttribute('aria-pressed', String(active));
    zoom.textContent = active ? 'Adatta' : 'Ingrandisci';
    stage.scrollTo(0, 0);
  }

  function selectImage(next) {
    index = (next + links.length) % links.length;
    const link = links[index];
    picture.alt = link.querySelector('img').alt;
    picture.src = link.href;
    dialog.querySelector('.case-count').textContent = (index + 1) + ' / ' + links.length;
    dialog.querySelector('.case-caption').textContent = link.closest('figure').querySelector('figcaption').textContent;
    setZoom(false);
  }

  links.forEach((link, next) => {
    link.addEventListener('click', event => {
      if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      selectImage(next);
      dialog.showModal();
      document.documentElement.classList.add('case-modal-open');
      close.focus();
    });
  });

  dialog.querySelector('[data-previous]').addEventListener('click', () => selectImage(index - 1));
  dialog.querySelector('[data-next]').addEventListener('click', () => selectImage(index + 1));
  zoom.addEventListener('click', () => setZoom(!stage.classList.contains('is-zoomed')));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', event => {
    if (stage.classList.contains('is-zoomed')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      selectImage(index + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('case-modal-open');
    if (opener) opener.focus({preventScroll: true});
  });
})();
