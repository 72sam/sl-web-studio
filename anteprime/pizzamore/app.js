(() => {
  const page = document.body.dataset.page;
  const storageKey = 'pm-agenda-v1';
  const areas = ['Sala', 'Dehors'];
  const hours = ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];
  const formatDate = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  const italianDay = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  function today() {
    return italianDay.format(new Date());
  }
  function validDay(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(value + 'T12:00:00');
    return Number.isFinite(date.getTime()) && date.getDate() === Number(value.slice(-2));
  }
  function isMonday(value) {
    return validDay(value) && new Date(value + 'T12:00:00').getDay() === 1;
  }
  function firstOpenDay() {
    const day = today();
    if (!isMonday(day)) return day;
    const midday = new Date(day + 'T12:00:00Z');
    midday.setUTCDate(midday.getUTCDate() + 1);
    return midday.toISOString().slice(0, 10);
  }
  function checkServiceDate(form, note) {
    const field = form.elements.date;
    const closed = isMonday(field.value);
    const msg = closed ? 'Il lunedì la pizzeria è chiusa. Scegli una serata da martedì a domenica.' : 'Il lunedì la pizzeria è chiusa.';
    field.setCustomValidity(closed ? msg : '');
    field.setAttribute('aria-invalid', String(closed));
    note.toggleAttribute('data-invalid', closed);
    note.textContent = msg;
    form.querySelector('button[type="submit"]').disabled = closed || !validDay(field.value) || field.value < today();
    return !closed;
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
      { id: 'esempio-1', time: '19:30', guests: 4, area: 'Sala', status: 'confirmed', label: 'Tavolo di esempio' },
      { id: 'esempio-2', time: '20:00', guests: 2, area: 'Dehors', status: 'confirmed', label: 'Tavolo di esempio' }
    ];
  }
  function getDay(date) {
    if (!validDay(date) || isMonday(date)) return [];
    const rows = readCalendar()[date];
    return Array.isArray(rows) ? rows : samples();
  }
  const states = {
    pending: {label: 'Da confermare', action: 'Conferma', next: 'confirmed'},
    confirmed: {label: 'Confermata', action: 'Segna arrivo', next: 'arrived'},
    arrived: {label: 'Arrivati', action: 'Annulla arrivo', next: 'confirmed'}
  };
  function stateOf(record) {
    if (Object.hasOwn(states, record.status)) return record.status;
    if (record.arrived) return 'arrived';
    return record.id.startsWith('esempio-') ? 'confirmed' : 'pending';
  }
  function recordFrom(form, source) {
    const input = new FormData(form);
    const byPhone = source === 'phone';
    return {
      id: (byPhone ? 'telefono-' : 'prova-') + Date.now(),
      guests: Number(input.get('guests')), area: input.get('area'), time: input.get('time'),
      status: 'pending', label: byPhone ? 'Telefono · prova' : 'Dal sito · prova'
    };
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
  }
  function initPhotoZoom() {
    const dialog = document.querySelector('.photo-dialog');
    const picture = dialog.querySelector('img');
    for (const trigger of document.querySelectorAll('.zoom')) {
      trigger.addEventListener('click', () => {
        picture.src = trigger.dataset.image;
        picture.alt = trigger.querySelector('img').alt;
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
    if (isMonday(date) || !match || !hours.includes(match[2])) return;
    const records = getDay(date);
    const id = 'prova-' + match[1];
    if (records.some(row => row.id === id)) return;
    records.push({ id, time: match[2], guests: Number(match[3]), area: areas[Number(match[4])], status: 'pending', label: 'Dal sito · prova' });
    writeDay(date, records);
  }
  function initBooking() {
    const form = document.querySelector('#booking-form');
    const day = form.elements.date;
    const ticket = document.querySelector('#ticket');
    day.min = today();
    day.value = firstOpenDay();
    const note = document.querySelector('#service-note');
    day.addEventListener('input', () => checkServiceDate(form, note));
    day.addEventListener('change', () => checkServiceDate(form, note));
    checkServiceDate(form, note);
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!checkServiceDate(form, note) || !form.reportValidity() || day.value < today()) return;
      const record = recordFrom(form, 'site');
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
    const phoneToggle = document.querySelector('#phone-toggle');
    const phoneForm = document.querySelector('#phone-form');
    const phoneNote = document.querySelector('#phone-service-note');
    const notice = document.querySelector('#agenda-notice');
    const reset = document.querySelector('#reset-day');
    const params = new URLSearchParams(location.search);
    day.value = validDay(params.get('date')) ? params.get('date') : firstOpenDay();
    restoreTicket(day.value);
    function setPhoneOpen(open) {
      phoneForm.hidden = !open;
      phoneToggle.setAttribute('aria-expanded', String(open));
      if (open) {
        phoneForm.reset();
        phoneForm.elements.date.min = today();
        phoneForm.elements.date.value = day.value;
        if (areas.includes(area.value)) phoneForm.elements.area.value = area.value;
        checkServiceDate(phoneForm, phoneNote);
        phoneForm.elements.date.focus();
      }
    }
    function focusRecord(id) {
      [...container.querySelectorAll('[data-record]')].find(button => button.dataset.record === id)?.focus();
    }
    function render() {
      const closed = isMonday(day.value);
      phoneToggle.disabled = closed || day.value < today();
      reset.disabled = closed;
      if (phoneToggle.disabled) setPhoneOpen(false);
      const rows = getDay(day.value).filter(row => areas.includes(row.area) && (area.value === 'Tutti' || row.area === area.value)).sort((a, b) => a.time.localeCompare(b.time));
      document.querySelector('#tot-bookings').textContent = rows.length;
      document.querySelector('#tot-guests').textContent = rows.reduce((sum, row) => sum + row.guests, 0);
      document.querySelector('#tot-arrived').textContent = rows.filter(row => stateOf(row) === 'arrived').length;
      container.replaceChildren();
      for (const row of rows) {
        const element = document.createElement('div');
        element.className = 'entry';
        element.innerHTML = '<div class="detail"><time></time><div><strong></strong><small></small></div></div><button type="button"></button>';
        element.querySelector('time').textContent = row.time;
        element.querySelector('strong').textContent = row.guests + (row.guests === 1 ? ' persona' : ' persone') + ' · ' + row.area;
        const status = stateOf(row);
        const current = states[status];
        element.querySelector('small').textContent = row.label + ' · ' + current.label;
        const button = element.querySelector('button');
        button.textContent = current.action;
        button.dataset.status = status;
        button.setAttribute('aria-label', current.action + ' per ' + row.guests + ' alle ' + row.time + ', ' + row.area);
        button.dataset.record = row.id;
        container.append(element);
      }
      if (!rows.length) {
        const message = document.createElement('p');
        message.className = 'empty';
        message.textContent = closed ? 'Lunedì di chiusura. La sala e il dehors sono chiusi.' : 'Nessuna prenotazione per questa selezione.';
        container.append(message);
      }
    }
    day.addEventListener('change', () => {
      day.value = validDay(day.value) ? day.value : firstOpenDay();
      setPhoneOpen(false);
      notice.textContent = isMonday(day.value) ? 'Lunedì di chiusura, nessun turno.' : '';
      history.replaceState(null, '', agendaAddress(day.value));
      render();
    });
    area.addEventListener('change', render);
    phoneToggle.addEventListener('click', () => setPhoneOpen(phoneForm.hidden));
    phoneForm.elements.date.addEventListener('input', () => checkServiceDate(phoneForm, phoneNote));
    phoneForm.elements.date.addEventListener('change', () => checkServiceDate(phoneForm, phoneNote));
    phoneForm.addEventListener('submit', event => {
      event.preventDefault();
      if (!checkServiceDate(phoneForm, phoneNote) || !phoneForm.reportValidity()) return;
      const selectedDay = phoneForm.elements.date.value;
      if (selectedDay < today()) return;
      const record = recordFrom(phoneForm, 'phone');
      writeDay(selectedDay, [...getDay(selectedDay), record]);
      day.value = selectedDay;
      if (area.value !== 'Tutti' && area.value !== record.area) area.value = record.area;
      setPhoneOpen(false);
      history.replaceState(null, '', agendaAddress(selectedDay));
      render();
      focusRecord(record.id);
      notice.textContent = 'Richiesta telefonica aggiunta, da confermare.';
    });
    container.addEventListener('click', e => {
      const button = e.target.closest('[data-record]');
      if (!button) return;
      const records = getDay(day.value);
      const selected = records.find(r => r.id === button.dataset.record);
      if (!selected) return;
      selected.status = states[stateOf(selected)].next;
      writeDay(day.value, records);
      render();
      notice.textContent = 'Richiesta aggiornata: ' + states[selected.status].label + '.';
      focusRecord(selected.id);
    });
    reset.addEventListener('click', () => {
      if (isMonday(day.value)) return;
      setPhoneOpen(false);
      notice.textContent = 'Serata di esempio ripristinata.';
      writeDay(day.value, samples());
      history.replaceState(null, '', agendaAddress(day.value));
      render();
    });
    render();
  }
  function initRoomGallery() {
    const controls = document.querySelector('.room-controls');
    controls.addEventListener('click', event => {
      const selected = event.target.closest('button[data-room]');
      if (!selected) return;
      for (const button of controls.querySelectorAll('button')) {
        const active = button === selected;
        button.setAttribute('aria-pressed', String(active));
        document.getElementById(button.getAttribute('aria-controls')).hidden = !active;
      }
    });
  }
  if (page === 'index') initRoomGallery();
  if (document.querySelector('.photo-dialog')) initPhotoZoom();
  if (page === 'menu') initMenu();
  if (page === 'prenota') initBooking();
  if (page === 'sala') initAgenda();
})();
