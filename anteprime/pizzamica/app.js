(() => {
  'use strict';
  const products = JSON.parse(document.getElementById('product-data')?.textContent || '[]');
  const byId = new Map(products.map(product => [product.id, product]));
  const cartDialog = document.getElementById('cart');
  const photoDialog = document.getElementById('photo');
  const cartBody = document.getElementById('cart-body');
  const key = 'sl-pizzamica-preview-1';
  const shifts = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];
  const currency = cents => (cents / 100).toLocaleString('it-IT', {style:'currency', currency:'EUR'});
  function initialOrders() {
    return [
      {number:16, slot:'19:00', dish:'2 × Margherita', state:0},
      {number:17, slot:'19:30', dish:'1 × Bolognese · 1 × Vivace', state:1}
    ];
  }
  let state = {cart:{}, orders:initialOrders()};
  function refreshState() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (saved?.cart && Array.isArray(saved.orders)) state = saved;
    } catch {}
  }
  refreshState();
  const save = () => { try { sessionStorage.setItem(key, JSON.stringify(state)); } catch {} };
  const entries = () => products.map(p => ({...p,count:Number(state.cart[p.id]) || 0})).filter(p => p.count > 0);
  let notice;
  function notify(message) {
    const toast = document.querySelector('.toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(notice);
    notice = setTimeout(() => toast.classList.remove('show'), 2000);
  }
  function updateCount() {
    const count = entries().reduce((a,p) => a + p.count, 0);
    document.body.classList.toggle('has-items', count > 0);
    document.querySelectorAll('[data-bag-count]').forEach(el => { el.textContent = count; });
    document.querySelectorAll('[data-cart-open]').forEach(el => el.setAttribute('aria-label','Apri il carrello, '+count+' articoli'));
  }
  function change(id, amount) {
    if (!byId.has(id)) return;
    const count = (Number(state.cart[id]) || 0) + amount;
    if (count <= 0) delete state.cart[id]; else state.cart[id] = count;
    save();
    updateCount();
  }
  function element(tag, text, css) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (css) el.className = css;
    return el;
  }
  function action(text, css, fn) {
    const button = element('button',text,css);
    button.type = 'button';
    button.addEventListener('click',fn);
    return button;
  }
  function link(text, href) {
    const a = element('a',text,'button dark');
    a.href = href;
    return a;
  }

  function renderCart() {
    const previousControl = document.activeElement?.dataset?.cartControl;
    const previousSlot = cartBody.querySelector('select')?.value;
    const selected = entries();
    cartBody.replaceChildren();
    if (!selected.length) {
      const browse = link('Scegli dal menu ↗','menu.html');
      cartBody.append(element('p','Il cartone è ancora vuoto. Scegli una pizza o un piatto di bigoli per iniziare.'),browse);
      if (cartDialog.open) browse.focus();
      return;
    }
    const list = element('div',undefined,'cart-list');
    for (const product of selected) {
      const line = element('div',undefined,'cart-line');
      const info = element('div');
      info.append(element('strong',product.name), element('small',currency(product.price)));
      const stepper = element('div',undefined,'stepper');
      for (const [sign, delta] of [['−',-1],['+',1]]) {
        const btn = action(sign,'',() => { change(product.id,delta); renderCart(); });
        btn.dataset.cartControl = product.id+sign;
        btn.setAttribute('aria-label', (delta > 0 ? 'Aumenta ' : 'Riduci ')+product.name);
        stepper.append(btn);
        if (delta < 0) stepper.append(element('span',String(product.count)));
      }
      line.append(info,stepper);
      list.append(line);
    }
    const total = element('div',undefined,'sum');
    total.append(element('span','Totale'),element('b',currency(selected.reduce((a,p) => a+p.count*p.price,0))));
    const label = element('label','Fascia di ritiro');
    label.htmlFor = 'slot';
    const select = element('select');
    select.id = 'slot';
    for (const time of shifts) select.append(new Option(time,time));
    if (shifts.includes(previousSlot)) select.value = previousSlot;
    const description = element('p','Ordine di prova sul tuo dispositivo. Gli orari sono dimostrativi e la cucina non riceve la richiesta.','form-help');
    const confirm = action('Conferma il ritiro di prova →','button dark',() => {
      const number = Math.max(17,...state.orders.map(o => Number(o.number) || 0))+1;
      const order = {number,slot:select.value,dish:selected.map(p => p.count+' × '+p.name).join(' · '),state:0};
      state.orders.push(order);
      state.cart = {};
      save();
      updateCount();
      const counter = link('Vedi il ritiro dal banco ↗','banco.html?ordine='+number);
      counter.addEventListener('click',() => { if (cartDialog.open) cartDialog.close(); });
      cartBody.replaceChildren(element('h3','Ritiro di prova confermato'),element('p','Cartone '+number+' · ore '+order.slot),element('p',order.dish),counter);
      counter.focus();
    });
    cartBody.append(list,total,label,select,description,confirm);
    if (previousControl) {
      const controls = [...cartBody.querySelectorAll('[data-cart-control]')];
      (controls.find(el => el.dataset.cartControl === previousControl) || controls[0] || select).focus();
    }
  }
  function initCounter() {
    const board = document.getElementById('order-board');
    const titles = ['Da preparare', 'In preparazione', 'Pronti al ritiro'];
    const actions = ['Inizia preparazione', 'Segna pronto', 'Segna ritirato'];
    const highlighted = Number(new URLSearchParams(location.search).get('ordine')) || null;
    let focusNumber = null;
    function draw() {
      const byPickup = [...state.orders].sort((a,b) => a.slot.localeCompare(b.slot) || a.number-b.number);
      document.querySelectorAll('[data-count]').forEach(count => {
        count.textContent = byPickup.filter(o=>o.state===Number(count.dataset.count)).length;
      });
      board.replaceChildren(...titles.map((title,stage)=>{
        const orders = byPickup.filter(order=>order.state===stage);
        const column=element('section',undefined,'order-column');
        const heading=element('h2',title);heading.append(element('span',String(orders.length)));
        column.append(heading);
        for (const order of orders) {
          const selected=order.number===(focusNumber || highlighted);
          const card=element('article',undefined,'order-card'+(selected?' highlight':''));
          card.dataset.number=order.number;
          const advance=element('button',actions[stage]+' →','primary');
          advance.type='button';advance.dataset.advance=order.number;
          advance.setAttribute('aria-label',actions[stage]+' il cartone '+order.number);
          card.append(element('small','RITIRO'),element('div',order.slot,'order-time'),element('h3','Cartone '+order.number),element('p',order.dish),advance);
          column.append(card);
        }
        if (!orders.length) column.append(element('p','Nessun ordine in questa fase','order-empty'));
        return column;
      }));
    }
    board.addEventListener('click',event=>{
      const button=event.target.closest('[data-advance]');
      if (!button) return;
      const item=state.orders.find(o=>o.number===Number(button.dataset.advance));
      if (!item || item.state>2) return;
      item.state++;focusNumber=item.number;
      save();draw();
      const action=board.querySelector('[data-advance="'+item.number+'"]') || document.getElementById('reset-dashboard');
      action.focus({preventScroll:true});
      const toast=document.getElementById('dashboard-toast');
      toast.textContent='Cartone '+item.number+' · '+['In coda','In preparazione','Pronto al ritiro','Ritirato'][item.state];
      toast.hidden=false;clearTimeout(notice);notice=setTimeout(()=>{toast.hidden=true;},2400);
    });
    document.getElementById('reset-dashboard').addEventListener('click',()=>{
      state.orders=initialOrders();focusNumber=null;save();draw();
      history.replaceState(null,'',location.pathname);
    });
    window.addEventListener('pageshow',()=>{refreshState();draw();});
    draw();
  }
  if (document.body.dataset.page === 'banco') {initCounter();return;}
  function openOldCounterLink() {
    if(document.body.dataset.page==='proposte' && location.hash==='#banco') location.replace('banco.html');
  }
  openOldCounterLink();
  window.addEventListener('hashchange',openOldCounterLink);
  window.addEventListener('pageshow',()=>{
    refreshState();updateCount();
    if (cartDialog?.open) renderCart();
  });
  document.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click',() => {
    const id = Number(button.dataset.add);
    change(id,1);
    notify(byId.get(id).name+' nel cartone');
    button.textContent = '✓';
    setTimeout(() => { button.textContent = '+'; },700);
  }));
  document.querySelectorAll('[data-cart-open]').forEach(button => button.addEventListener('click',() => {
    renderCart();
    cartDialog.showModal();
    cartDialog.querySelector('[data-close]').focus();
  }));
  document.querySelectorAll('[data-photo]').forEach(button => button.addEventListener('click',() => {
    const img = photoDialog.querySelector('img');
    const preview = button.querySelector('img');
    const full = button.dataset.photo;
    img.src = preview.currentSrc || preview.src;
    img.alt = preview.alt;
    img.dataset.full = full;
    photoDialog.showModal();
    const original = new Image();
    original.onload = () => {
      if (photoDialog.open && img.dataset.full === full) img.src = full;
    };
    original.src = full;
    photoDialog.querySelector('[data-close]').focus();
  }));
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click',() => button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click',event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  }));
  const filters = [...document.querySelectorAll('[data-filter]')];
  function filter(value) {
    if (!filters.some(b => b.dataset.filter === value)) value = 'all';
    for (const button of filters) button.setAttribute('aria-pressed',String(button.dataset.filter === value));
    document.querySelectorAll('[data-group]').forEach(group => { group.hidden = value !== 'all' && group.dataset.group !== value; });
  }
  filters.forEach(button => button.addEventListener('click',() => {
    filter(button.dataset.filter);
    const url = new URL(location.href);
    url.hash = button.dataset.filter === 'all' ? '' : button.dataset.filter;
    history.replaceState(null,'',url);
  }));
  if (filters.length) {
    const applyLocation = () => filter(location.hash.slice(1));
    applyLocation();
    window.addEventListener('hashchange', applyLocation);
    window.addEventListener('pageshow', applyLocation);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      document.body.classList.toggle('header-away', !entry.isIntersecting && entry.boundingClientRect.bottom <= 0);
    }).observe(document.querySelector('.mast'));
  }
  updateCount();
})();
