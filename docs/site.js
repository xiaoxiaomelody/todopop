/* todopop.app: everything on the page besides the bubbles themselves (those are engine.js) */
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const root = document.documentElement, REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const TP = window.TP || {};
  const I18N = window.I18N || {T:s => s, lang:'en', onChange(){}}, T = s => I18N.T(s), zh = () => I18N.lang === 'zh';
  const label = b => TP.label ? TP.label(b) : b.name;

  /* ---------- downloads: the right one first ---------- */
  const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)), android = /Android/i.test(ua), mobile = ios || android;
  const mac = /Mac/i.test(navigator.userAgentData?.platform || navigator.platform || ua);
  if(!mobile) $$('.btns').forEach(g => { // the computer you're on gets the solid button
    const w = g.querySelector('[data-os=win]'), m = g.querySelector('[data-os=mac]'); if(!w || !m) return;
    const [mine, other] = mac ? [m, w] : [w, m]; mine.classList.add('solid'); other.classList.remove('solid');
  });
  if(mobile){
    const g = $('#hero-btns'), a = document.createElement('a'); a.className = 'btn solid';
    const fill = () => { if(android) a.innerHTML = `${T('Get the Android app')} <small>.apk</small>`; else a.textContent = T('Get on iPhone');
      if($('#hero-meta')) $('#hero-meta').textContent = T('Free · No Sign-up · No ads · The bubbles float on your computer; your phone is the remote.'); };
    a.href = android ? 'https://github.com/nosugarlessice/todopop/releases/latest/download/TODOPOP-android.apk' : 'app/';
    g.querySelectorAll('[data-os]').forEach(b => b.classList.remove('solid')); g.prepend(a); fill(); I18N.onChange(fill);
  }

  scrollTo({top:0, behavior:'instant'}); // a fresh start every time
  $('#foot-logo')?.addEventListener('click', e => { e.preventDefault(); scrollTo({top:0, behavior:'instant'}); location.reload(); });

  /* ---------- reveal things as you scroll to them ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }), {rootMargin:'0px 0px -8% 0px', threshold:.12});
  $$('.rv, .pop-in, .arrows').forEach(el => REDUCED ? el.classList.add('in') : io.observe(el));

  /* ---------- the giant logo: its three O's work like the app's sticker panel ---------- */
  const big = $('#big') || document.createElement('div'), pop = $('#tp-pop') || document.createElement('div'), notes = $$('.o-note'); // (the logo frame only lives on the home page)
  function placeNotes(){ // each label sits right above its O
    const nb = $('#o-notes'); if(!nb) return; const box = nb.getBoundingClientRect();
    notes.forEach(n => { const o = big.querySelectorAll('.o')[+n.dataset.o].getBoundingClientRect(); n.style.left = (o.left + o.width/2 - box.left) + 'px'; });
  }
  addEventListener('resize', placeNotes); document.fonts?.ready.then(placeNotes); placeNotes();
  function alignFeats(){ // the feature line starts under the "t" in "Additional Features"
    const h = $('#more-title'), f = $('.feats'); if(!h || !f) return;
    const word = zh() ? '更多' : 'Additional', tn = [...h.childNodes].find(n => n.nodeType === 3 && n.textContent.includes(word)); if(!tn){ f.style.paddingLeft = ''; return; }
    const rg = document.createRange(), k = tn.textContent.indexOf(word) + (zh() ? 1 : 4); rg.setStart(tn, k); rg.setEnd(tn, k + 1);
    f.style.paddingLeft = Math.max(0, rg.getBoundingClientRect().left - h.getBoundingClientRect().left) + 'px';
  }
  addEventListener('resize', alignFeats); document.fonts?.ready.then(alignFeats); alignFeats();
  function fitCircles(){ // a dotted circle always big enough to hold its words, whatever the language
    $$('.doodle').forEach(el => { const kids = [...el.children].filter(k => !k.matches('svg'));
      el.style.width = ''; const w = Math.max(...kids.flatMap(k => [k, ...k.querySelectorAll('li')]).map(k => k.scrollWidth)), h = kids.reduce((s, k) => s + k.offsetHeight, 0) + 10;
      const need = Math.ceil(Math.hypot(w, h) + 64); if(need > el.offsetWidth) el.style.width = need + 'px'; });
  }
  addEventListener('resize', fitCircles); document.fonts?.ready.then(fitCircles); fitCircles();
  big.querySelectorAll('.o').forEach((o, k) => { const hot = on => notes.forEach(n => +n.dataset.o === k && n.classList.toggle('hot', on));
    o.addEventListener('pointerenter', () => hot(true)); o.addEventListener('pointerleave', () => hot(false)); o.addEventListener('focus', () => hot(true)); o.addEventListener('blur', () => hot(false)); });

  /* dotted circles: perfectly round at rest; the skin reacts to your cursor exactly as a bubble's does in the app
     (same springs, same push and drag from the cursor, same jiggle when you cross it) */
  $$('.doodle').forEach(el => {
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'), path = document.createElementNS(NS, 'path');
    svg.setAttribute('class', 'wob'); svg.setAttribute('viewBox', '-1.1 -1.1 2.2 2.2'); svg.setAttribute('aria-hidden', 'true');
    path.setAttribute('vector-effect', 'non-scaling-stroke'); svg.appendChild(path); el.prepend(svg);
    // GAIN: the app's numbers move a thin dashed line only ~1px, which reads as nothing, so the push is tripled to look like a bubble does on screen
    const GAIN = 3, N = 40, JELLY = .55, k = 420, Ls = 300, c = 9 + (1 - JELLY)*30, d = new Float32Array(N), v = new Float32Array(N), C = [], Sn = [];
    for(let i = 0; i < N; i++){ C.push(Math.cos(i/N*6.2832)); Sn.push(Math.sin(i/N*6.2832)); }
    let R = 100;
    const shape = () => { // the app's smooth outline through the points
      const P = []; for(let i = 0; i < N; i++){ const r = 1 + d[i]/R; P.push([C[i]*r, Sn[i]*r]); }
      let p = `M${((P[N-1][0] + P[0][0])/2).toFixed(4)} ${((P[N-1][1] + P[0][1])/2).toFixed(4)}`;
      for(let i = 0; i < N; i++){ const a = P[i], b = P[(i + 1) % N]; p += `Q${a[0].toFixed(4)} ${a[1].toFixed(4)} ${((a[0] + b[0])/2).toFixed(4)} ${((a[1] + b[1])/2).toFixed(4)}`; }
      path.setAttribute('d', p + 'Z'); };
    shape();
    if(REDUCED) return;
    const m = {x:-999, y:-999, vx:0, vy:0, t:0}; let running = false, last = 0, inside = null;
    function run(now){
      const dt = Math.min(1/30, (now - last)/1000 || 1/60); last = now;
      const r = el.getBoundingClientRect(), cx = r.left + r.width/2, cy = r.top + r.height/2; R = r.width/2;
      if(Math.hypot(m.x - cx, m.y - cy) < R + 90){
        for(let i = 0; i < N; i++){
          const px = cx + C[i]*(R + d[i]), py = cy + Sn[i]*(R + d[i]), q = (px - m.x)**2 + (py - m.y)**2, w = Math.exp(-q/(2*55*55));
          v[i] += (C[i]*m.vx + Sn[i]*m.vy)*w*0.045*JELLY*GAIN; // drags the skin along
          if(q < 26*26) v[i] += -(1 - Math.sqrt(q)/26)*40*JELLY*GAIN; // presses into it
        }
      }
      m.vx *= .82; m.vy *= .82;
      const h = dt/3; let e = 0;
      for(let s = 0; s < 3; s++){
        for(let i = 0; i < N; i++) v[i] += (k*(0 - d[i]) + Ls*(d[(i + N - 1) % N] + d[(i + 1) % N] - 2*d[i]) - c*v[i])*h;
        for(let i = 0; i < N; i++) d[i] += v[i]*h;
      }
      for(let i = 0; i < N; i++) e += Math.abs(d[i]) + Math.abs(v[i])*.02;
      shape();
      const near = Math.hypot(m.x - cx, m.y - cy) < R + 90;
      if(e > .05 || near){ requestAnimationFrame(run); } else { d.fill(0); v.fill(0); shape(); running = false; }
    }
    addEventListener('pointermove', e => {
      const t = performance.now(), dt = Math.max(8, t - m.t);
      m.vx = (e.clientX - m.x)/dt*1000; m.vy = (e.clientY - m.y)/dt*1000; if(Math.abs(m.vx) > 6000) m.vx = 0; if(Math.abs(m.vy) > 6000) m.vy = 0;
      m.x = e.clientX; m.y = e.clientY; m.t = t;
      const r = el.getBoundingClientRect(); if(r.bottom < 0 || r.top > innerHeight) return;
      const cx = r.left + r.width/2, cy = r.top + r.height/2, now = Math.hypot(m.x - cx, m.y - cy) < r.width/2;
      if(inside !== null && now !== inside) for(let i = 0; i < N; i++) v[i] += (C[i]*m.vx + Sn[i]*m.vy)*-0.03*GAIN; // the jiggle as you cross into it
      inside = now;
      if(!running && Math.hypot(m.x - cx, m.y - cy) < r.width/2 + 90){ running = true; last = t; requestAnimationFrame(run); }
    }, {passive:true});
  });

  let openO = null;
  const SHORT = {1:'REMIND', 2:'SOON', 3:'TODAY', 4:'NOW!'};
  const LEVEL_NAME = {1:'Just a reminder', 2:'Soon', 3:'Today', 4:'Super urgent'};
  const GROUPS = ['School', 'Work', 'Home', 'Health'];
  const popped = []; // what you've popped on this page
  TP.onPop = (b, secs) => { popped.unshift({name:b.name, key:b.key || null, level:b.level, group:b.group || null, focus:secs || b.focusSecs || 0, at:Date.now()}); if(openO === 1){ selDay = null; renderProgress(); } };

  // the app's tints: hue + saturation, drawn at a lightness that always reads on white
  const hslToRgb = (h, s, l) => { const a = s*Math.min(l, 1-l), f = n => { const k = (n + h/30) % 12; return l - a*Math.max(-1, Math.min(k-3, 9-k, 1)); }; return [f(0), f(8), f(4)].map(v => Math.round(v*255)); };
  const inkL = (h, s) => s < .08 ? .16 : .36 - .14*Math.max(0, 1 - Math.abs(h-140)/80);
  const PRESETS = [[222,.72],[354.9,.771],[178,.9],[95,.55],[268,.55],[24,.85],[0,0]];
  let tint = 0;
  const hex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  function setTint(i){
    tint = i; const [h, s] = PRESETS[i], rgb = hslToRgb(h, s, inkL(h, s));
    root.style.setProperty('--ink', hex(rgb)); document.querySelector('meta[name=theme-color]')?.setAttribute('content', hex(rgb)); TP.setTint?.(rgb);
    if(openO === 2) renderCustomize();
  }

  function stopsHTML(cur){ return `<div class="stops" role="group" aria-label="${T('Urgency')}">${[1,2,3,4].map(l => `<button type="button" data-l="${l}" aria-pressed="${l === cur}">${T(SHORT[l])}</button>`).join('')}</div>`; }
  function wireStops(box, onPick){ box.querySelector('.stops').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if(!b) return; box.querySelectorAll('.stops button').forEach(x => x.setAttribute('aria-pressed', x === b)); onPick(+b.dataset.l); }); }

  function renderCreate(){
    let level = 2, group = null;
    pop.innerHTML = `<div class="row"><h3>${T('Blow a bubble')}</h3><button type="button" class="x" aria-label="${T('Close')}">×</button></div>
      <label class="lbl" for="tp-name">${T('Task name')}</label><input class="tin" id="tp-name" maxlength="40" placeholder="${T('e.g. Send the team the Figma link')}" autocomplete="off">
      <span class="lbl">${T('Urgency')} · <span id="tp-lv">${T(LEVEL_NAME[level])}</span></span>${stopsHTML(level)}
      <span class="lbl">${T('Group')}</span><div class="chips" id="tp-g"><button type="button" data-g="" aria-pressed="true"><i></i>${T('No group')}</button>${GROUPS.map(g => `<button type="button" data-g="${g}" aria-pressed="false"><i style="background:${TP.groupColor?.(g)}"></i>${T(g)}</button>`).join('')}</div>
      <button type="button" class="btn solid" id="tp-blow" style="justify-content:center">${T('Blow it')}</button>`;
    wireStops(pop, l => { level = l; $('#tp-lv').textContent = T(LEVEL_NAME[l]); });
    $('#tp-g').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if(!b) return; group = b.dataset.g || null; $$('#tp-g button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
    const blow = () => { const name = $('#tp-name').value.trim(); if(!name){ $('#tp-name').focus(); return; }
      const r = big.getBoundingClientRect(); TP.add?.({name, level, group, at:{x:r.left + r.width*(.2 + Math.random()*.6), y:Math.min(innerHeight - 80, r.bottom + 160)}}); window.TPSound?.blow(); setO(null); };
    $('#tp-blow').addEventListener('click', blow); $('#tp-name').addEventListener('keydown', e => { if(e.key === 'Enter') blow(); });
    setTimeout(() => $('#tp-name')?.focus({preventScroll:true}), 60);
  }
  /* Popped: the app's week and month views. Today is what you've really popped on this page;
     the days before it are a made-up history, so you can see what a few weeks of using it looks like. */
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const SAMPLE_TASKS = [['Problem set 3','School',4,52],['Reading response','School',3,38],['Email TA','School',2,0],['Studio crit prep','School',4,95],['Print posters','School',2,0],
    ['Reply to emails','Work',3,14],['Figma critique','Work',3,41],['Send invoice','Work',2,0],['Update portfolio','Work',2,63],
    ['Laundry','Home',2,0],['Groceries','Home',2,0],['Pay rent','Home',3,0],['Water the pothos','Home',1,0],['Clean desk','Home',1,0],
    ['Gym','Health',2,0],['Book dentist','Health',2,0],['Call mom',null,1,0],['Return library book',null,1,0]];
  const sample = (() => { // the same history every visit
    let seed = 7; const rnd = () => (seed = (seed*16807) % 2147483647) / 2147483647;
    const m = {}, today = new Date(); today.setHours(12, 0, 0, 0);
    for(let i = 1; i < 75; i++){ const d = new Date(today); d.setDate(d.getDate() - i); const wk = d.getDay() === 0 || d.getDay() === 6;
      const n = Math.max(0, Math.round(rnd()*(wk ? 3 : 6) - (rnd() < .18 ? 9 : 0)));
      m[dayKey(d)] = Array.from({length:n}, () => { const [name, group, level, focus] = SAMPLE_TASKS[Math.floor(rnd()*SAMPLE_TASKS.length)]; return {name, group, level, focus:focus ? Math.round(focus*(.6 + rnd()*.8)) : 0}; }); }
    return m; })();
  let archMode = 'week', archOffset = 0, selDay = null;
  const dur = mins => zh() ? (mins >= 60 ? `${Math.floor(mins/60)} 小时 ${mins%60} 分钟` : `${mins} 分钟`) : mins >= 60 ? `${Math.floor(mins/60)} h ${mins%60} min` : `${mins} min`;
  const md = d => zh() ? `${d.getMonth() + 1}月${d.getDate()}日` : `${MON[d.getMonth()]} ${d.getDate()}`;
  const WD = () => zh() ? '一二三四五六日' : 'MTWTFSS';
  function dayList(k){ return k === dayKey(new Date()) ? popped.map(p => ({name:p.key ? T(p.key) : p.name, group:p.group, level:p.level, focus:Math.round((p.focus || 0)/60)})) : (sample[k] || []).map(a => ({...a, name:T(a.name)})); }
  function renderProgress(){
    const today = new Date(); today.setHours(12, 0, 0, 0); const tk = dayKey(today);
    let days = [], cal = '', range = '';
    if(archMode === 'week'){
      const start = new Date(today); start.setDate(start.getDate() - 6 + archOffset*7);
      for(let i = 0; i < 7; i++){ const d = new Date(start); d.setDate(d.getDate() + i); days.push(d); }
      const e = days[6]; range = zh() ? `${start.getFullYear()}年${md(start)} – ${md(e)}` : `${MON[start.getMonth()]} ${start.getDate()} – ${start.getMonth() !== e.getMonth() ? MON[e.getMonth()] + ' ' : ''}${e.getDate()}, ${e.getFullYear()}`;
      cal = `<div class="week">` + days.map(d => { const k = dayKey(d), L = d > today ? [] : dayList(k);
        return `<button type="button" class="wday${k === tk ? ' today' : ''}${k === selDay ? ' sel' : ''}" data-k="${k}" aria-label="${md(d)}: ${L.length}">
          <span class="pips">${L.slice(0, 8).map((a, j) => `<i class="pip${a.group ? ' g' : ''}" style="--k:${j}${a.group ? `; --gc:${TP.groupColor?.(a.group)}` : ''}"></i>`).join('')}</span>
          <span class="n">${L.length}</span><span class="d">${WD()[(d.getDay() + 6) % 7]} ${d.getDate()}</span></button>`; }).join('') + `</div>`;
    } else {
      const m = new Date(today.getFullYear(), today.getMonth() + archOffset, 1, 12); range = zh() ? `${m.getFullYear()}年${m.getMonth() + 1}月` : `${MONTHS[m.getMonth()]} ${m.getFullYear()}`;
      const lead = (m.getDay() + 6) % 7, dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      cal = `<div class="month">` + WD().split('').map(c => `<span class="h">${c}</span>`).join('') + '<span class="mday out"></span>'.repeat(lead);
      for(let i = 1; i <= dim; i++){ const d = new Date(m.getFullYear(), m.getMonth(), i, 12); days.push(d); const k = dayKey(d), n = d > today ? 0 : dayList(k).length, sz = n ? 30 + Math.min(n, 7)*10 : 0;
        cal += `<button type="button" class="mday${n ? '' : ' zero'}${k === tk ? ' today' : ''}${k === selDay ? ' sel' : ''}" data-k="${k}" aria-label="${md(d)}: ${n}">${n ? `<span class="c" style="width:${sz}%; height:${sz}%; --k:${i}"></span>` : ''}<span class="num">${i}</span></button>`; }
      cal += `</div>`;
    }
    const inRange = days.filter(d => d <= today).map(d => ({d, list:dayList(dayKey(d))}));
    const total = inRange.reduce((s, x) => s + x.list.length, 0), best = inRange.reduce((a, x) => x.list.length > (a?.list.length || 0) ? x : a, null);
    const focus = inRange.reduce((s, x) => s + x.list.reduce((t, a) => t + a.focus, 0), 0);
    if(selDay === null){ const last = [...inRange].reverse().find(x => x.list.length); selDay = last ? dayKey(last.d) : ''; }
    const sel = days.find(d => dayKey(d) === selDay), L = sel ? dayList(selDay) : [];
    const per = zh() ? (archMode === 'week' ? '本周' : '本月') : `this ${archMode}`;
    const sum = !total ? (zh() ? `${per}还没有戳破任何泡泡。` : `Nothing popped ${per}.`)
      : zh() ? `${per}戳破了 <b>${total}</b> 个。最多的一天是 <b>${md(best.d)}</b>，戳破了 ${best.list.length} 个。${focus >= 1 ? `专注模式共 <b>${dur(focus)}</b>。` : ''}`
      : `<b>${total}</b> popped ${per}. Best day <b>${md(best.d)}</b> with ${best.list.length}.${focus >= 1 ? ` <b>${dur(focus)}</b> in focus mode.` : ''}`;
    pop.innerHTML = `<div class="row"><h3>${T('Popped')}</h3><button type="button" class="x" aria-label="${T('Close')}">×</button></div>` +
      (popped.length ? '' : `<p class="empty">${T('Nothing popped on this page yet. Press and hold a bubble to pop it, and it lands in today.')}</p>`) +
      `<div class="arch-bar"><div class="seg${archMode === 'month' ? ' on-month' : ''}" role="group" aria-label="${T('View')}"><button type="button" data-m="week" class="${archMode === 'week' ? 'on' : ''}">${T('Week')}</button><button type="button" data-m="month" class="${archMode === 'month' ? 'on' : ''}">${T('Month')}</button></div>
        <div class="arch-nav"><button type="button" data-nav="-1" aria-label="${T('Earlier')}">‹</button><button type="button" data-nav="1" aria-label="${T('Later')}"${archOffset >= 0 ? ' disabled' : ''}>›</button></div></div>
      <div class="range">${range}</div>${cal}
      <p class="arch-sum">${sum}</p>` +
      (L.length ? `<ul class="day-list"><li class="ttl">${md(sel)}</li>${L.map(a => `<li><i style="--gc:${a.group ? TP.groupColor?.(a.group) : 'transparent'}"></i><span>${esc(a.name)}</span><small>${a.focus ? dur(a.focus) + ' · ' : ''}${T(SHORT[a.level])}</small></li>`).join('')}</ul>` : '') +
      `<p class="note">${T('Days before today are a sample history, to show what a few weeks of popping looks like.')}</p>`;
  }
  pop.addEventListener('click', e => {
    if(openO !== 1) return; const m = e.target.closest('[data-m]'), nav = e.target.closest('[data-nav]'), day = e.target.closest('[data-k]');
    if(m && m.dataset.m !== archMode){ archMode = m.dataset.m; archOffset = 0; selDay = null; renderProgress(); }
    else if(nav && !nav.disabled){ archOffset = Math.min(0, archOffset + +nav.dataset.nav); selDay = null; renderProgress(); }
    else if(day){ selDay = selDay === day.dataset.k ? '' : day.dataset.k; renderProgress(); }
    placePop();
  });
  function renderCustomize(){
    pop.innerHTML = `<div class="row"><h3>${T('Your color')}</h3><button type="button" class="x" aria-label="${T('Close')}">×</button></div>
      <div class="swatches" role="group" aria-label="Tint">${PRESETS.map(([h, s], i) => `<button type="button" data-t="${i}" aria-pressed="${i === tint}" aria-label="Color ${i + 1}" style="background:${hex(hslToRgb(h, s, inkL(h, s)))}"></button>`).join('')}</div>
      <p class="note">${T('The whole page and every bubble follow your color. In the app you can pick any color at all, and your groups\u2019 colors shift to match it.')}</p>`;
    pop.querySelector('.swatches').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if(b) setTint(+b.dataset.t); });
  }
  function setO(i){
    openO = (i === openO) ? null : i;
    big.querySelectorAll('.o').forEach((o, k) => { o.classList.toggle('on', k === openO); o.setAttribute('aria-expanded', k === openO); });
    if(openO === null){ pop.hidden = true; notes.forEach(n => n.classList.remove('lift')); return; }
    pop.hidden = false; pop.classList.toggle('wide', openO === 1); if(openO === 1){ archMode = 'week'; archOffset = 0; selDay = null; }
    [renderCreate, renderProgress, renderCustomize][openO](); placePop();
    pop.style.animation = 'none'; void pop.offsetWidth; pop.style.animation = '';
    notes.forEach(n => n.classList.toggle('lift', +n.dataset.o === openO));
  }
  function placePop(){ // floats over the page, hanging from the O you pressed; nothing underneath moves
    if(openO === null || pop.hidden) return;
    const o = big.querySelectorAll('.o')[openO].getBoundingClientRect(), wr = pop.parentElement.getBoundingClientRect(), b = big.getBoundingClientRect(), w = pop.offsetWidth;
    const cx = o.left + o.width/2 - wr.left, left = Math.max(Math.min(0, (wr.width - w)/2), Math.min(Math.max(wr.width - w, (wr.width - w)/2), cx - w/2));
    pop.style.left = left + 'px'; pop.style.top = (b.bottom - wr.top + 16) + 'px';
    pop.style.setProperty('--ox', Math.max(8, Math.min(w - 8, cx - left)) + 'px');
  }
  addEventListener('resize', placePop);
  big.addEventListener('click', e => { const o = e.target.closest('.o'); if(o) setO(+o.dataset.o); });
  pop.addEventListener('click', e => { if(e.target.closest('.x')) setO(null); });
  addEventListener('pointerdown', e => { if(openO !== null && !e.target.closest('#tp-pop, #big')) setO(null); });
  // the first time you see it, the O's show what they do
  if(!REDUCED){ setTimeout(() => { big.classList.add('hint'); setTimeout(() => big.classList.remove('hint'), 1800); }, 1400); }

  /* ---------- right-click a bubble to edit it ---------- */
  let editPop = null;
  function closeEdit(){ editPop?.remove(); editPop = null; }
  TP.onEdit = (b, x, y) => {
    closeEdit(); let level = b.level;
    editPop = document.createElement('div'); editPop.className = 'tp-pop edit-pop'; editPop.setAttribute('role', 'dialog'); editPop.setAttribute('aria-label', T('Edit bubble'));
    editPop.innerHTML = `<div class="row"><span class="lbl">${T('Edit bubble')}</span><button type="button" class="x" aria-label="${T('Close')}">×</button></div>
      <label class="lbl" for="ed-name">${T('Task name')}</label><input class="tin" id="ed-name" maxlength="40" value="${esc(label(b))}">
      <span class="lbl">${T('Urgency')}</span>${stopsHTML(level)}
      <button type="button" class="btn" id="ed-in" style="justify-content:center">${T('Get in the bubble')}</button>
      <div class="acts"><button type="button" class="link" id="ed-del">${T('Delete')}</button><button type="button" class="btn small" id="ed-cancel">${T('Cancel')}</button><button type="button" class="btn small solid" id="ed-save">${T('Save')}</button></div>
      <button type="button" class="shrink" id="ed-shrink">${T('Shrink back to starting size')}</button>`;
    document.body.appendChild(editPop);
    const w = editPop.offsetWidth, h = editPop.offsetHeight;
    editPop.style.left = Math.max(12, Math.min(innerWidth - w - 12, x + 14)) + 'px'; editPop.style.top = Math.max(12, Math.min(innerHeight - h - 12, y - 20)) + 'px';
    wireStops(editPop, l => level = l);
    const save = () => { const n = $('#ed-name').value.trim(); if(n) TP.rename?.(b, n === label(b) ? b.name : n, level, n === label(b)); closeEdit(); };
    editPop.addEventListener('click', e => {
      const id = e.target.closest('button')?.id;
      if(e.target.closest('.x') || id === 'ed-cancel') closeEdit(); else if(id === 'ed-save') save();
      else if(id === 'ed-del'){ closeEdit(); TP.pop?.(b, true); } else if(id === 'ed-shrink'){ TP.shrink?.(b); closeEdit(); }
      else if(id === 'ed-in'){ closeEdit(); enterFocus(b); }
    });
    $('#ed-name').addEventListener('keydown', e => { if(e.key === 'Enter') save(); });
    setTimeout(() => { $('#ed-name')?.focus(); $('#ed-name')?.select(); }, 30);
  };
  addEventListener('pointerdown', e => { if(editPop && !editPop.contains(e.target)) closeEdit(); }, true);

  /* ---------- focus mode, for real, on this page ---------- */
  const bar = $('#focus-bar'); bar.hidden = false; bar.inert = true;
  let inside = null, started = 0, tick = 0, entering = false;
  const ease3 = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;
  function enterFocus(b){ // like the app: the bubble's skin opens out to the edges of the screen, and you're inside
    if(!b || entering || inside) return; closeEdit(); setO(null);
    if(REDUCED){ startFocus(b); return; }
    entering = true; b.pulse = .8; window.TPSound?.whoosh();
    const veil = document.createElement('div'), ring = document.createElement('div'); veil.className = 'veil'; ring.className = 'veil-ring'; document.body.append(veil, ring);
    const x = b.x, y = b.y, r0 = Math.max(10, b.R), Rend = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 20, t0 = performance.now(), DUR = 800;
    (function grow(now){
      const t = Math.min(1, (now - t0)/DUR), r = r0 + (Rend - r0)*ease3(t);
      veil.style.clipPath = `circle(${r}px at ${x}px ${y}px)`;
      Object.assign(ring.style, {left:(x - r) + 'px', top:(y - r) + 'px', width:2*r + 'px', height:2*r + 'px'});
      if(t < 1){ requestAnimationFrame(grow); return; }
      ring.remove(); entering = false; startFocus(b);
      veil.style.transition = 'opacity .7s ease'; veil.style.opacity = 0; setTimeout(() => veil.remove(), 720); // the skin thins out, leaving the frame
    })(t0);
  }
  function startFocus(b){
    inside = b; started = Date.now();
    $('#fb-name').textContent = label(b); $('#fb-time').textContent = '0:00';
    root.classList.add('focusing'); bar.inert = false; TP.hide?.(true);
    clearInterval(tick); tick = setInterval(() => { const s = Math.floor((Date.now() - started)/1000); $('#fb-time').textContent = `${Math.floor(s/60)}:${String(s%60).padStart(2, '0')}`; }, 1000);
  }
  function leaveFocus(popIt){
    if(!inside) return; const b = inside; inside = null; clearInterval(tick);
    root.classList.remove('focusing'); bar.inert = true; TP.hide?.(false);
    b.focusSecs = (b.focusSecs || 0) + (Date.now() - started)/1000;
    if(popIt) setTimeout(() => TP.pop?.(b), 350); // back out, then it bursts
  }
  TP.onClick = b => enterFocus(b);

  /* the focus bar is magnetic, as in the app: drag it to a bottom corner, the middle, or a side edge */
  const DOCKS = ['bl', 'bc', 'br', 'l', 'r'];
  let dock = 'bc', bdrag = null; try{ const d = localStorage.getItem('tp-dock'); if(DOCKS.includes(d)) dock = d; }catch(e){}
  const applyDock = () => DOCKS.forEach(d => bar.classList.toggle('dock-' + d, d === dock && d !== 'bc'));
  function spots(){
    const vw = innerWidth, vh = innerHeight, m = 22, sb = parseFloat(getComputedStyle(bar).bottom) || 26, was = bar.className;
    bar.classList.remove('dock-l', 'dock-r', 'dock-bl', 'dock-br'); const hz = bar.getBoundingClientRect(); bar.classList.add('dock-r'); const vt = bar.getBoundingClientRect(); bar.className = was;
    const hy = vh - sb - hz.height/2;
    return {bl:{x:m + hz.width/2, y:hy}, bc:{x:vw/2, y:hy}, br:{x:vw - m - hz.width/2, y:hy}, l:{x:m + vt.width/2, y:vh/2}, r:{x:vw - m - vt.width/2, y:vh/2}};
  }
  const nearest = (S, x, y) => DOCKS.reduce((a, d) => Math.hypot(S[d].x - x, S[d].y - y) < Math.hypot(S[a].x - x, S[a].y - y) ? d : a, 'bc');
  bar.addEventListener('pointerdown', e => {
    if(e.button !== 0 || e.target.closest('button')) return; e.preventDefault();
    const r = bar.getBoundingClientRect(), S = spots(), slots = document.createElement('div'); slots.className = 'dock-slots';
    slots.innerHTML = DOCKS.map(d => { const v = d === 'l' || d === 'r', w = v ? 16 : 84, h = v ? 84 : 16; return `<span data-d="${d}" style="left:${S[d].x - w/2}px; top:${S[d].y - h/2}px; width:${w}px; height:${h}px"></span>`; }).join('');
    document.body.appendChild(slots);
    bdrag = {dx:e.clientX - (r.left + r.width/2), dy:e.clientY - (r.top + r.height/2), S, slots, moved:false, sx:e.clientX, sy:e.clientY}; bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener('pointermove', e => {
    if(!bdrag) return; if(!bdrag.moved && Math.hypot(e.clientX - bdrag.sx, e.clientY - bdrag.sy) < 4) return;
    if(!bdrag.moved){ bdrag.moved = true; bar.classList.add('dragging'); }
    const near = nearest(bdrag.S, e.clientX, e.clientY); DOCKS.forEach(d => bar.classList.remove('dock-' + d)); if(near === 'l' || near === 'r') bar.classList.add('dock-' + near);
    Object.assign(bar.style, {left:(e.clientX - bdrag.dx) + 'px', top:(e.clientY - bdrag.dy) + 'px', bottom:'auto', transform:`translate(-50%, -50%)${near === 'l' ? ' rotate(180deg)' : ''}`});
    bdrag.slots.querySelectorAll('span').forEach(s => s.classList.toggle('near', s.dataset.d === near));
  });
  const drop = e => {
    if(!bdrag) return; const d = bdrag; bdrag = null; d.slots.remove(); if(!d.moved) return;
    dock = nearest(d.S, e.clientX, e.clientY); try{ localStorage.setItem('tp-dock', dock); }catch(err){}
    const r = bar.getBoundingClientRect(); bar.classList.remove('dragging'); Object.assign(bar.style, {left:'', top:'', bottom:'', transform:''}); applyDock();
    const to = bar.getBoundingClientRect(); bar.style.translate = `${(r.left + r.width/2) - (to.left + to.width/2)}px ${(r.top + r.height/2) - (to.top + to.height/2)}px`;
    void bar.offsetWidth; bar.style.transition = 'translate .45s cubic-bezier(.3,1.35,.5,1)'; bar.style.translate = '0 0';
    setTimeout(() => { bar.style.transition = ''; bar.style.translate = ''; }, 480);
  };
  bar.addEventListener('pointerup', drop); bar.addEventListener('pointercancel', drop); applyDock();
  $('#fb-exit')?.addEventListener('click', () => leaveFocus(false));
  $('#fb-done')?.addEventListener('click', () => leaveFocus(true));
  addEventListener('keydown', e => { if(e.key !== 'Escape') return; if(editPop) closeEdit(); else if(inside) leaveFocus(false); else if(openO !== null) setO(null); });
  $('#get-in')?.addEventListener('click', () => { // try it: the biggest bubble on screen
    const list = (TP.list?.() || []).filter(b => b.x > 0 && b.x < innerWidth && b.y > 0 && b.y < innerHeight).sort((a, c) => c.R - a.R);
    const b = list[0] || TP.add?.({name:'Essay draft', key:'Essay draft', level:4}); if(b) enterFocus(b);
  });

  /* ---------- the hand-drawn arrows in the creation story ---------- */
  const svg = $('#arrows');
  function drawArrows(){
    if(!svg || innerWidth < 860){ if(svg) svg.innerHTML = ''; return; }
    // measured from the layout, not the screen, so cards mid-reveal or lifted on hover don't bend the arrows
    const host = svg.parentElement, r = id => { let el = $('#' + id), x = 0, y = 0; const w = el.offsetWidth, h = el.offsetHeight;
      while(el && el !== host){ x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
      return {l:x, r:x + w, t:y, b:y + h, cx:x + w/2}; };
    const w1 = r('why1'), w2 = r('why2'), w3 = r('why3'), s = r('solves'), f1 = r('feat1'), f2 = r('feat2'), f3 = r('feat3');
    // the head follows the line: it points the way the curve is travelling as it arrives
    const head = (x, y, cx, cy) => { const L = Math.hypot(x - cx, y - cy) || 1, ux = (x - cx)/L, uy = (y - cy)/L, k = 12, a = .6, ca = Math.cos(a), sa = Math.sin(a);
      const p = (c, s2) => `${(x - k*(ux*c - uy*s2)).toFixed(1)} ${(y - k*(uy*c + ux*s2)).toFixed(1)}`; return `M${p(ca, sa)} L${x} ${y} L${p(ca, -sa)}`; };
    // each reason leads down to the bubble behaviour that answers it; the tails start inside the reason's card
    const e1 = [w1.l + 96, f1.t + 6], e2 = [f2.cx, f2.t + 6], e3 = [w3.r - 70, f3.t + 6];
    const c1 = [w1.l - 60, e1[1] - 110], c2 = [f2.cx + 40, e2[1] - 70], c3 = [w3.r + 60, e3[1] - 110];
    const paths = [
      [`M${w1.l + 44} ${w1.b - 34} C ${w1.l - 50} ${w1.b + 40}, ${c1[0]} ${c1[1]}, ${e1[0]} ${e1[1]}`, head(...e1, ...c1)],
      [`M${w2.cx - 10} ${w2.b - 34} C ${w2.cx + 20} ${s.t - 20}, ${s.r + 90} ${s.t}, ${s.r + 46} ${(s.t + s.b)/2} S ${c2[0]} ${c2[1]}, ${e2[0]} ${e2[1]}`, head(...e2, ...c2)],
      [`M${w3.r - 44} ${w3.b - 34} C ${w3.r + 50} ${w3.b + 40}, ${c3[0]} ${c3[1]}, ${e3[0]} ${e3[1]}`, head(...e3, ...c3)],
    ];
    svg.innerHTML = paths.map(([d, h]) => `<g><path d="${d}"/>${h ? `<path class="head" d="${h}"/>` : ''}</g>`).join('');
  }
  addEventListener('resize', drawArrows); document.fonts?.ready.then(drawArrows); setTimeout(drawArrows, 300);

  /* ---------- the focus-mode demo screen: a little film, played whenever it's on screen ---------- */
  const screen = $('#screen'), holder = $('#scr-bubbles'), cursor = $('#cursor');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let playing = false, alive = false;
  const pos = (el, x, y) => { el.style.left = x + '%'; el.style.top = y + '%'; };
  function mkBubble(name, sub, x, y, w, cls = ''){ const b = document.createElement('span'); b.className = 'sb ' + cls; b.innerHTML = `<span>${esc(name)}${sub ? `<small>${sub}</small>` : ''}</span>`;
    b.style.width = w + '%'; b.style.aspectRatio = '1'; pos(b, x, y); holder.appendChild(b); return b; }
  function at(el){ const s = screen.getBoundingClientRect(), r = el.getBoundingClientRect(); return [(r.left + r.width/2 - s.left)/s.width*100, (r.top + r.height/2 - s.top)/s.height*100]; }
  async function moveTo(x, y, ms = 950){ pos(cursor, x - 1, y - 1.5); await sleep(ms); }
  async function click(x, y){ cursor.classList.add('down'); const rp = document.createElement('span'); rp.className = 'ripple'; pos(rp, x, y); screen.appendChild(rp); setTimeout(() => rp.remove(), 520); await sleep(160); cursor.classList.remove('down'); }
  function burst(x, y, n = 12){ for(let k = 0; k < n; k++){ const d = document.createElement('span'); d.className = 'drip'; pos(d, x, y); screen.appendChild(d); const a = Math.random()*6.283, dist = 30 + Math.random()*60;
    d.animate([{transform:'translate(-50%,-50%)', opacity:1}, {transform:`translate(calc(-50% + ${Math.cos(a)*dist}px), calc(-50% + ${Math.sin(a)*dist + 14}px)) scale(.4)`, opacity:0}], {duration:600 + Math.random()*300, easing:'cubic-bezier(.15,.7,.3,1)'}).onfinish = () => d.remove(); } }
  async function film(){
    while(alive){
      holder.innerHTML = ''; screen.classList.remove('in-focus'); $('#scr-t').textContent = '0:00'; pos(cursor, 88, 86);
      const essay = mkBubble(T('Essay draft'), T('NOW!'), 26, 34, 15), mail = mkBubble(T('Reply to emails'), T('TODAY'), 74, 28, 12), wash = mkBubble(T('Laundry'), T('SOON'), 68, 72, 10), read = mkBubble(T('Read ch. 7'), T('TODAY'), 18, 76, 11);
      const others = [mail, wash, read];
      await sleep(900); if(!alive) break;
      // grows a little while you ignore it
      essay.style.width = '18%'; await sleep(900);
      await moveTo(26, 34); await click(26, 34);
      // in you go: the others leave, the edge takes your colour, the timer starts
      others.forEach(o => o.style.opacity = 0); essay.style.transform = 'translate(-50%,-50%) scale(9)'; essay.style.opacity = 0;
      screen.classList.add('in-focus');
      let secs = 0; const t = setInterval(() => { secs += 7; $('#scr-t').textContent = `${Math.floor(secs/60)}:${String(secs%60).padStart(2, '0')}`; }, 260);
      await sleep(1100); if(!alive){ clearInterval(t); break; }
      // break it into steps
      const stepAt = [[30, 30], [58, 24], [44, 56]], names = ['Outline', 'Find 3 sources', 'Draft intro'].map(T), steps = [];
      for(let k = 0; k < 3; k++){ const [sx, sy] = at($('#scr-step')); await moveTo(sx, sy, k ? 600 : 900); await click(sx, sy); steps.push(mkBubble(names[k], '', stepAt[k][0], stepAt[k][1], 12, 'step')); await sleep(450); }
      // press and hold a step until it pops
      await moveTo(30, 30); cursor.classList.add('down'); steps[0].classList.add('squeeze'); await sleep(800); steps[0].classList.add('gone'); burst(30, 30); cursor.classList.remove('down'); await sleep(700);
      // done: pop the whole task
      const [dx, dy] = at($('#scr-done')); await moveTo(dx, dy); await click(dx, dy); clearInterval(t);
      steps.forEach(s => s.classList.add('gone')); screen.classList.remove('in-focus'); burst(50, 46, 22);
      await sleep(500); others.forEach(o => o.style.opacity = 1); await moveTo(88, 86, 900); await sleep(1600);
    }
    playing = false;
  }
  if(screen){
    if(REDUCED){ mkBubble(T('Essay draft'), T('NOW!'), 26, 34, 16); mkBubble(T('Reply to emails'), T('TODAY'), 74, 28, 12); mkBubble(T('Laundry'), T('SOON'), 68, 72, 10); }
    else new IntersectionObserver(([e]) => { alive = e.isIntersecting; if(alive && !playing){ playing = true; film(); } }, {threshold:.35}).observe(screen);
  }

  /* ---------- the phone: it leans toward your cursor, its shadow falls away from it ---------- */
  const dev = $('#device');
  if(dev && !REDUCED && matchMedia('(pointer: fine)').matches){
    let raf = 0, mx = innerWidth/2, my = innerHeight/3;
    const apply = () => { raf = 0; const r = dev.getBoundingClientRect(); if(r.bottom < 0 || r.top > innerHeight) return;
      const cx = r.left + r.width/2, cy = r.top + r.height/2, dx = (mx - cx)/innerWidth, dy = (my - cy)/innerHeight, d = Math.min(1, Math.hypot(dx, dy)*1.6);
      dev.style.setProperty('--ry', (dx*14).toFixed(2) + 'deg'); dev.style.setProperty('--rx', (-dy*10).toFixed(2) + 'deg');
      dev.style.setProperty('--sx', (-dx*110).toFixed(1) + 'px'); dev.style.setProperty('--sy', (44 - dy*80).toFixed(1) + 'px'); dev.style.setProperty('--sa', (.72 - d*.24).toFixed(2));
      dev.style.setProperty('--gx', ((mx - r.left)/r.width*100).toFixed(1) + '%'); dev.style.setProperty('--gy', ((my - r.top)/r.height*100).toFixed(1) + '%'); };
    addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; if(!raf) raf = requestAnimationFrame(apply); }, {passive:true});
    addEventListener('scroll', () => { if(!raf) raf = requestAnimationFrame(apply); }, {passive:true});
  }

  /* switching language: redraw everything the scripts drew themselves */
  I18N.onChange(() => {
    const o = openO; if(o !== null){ openO = null; pop.hidden = true; setO(o); }
    closeEdit(); if(inside) $('#fb-name').textContent = label(inside);
    placeNotes(); alignFeats(); fitCircles(); drawArrows(); TP.setLang?.();
  });
})();
// TODOPOP: touched 2026-11-08
