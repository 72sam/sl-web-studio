(() => {
  const demo = document.querySelector('[data-stock-demo]');
  if (!demo) return;

  const rows = [...demo.querySelectorAll('.stock-demo__queue li')];
  const summary = demo.querySelector('[data-stock-summary]');
  const empty = demo.querySelector('.stock-demo__empty');
  const reset = demo.querySelector('.stock-demo__reset');
  function render() {
    const count = rows.filter(row => !row.hidden).length;
    summary.textContent = count === 0 ? 'Tutti gli articoli sono stati recuperati' :
      count === 1 ? '1 articolo da recuperare' : count + ' articoli da recuperare';
    empty.hidden = count > 0;
    reset.hidden = count === rows.length;
  }
  for (const row of rows) {
    const button = row.querySelector('button');
    button.hidden = false;
    button.addEventListener('click', () => {
      row.hidden = true;
      render();
      const next = rows.find(item => !item.hidden);
      (next?.querySelector('button') || reset).focus({preventScroll: true});
    });
  }
  reset.addEventListener('click', () => {
    rows.forEach(row => { row.hidden = false; });
    render();
    rows[0].querySelector('button').focus({preventScroll: true});
  });
})();
