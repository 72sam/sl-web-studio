(() => {
  const root = document.documentElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try {
    if (sessionStorage.getItem('pizzamica-intro')) return;
    sessionStorage.setItem('pizzamica-intro', '1');
  } catch { /* Continue with the same bounded intro if storage is unavailable. */ }
  root.classList.add('opening-active');
  const exit = () => root.classList.remove('opening-active');
  const fallback = setTimeout(exit, 1150);
  const start = performance.now();
  addEventListener('DOMContentLoaded', async () => {
    const photo = document.querySelector('.hero-image img');
    await Promise.allSettled([document.fonts.ready, photo?.decode?.()]);
    const remaining = Math.max(0, 460 - (performance.now() - start));
    setTimeout(() => { clearTimeout(fallback); exit(); }, remaining);
  }, {once:true});
  addEventListener('pageshow', event => { if (event.persisted) exit(); }, {once:true});
})();
