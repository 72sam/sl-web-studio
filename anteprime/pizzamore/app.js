(() => {
  const page = document.body.dataset.page;
  const storageKey = 'pm-agenda-v1';
  const areas = ['Sala', 'Dehors'];
  const hours = ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];
  const formatDate = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  function today() {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  }
  function validDay(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(value + 'T12:00:00');
    return Number.isFinite(date.getTime()) && date.getDate() === Number(value.slice(-2));
  }
  let memory = {};
  function readCalendar() {
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) memory = stored;
    } catch {}
    return memory;
  }
  function writeDay(date, records) {
    const calendar = readCalendar();
    calendar[date] = records;
    memory = calendar;
    try { sessionStorage.setItem(storageKey, JSON.stringify(calendar)); } catch {}
  }
  function samples() {
    return [
      { id: 'esempio-1', time: '19:30', guests: 4, area: 'Sala', arrived: false, label: 'Tavolo di esempio' },
      { id: 'esempio-2', time: '20:00', guests: 2, area: 'Dehors', arrived: false, label: 'Tavolo di esempio' }
    ];
  }
  function getDay(date) {
    const rows = readCalendar()[date];
    return Array.isArray(rows) ? rows : samples();
  }
  function initMenu() {
    const filters = document.querySelector('.filters');
    const dishes = [...document.querySelectorAll('[data-category]')];
    filters.addEventListener('click', event => {
      const button = event.target.closest('button[data-filter]');
      if (!button) return;
      for (const b of filters.querySelectorAll('button')) b.setAttribute('aria-pressed', b === button);
      for (const dish of dishes) dish.hidden = button.dataset.filter !== 'Tutto' && dish.dataset.category !== button.dataset.filter;
    });
    const dialog = document.querySelector('.photo-dialog');
    const picture = dialog.querySelector('img');
    for (const trigger of document.querySelectorAll('.zoom')) {
      trigger.addEventListener('click', () => {
        picture.src = trigger.dataset.image;
        picture.alt = trigger.dataset.title + ', fotografia illustrativa';
        dialog.querySelector('p').textContent = trigger.dataset.title;
        dialog.showModal();
      });
    }
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  }
  function agendaAddress(date, record) {
    const url = new URL('sala.html', location.href);
    url.searchParams.set('date', date);
    if (record) {
      // Carry only synthetic selections so this preview also works with browser storage disabled.
      url.searchParams.set('demo', [record.id.slice(6), record.time, record.guests, areas.indexOf(record.area)].join('.'));
    }
    return url.href;
  }
  function restoreTicket(date) {
    const encoded = new URLSearchParams(location.search).get('demo') || '';
    const match = /^(\d{10,16})\.(\d{2}:\d{2})\.([1-8])\.([01])$/.exec(encoded);
    if (!match || !hours.includes(match[2])) return;
    const records = getDay(date);
    const id = 'prova-' + match[1];
    if (records.some(row => row.id === id)) return;
    records.push({ id, time: match[2], guests: Number(match[3]), area: areas[Number(match[4])], arrived: false, label: 'Dal sito · prova' });
    writeDay(date, records);
  }
  function initBooking() {
    const form = document.querySelector('#booking-form');
    const day = form.elements.date;
    const ticket = document.querySelector('#ticket');
    day.min = today();
    day.value = today();
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!form.reportValidity() || !validDay(day.value)) return;
      const input = new FormData(form);
      const record = { id: 'prova-' + Date.now(), guests: Number(input.get('guests')), area: input.get('area'), time: input.get('time'), arrived: false, label: 'Dal sito · prova' };
      writeDay(day.value, [...getDay(day.value), record]);
      document.querySelector('#ticket-details').textContent = formatDate.format(new Date(day.value + 'T12:00:00')) + ' alle ' + record.time + ' · ' + record.guests + (record.guests === 1 ? ' persona' : ' persone') + ' · ' + record.area + '.';
      const see = document.querySelector('#see-agenda');
      see.href = agendaAddress(day.value, record);
      form.hidden = true;
      ticket.hidden = false;
      see.focus();
    });
    document.querySelector('#book-again').addEventListener('click', () => {
      form.hidden = false;
      ticket.hidden = true;
      day.focus();
    });
  }
  function initAgenda() {
    const day = document.querySelector('#sala-date');
    const area = document.querySelector('#sala-area');
    const container = document.querySelector('#agenda-entries');
    const params = new URLSearchParams(location.search);
    day.value = validDay(params.get('date')) ? params.get('date') : today();
    restoreTicket(day.value);
    function render() {
      const rows = getDay(day.value).filter(row => areas.includes(row.area) && (area.value === 'Tutti' || row.area === area.value)).sort((a, b) => a.time.localeCompare(b.time));
      document.querySelector('#tot-bookings').textContent = rows.length;
      document.querySelector('#tot-guests').textContent = rows.reduce((sum, row) => sum + row.guests, 0);
      document.querySelector('#tot-arrived').textContent = rows.filter(r => r.arrived).length;
      container.replaceChildren();
      for (const row of rows) {
        const element = document.createElement('div');
        element.className = 'entry';
        element.innerHTML = '<div class="detail"><time></time><div><strong></strong><small></small></div></div><button type="button"></button>';
        element.querySelector('time').textContent = row.time;
        element.querySelector('strong').textContent = row.guests + (row.guests === 1 ? ' persona' : ' persone') + ' · ' + row.area;
        element.querySelector('small').textContent = row.label;
        const button = element.querySelector('button');
        button.textContent = row.arrived ? 'Arrivati ✓' : 'Segna arrivo';
        button.setAttribute('aria-pressed', row.arrived);
        button.setAttribute('aria-label', (row.arrived ? 'Annulla arrivo' : 'Segna arrivo') + ' per ' + row.guests + ' alle ' + row.time + ', ' + row.area);
        button.dataset.record = row.id;
        container.append(element);
      }
      if (!rows.length) {
        const message = document.createElement('p');
        message.className = 'empty';
        message.textContent = 'Nessuna prenotazione per questa selezione.';
        container.append(message);
      }
    }
    day.addEventListener('change', () => {
      day.value = validDay(day.value) ? day.value : today();
      history.replaceState(null, '', agendaAddress(day.value));
      render();
    });
    area.addEventListener('change', render);
    container.addEventListener('click', e => {
      const button = e.target.closest('[data-record]');
      if (!button) return;
      const records = getDay(day.value);
      const selected = records.find(r => r.id === button.dataset.record);
      if (!selected) return;
      selected.arrived = !selected.arrived;
      writeDay(day.value, records);
      render();
      [...container.querySelectorAll('[data-record]')].find(b => b.dataset.record === selected.id)?.focus();
    });
    document.querySelector('#reset-day').addEventListener('click', () => {
      writeDay(day.value, samples());
      history.replaceState(null, '', agendaAddress(day.value));
      render();
    });
    render();
  }
  if (page === 'menu') initMenu();
  if (page === 'prenota') initBooking();
  if (page === 'sala') initAgenda();
})();
