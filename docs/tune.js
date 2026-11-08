/* TODOPOP website tuner: open the site with ?tune to get a slider for every spacing and text size.
   Changes stay in this browser (localStorage) until you reset them; "Copy changes" puts a summary on the clipboard. */
(() => {
  const KEY = 'todopop:tune';
  const px = (sel, prop) => () => { const el = document.querySelector(sel); return el ? parseFloat(getComputedStyle(el)[prop]) || 0 : 0; };
  // [id, label, selector, css property, min, max, step, unit?]  or  {id, label, get, css(v), min, max, step, unit}
  const C = {
    'Whole page': [
      {id:'wrapW', label:'Content width', sel:'.wrap', get:() => document.querySelector('#how .wrap').getBoundingClientRect().width, css:v => `.wrap{width:min(${v}px, 100% - 2*var(--gut)) !important}`, min:700, max:1500, step:10},
      ['bodyFs', 'Body text size', 'body', 'font-size', 12, 22, .5],
      ['pillFs', 'Pill heading text size (all pills)', '.pill', 'font-size', 14, 56, 1],
      ['pillBorder', 'Pill outline thickness', '.pill', 'border-top-width', 1, 8, .5, 'px', v => `.pill{border-width:${v}px !important}`],
      ['badgeW', 'Number badge size', '.badge', 'width', 30, 100, 1],
      ['badgeFs', 'Number badge text size', '.badge', 'font-size', 10, 40, 1],
      ['cardR', 'Card corner roundness', '.card', 'border-top-left-radius', 0, 80, 1, 'px', v => `.card{border-radius:${v}px !important}`],
      ['cardPad', 'Card inner padding', '#why1', 'padding-left', 8, 70, 1, 'px', v => `.card{padding:${v}px !important}`],
      ['sepGap', 'Dashed divider line thickness', '.sep', 'border-top-width', 0, 6, .5, 'px', v => `.sep{border-top-width:${v}px !important}`],
    ],
    '1 · Landing': [
      ['heroTop', 'Space above the logo', '.hero', 'padding-top', 0, 500, 5],
      ['heroBot', 'Space below the logo', '.hero', 'padding-bottom', 0, 500, 5],
      {id:'logoS', label:'Big logo size', sel:'.big .logo', get:px('.big .logo', 'fontSize'), css:v => `.big .logo{--s:${v}px !important; font-size:${v}px}`, min:30, max:220, step:1},
      ['bigPadY', 'Logo frame: space above/below letters', '.big', 'padding-top', 0, 60, 1, 'px', v => `.big{padding-top:${v}px !important; padding-bottom:${v}px !important}`],
      ['bigPadX', 'Logo frame: space left/right of letters', '.big', 'padding-left', 0, 120, 1, 'px', v => `.big{padding-left:${v}px !important; padding-right:${v}px !important}`],
      ['heroGap', 'Gap between landing items', '.hero .wrap', 'row-gap', 0, 80, 1, 'px', v => `.hero .wrap{gap:${v}px !important}`],
      ['noteFs', 'Logo O notes text size', '.o-note', 'font-size', 9, 24, .5],
      ['hintFs', '"Interact with these bubbles" note size', '.bubble-hint', 'font-size', 9, 24, .5],
      ['metaFs', '"Free · No sign-up" text size', '.meta', 'font-size', 8, 20, .5],
      {id:'bubble', label:'Floating task bubbles size (%)', sel:'#field, canvas', get:() => 100, css:() => '', min:30, max:200, step:5, unit:'%', apply:v => {
        const prev = window.TUNE_BUBBLE || 1, next = v/100; window.TUNE_BUBBLE = next;
        try{ for(const b of window.TP.list()){ b.R *= next/prev; } }catch(e){} }},
    ],
    '2 · The problem & features': [
      ['howTop', 'Space above this section', '#how', 'padding-top', 0, 300, 2],
      ['howBot', 'Space below this section', '#how', 'padding-bottom', 0, 300, 2],
      ['eyeFs', '"The problem" label size', '.eyebrow', 'font-size', 8, 28, .5],
      ['eyeLs', '"The problem" letter spacing', '.eyebrow', 'letter-spacing', 0, 8, .1],
      ['eyeGap', '"The problem" → Cindy Zhao pill gap', '.eyebrow', 'margin-bottom', -10, 80, 1],
      ['storyFs', '"A (Cindy Zhao) creation" pill size', '#story-title', 'font-size', 14, 60, 1],
      ['collabFs', '"Made in collaboration" text size', '.collab', 'font-size', 10, 34, .5],
      ['whoGap', 'Pill → "who:" gap', '.who', 'margin-top', -20, 100, 1],
      ['whoFs', '"who:" text size', '.who', 'font-size', 12, 48, 1],
      ['whyTop', '"who:" → problem cards gap', '.trio.why', 'margin-top', 0, 140, 1],
      ['whyFs', 'Problem card text size', '.why .card', 'font-size', 10, 40, .5],
      ['whyH', 'Problem card height', '.why .card', 'min-height', 60, 300, 2],
      ['trioGap', 'Gap between cards side by side', '.trio', 'column-gap', 0, 80, 1, 'px', v => `.trio{column-gap:${v}px !important}`],
      ['solvesTop', 'Problem cards → "TODOPOP solves" gap', '.solves', 'margin-top', 0, 300, 2],
      ['solvesFs', '"TODOPOP solves my problem" pill size', '#solves', 'font-size', 14, 60, 1],
      ['featTop', '"TODOPOP solves" → feature cards gap', '.trio.feat', 'margin-top', 0, 160, 1],
      ['featH', 'Feature card title size', '.feat h3', 'font-size', 12, 40, .5],
      ['featP', 'Feature card text size', '.feat p', 'font-size', 9, 24, .5],
      ['featGap', 'Space between items inside a feature card', '.feat .card', 'row-gap', 0, 50, 1, 'px', v => `.feat .card{gap:${v}px !important}`],
    ],
    '3 · Focus mode': [
      ['focTop', 'Space above this section', '#focus', 'padding-top', 0, 300, 2],
      ['focBot', 'Space below this section', '#focus', 'padding-bottom', 0, 300, 2],
      ['qFs', 'Question text size', '.qa .q', 'font-size', 14, 60, .5],
      ['qLh', 'Question line height', '.qa .q', 'line-height', 14, 90, .5],
      ['qaGap', 'Q → A gap', '.qa', 'row-gap', 0, 80, 1, 'px', v => `.qa{row-gap:${v}px !important}`],
      ['aFs', 'Answer text size', '.qa .a', 'font-size', 12, 48, .5],
      ['bubBtn', '"Get in the bubble" button text size', '.btn.bubble-btn', 'font-size', 10, 36, .5],
      ['scrTop', 'Answer → demo screen gap', '.screen', 'margin-top', 0, 120, 1],
      ['bodyTop', 'Demo screen → paragraph gap', '.qa .body', 'margin-top', 0, 160, 1],
      ['bodyFsQ', 'Paragraph text size', '.qa .body', 'font-size', 10, 24, .5],
      ['bodyLhQ', 'Paragraph line height', '.qa .body', 'line-height', 12, 44, .5],
    ],
    '4 · Additional features & phone': [
      ['phTop', 'Space above this section', '#phone', 'padding-top', 0, 300, 2],
      ['phBot', 'Space below this section', '#phone', 'padding-bottom', 0, 300, 2],
      ['moreGap', 'Gap between the left column items', '.more-left', 'row-gap', 0, 100, 1, 'px', v => `.more-left{gap:${v}px !important}`],
      ['featsFs', 'Feature list text size', '.feats', 'font-size', 9, 24, .5],
      ['leadFs', 'Phone intro (first line) size', '.remote p.lead', 'font-size', 10, 36, .5],
      ['remFs', 'Phone paragraph size', '.remote p:not(.lead)', 'font-size', 9, 24, .5],
      ['tutH', 'Tutorial title size', '.tut h3', 'font-size', 10, 36, .5],
      ['tutLi', 'Tutorial step text size', '.tut li', 'font-size', 9, 24, .5],
      ['tutGap', 'Gap between tutorial steps', '.tut ol', 'row-gap', 0, 60, 1, 'px', v => `.tut ol{gap:${v}px !important}`],
      ['devW', 'Phone mockup width', '.device', 'width', 180, 800, 5],
      ['devTop', 'Phone mockup: space above', '.device', 'margin-top', -100, 200, 2],
      {id:'devTilt', label:'Phone mockup tilt (degrees)', sel:'.device', get:() => 4.5, css:v => `.device{transform:rotate(${v}deg) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) !important}`, min:-15, max:15, step:.5, unit:'°'},
    ],
    '5 · Download': [
      ['dlTop', 'Space above this section', '#download', 'padding-top', 0, 300, 2],
      ['dlBot', 'Space below this section', '#download', 'padding-bottom', 0, 300, 2],
      ['dlH', '"Get TODOPOP" heading size', '.dl h2', 'font-size', 16, 80, 1],
      ['dlPad', 'Blue box inner padding', '.dl', 'padding-top', 10, 120, 1, 'px', v => `.dl{padding:${v}px !important}`],
      ['dlGap', 'Gap between items in the blue box', '.dl', 'row-gap', 0, 80, 1, 'px', v => `.dl{gap:${v}px !important}`],
      ['dlR', 'Blue box corner roundness', '.dl', 'border-top-left-radius', 0, 100, 1, 'px', v => `.dl{border-radius:${v}px !important}`],
      ['faqFs', 'First-time help text size', '.first summary', 'font-size', 9, 22, .5],
    ],
    '6 · Privacy & footer': [
      ['prTop', 'Space above privacy', '#privacy', 'padding-top', 0, 300, 2],
      ['prBot', 'Space below privacy', '#privacy', 'padding-bottom', 0, 300, 2],
      ['prHeadFs', '"Your list is yours." size', '.priv-head span', 'font-size', 10, 36, .5],
      ['prColTop', 'Privacy pill → columns gap', '.priv', 'padding-top', 0, 140, 1],
      ['prGap', 'Gap between privacy columns', '.priv', 'column-gap', 0, 100, 1, 'px', v => `.priv{column-gap:${v}px !important}`],
      ['prH', 'Privacy column title size', '.priv h3', 'font-size', 10, 30, .5],
      ['prP', 'Privacy column text size', '.priv p', 'font-size', 9, 22, .5],
      ['ftTop', 'Footer: space above', 'footer', 'padding-top', 0, 160, 1],
      ['ftFs', 'Footer text size', 'footer .wrap', 'font-size', 8, 20, .5],
    ],
  };
  // normalize
  const ALL = [];
  for(const [group, list] of Object.entries(C)) for(const c of list){
    const o = Array.isArray(c) ? {id:c[0], label:c[1], sel:c[2], prop:c[3], min:c[4], max:c[5], step:c[6], unit:c[7] || 'px', css:c[8]} : {unit:'px', ...c};
    if(!o.get) o.get = px(o.sel, o.prop.replace(/-(\w)/g, (_, x) => x.toUpperCase()));
    if(!o.css) o.css = v => `${o.sel}{${o.prop}:${v}${o.unit} !important}`;
    o.group = group; ALL.push(o);
  }
  let saved = {}; try{ saved = JSON.parse(localStorage.getItem(KEY)) || {}; }catch(e){}
  const st = document.createElement('style'); st.id = 'tune-css'; document.head.appendChild(st);
  // defaults are measured before anything is overridden
  const defaults = {}; for(const o of ALL) defaults[o.id] = Math.round(o.get()*100)/100;
  const relayout = (() => { let t; return () => { clearTimeout(t); t = setTimeout(() => dispatchEvent(new Event('resize')), 60); }; })();
  function apply(){
    st.textContent = ALL.filter(o => o.id in saved).map(o => o.css(saved[o.id])).join('\n');
    try{ localStorage.setItem(KEY, JSON.stringify(saved)); }catch(e){}
    relayout();
  }
  for(const o of ALL) if(o.apply && o.id in saved) o.apply(saved[o.id]);
  apply();

  /* ---------- the panel ---------- */
  const css = document.createElement('style');
  css.textContent = `
  .tune{position:fixed; z-index:9999; top:12px; right:12px; bottom:12px; width:360px; display:flex; flex-direction:column; background:#fff; color:#1a419e; border:2px solid currentColor; border-radius:22px;
    box-shadow:0 30px 60px -30px rgba(16,24,60,.5); font:300 12px/1.4 'Unbounded', system-ui, sans-serif; overflow:hidden; transition:transform .3s cubic-bezier(.3,1.3,.5,1)}
  .tune.min{transform:translateX(calc(100% + 24px))}
  .tune-tab{position:fixed; z-index:9999; right:12px; top:12px; display:none; border:2px solid #1a419e; background:#1a419e; color:#fff; border-radius:999px; padding:9px 16px; font:500 12px 'Unbounded', sans-serif; cursor:pointer}
  .tune.min + .tune-tab{display:block}
  .tune header{padding:14px 16px 10px; display:grid; gap:8px; border-bottom:1px dashed rgba(26,65,158,.3)}
  .tune header b{font-weight:500; font-size:14px; display:flex; justify-content:space-between; align-items:center}
  .tune header small{color:rgba(26,65,158,.65); font-size:10.5px}
  .tune .row-btns{display:flex; gap:6px; flex-wrap:wrap}
  .tune button{all:unset; cursor:pointer; border:1.5px solid currentColor; border-radius:999px; padding:6px 11px; font:400 11px 'Unbounded', sans-serif}
  .tune button.solid{background:#1a419e; color:#fff; border-color:#1a419e}
  .tune input[type=search]{all:unset; border-bottom:1px solid rgba(26,65,158,.3); padding:6px 0; font:300 12px 'Unbounded', sans-serif}
  .tune .list{overflow:auto; padding:4px 16px 20px; flex:1; overscroll-behavior:contain}
  .tune details{border-bottom:1px dashed rgba(26,65,158,.2)}
  .tune summary{cursor:pointer; padding:12px 0; font-weight:500; font-size:12.5px; list-style:none; display:flex; justify-content:space-between}
  .tune summary::-webkit-details-marker{display:none}
  .tune summary i{font-style:normal; font-weight:300; color:rgba(26,65,158,.6)}
  .tune .c{display:grid; grid-template-columns:1fr 64px 18px; gap:4px 8px; align-items:center; padding:6px 6px 8px; margin:0 -6px; border-radius:10px}
  .tune .c:hover{background:rgba(26,65,158,.06)}
  .tune .c label{grid-column:1 / -1; font-size:11px}
  .tune .c.changed label{font-weight:500}
  .tune .c.changed label::after{content:" ●"; color:#F89547}
  .tune input[type=range]{width:100%; accent-color:#1a419e}
  .tune input[type=number]{width:64px; box-sizing:border-box; border:1px solid rgba(26,65,158,.3); border-radius:8px; padding:4px 6px; font:400 11px 'Unbounded', sans-serif; color:#1a419e}
  .tune .rs{all:unset; cursor:pointer; width:18px; height:18px; display:grid; place-items:center; border-radius:50%; font-size:12px; opacity:.25}
  .tune .c.changed .rs{opacity:1}
  .tune-hl{outline:2px dashed #F89547 !important; outline-offset:3px}
  .tune .toast{position:absolute; left:16px; right:16px; bottom:12px; background:#1a419e; color:#fff; border-radius:12px; padding:10px 12px; font-size:11px; opacity:0; transition:opacity .2s; pointer-events:none}
  .tune .toast.on{opacity:1}
  @media (max-width:700px){ .tune{left:8px; right:8px; top:auto; width:auto; height:55vh} }`;
  document.head.appendChild(css);
  const el = document.createElement('div'); el.className = 'tune'; el.setAttribute('data-solid', '');
  const groups = [...new Set(ALL.map(o => o.group))];
  el.innerHTML = `<header><b>Tune the website <button data-a="min" title="Hide the panel">Hide</button></b>
    <small>Drag a slider, or type a number. Hover a row to see what it changes. Values are measured at this window width (<span id="tw"></span>px).</small>
    <div class="row-btns"><button class="solid" data-a="copy">Copy changes</button><button data-a="reset">Reset all</button><button data-a="open">Open all</button></div>
    <input type="search" placeholder="Search, e.g. gap, pill, phone" aria-label="Search sliders"></header>
    <div class="list">${groups.map((g, gi) => `<details${gi === 0 ? '' : ''} data-g="${g}"><summary>${g} <i>${ALL.filter(o => o.group === g).length}</i></summary>${ALL.filter(o => o.group === g).map(o => `
      <div class="c" data-id="${o.id}"><label for="t-${o.id}">${o.label}</label>
      <input type="range" id="t-${o.id}" min="${o.min}" max="${o.max}" step="${o.step}"><input type="number" min="${o.min}" max="${o.max}" step="${o.step}" aria-label="${o.label} (${o.unit})"><button class="rs" title="Back to the original" aria-label="Reset ${o.label}">↺</button></div>`).join('')}</details>`).join('')}</div>
    <div class="toast"></div>`;
  document.body.appendChild(el);
  const tab = document.createElement('button'); tab.className = 'tune-tab'; tab.textContent = 'Tune'; document.body.appendChild(tab);
  el.querySelector('#tw').textContent = innerWidth; addEventListener('resize', () => { el.querySelector('#tw').textContent = innerWidth; });
  const byId = Object.fromEntries(ALL.map(o => [o.id, o]));
  const val = id => id in saved ? saved[id] : defaults[id];
  function paint(row){ const o = byId[row.dataset.id], v = val(o.id); row.querySelector('[type=range]').value = v; row.querySelector('[type=number]').value = v; row.classList.toggle('changed', o.id in saved); }
  el.querySelectorAll('.c').forEach(paint);
  const set = (id, v) => { const o = byId[id]; v = Math.round(+v*100)/100; if(!Number.isFinite(v)) return;
    if(Math.abs(v - defaults[id]) < 1e-9) delete saved[id]; else saved[id] = v; if(o.apply) o.apply(v); apply(); };
  el.addEventListener('input', e => { const row = e.target.closest('.c'); if(!row) return; set(row.dataset.id, e.target.value); paint(row); });
  el.addEventListener('click', e => {
    const rs = e.target.closest('.rs'); if(rs){ const row = rs.closest('.c'); set(row.dataset.id, defaults[row.dataset.id]); paint(row); return; }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if(a === 'min') el.classList.add('min');
    if(a === 'open'){ const all = [...el.querySelectorAll('details')]; const openAll = all.some(d => !d.open); all.forEach(d => d.open = openAll); e.target.textContent = openAll ? 'Close all' : 'Open all'; }
    if(a === 'reset'){ if(!confirmReset()) return; for(const o of ALL) if(o.apply && o.id in saved) o.apply(defaults[o.id]); saved = {}; apply(); el.querySelectorAll('.c').forEach(paint); }
    if(a === 'copy') copy();
  });
  let resetArm = 0; function confirmReset(){ if(Date.now() - resetArm < 2500) return true; resetArm = Date.now(); toast('Click Reset all again to clear every change.'); return false; }
  tab.addEventListener('click', () => el.classList.remove('min'));
  // show what a slider changes
  let hl = [];
  el.addEventListener('mouseover', e => { const row = e.target.closest('.c'); hl.forEach(x => x.classList.remove('tune-hl')); hl = [];
    if(row){ const o = byId[row.dataset.id]; try{ hl = [...document.querySelectorAll(o.sel)].filter(x => !el.contains(x)); hl.forEach(x => x.classList.add('tune-hl')); }catch(err){} } });
  el.addEventListener('mouseleave', () => { hl.forEach(x => x.classList.remove('tune-hl')); hl = []; });
  // jump to the part of the page a group is about
  el.addEventListener('toggle', e => { const d = e.target; if(!d.open) return; const o = ALL.find(x => x.group === d.dataset.g); const t = o && document.querySelector(o.sel.split(',')[0]);
    if(t && d.dataset.g !== 'Whole page') t.scrollIntoView({behavior:'smooth', block:'start'}); }, true);
  el.querySelector('[type=search]').addEventListener('input', e => { const q = e.target.value.trim().toLowerCase();
    el.querySelectorAll('.c').forEach(r => { const o = byId[r.dataset.id]; r.hidden = !!q && !(o.label + ' ' + o.group).toLowerCase().includes(q); });
    el.querySelectorAll('details').forEach(d => { const any = [...d.querySelectorAll('.c')].some(r => !r.hidden); d.hidden = !any; if(q) d.open = any; }); });
  function toast(t){ const x = el.querySelector('.toast'); x.textContent = t; x.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => x.classList.remove('on'), 2400); }
  async function copy(){
    const ch = ALL.filter(o => o.id in saved);
    if(!ch.length){ toast('Nothing changed yet.'); return; }
    const lang = document.documentElement.lang || 'en';
    const text = `TODOPOP website tuning · window ${innerWidth}px wide · ${lang}\n` + groups.map(g => { const r = ch.filter(o => o.group === g); return r.length ? `\n${g}\n` + r.map(o => `- ${o.label}: ${defaults[o.id]}${o.unit} → ${saved[o.id]}${o.unit}`).join('\n') : ''; }).join('') +
      `\n\nCSS\n` + ch.map(o => o.css(saved[o.id])).filter(Boolean).join('\n') + (ch.some(o => o.id === 'bubble') ? `\n/* bubbles: ${saved.bubble}% */` : '');
    try{ await navigator.clipboard.writeText(text); toast(`Copied ${ch.length} change${ch.length === 1 ? '' : 's'}. Paste them to Claude.`); }
    catch(e){ const ta = document.createElement('textarea'); ta.value = text; el.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Copied.'); }
  }
})();
// TODOPOP: touched 2026-11-08
