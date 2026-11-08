/* ---------- the bubbles ----------
   This is TODOPOP's own bubble engine, carried over from the app: the same jelly skin, the same rule that two
   bubbles never overlap (their outlines press flat against each other instead), the same spring when you drag,
   the same squeeze-and-pop when you press and hold, and the same look. Like in the app, the bubbles sit on top
   of your screen and stay put while the page scrolls underneath; clicks pass straight through anywhere that
   isn't a bubble, and the TODOPOP bar at the top is solid, like the app's sticker. */
(() => {
  const cv = document.getElementById('field'), ctx = cv.getContext('2d'), root = document.documentElement;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let INK_RGB = [26, 65, 158]; const rgba = a => `rgba(${INK_RGB[0]},${INK_RGB[1]},${INK_RGB[2]},${a})`;
  const FONT = '"Unbounded", "WDXL Lubrifont SC", "Varela Round", system-ui, sans-serif';
  const T = s => window.I18N ? window.I18N.T(s) : s; // the page's language
  const label = b => b.key ? T(b.key) : b.name; // built-in tasks follow the language; ones you named stay as you wrote them
  const CJK = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/;
  // group colours are worked out from the tint exactly like the app's (six hues spaced around the wheel, clear of the tint)
  const oklchToRgb = (L, C, h) => { const a = C*Math.cos(h*Math.PI/180), b = C*Math.sin(h*Math.PI/180);
    const l = (L + .3963377774*a + .2158037573*b)**3, m = (L - .1055613458*a - .0638541728*b)**3, s2 = (L - .0894841775*a - 1.291485548*b)**3;
    return [4.0767416621*l - 3.3077115913*m + .2309699292*s2, -1.2684380046*l + 2.6097574011*m - .3413193965*s2, -.0041960863*l - .7034186147*m + 1.707614701*s2].map(x => x <= .0031308 ? 12.92*x : 1.055*Math.pow(x, 1/2.4) - .055); };
  const okHueOf = rgb => { const lin = rgb.map(v => { v /= 255; return v <= .04045 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); });
    const l = Math.cbrt(.4122214708*lin[0] + .5363325363*lin[1] + .0514459929*lin[2]), m = Math.cbrt(.2119034982*lin[0] + .6806995451*lin[1] + .1073969566*lin[2]), s2 = Math.cbrt(.0883024619*lin[0] + .2817188376*lin[1] + .6299787005*lin[2]);
    return (Math.atan2(.0259040371*l + .7827717662*m - .808675766*s2, 1.9779984951*l - 2.428592205*m + .4505937099*s2)*180/Math.PI + 360) % 360; };
  const glow = h => { let v; for(let C = .15; C >= -.001; C -= .004){ v = oklchToRgb(.76, Math.max(0, C), h); if(v.every(x => x >= -.001 && x <= 1.001)) break; }
    return '#' + v.map(x => Math.round(Math.min(1, Math.max(0, x))*255).toString(16).padStart(2, '0')).join(''); };
  const SLOT = {School:0, Work:1, Home:2, Health:4}; const GROUP = {};
  const retint = () => { const ih = okHueOf(INK_RGB); for(const [g, i] of Object.entries(SLOT)) GROUP[g] = glow((ih + 40 + i*56) % 360); };
  retint();
  const SHORT = {1:'REMIND', 2:'SOON', 3:'TODAY', 4:'NOW!'};
  const TASKS = [['Problem set 4', 4, 'School'], ['Reply to emails', 3, null], ['Laundry', 2, 'Home'], ['Figma critique', 3, 'Work'], ['Water the pothos', 1, 'Home'],
    ['Book dentist', 2, null], ['Portfolio review', 4, 'Work'], ['Call mom', 2, null], ['Read ch. 7', 3, 'School'], ['Drink water', 1, 'Health'], ['Pay rent', 3, 'Home'],
    ['Gym', 2, 'Health'], ['Email the landlord', 2, 'Home'], ['Groceries', 2, null], ['Return library books', 1, 'School'], ['Taxes', 3, null]];
  const W = () => innerWidth, H = () => innerHeight;
  const SMALL = () => W() < 700;

  // ---- the app's constants ----
  const N = 40;
  const COS = new Float32Array(N), SIN = new Float32Array(N);
  for(let i=0;i<N;i++){ COS[i]=Math.cos(i/N*Math.PI*2); SIN[i]=Math.sin(i/N*Math.PI*2); }
  const HC = new Float32Array(N), HS = new Float32Array(N), HCOS = Math.cos(Math.PI/N);
  for(let i=0;i<N;i++){ HC[i]=Math.cos((i+.5)/N*Math.PI*2); HS[i]=Math.sin((i+.5)/N*Math.PI*2); }
  const RATE = [0, 0, 0.45, 1.1, 2.5]; // the app's demo growth speeds, radius px / s
  const OUT = .08, GAP = 2.5, SQUISH = 9, JELLY = 0.55, SWELL = 34, HOLD_DELAY = .15, HOLD_TIME = .75;
  const bubbles = [], particles = [], rings = [];
  const POP_GESTURE = 'hold', DBL_MS = 280; let pending = null; // press and hold to pop; 'double' = double-click
  let time = 0, drawOrder = [], walls = [], ti = 0, dpr = 1, fieldAlpha = 1, fieldTarget = 1;
  const easeOut = t => { const c = 1.7; return 1 + (c+1)*Math.pow(t-1,3) + c*Math.pow(t-1,2); };
  const effR = b => b.R * easeOut(Math.min(1, b.spawn)) + SWELL*Math.pow(b.holdP || 0, 1.6);
  // on a website they stop growing before they cover what you're reading (the app lets them fill the screen)
  const K = () => (window.TUNE_BUBBLE || 1) * (SMALL() ? .75 : 1.5); // big enough that you can't ignore them
  const maxFor = level => K()*[0, 34, 52, 66, 82][level];

  function makeBubble(o){
    return {name:o.name, level:o.level, group:o.group, R:o.R, hx:o.hx, hy:o.hy, x:o.hx, y:o.hy, vx:0, vy:0, ax:0, ay:0,
      spawn:0, phase:Math.random()*6.283, holdP:0, pulse:0, fx:o.hx/W(), fy:o.hy/H(),
      d:new Float32Array(N), v:new Float32Array(N), t:new Float32Array(N), lim:new Float32Array(N)};
  }
  function navWall(){
    const n = document.querySelector('.nav .wrap'); if(!n) return null;
    const r = n.getBoundingClientRect(), g = 9; return {x0:r.left-g, y0:r.top-g, x1:r.right+g, y1:r.bottom+g};
  }
  // solid things bubbles press against instead of covering: the bar, the giant logo and its popup (like the app's sticker panel), the focus bar
  function solidWalls(){
    const out = [], g = 9;
    for(const el of document.querySelectorAll('.nav .wrap, [data-solid]')){
      if(el.hidden || el.closest('[hidden]')) continue; const r = el.getBoundingClientRect();
      if(r.width < 2 || r.bottom < 0 || r.top > H()) continue; out.push({x0:r.left-g, y0:r.top-g, x1:r.right+g, y1:r.bottom+g});
    }
    return out;
  }
  function freeSpot(R){ // the app's: the roomiest spot, away from the edges, the bar and the other bubbles
    const walls = solidWalls();
    const w = navWall(), x0 = 30, x1 = W()-30, y0 = (w ? w.y1 : 0) + 20, y1 = H()-30; let best = null, bestScore = -Infinity;
    for(let k=0;k<160;k++){
      const x = x0 + Math.random()*Math.max(10,x1-x0), y = y0 + Math.random()*Math.max(10,y1-y0);
      // anywhere at all, as long as it isn't on top of another bubble
      let s = Math.random()*40;
      for(const w of walls) if(x + R > w.x0 && x - R < w.x1 && y + R > w.y0 && y - R < w.y1) s -= 600;
      for(const b of bubbles) s = Math.min(s, Math.hypot(b.hx-x,b.hy-y) - b.R - R);
      if(s>bestScore){ bestScore=s; best={x,y}; }
    }
    return best;
  }
  function add(spec){
    const [name, level, group] = spec ? [spec.name, spec.level, spec.group || null] : TASKS[ti++ % TASKS.length], max = maxFor(level);
    const start = K()*(level === 1 ? 34 : 42)*.75;
    const R = spec ? start : level === 1 ? max : start + (max - start)*Math.random()*.6;
    const p = spec && spec.at ? {x:spec.at.x, y:spec.at.y} : freeSpot(R); if(!p) return null;
    const b = makeBubble({name, level, group, R, hx:p.x, hy:p.y}); b.key = spec ? spec.key || null : name; bubbles.push(b); if(spec && spec.at) keepApart(b, 'home'); return b;
  }

  // ---- size ----
  let lastW = W(), lastH = H();
  function resize(){
    if(lastW >= 200 && lastH >= 200) for(const b of bubbles){ b.fx = b.hx/lastW; b.fy = b.hy/lastH; }
    for(const b of bubbles){ const nx = b.fx*W(), ny = b.fy*H(); b.x += nx - b.hx; b.y += ny - b.hy; b.hx = nx; b.hy = ny; }
    lastW = W(); lastH = H(); dpr = Math.min(2, devicePixelRatio || 1); cv.width = W()*dpr; cv.height = H()*dpr;
  }

  // ---- pointer: the app's handlers ----
  const mouse = {x:-999, y:-999, vx:0, vy:0, lastT:0};
  let hover = null, drag = null, suppressClick = false;
  function hit(x,y){
    if(fieldAlpha < .5) return null; // inside a bubble, the others are gone
    for(let k=drawOrder.length-1;k>=0;k--){
      const b = drawOrder[k]; if(!b) continue;
      const dx=x-b.x, dy=y-b.y, D=Math.hypot(dx,dy), r = effR(b);
      if(D > r*1.6+10) continue;
      let a = Math.atan2(dy,dx); if(a<0) a+=6.283; const i = Math.round(a/6.283*N)%N;
      if(D < r + b.d[i]) return b;
    }
    return null;
  }
  const onBar = e => !!e.target?.closest?.('.nav, [data-solid], .tp-pop, .focus-bar, .edit-pop, a, button, input');
  addEventListener('pointermove', e => {
    const t = performance.now(), dt = Math.max(8, t - mouse.lastT);
    mouse.vx = (e.clientX-mouse.x)/dt*1000; mouse.vy = (e.clientY-mouse.y)/dt*1000;
    if(Math.abs(mouse.vx)>6000) mouse.vx=0; if(Math.abs(mouse.vy)>6000) mouse.vy=0;
    mouse.x=e.clientX; mouse.y=e.clientY; mouse.lastT=t;
    if(drag){
      if(Math.hypot(e.clientX-drag.sx, e.clientY-drag.sy) > 6) drag.moved = true;
      drag.b.hx = e.clientX - drag.ox; drag.b.hy = e.clientY - drag.oy;
      keepApart(drag.b, 'home');
      return;
    }
    const h = onBar(e) ? null : hit(e.clientX, e.clientY);
    if(h !== hover){ if(h){ for(let i=0;i<N;i++) h.v[i] += (COS[i]*mouse.vx + SIN[i]*mouse.vy)*-0.03; } hover = h; }
    root.classList.toggle('grab', !!h);
  }, {passive:true});
  addEventListener('pointerdown', e => {
    if(e.button!==0 || onBar(e)) return;
    const b = hit(e.clientX, e.clientY); if(!b) return;
    e.preventDefault(); e.stopPropagation(); suppressClick = true;
    drag = {b, id:e.pointerId, ox:e.clientX-b.hx, oy:e.clientY-b.hy, sx:e.clientX, sy:e.clientY, t:performance.now(), moved:false};
    root.classList.add('grabbing');
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.vx = mouse.vy = 0;
    // press dent
    const dx=e.clientX-b.x, dy=e.clientY-b.y, D=Math.hypot(dx,dy)||1;
    for(let i=0;i<N;i++){ const al = (COS[i]*dx+SIN[i]*dy)/D; if(al>.3) b.v[i] -= al*90*JELLY; }
  }, {capture:true});
  // on a phone, a finger on a bubble holds the bubble, not the page
  addEventListener('touchstart', e => { const t = e.touches[0]; if(t && !e.target?.closest?.('.nav') && hit(t.clientX, t.clientY)) e.preventDefault(); }, {capture:true, passive:false});
  const release = e => {
    if(!drag || (e.pointerId !== undefined && e.pointerId !== drag.id)) return;
    const {b, moved, t} = drag; drag = null;
    root.classList.remove('grabbing'); b.holding = false;
    if(!moved && performance.now()-t < 300){ // a quick click gets you in; a second click right after pops it instead
      b.pulse = 1;
      if(POP_GESTURE === 'double'){
        if(pending && pending.b === b){ clearTimeout(pending.t); pending = null; pop(b); }
        else { if(pending) clearTimeout(pending.t); pending = {b, t:setTimeout(() => { pending = null; api.onClick?.(b); }, DBL_MS)}; }
      } else api.onClick?.(b);
    }
    else if(moved){ b.fx = b.hx/W(); b.fy = b.hy/H(); }
    if(e.pointerType !== 'mouse'){ mouse.x = mouse.y = -999; } // a lifted finger stops pressing on the skin
    setTimeout(()=> suppressClick=false, 0);
  };
  addEventListener('pointerup', release, {capture:true}); addEventListener('pointercancel', release, {capture:true});
  // right-click a bubble to edit it, like the app
  addEventListener('contextmenu', e => { if(onBar(e)) return; const b = hit(e.clientX, e.clientY); if(!b) return; e.preventDefault(); e.stopPropagation(); b.pulse = .6; api.onEdit?.(b, e.clientX, e.clientY); }, {capture:true});
  addEventListener('click', e => { if(suppressClick){ e.preventDefault(); e.stopPropagation(); suppressClick=false; } }, {capture:true});
  document.addEventListener('pointerleave', () => { mouse.x = mouse.y = -999; });

  // ---- physics: the app's ----
  function keepApart(b, which){
    const ra = effR(b);
    for(let it=0; it<4; it++){
      let moved = false;
      for(const o of bubbles){ if(o===b) continue;
        const need = (ra + effR(o))*(1+OUT) + GAP*2 - SQUISH*2;
        const now = Math.hypot(b.x-o.x, b.y-o.y);
        const minD = Math.min(need, now);
        const px = which==='home' ? b.hx : b.x, py = which==='home' ? b.hy : b.y;
        let dx = px-o.x, dy = py-o.y, D = Math.hypot(dx,dy);
        if(D >= minD - .5) continue;
        if(D < .01){ dx = b.x-o.x || 1; dy = b.y-o.y; D = Math.hypot(dx,dy); }
        const nx = o.x + dx/D*minD, ny = o.y + dy/D*minD;
        if(which==='home'){ b.hx = nx; b.hy = ny; } else { b.x = nx; b.y = ny; const vn = (b.vx*dx + b.vy*dy)/D; if(vn < 0){ b.vx -= vn*dx/D; b.vy -= vn*dy/D; } }
        moved = true;
      }
      if(!moved) break;
    }
  }
  function rayBox(cx, cy, dx, dy, B){
    let tmin = -Infinity, tmax = Infinity;
    for(const [c,d,lo,hi] of [[cx,dx,B.x0,B.x1],[cy,dy,B.y0,B.y1]]){
      if(Math.abs(d) < 1e-6){ if(c < lo || c > hi) return Infinity; continue; }
      let t1 = (lo-c)/d, t2 = (hi-c)/d; if(t1 > t2){ const q=t1; t1=t2; t2=q; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    }
    if(tmax < 0 || tmin > tmax) return Infinity;
    return Math.max(0, tmin);
  }
  function outsideWall(b, x, y){
    for(const wall of walls){
      const m = Math.min(effR(b)*.8, 90);
      const x0 = wall.x0-m, x1 = wall.x1+m, y0 = wall.y0-m, y1 = wall.y1+m;
      if(x <= x0 || x >= x1 || y <= y0 || y >= y1) continue;
      const dl = x-x0, dr = x1-x, du = y-y0, dd = y1-y, k = Math.min(dl, dr, du, dd);
      [x, y] = k===dl ? [x0, y] : k===dr ? [x1, y] : k===du ? [x, y0] : [x, y1];
    }
    return [x, y];
  }
  function step(dt){
    time += dt;
    if(POP_GESTURE === 'hold' && drag && !drag.moved){
      const b = drag.b, held = (performance.now() - drag.t)/1000;
      b.holding = held > HOLD_DELAY; b.holdP = Math.max(0, Math.min(1, (held - HOLD_DELAY)/HOLD_TIME));
      if(b.holding) for(let i=0;i<N;i++) b.v[i] += (Math.random()-.5)*90*b.holdP; // a little tremble under the pressure
      if(b.holdP >= 1){ drag = null; root.classList.remove('grabbing'); b.holding = false; b.holdP = 0; pop(b); }
    }
    for(const b of bubbles) if(!b.holding && b.holdP){ b.holdP *= .82; if(b.holdP < .01) b.holdP = 0; }
    walls = solidWalls();
    const drift = REDUCED ? 1.5 : 7;
    for(const b of bubbles){
      b.spawn = Math.min(1, b.spawn + dt*1.6);
      if(b.level>1 && !(drag && drag.b===b)) b.R = Math.min(maxFor(b.level), b.R + RATE[b.level]*dt);
      b.pulse = Math.max(0, b.pulse - dt*1.5);
    }
    // keep homes on screen (a resize or a drag to the edge)
    for(const b of bubbles){ const r = effR(b)*.5; b.hx = Math.max(r, Math.min(W()-r, b.hx)); b.hy = Math.max(r, Math.min(H()-r, b.hy)); }
    for(const b of bubbles){
      const dragging = drag && drag.b===b;
      const [hx, hy] = outsideWall(b, b.hx, b.hy);
      const tx = hx + (dragging?0:Math.sin(time*.23+b.phase)*drift + Math.sin(time*.51+b.phase*2)*drift*.4);
      const ty = hy + (dragging?0:Math.cos(time*.19+b.phase)*drift + Math.cos(time*.43+b.phase*1.7)*drift*.4);
      const K = dragging ? 60 : 9, C = dragging ? 11 : 5.2;
      let ax = (tx-b.x)*K - b.vx*C, ay = (ty-b.y)*K - b.vy*C;
      const ra = effR(b);
      for(const o of bubbles){ if(o===b) continue;
        const dx=b.x-o.x, dy=b.y-o.y, D=Math.hypot(dx,dy)||.01, ov = ra+effR(o)-D;
        if(ov>0){ const f = Math.min(ov, 34)*3.2*(dragging?.4:1); ax += dx/D*f; ay += dy/D*f; }
      }
      b.ax = ax; b.ay = ay;
    }
    for(const b of bubbles){ b.vx += b.ax*dt; b.vy += b.ay*dt; b.x += b.vx*dt; b.y += b.vy*dt; }
    if(drag){ keepApart(drag.b, 'home'); keepApart(drag.b, 'pos'); }
    // membranes
    for(const b of bubbles){
      const ra = effR(b), t = b.t, wob = REDUCED ? .004 : .016;
      for(let i=0;i<N;i++){
        const th = i/N*6.283;
        t[i] = ra*(wob*Math.sin(2*th + time*1.1 + b.phase) + wob*.7*Math.sin(3*th - time*.8 + b.phase*1.3) + wob*.4*Math.sin(5*th + time*1.7));
        if(b.pulse) t[i] += ra*.06*b.pulse*Math.sin(time*14);
      }
      const lim = b.lim; for(let i=0;i<N;i++) lim[i] = ra*OUT;
      for(const o of bubbles){ if(o===b) continue;
        const rb = effR(o), D = Math.hypot(o.x-b.x, o.y-b.y), eB = rb*(1+OUT) + GAP;
        if(D > ra*(1+OUT) + eB || D < .01) continue;
        const nx=(o.x-b.x)/D, ny=(o.y-b.y)/D;
        const lo = Math.min(ra*.8, D*.5), hi = D - Math.min(rb*.8, D*.5);
        let sp = (D*D + ra*ra - rb*rb)/(2*D);
        sp = lo<=hi ? Math.max(lo, Math.min(hi, sp)) : D*ra/(ra+rb);
        const limAt = (c, sn) => {
          const un = c*nx + sn*ny; if(un <= .001) return Infinity;
          const proj = D*un, perp2 = D*D - proj*proj; if(perp2 >= eB*eB) return Infinity;
          const root2 = Math.sqrt(eB*eB - perp2), tLine = sp/un;
          if(tLine >= proj + root2) return Infinity;
          return Math.max(proj - root2, tLine) - GAP + SQUISH - ra;
        };
        for(let i=0;i<N;i++){
          let l = limAt(COS[i], SIN[i]);
          const hm = Math.min(limAt(HC[i], HS[i]), limAt(HC[(i+N-1)%N], HS[(i+N-1)%N]));
          if(hm < Infinity) l = Math.min(l, (hm + ra)/HCOS - ra);
          if(l < lim[i]) lim[i] = Math.max(l, -ra*.94);
        }
      }
      for(const wall of walls){
        for(let i=0;i<N;i++){
          let l = rayBox(b.x, b.y, COS[i], SIN[i], wall);
          const hm = Math.min(rayBox(b.x, b.y, HC[i], HS[i], wall), rayBox(b.x, b.y, HC[(i+N-1)%N], HS[(i+N-1)%N], wall));
          if(hm < Infinity) l = Math.min(l, hm/HCOS);
          if(l < Infinity){ l -= ra; if(l < lim[i]) lim[i] = Math.max(l, -ra*.94); }
        }
      }
      for(let i=0;i<N;i++) if(t[i] > lim[i]) t[i] = lim[i];
      // the cursor presses into the skin and drags it along
      if(!REDUCED && mouse.x>-900){
        const mdx = mouse.x-b.x, mdy = mouse.y-b.y, MD = Math.hypot(mdx,mdy);
        if(MD < ra+90){
          for(let i=0;i<N;i++){
            const px = b.x + COS[i]*(ra+b.d[i]), py = b.y + SIN[i]*(ra+b.d[i]);
            const q = (px-mouse.x)**2 + (py-mouse.y)**2; const w = Math.exp(-q/(2*55*55));
            b.v[i] += (COS[i]*mouse.vx + SIN[i]*mouse.vy)*w*0.045*JELLY;
            if(q < 26*26){ b.v[i] += -(1 - Math.sqrt(q)/26)*40*JELLY; }
          }
        }
      }
      const inert = (REDUCED ? .0004 : .0016)*JELLY;
      for(let i=0;i<N;i++) b.v[i] -= (COS[i]*b.ax + SIN[i]*b.ay)*inert*ra*dt*60*.25;
    }
    mouse.vx *= .82; mouse.vy *= .82;
    const sub = 3, h = dt/sub, k = 420, L = 300, c = 9 + (1 - JELLY)*30;
    for(const b of bubbles){
      const d=b.d, v=b.v, t=b.t;
      for(let s=0;s<sub;s++){
        for(let i=0;i<N;i++){ const a = k*(t[i]-d[i]) + L*(d[(i+N-1)%N] + d[(i+1)%N] - 2*d[i]) - c*v[i]; v[i] += a*h; }
        const lim = b.lim, r = effR(b);
        for(let i=0;i<N;i++){ d[i] += v[i]*h; if(d[i] > lim[i]){ d[i] = lim[i]; if(v[i] > 0) v[i] = 0; } if(d[i] < -r*.94){ d[i] = -r*.94; v[i] = 0; } }
      }
    }
    for(const p of particles){ p.t += dt; p.vx *= .9; p.vy = p.vy*.9 + 40*dt; p.x += p.vx*dt; p.y += p.vy*dt; }
    for(let i=particles.length-1;i>=0;i--) if(particles[i].t > particles[i].life) particles.splice(i,1);
    for(const r of rings) r.t += dt;
    for(let i=rings.length-1;i>=0;i--) if(rings[i].t > .45) rings.splice(i,1);
  }
  function pop(b, quiet){
    const i = bubbles.indexOf(b); if(i<0) return; bubbles.splice(i,1);
    if(!quiet) api.onPop?.(b);
    const r = b.R*Math.min(1,b.spawn);
    if(!quiet) window.TPSound?.pop(r);
    rings.push({x:b.x, y:b.y, r, t:0});
    const n = 12 + Math.min(24, Math.round(r/6));
    for(let k=0;k<n;k++){ const a = Math.random()*6.283, sp = 120 + Math.random()*260 + r*.8; particles.push({x:b.x+Math.cos(a)*r*.9, y:b.y+Math.sin(a)*r*.9, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r:1.5+Math.random()*3.5, t:0, life:.5+Math.random()*.45}); }
    for(const o of bubbles){ // neighbors feel the burst
      const dx=o.x-b.x, dy=o.y-b.y, D=Math.hypot(dx,dy)||1; const f = Math.max(0, 1 - (D-o.R)/(r+180));
      if(f>0){ o.vx += dx/D*f*140; o.vy += dy/D*f*140; for(let j=0;j<N;j++) o.v[j] += (COS[j]*dx+SIN[j]*dy)/D*-f*220*JELLY; }
    }
    if(!quiet) setTimeout(() => { if(bubbles.length < count() + 3) add(); }, 1600); // another task floats in
  }

  // ---- drawing: the app's ----
  function shapePath(b, inset=0){
    const r = effR(b) - inset; const P = [];
    for(let i=0;i<N;i++){ const rr = Math.max(2, r + b.d[i]*(1 - inset/Math.max(r,1)*.3)); P.push([b.x+COS[i]*rr, b.y+SIN[i]*rr]); }
    ctx.beginPath();
    let mx=(P[N-1][0]+P[0][0])/2, my=(P[N-1][1]+P[0][1])/2; ctx.moveTo(mx,my);
    for(let i=0;i<N;i++){ const p=P[i], q=P[(i+1)%N]; ctx.quadraticCurveTo(p[0],p[1],(p[0]+q[0])/2,(p[1]+q[1])/2); }
    ctx.closePath();
  }
  function wrap(text, maxW){ // words for English; Chinese can break between any two characters
    const parts = text.match(/[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]|[^\s\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]+|\s+/g) || [], lines = []; let cur = '', sp = false;
    for(const w of parts){ if(/^\s+$/.test(w)){ sp = true; continue; }
      const glue = cur && sp && !(CJK.test(w) && CJK.test(cur.slice(-1))) ? ' ' : '', t = cur + glue + w; sp = false;
      if(ctx.measureText(t).width > maxW && cur){ lines.push(cur); cur = w; } else cur = t; }
    if(cur) lines.push(cur); return lines; }
  const hexRGB = h => [1,3,5].map(i => parseInt(h.slice(i, i+2), 16));
  function draw(){
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W(),H());
    // on a phone there are no side margins, so once you scroll past the top the bubbles fade back and let touches through to the page
    const tgt = fieldTarget && SMALL() && scrollY > H()*.7 ? .22 : fieldTarget;
    fieldAlpha += (tgt - fieldAlpha)*.12; if(Math.abs(fieldAlpha - tgt) < .01) fieldAlpha = tgt;
    ctx.globalAlpha = fieldAlpha; if(fieldAlpha === 0 && !particles.length && !rings.length) return;
    drawOrder = [...bubbles].sort((a,b)=> b.R-a.R);
    for(const b of drawOrder){
      const r = effR(b); if(r < 2) continue;
      const block = b.level===1 ? .55 : Math.min(.94, .62 + (b.R-42)/420);
      const gp = b.group && GROUP[b.group], fill = gp ? hexRGB(gp) : null;
      shapePath(b);
      ctx.fillStyle = `rgba(250,250,248,${block})`; ctx.fill();
      ctx.fillStyle = rgba(b.level===4 ? .085 : b.level===3 ? .06 : .04); ctx.fill();
      ctx.lineWidth = (b.level===4 ? 2.8 : 2.4) * (1 + (b.holdP || 0)*1.1); ctx.strokeStyle = rgba(1); ctx.stroke();
      if(gp && r > 10){ shapePath(b, 4.5); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(${fill[0]},${fill[1]},${fill[2]},.67)`; ctx.stroke(); }
      if(b.level>=3 && r>24){ shapePath(b, gp ? 9.5 : 6); ctx.lineWidth = .9; ctx.strokeStyle = rgba(.28); ctx.stroke(); }
      ctx.save(); shapePath(b); ctx.clip();
      if(r>22){
        let cx=0, cy=0; for(let i=0;i<N;i++){ const rr=r+b.d[i]; cx += Math.min(W()-8, Math.max(8, b.x+COS[i]*rr*.8)); cy += Math.min(H()-8, Math.max(8, b.y+SIN[i]*rr*.8)); }
        const lx = cx/N, ly = cy/N, fs = Math.max(9.5, Math.min(34, r*.15));
        ctx.fillStyle = rgba(1); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font = `400 ${fs}px ${FONT}`;
        const text = label(b); let lines = wrap(text, r*1.45); const maxL = (r>70 || r<40) ? 3 : 2;
        if(lines.length>maxL){ lines = lines.slice(0,maxL); let l = lines[maxL-1]; while(l.length>1 && ctx.measureText(l+'…').width > r*1.45) l=l.slice(0,-1); lines[maxL-1] = l.replace(/[\s…]+$/,'')+'…'; }
        const ms = Math.max(7, Math.min(12, r*.06)) + 1, showMeta = r>40;
        const lh = fs*(CJK.test(text) ? 1.45 : 1.15), total = lines.length*lh + (showMeta ? ms*1.9 : 0) + (showMeta && gp ? ms*1.6 : 0);
        let y = ly - total/2 + lh/2;
        for(const l of lines){ ctx.fillText(l, lx, y); y += lh; }
        if(showMeta){
          ctx.font = `400 ${ms}px ${FONT}`; ctx.fillStyle = rgba(.62);
          if('letterSpacing' in ctx) ctx.letterSpacing = (ms*.1)+'px';
          const meta = T(SHORT[b.level]);
          if(ctx.measureText(meta).width <= r*1.5) ctx.fillText(meta, lx, y + ms*.6);
          const ty = y + ms*.6 + ms*1.5;
          if(gp){
            const tag = T(b.group).toUpperCase(), dr = ms*.45, gap = ms*.5;
            ctx.font = `400 ${ms*.95}px ${FONT}`;
            const tw = ctx.measureText(tag).width, x0 = lx - (dr*2 + gap + tw)/2;
            ctx.beginPath(); ctx.arc(x0 + dr, ty, dr, 0, 6.283); ctx.fillStyle = gp; ctx.fill();
            ctx.lineWidth = .8; ctx.strokeStyle = rgba(.35); ctx.stroke();
            ctx.fillStyle = rgba(.82); ctx.textAlign = 'left'; ctx.fillText(tag, x0 + dr*2 + gap, ty); ctx.textAlign = 'center';
          }
          if('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        }
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1; // a burst always shows, even as the field fades
    for(const g of rings){ const p = g.t/.45; ctx.beginPath(); ctx.arc(g.x,g.y,g.r*(1+p*.35),0,6.283); ctx.lineWidth = 1.4*(1-p); ctx.strokeStyle = rgba(1-p); ctx.stroke(); }
    for(const p of particles){ const a = 1 - p.t/p.life; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(.6+.4*a),0,6.283); ctx.lineWidth=1.2; ctx.strokeStyle = rgba(a); ctx.stroke(); }
  }

  // ---- what the page can do with the bubbles ----
  const api = window.TP = {
    add, pop, list: () => bubbles,
    hide(on){ fieldTarget = on ? 0 : 1; }, // focus mode: the others step out of the way
    rename(b, name, level, keepKey){ if(!keepKey){ b.name = name; b.key = null; } if(level && level !== b.level){ b.level = level; if(level === 1) b.R = Math.min(b.R, maxFor(1)); } b.pulse = 1; },
    shrink(b){ b.R = K()*(b.level === 1 ? 34 : 42)*.75; b.pulse = 1; },
    setTint(rgb){ INK_RGB = rgb; retint(); },
    burstAt(x, y, r){ rings.push({x, y, r, t:0}); for(let k=0;k<22;k++){ const a = Math.random()*6.283, sp = 140 + Math.random()*260; particles.push({x:x+Math.cos(a)*r*.9, y:y+Math.sin(a)*r*.9, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r:1.5+Math.random()*3.5, t:0, life:.5+Math.random()*.45}); } },
    groupColor: g => GROUP[g], short: l => SHORT[l], label,
    setLang(){ document.fonts?.load?.(`400 20px "WDXL Lubrifont SC"`, bubbles.map(label).join('') + '提醒快了今天马上学校工作家健康'); }, // canvas text needs its font fetched first
  };

  // ---- run ----
  addEventListener('resize', resize); resize();
  const count = () => SMALL() ? 3 : (W() > 1200 ? 5 : 4);
  for(let k=0;k<count();k++) add();
  if(window.I18N?.lang === 'zh') api.setLang();
  let last = performance.now();
  (function frame(now){ const dt = Math.min(1/30, (now-last)/1000); last = now; step(dt); draw(); requestAnimationFrame(frame); })(last);
})();
// TODOPOP: touched 2026-11-08
