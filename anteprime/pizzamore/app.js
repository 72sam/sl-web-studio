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
      {id:'esempio-1',time:'19:00',guests:2,area:'Sala',status:'arrived',table:1,label:'Cliente demo A'},
      {id:'esempio-2',time:'19:30',guests:4,area:'Sala',status:'confirmed',label:'Cliente demo B'},
      {id:'esempio-3',time:'20:00',guests:2,area:'Dehors',status:'confirmed',table:4,label:'Cliente demo C'},
      {id:'esempio-4',time:'20:00',guests:4,area:'Dehors',status:'confirmed',label:'Cliente demo D'}
    ];
  }
  function getDay(date) {
    if (!validDay(date) || isMonday(date)) return [];
    const rows = readCalendar()[date];
    return Array.isArray(rows) ? rows : samples();
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
    const el = id => document.getElementById(id);
    const day = el('sala-date');
    const area = el('sala-area');
    const phone = el('phone-dialog');
    const form = el('phone-form');
    const list = el('booking-list');
    const floor = el('floor');
    const query = new URLSearchParams(location.search);
    const tables = [
      {number:1,seats:2,area:'Sala'}, {number:2,seats:4,area:'Sala'}, {number:3,seats:8,area:'Sala'},
      {number:4,seats:2,area:'Dehors'}, {number:5,seats:4,area:'Dehors'}, {number:6,seats:8,area:'Dehors'}
    ];
    const labels = {pending:'Da confermare',confirmed:'Confermata',arrived:'Arrivato',completed:'Concluso'};
    const areaLabel = zone => zone === 'Dehors' ? 'Tavoli fuori' : 'Sala';
    const tableLabel = number => String(number).padStart(2,'0');
    const covers = n => n + (n === 1 ? ' persona' : ' persone');
    const node = (tag, cls, value) => {
      const element = document.createElement(tag);
      if (cls) element.className = cls;
      if (value !== undefined) element.textContent = value;
      return element;
    };
    let timeout;
    function announce(message) {
      const toast = el('dashboard-toast');
      toast.hidden = false;
      toast.textContent = message;
      clearTimeout(timeout);
      timeout = setTimeout(() => {toast.hidden = true;}, 2800);
    }
    day.value = validDay(query.get('date')) ? query.get('date') : firstOpenDay();
    restoreTicket(day.value);
    const idFromSite = (query.get('demo') || '').split('.')[0];
    let selectedId = idFromSite ? 'prova-' + idFromSite : 'esempio-2';
    // Consume the demo fallback once. Reloading after a reset must not resurrect a removed request.
    if (query.has('demo')) history.replaceState(null,'',agendaAddress(day.value));

    function readRows() {
      const rows = getDay(day.value);
      // Earlier demos could mark an arrival before allocating a table.
      for (const row of rows) {
        if (!labels[row.status]) row.status = row.arrived ? 'arrived' : row.id.startsWith('esempio-') ? 'confirmed' : 'pending';
        if (row.status !== 'arrived' || row.table) continue;
        const available = tables.find(t => t.area === row.area && t.seats >= row.guests &&
          !rows.some(r => r.table === t.number && r.status !== 'completed'));
        if (available) row.table = available.number;
      }
      return rows;
    }
    function selected(rows) {return rows.find(row => row.id === selectedId);}
    function matchesZone(row) {return area.value === 'Tutti' || row.area === area.value;}
    function draw() {
      const closed = isMonday(day.value);
      const rows = readRows().filter(matchesZone).sort((a,b) => a.time.localeCompare(b.time));
      const visibleTables = tables.filter(matchesZone);
      if (!selected(rows)) selectedId = (rows.find(r => r.status !== 'completed' && !r.table) || rows[0])?.id;
      const chosen = selected(rows);
      const active = rows.filter(row => row.status !== 'completed');
      el('demo-day').textContent = 'Turno di cena · ' + formatDate.format(new Date(day.value+'T12:00:00'));
      el('area-summary').textContent = (area.value === 'Tutti' ? 'Sala e tavoli fuori' : areaLabel(area.value)) + ' · planimetria di esempio';
      el('phone-toggle').disabled = closed || day.value < today();
      el('reset-dashboard').disabled = closed;
      el('stat-bookings').textContent = active.length;
      el('stat-guests').textContent = active.reduce((n,row) => n+row.guests,0);
      el('stat-pending').textContent = active.filter(row => !row.table).length;
      el('stat-occupied').replaceChildren(document.createTextNode(visibleTables.filter(t =>
        active.some(r=>r.status==='arrived' && r.table===t.number)).length),node('em','', '/'+visibleTables.length));
      list.replaceChildren(...rows.map(row => {
        const button=node('button','booking-row'+(row.id===selectedId?' active':''));
        button.type='button';button.dataset.booking=row.id;button.setAttribute('aria-pressed',String(row.id===selectedId));
        const info=node('span');
        const summary=covers(row.guests)+' · '+areaLabel(row.area)+(row.table ? ' · Tavolo '+tableLabel(row.table) : '');
        info.append(node('strong','',row.label),node('small','',summary));
        const label = row.status==='confirmed' ? (row.table ? 'Prenotato' : 'Da assegnare') : labels[row.status];
        button.append(node('span','time',row.time),info,node('span','status '+row.status,label));
        return button;
      }));
      if (!rows.length) list.append(node('p','booking-empty',closed?'Lunedì di chiusura.':'Nessuna prenotazione per questa selezione.'));
      floor.replaceChildren(...visibleTables.map(table => {
        const occupant = active.find(r=>r.table===table.number);
        const occupied = occupant?.status === 'arrived';
        const button=node('button','table'+(occupant?(occupied?' arrived':' booked'):'')+(chosen?.table === table.number?' selected-table':''));
        button.type='button';button.dataset.table=table.number;
        button.disabled=!chosen || ['arrived','completed'].includes(chosen.status) ||
          (occupant && occupant!==chosen) || chosen.guests>table.seats || chosen.area!==table.area;
        button.setAttribute('aria-label','Tavolo '+table.number+', '+table.seats+' posti, '+areaLabel(table.area)+', '+(occupant?(occupied?'occupato':'prenotato'):'libero'));
        button.append(node('b','',tableLabel(table.number)),node('span','',table.seats+' posti · '+areaLabel(table.area)));
        return button;
      }));
      el('selection-title').textContent=chosen?.label || 'Nessuna prenotazione selezionata';
      el('selection-detail').textContent=chosen ? [chosen.time,covers(chosen.guests),areaLabel(chosen.area),
        chosen.status==='completed'?'Servizio concluso':chosen.table?'Tavolo '+tableLabel(chosen.table):'Scegli un tavolo libero'].join(' · ') : '';
      el('confirm').hidden = chosen?.status!=='pending';
      el('unassign').hidden = chosen?.status==='completed' || chosen?.status==='arrived';
      el('unassign').disabled = !chosen?.table;
      el('arrive').hidden = chosen?.status==='completed' || chosen?.status==='arrived';
      el('arrive').disabled = !chosen?.table;
      el('complete').hidden = chosen?.status!=='arrived';
      el('undo-arrival').hidden = chosen?.status!=='arrived';
    }
    function updateSelected(change, message) {
      const rows=readRows(), current=selected(rows);
      if (!current) return;
      change(current);
      writeDay(day.value,rows);
      draw();announce(message);
    }
    list.addEventListener('click',event=>{
      const row=event.target.closest('[data-booking]');
      if (!row) return;
      selectedId=row.dataset.booking;draw();
      list.querySelector('.active')?.focus({preventScroll:true});
    });
    floor.addEventListener('click',event=>{
      const table=event.target.closest('[data-table]');
      if (!table || table.disabled) return;
      updateSelected(row=>{row.table=Number(table.dataset.table);row.status='confirmed';},'Tavolo assegnato e prenotazione confermata.');
      el('arrive').focus({preventScroll:true});
    });
    el('unassign').addEventListener('click',()=>updateSelected(r=>{r.table=null;},'Tavolo liberato. Puoi sceglierne un altro.'));
    el('confirm').addEventListener('click',()=>updateSelected(r=>{r.status='confirmed';},'Richiesta confermata.'));
    el('arrive').addEventListener('click',()=>updateSelected(r=>{r.status='arrived';},'Arrivo registrato.'));
    el('undo-arrival').addEventListener('click',()=>updateSelected(r=>{r.status='confirmed';},'Arrivo annullato.'));
    el('complete').addEventListener('click',()=>updateSelected(r=>{r.status='completed';r.table=null;},'Servizio concluso, tavolo libero.'));
    el('shift-toggle').addEventListener('click',()=>{
      const filters=el('shift-options');
      filters.hidden=!filters.hidden;
      el('shift-toggle').setAttribute('aria-expanded',String(!filters.hidden));
      if (!filters.hidden) day.focus();
    });
    day.addEventListener('change',()=>{
      if (!validDay(day.value)) day.value=firstOpenDay();
      history.replaceState(null,'',agendaAddress(day.value));draw();
    });
    area.addEventListener('change',draw);
    el('phone-toggle').addEventListener('click',()=>{
      form.reset();form.elements.date.min=today();form.elements.date.value=day.value;
      if (areas.includes(area.value)) form.elements.area.value=area.value;
      checkServiceDate(form,el('phone-service-note'));
      phone.showModal();
    });
    el('phone-close').addEventListener('click',()=>phone.close());
    for (const event of ['input','change']) form.elements.date.addEventListener(event,()=>checkServiceDate(form,el('phone-service-note')));
    form.addEventListener('submit',event=>{
      event.preventDefault();
      if (!checkServiceDate(form,el('phone-service-note')) || !form.reportValidity() || form.elements.date.value < today()) return;
      const row=recordFrom(form,'phone');
      day.value=form.elements.date.value;
      writeDay(day.value,[...getDay(day.value),row]);
      if (!matchesZone(row)) area.value=row.area;
      selectedId=row.id;phone.close();
      history.replaceState(null,'',agendaAddress(day.value));draw();
      list.querySelector('.active')?.focus({preventScroll:true});announce('Richiesta telefonica aggiunta.');
    });
    el('reset-dashboard').addEventListener('click',()=>{
      writeDay(day.value,samples());selectedId='esempio-2';area.value='Tutti';draw();announce('Serata di esempio ripristinata.');
    });
    window.addEventListener('pageshow',draw);
    draw();
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
  function initOdooExcerpt() {
    const toggle = document.getElementById('clip-toggle');
    const panel = document.getElementById('clip-odoo');
    const player = panel.querySelector('.clip-player');
    toggle.addEventListener('click', () => {
      const open = panel.hidden;
      toggle.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      player.replaceChildren();
      if (open) {
        const frame = document.createElement('iframe');
        frame.title = 'Prenotazioni in Odoo Ristorante, estratto di un minuto';
        frame.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
        frame.allowFullscreen = true;
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.src = 'https://www.youtube-nocookie.com/embed/t_MCzbETS4k?start=449&end=509&autoplay=1&rel=0';
        player.append(frame);
      }
    });
  }
  if (page === 'proposte') initOdooExcerpt();
  if (page === 'index') initRoomGallery();
  if (document.querySelector('.photo-dialog')) initPhotoZoom();
  if (page === 'menu') initMenu();
  if (page === 'prenota') initBooking();
  if (page === 'sala') initAgenda();
})();
