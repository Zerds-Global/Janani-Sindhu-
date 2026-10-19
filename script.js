'use strict';
(() => {
/* ================= helpers ================= */
const TOTAL = 15, KEY = 'janani-bday-v1';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = innerWidth < 600;
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls = '', html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const ICON = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-label="completed"><path d="M20 6 9 17l-5-5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-label="locked"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
};
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 9.2l7.1-.6z" fill="#ffd86b" stroke="#f5a623" stroke-width="1.2" stroke-linejoin="round"/></svg>';

/* ================= progress (validated localStorage) ================= */
const Progress = {
  done: new Set(), current: 1,
  unlocked() { let n = 1; while (n < TOTAL && this.done.has(n)) n++; return n; },
  load() {
    try {
      const r = JSON.parse(localStorage.getItem(KEY) || 'null');
      const raw = new Set(r && Array.isArray(r.done) ? r.done.filter(n => Number.isInteger(n) && n >= 1 && n <= TOTAL) : []);
      this.done = new Set();
      for (let n = 1; n <= TOTAL && raw.has(n); n++) this.done.add(n); // strictly sequential
      const cur = r && Number.isInteger(r.current) ? r.current : 1;
      this.current = Math.min(Math.max(cur, 1), this.unlocked());
    } catch (e) { this.done = new Set(); this.current = 1; }
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify({ done: [...this.done], current: this.current })); } catch (e) { /* storage unavailable */ } },
  complete(n) { this.done.add(n); this.save(); },
  reset() { this.done = new Set(); this.current = 1; this.save(); }
};

/* ================= sound (off by default) ================= */
const Sound = {
  on: false, ctx: null,
  init() {
    if (!this.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return false; this.ctx = new C(); }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  },
  set(v) {
    this.on = v ? this.init() : false;
    if (!v && this.ctx) this.ctx.suspend();
    const b = $('#soundBtn');
    b.textContent = this.on ? '🔊' : '🔇';
    b.setAttribute('aria-pressed', String(this.on));
    b.setAttribute('aria-label', this.on ? 'Mute sound' : 'Turn sound on');
    b.title = this.on ? 'Sound is on' : 'Sound is off';
    if (this.on) this.play('chime');
  },
  tone(f, t0, d, type = 'sine', v = .07, to) {
    const c = this.ctx, t = c.currentTime + t0, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + .05);
  },
  noise(d = .5, v = .05) {
    const c = this.ctx, n = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, n, c.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; g.gain.value = v; s.connect(g); g.connect(c.destination); s.start();
  },
  play(name) {
    if (!this.on || !this.ctx) return;
    const seq = (fs, gap = .08, type = 'triangle', d = .25) => fs.forEach((f, i) => this.tone(f, i * gap, d, type));
    switch (name) {
      case 'click': this.tone(660, 0, .08, 'triangle', .05); break;
      case 'pop': this.tone(400, 0, .12, 'sine', .08, 900); break;
      case 'star': seq([880, 1175, 1568], .06); break;
      case 'gift': seq([523, 659, 784, 1046], .09); break;
      case 'cheer': seq([523, 659, 784, 1046, 1318], .08, 'triangle', .3); break;
      case 'chime': this.tone(1046, 0, .4); this.tone(1318, .12, .5); break;
      case 'boing': this.tone(180, 0, .35, 'sine', .1, 620); break;
      case 'giggle': [700, 900, 700, 900, 760].forEach((f, i) => this.tone(f, i * .09, .1, 'square', .03)); break;
      case 'whoosh': this.noise(.6, .05); break;
      case 'blow': this.noise(.8, .07); break;
    }
  }
};

/* ================= confetti / fireworks canvas ================= */
const FX = (() => {
  const cv = $('#fx'), cx = cv.getContext('2d'); let W = 0, H = 0, ps = [], raf = 0;
  const COL = ['#C8A2F0', '#FFD6E7', '#D8EAFE', '#ff9ec6', '#ffd86b', '#8b5cc7', '#7fd8c7'];
  function size() { const d = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0); }
  addEventListener('resize', size); size();
  function loop() {
    cx.clearRect(0, 0, W, H);
    ps = ps.filter(p => p.life > 0 && p.y < H + 40);
    for (const p of ps) {
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy; p.life--; p.rot += p.vr;
      cx.globalAlpha = Math.min(1, p.life / 25); cx.fillStyle = p.c; cx.strokeStyle = p.c;
      if (p.spark) { cx.beginPath(); cx.arc(p.x, p.y, 2.2, 0, 7); cx.fill(); cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3); cx.stroke(); }
      else { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore(); }
    }
    cx.globalAlpha = 1;
    if (ps.length) raf = requestAnimationFrame(loop); else { raf = 0; cx.clearRect(0, 0, W, H); }
  }
  const add = l => { ps.push(...l); if (!raf) raf = requestAnimationFrame(loop); };
  const count = n => reduce ? Math.round(n / 4) : small ? Math.round(n * .7) : n;
  return {
    confetti(x = W / 2, y = H / 3, n = 70, spread = 1) {
      const l = []; for (let i = 0; i < count(n); i++) { const a = rand(-Math.PI, 0), s = rand(4, 11) * spread; l.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: .22, drag: .985, rot: rand(0, 6), vr: rand(-.3, .3), w: rand(6, 11), h: rand(4, 8), c: pick(COL), life: rand(80, 150) }); }
      add(l);
    },
    rain(n = 60) {
      const l = []; for (let i = 0; i < count(n); i++) l.push({ x: rand(0, W), y: rand(-60, -5), vx: rand(-1, 1), vy: rand(2, 4), g: .02, drag: 1, rot: rand(0, 6), vr: rand(-.2, .2), w: rand(6, 10), h: rand(4, 7), c: pick(COL), life: 400 });
      add(l);
    },
    burst(x, y, color) {
      const l = [], c = color || pick(COL); for (let i = 0; i < count(46); i++) { const a = rand(0, 6.283), s = rand(1.5, 5.5); l.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: .05, drag: .97, rot: 0, vr: 0, w: 3, h: 3, c, life: rand(45, 80), spark: true }); }
      add(l);
    }
  };
})();

/* ================= cartoon characters (original SVG) ================= */
function eyes(m, cy, lx, rx, col) {
  const brow = m === 'frown' ? `<path d="M${lx - 12} ${cy - 19} L${lx + 8} ${cy - 13} M${rx + 12} ${cy - 19} L${rx - 8} ${cy - 13}" stroke="${col}" stroke-width="4" stroke-linecap="round"/>`
    : m === 'smirk' ? `<path d="M${rx - 10} ${cy - 21} Q${rx} ${cy - 27} ${rx + 10} ${cy - 19}" stroke="${col}" stroke-width="4" fill="none" stroke-linecap="round"/>` : '';
  if (m === 'laugh') return `<g class="eyes"><path d="M${lx - 10} ${cy + 4} Q${lx} ${cy - 10} ${lx + 10} ${cy + 4} M${rx - 10} ${cy + 4} Q${rx} ${cy - 10} ${rx + 10} ${cy + 4}" stroke="${col}" stroke-width="4" fill="none" stroke-linecap="round"/></g>`;
  const e = x => `<ellipse cx="${x}" cy="${cy}" rx="9.5" ry="12.5" fill="${col}"/><circle cx="${x - 3.5}" cy="${cy - 5}" r="4" fill="#fff"/><circle cx="${x + 3}" cy="${cy + 4}" r="2" fill="#fff"/>`;
  return `<g class="eyes">${e(lx)}${e(rx)}</g>${brow}`;
}
function mouth(m, y) {
  const s = 'stroke="#5B3A80" stroke-width="3.5" fill="none" stroke-linecap="round"';
  return ({
    smile: `<path d="M88 ${y} Q100 ${y + 11} 112 ${y}" ${s}/>`,
    laugh: `<path d="M82 ${y - 4} Q100 ${y + 30} 118 ${y - 4}Z" fill="#7a2f66" stroke="#5B3A80" stroke-width="3" stroke-linejoin="round"/><ellipse cx="100" cy="${y + 12}" rx="9" ry="5" fill="#ff8fb0"/>`,
    frown: `<path d="M88 ${y + 8} Q100 ${y - 3} 112 ${y + 8}" ${s}/>`,
    smirk: `<path d="M90 ${y + 3} Q103 ${y + 10} 114 ${y - 2}" ${s}/>`,
    wow: `<ellipse cx="100" cy="${y + 6}" rx="7" ry="9" fill="#7a2f66" stroke="#5B3A80" stroke-width="3"/>`
  })[m] || '';
}
function mochiSVG(m = 'smile') {
  return `<svg viewBox="0 0 200 235" role="img" aria-label="Mochi, the lavender bunny"><g class="body">
<g class="ear ear-l"><ellipse cx="68" cy="44" rx="16" ry="42" fill="#C8A2F0"/><ellipse cx="68" cy="50" rx="8" ry="28" fill="#FFD6E7"/></g>
<g class="ear ear-r"><ellipse cx="132" cy="44" rx="16" ry="42" fill="#C8A2F0"/><ellipse cx="132" cy="50" rx="8" ry="28" fill="#FFD6E7"/></g>
<ellipse cx="78" cy="220" rx="21" ry="11" fill="#b78ce6"/><ellipse cx="122" cy="220" rx="21" ry="11" fill="#b78ce6"/>
<ellipse cx="100" cy="178" rx="46" ry="44" fill="#C8A2F0"/><ellipse cx="100" cy="188" rx="27" ry="27" fill="#EBDCFB"/>
<g class="arm arm-l"><ellipse cx="56" cy="176" rx="12" ry="26" fill="#bb90ea" transform="rotate(14 56 176)"/></g>
<g class="arm arm-r"><ellipse cx="144" cy="176" rx="12" ry="26" fill="#bb90ea" transform="rotate(-14 144 176)"/></g>
<ellipse cx="100" cy="108" rx="56" ry="49" fill="#C8A2F0"/>
<ellipse cx="62" cy="120" rx="9" ry="6.5" fill="#FF8FB8" opacity=".75"/><ellipse cx="138" cy="120" rx="9" ry="6.5" fill="#FF8FB8" opacity=".75"/>
${eyes(m, 100, 78, 122, '#3b2457')}<ellipse cx="100" cy="114" rx="4.5" ry="3.3" fill="#ff7fa8"/>${mouth(m, 122)}</g></svg>`;
}
function pipSVG(m = 'smile') {
  return `<svg viewBox="0 0 200 235" role="img" aria-label="Pip, the cream teddy bear"><g class="body">
<ellipse cx="76" cy="219" rx="22" ry="11" fill="#EBD5B0"/><ellipse cx="76" cy="219" rx="9" ry="5" fill="#B98B5F"/>
<ellipse cx="124" cy="219" rx="22" ry="11" fill="#EBD5B0"/><ellipse cx="124" cy="219" rx="9" ry="5" fill="#B98B5F"/>
<ellipse cx="100" cy="172" rx="50" ry="42" fill="#F6E7CF"/><ellipse cx="100" cy="180" rx="30" ry="28" fill="#FFF4E0"/>
<g class="arm arm-l"><ellipse cx="52" cy="170" rx="12" ry="25" fill="#EFD9B6" transform="rotate(14 52 170)"/></g>
<g class="arm arm-r"><ellipse cx="148" cy="170" rx="12" ry="25" fill="#EFD9B6" transform="rotate(-14 148 170)"/></g>
<circle cx="50" cy="48" r="23" fill="#F0DDBB"/><circle cx="50" cy="48" r="12" fill="#C79B6B"/>
<circle cx="150" cy="48" r="23" fill="#F0DDBB"/><circle cx="150" cy="48" r="12" fill="#C79B6B"/>
<circle cx="100" cy="94" r="56" fill="#F6E7CF"/><ellipse cx="100" cy="112" rx="26" ry="20" fill="#FFF4E0"/>
<ellipse cx="62" cy="106" rx="9" ry="6.5" fill="#FFC7B0" opacity=".75"/><ellipse cx="138" cy="106" rx="9" ry="6.5" fill="#FFC7B0" opacity=".75"/>
${eyes(m, 86, 78, 122, '#4a2f1d')}<ellipse cx="100" cy="103" rx="8" ry="5.5" fill="#7b4a2e"/>${mouth(m, 114)}
<path d="M62 142 Q100 164 138 142 L136 156 Q100 176 64 156Z" fill="#8b5cc7"/></g></svg>`;
}
function Char(kind, mood = 'smile') {
  const wrap = el('span', 'char ' + kind), draw = m => { wrap.innerHTML = kind === 'mochi' ? mochiSVG(m) : pipSVG(m); };
  draw(mood);
  return {
    el: wrap, kind, mood: draw,
    set(c, on = true) { wrap.classList.toggle(c, on); },
    act(c, ms = 1600) { wrap.classList.add(c); setTimeout(() => wrap.classList.remove(c), ms); }
  };
}

/* ================= background decor ================= */
function decor(d) {
  const bg = $('#bg'); bg.textContent = '';
  const k = small ? .6 : 1, dark = document.body.dataset.theme === 'night', f = document.createDocumentFragment();
  const cols = ['#C8A2F0', '#FFD6E7', '#D8EAFE', '#ffb3d1', '#b9a3f5', '#9fc8ff'];
  for (let i = 0; i < Math.round((d.stars || 0) * k); i++) { const s = el('i', 'st' + (dark ? ' lt' : '')); s.style.cssText = `left:${rand(0, 98)}%;top:${rand(0, 98)}%;--s:${rand(6, 16)}px;--dl:${rand(0, 4)}s;--du:${rand(2, 5)}s`; f.append(s); }
  for (let i = 0; i < Math.round((d.balloons || 0) * k); i++) { const b = el('i', 'bl'); b.style.cssText = `left:${rand(2, 94)}%;--c:${pick(cols)};--du:${rand(14, 26)}s;--dl:${-rand(0, 20)}s;--sz:${rand(.7, 1.15)};--y:${rand(10, 70)}%`; f.append(b); }
  for (let i = 0; i < Math.round((d.clouds || 0) * k); i++) { const c = el('i', 'cl'); c.style.cssText = `top:${rand(4, 60)}%;--w:${rand(90, 170)}px;--du:${rand(40, 80)}s;--dl:${-rand(0, 60)}s;--x:${rand(5, 80)}%`; f.append(c); }
  bg.append(f);
}

/* ================= navigation / chrome ================= */
let cur = 1, navToken = 0, ctxNow = null, lastFocus = null;
const SECTIONS = [
  { t: 'The Secret Birthday Door', i: '🚪', theme: 'door', d: { stars: 22, balloons: 5, clouds: 4 }, r: s1 },
  { t: 'The Birthday Reveal', i: '🎉', theme: 'party', d: { stars: 20, balloons: 10 }, r: s2 },
  { t: 'Meet Our Cartoon Characters', i: '🐰', theme: 'day', d: { stars: 16, balloons: 4, clouds: 3 }, r: s3 },
  { t: 'The Friendship Storybook', i: '📖', theme: 'dusk', d: { stars: 24 }, r: s4 },
  { t: 'The Compliment Garden', i: '🌸', theme: 'garden', d: { clouds: 3 }, r: s5 },
  { t: 'Catch the Friendship Stars', i: '⭐', theme: 'night', d: { stars: 40 }, r: s6 },
  { t: 'The Funny Friendship Zone', i: '😂', theme: 'day', d: { stars: 10, clouds: 4 }, r: s7 },
  { t: 'The Virtual Birthday Cake', i: '🎂', theme: 'party', d: { stars: 16, balloons: 6 }, r: s8 },
  { t: 'A Letter for My Best Friend', i: '💌', theme: 'dusk', d: { stars: 20 }, r: s9 },
  { t: 'Three Magical Friendship Gifts', i: '🎁', theme: 'party', d: { stars: 16, balloons: 5 }, r: s10 },
  { t: 'The Friendship Promise Tree', i: '🌳', theme: 'night', d: { stars: 30 }, r: s11 },
  { t: 'The Dream Universe', i: '🌌', theme: 'night', d: { stars: 50 }, r: s12 },
  { t: 'The Appreciation Wall', i: '💜', theme: 'day', d: { stars: 14, balloons: 4 }, r: s13 },
  { t: 'The Celebration Party', i: '🎊', theme: 'party', d: { stars: 20, balloons: 14 }, r: s14 },
  { t: 'The Grand Birthday Finale', i: '🌈', theme: 'finale', d: { stars: 30, balloons: 12 }, r: s15 }
];

function makeCtx(n, root) {
  const cl = [];
  const c = {
    n, root,
    done: () => Progress.done.has(n),
    complete(msg) { Progress.complete(n); banner(root, msg || 'Section complete! Press Continue to go on.'); chrome(); Sound.play('chime'); },
    later(fn, ms) { const id = setTimeout(fn, ms); cl.push(() => clearTimeout(id)); return id; },
    every(fn, ms) { const id = setInterval(fn, ms); cl.push(() => clearInterval(id)); return id; },
    sleep(ms) { return new Promise(r => c.later(r, ms)); },
    onLeave(fn) { cl.push(fn); },
    destroy() { cl.splice(0).forEach(f => { try { f(); } catch (e) { /* ignore */ } }); }
  };
  return c;
}
function banner(root, msg) {
  let b = $('.donebar', root);
  if (!b) { b = el('div', 'donebar'); b.setAttribute('role', 'status'); root.append(b); }
  b.innerHTML = ICON.check + '<span></span>'; b.lastChild.textContent = msg;
}
function chrome() {
  const n = cur, d = Progress.done.size, all = Progress.done.has(TOTAL);
  $('#progText').textContent = `Section ${n} of ${TOTAL} · ` + (all ? 'All complete ✓' : `${d} completed`);
  $('#progFill').style.width = (d / TOTAL * 100) + '%';
  $('.bar').setAttribute('aria-valuenow', d);
  $('#backBtn').disabled = n <= 1;
  const can = Progress.done.has(n) && n < TOTAL, nb = $('#nextBtn');
  nb.disabled = !can; nb.classList.toggle('ready', can);
  nb.textContent = n === TOTAL ? 'The End 💜' : 'Continue →';
  $('#hint').textContent = n === TOTAL ? (Progress.done.has(TOTAL) ? '🎉 You finished the whole experience!' : 'Enjoy the finale…')
    : can ? 'Section complete! Continue when you are ready ✨' : '🔒 Finish this activity to unlock the next section';
}
async function go(n) {
  n = Number(n);
  if (!Number.isInteger(n) || n < 1 || n > TOTAL) return false;
  if (n > Progress.unlocked()) { Sound.play('boing'); return false; }
  const my = ++navToken, stage = $('#stage'), old = $('.scene', stage);
  closeModal();
  if (old) { old.classList.add('out'); await new Promise(r => setTimeout(r, reduce ? 0 : 220)); if (my !== navToken) return false; }
  if (ctxNow) ctxNow.destroy();
  stage.textContent = '';
  cur = n; Progress.current = n; Progress.save();
  const S = SECTIONS[n - 1], root = el('section', 'scene');
  root.setAttribute('aria-label', `Section ${n}: ${S.t}`);
  document.body.dataset.theme = S.theme; decor(S.d);
  ctxNow = makeCtx(n, root);
  stage.append(root);
  try { S.r(root, ctxNow); }
  catch (e) { console.error(e); root.append(el('div', 'card', 'Oops, something went wrong in this section. Please reload the page.')); }
  if (Progress.done.has(n)) banner(root, 'Section completed ✓ You can replay it or press Continue.');
  stage.scrollTop = 0; chrome();
  const h = $('.title, .mega', root); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  return true;
}
function head(root, n, title, lead) {
  root.append(el('p', 'kicker', `Section ${n} · ${SECTIONS[n - 1].i} ${SECTIONS[n - 1].t}`));
  const h = el('h2', 'title'); h.textContent = title; root.append(h);
  if (lead) { const p = el('p', 'lead'); p.textContent = lead; root.append(p); }
  return h;
}

/* modal + menus */
const ov = $('#overlay');
function modal(node, label) {
  ov.textContent = ''; ov.hidden = false; lastFocus = document.activeElement;
  node.setAttribute('role', 'dialog'); node.setAttribute('aria-modal', 'true'); node.setAttribute('aria-label', label);
  ov.append(node); (node.querySelector('button:not([disabled])') || node).focus();
}
function closeModal() { if (ov.hidden) return; ov.hidden = true; ov.textContent = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
ov.addEventListener('click', e => { if (e.target === ov) closeModal(); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
function sectionMenu(onlyUnlocked) {
  const m = el('div', 'modal'), un = Progress.unlocked();
  m.innerHTML = `<h3>${onlyUnlocked ? 'Replay My Favourite Moments ✨' : 'All Sections'}</h3><p>${onlyUnlocked ? 'Jump back into any section you have unlocked. Your progress is safe.' : 'Locked sections open as you finish each one.'}</p>`;
  const g = el('div', 'sgrid');
  SECTIONS.forEach((S, i) => {
    const n = i + 1; if (onlyUnlocked && n > un) return;
    const locked = n > un, done = Progress.done.has(n);
    const b = el('button', 'sitem' + (n === cur ? ' cur' : ''));
    b.disabled = locked; b.innerHTML = `<span class="n">${n}</span><span>${S.t}</span>` + (locked ? ICON.lock : done ? `<span class="ok">${ICON.check}</span>` : '');
    b.onclick = () => go(n); g.append(b);
  });
  const close = el('button', 'btn ghost', 'Close'); close.onclick = closeModal;
  m.append(g, close); modal(m, 'Section list');
}
function confirmReset() {
  const m = el('div', 'modal');
  m.innerHTML = '<h3>Celebrate again? 🎉</h3><p>This will reset all your progress and restart from Section 1. Are you sure?</p>';
  const row = el('div', 'row'), yes = el('button', 'btn', 'Yes, restart'), no = el('button', 'btn ghost', 'Keep my progress');
  yes.onclick = () => { Progress.reset(); closeModal(); go(1); }; no.onclick = closeModal;
  row.append(yes, no); m.append(row); modal(m, 'Confirm restart'); no.focus();
}

/* shared small helpers */
function letters(text, start = 0) {
  let i = start;
  return text.split(' ').map(w => `<span class="word">${[...w].map(ch => `<span class="lt" style="--i:${i++}">${ch}</span>`).join('')}</span>`).join(' ');
}
function floatEmoji(parent, emoji, x, y) { const h = el('span', 'heart', emoji); h.style.left = x + 'px'; h.style.top = y + 'px'; parent.append(h); setTimeout(() => h.remove(), 1700); }
function centerOf(node) { const r = node.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }

/* ================= SECTIONS 1-5 ================= */
function s1(root, c) {
  root.append(el('p', 'kicker', `Section 1 · 🚪 ${SECTIONS[0].t}`));
  const h = el('h2', 'title', 'Hey Janani! Someone special has prepared something for you...'); root.append(h);
  const door = el('div', 'door-scene', '<div class="door-glow">✨</div><div class="door-frame"><div class="door"><i class="knob"></i><i class="pnl p1"></i><i class="pnl p2"></i><i class="dstar">★</i></div></div>');
  const d = $('.door', door); root.append(door);
  const btn = el('button', 'btn big', 'Open Your Surprise 🎁'); root.append(btn);
  if (c.done()) { d.classList.add('open'); door.classList.add('opened'); btn.hidden = true; return; }
  btn.onclick = async () => {
    btn.disabled = true; Sound.play('whoosh'); d.classList.add('open'); door.classList.add('opened');
    await c.sleep(reduce ? 100 : 1000);
    const [x, y] = centerOf(door); FX.confetti(x, y, 80); Sound.play('cheer');
    await c.sleep(500); btn.textContent = 'Door opened ✨';
    c.complete('The magical door is open! Press Continue to step inside.');
  };
}
function s2(root, c) {
  root.append(el('p', 'kicker', `Section 2 · 🎉 ${SECTIONS[1].t}`));
  const h = el('h1', 'mega'); h.innerHTML = letters('HAPPY BIRTHDAY,') + '<br>' + letters('JANANI SINDHU!', 15); h.tabIndex = -1; root.append(h);
  const M = Char('mochi', 'laugh'), P = Char('pip', 'laugh'); M.set('cheer'); P.set('cheer'); M.set('jump'); P.set('jump');
  const duo = el('div', 'duo'); duo.append(M.el, P.el); root.append(duo);
  const p = el('p', 'lead', 'Today is all about YOU, my favourite human and forever best friend!'); p.style.fontWeight = '800'; root.append(p);
  const btn = el('button', 'btn big', "Let's Begin Our Adventure ✨"); btn.hidden = !c.done(); root.append(btn);
  c.later(() => { FX.confetti(innerWidth / 2, innerHeight / 3, 90); Sound.play('cheer'); }, 400);
  c.later(() => FX.confetti(innerWidth * .2, innerHeight / 2, 50), 1200);
  c.later(() => FX.confetti(innerWidth * .8, innerHeight / 2, 50), 1600);
  c.later(() => { btn.hidden = false; btn.classList.add('ready'); }, reduce ? 0 : 2400);
  btn.onclick = () => { c.complete('Adventure unlocked!'); go(3); };
}
function s3(root, c) {
  head(root, 3, 'Meet Our Cartoon Characters', 'Two different personalities, one amazing friendship!');
  const info = el('p', 'counter', '<b>0</b> of 2 characters met'); root.append(info);
  const grid = el('div', 'pgrid'); root.append(grid);
  const defs = [
    { k: 'mochi', name: 'Mochi', role: 'Represents Janani', pre: 'wave', msg: "Hi Janani! I'm Mochi, a bouncy bunny full of curiosity, kindness and big dreams. Hop along, our adventure is just starting! 🐰" },
    { k: 'pip', name: 'Pip', role: 'Represents Vasanth', pre: 'dance', msg: "Hey Janani! I'm Pip, the official snack-sharer, joke-maker and your number one cheerleader. Watch my dance moves! 🧸" }
  ];
  const met = new Set();
  defs.forEach(d => {
    const ch = Char(d.k), card = el('button', 'pcard');
    const msg = el('span', 'cmsg'); msg.hidden = true;
    card.append(ch.el, el('strong', '', d.name), el('small', '', d.role), msg);
    ch.set(d.pre); c.later(() => ch.set(d.pre, false), 3500);
    card.onclick = () => {
      ch.act('hop', 1900); ch.act(d.k === 'mochi' ? 'wave' : 'dance', 2400); ch.mood('laugh'); c.later(() => ch.mood('smile'), 1800);
      msg.textContent = d.msg; msg.hidden = false; Sound.play(d.k === 'mochi' ? 'pop' : 'giggle');
      const [x, y] = centerOf(card); FX.confetti(x, y, 30, .7);
      met.add(d.k); $('b', info).textContent = met.size;
      if (met.size === 2 && !c.done()) c.complete('You met them both! Press Continue for the storybook.');
    };
    grid.append(card);
  });
}
function s4(root, c) {
  head(root, 4, 'The Friendship Storybook');
  const pages = [
    { e: '🌟', t: 'Some people enter our lives and make everything brighter.' },
    { e: '🌈', t: 'Some become our favourite people without even trying.' },
    { e: '📸', t: 'Some turn ordinary days into unforgettable memories.' },
    { e: '💜', t: 'And some friendships become a special part of our lives.' },
    { e: '', t: 'For me, that special friend is YOU, Janani!', fin: true }
  ];
  let i = 0, busy = false; const seen = new Set([0]);
  const book = el('div', 'book'), page = el('div', 'page'), no = el('p', 'pgno'), dots = el('div', 'dots');
  const row = el('div', 'row'), prev = el('button', 'btn ghost', '← Previous'), next = el('button', 'btn', 'Turn Page 📖');
  row.append(prev, next); book.append(page); root.append(book, no, dots, row);
  function draw() {
    const p = pages[i]; page.textContent = '';
    if (p.fin) { const duo = el('div', 'duo hugging'); const M = Char('mochi', 'smile'), P = Char('pip', 'smile'); duo.append(M.el, P.el); duo.style.setProperty('--cw', 'clamp(80px,24vw,130px)'); page.append(duo); }
    else page.append(el('div', 'big', p.e));
    const t = el('p'); t.textContent = p.t; page.append(t);
    no.textContent = `Page ${i + 1} of ${pages.length}`;
    dots.innerHTML = pages.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
    prev.disabled = i === 0; next.disabled = i === pages.length - 1; next.textContent = i === pages.length - 1 ? 'The End 💜' : 'Turn Page 📖';
  }
  async function turn(dir) {
    if (busy) return; const to = i + dir; if (to < 0 || to >= pages.length) return; busy = true; Sound.play('whoosh');
    page.classList.remove('in'); page.classList.add('out'); await c.sleep(reduce ? 0 : 350);
    i = to; seen.add(i); draw(); page.classList.remove('out'); page.classList.add('in'); busy = false;
    if (seen.size === pages.length && !c.done()) { FX.confetti(innerWidth / 2, innerHeight / 2, 60); c.complete('You have read the whole story! Press Continue.'); }
  }
  prev.onclick = () => turn(-1); next.onclick = () => turn(1); draw();
}
function s5(root, c) {
  head(root, 5, 'The Friendship Compliment Garden 🌸', 'Tap each bud to make it bloom.');
  const info = el('p', 'counter', '<b>0</b> of 5 flowers discovered'); root.append(info);
  const msgs = ['Your smile makes people happy.', 'You make ordinary moments special.', 'You have a beautiful heart.', 'You are stronger than you think.', 'You deserve all the happiness in the world.'];
  const cols = ['#ff9ec6', '#C8A2F0', '#9fc8ff', '#ffb88a', '#ff7fb2'], mbs = [18, 0, 30, 6, 22];
  const garden = el('div', 'garden'); garden.append(el('div', 'ground'));
  for (let i = 0; i < 5; i++) garden.append(el('i', 'bulb')), garden.lastChild.style.cssText = `left:${8 + i * 20 + rand(0, 6)}%;--dl:${rand(0, 2)}s`;
  for (let i = 0; i < 3; i++) { const f = el('span', 'fly', '🦋'); f.style.cssText = `left:${rand(5, 50)}%;top:${rand(10, 45)}%;--dl:${-rand(0, 8)}s`; garden.append(f); }
  const fl = el('div', 'flowers'); garden.append(fl); root.append(garden);
  const box = el('div', 'msg card'); box.setAttribute('aria-live', 'polite'); box.innerHTML = '<span>🌱 Tap a bud to read its message</span>'; root.append(box);
  const found = new Set();
  const petals = col => Array.from({ length: 8 }, (_, k) => `<ellipse cx="50" cy="34" rx="9" ry="19" fill="${col}" transform="rotate(${k * 45} 50 56)"/>`).join('');
  cols.forEach((col, i) => {
    const b = el('button', 'flower'); b.style.setProperty('--mb', mbs[i] + 'px'); b.style.setProperty('--dl', (i * .4) + 's'); b.setAttribute('aria-label', `Flower ${i + 1}, tap to bloom`);
    b.innerHTML = `<svg viewBox="0 0 100 170" aria-hidden="true"><path d="M50 162 C50 122 46 100 50 64" stroke="#5fb36b" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M50 134 C30 132 22 118 20 108 C38 108 48 116 50 134Z" fill="#7fd08a"/><path d="M50 116 C70 114 78 100 80 90 C62 90 52 98 50 116Z" fill="#7fd08a"/><g class="head">${petals(col)}<circle cx="50" cy="56" r="11" fill="#ffd86b"/><circle cx="47" cy="53" r="3" fill="#fff" opacity=".7"/></g></svg>`;
    b.onclick = () => {
      b.classList.add('open'); box.innerHTML = '<span></span>'; box.firstChild.textContent = '🌸 ' + msgs[i]; Sound.play('pop');
      const [x, y] = centerOf(b); FX.confetti(x, y, 22, .6);
      found.add(i); $('b', info).textContent = found.size;
      if (found.size === 5 && !c.done()) c.complete('Your garden is in full bloom! Press Continue.');
    };
    fl.append(b);
  });
}

/* ================= SECTIONS 6-10 ================= */
function s6(root, c) {
  head(root, 6, 'Catch the Friendship Stars ⭐', 'Tap or click the stars to collect them. Catch 5 before the 20 seconds run out!');
  const tP = el('span', 'pill', '⏱ <b>20</b>s'), sP = el('span', 'pill', '⭐ <b>0</b> / 5'), hud = el('div', 'ghud'); hud.append(tP, sP);
  const area = el('div', 'game'), over = el('div', 'gover'); area.append(over); root.append(hud, area);
  const tb = $('b', tP), sb = $('b', sP);
  let score = 0, time = 20, state = 'idle', tick = 0, spawnT = 0;
  function showOver(html, btns) {
    over.innerHTML = html; const row = el('div', 'row');
    btns.forEach(([label, fn, cls]) => { const b = el('button', 'btn ' + (cls || ''), label); b.onclick = fn; row.append(b); });
    over.append(row); over.hidden = false;
  }
  function stop() { clearInterval(tick); clearInterval(spawnT); area.querySelectorAll('.gstar,.gring').forEach(s => s.remove()); }
  function spawn() {
    const w = area.clientWidth, h = area.clientHeight, S = 56;
    const x = rand(4, Math.max(4, w - S - 4)), y = rand(4, Math.max(4, h - S - 4));
    const b = el('button', 'gstar', STAR); b.setAttribute('aria-label', 'Collect star'); b.style.left = x + 'px'; b.style.top = y + 'px';
    const grab = e => { e.preventDefault(); collect(b, x, y); };
    b.addEventListener('pointerdown', grab); b.addEventListener('click', grab);
    area.append(b); setTimeout(() => b.remove(), 1900);
  }
  function collect(b, x, y) {
    if (state !== 'running' || b.dataset.got) return; b.dataset.got = '1'; b.classList.add('got');
    const r = el('i', 'gring'); r.style.left = x + 'px'; r.style.top = y + 'px'; area.append(r); setTimeout(() => r.remove(), 600);
    score++; sb.textContent = score; Sound.play('star');
    if (score >= 5) end(true);
  }
  function start() {
    stop(); score = 0; time = 20; state = 'running'; sb.textContent = 0; tb.textContent = 20; over.hidden = true; spawn();
    tick = c.every(() => { time--; tb.textContent = Math.max(time, 0); if (time <= 0) end(false); }, 1000);
    spawnT = c.every(() => { if (area.querySelectorAll('.gstar:not(.got)').length < 3) spawn(); }, 650);
  }
  function end(win) {
    if (state !== 'running') return; state = 'over'; stop();
    if (win) {
      showOver(`<h3>Friendship Level: LEGENDARY! 🏆</h3><p>You caught all 5 stars with ${time}s to spare!</p>`, [['Play again', start, 'ghost']]);
      const [x, y] = centerOf(area); FX.confetti(x, y, 100); Sound.play('cheer');
      if (!c.done()) c.complete('Friendship Level: LEGENDARY! 🏆 Press Continue.');
    } else {
      showOver(`<h3>Time's up! ⏰</h3><p>You caught ${score} of 5 stars. So close!</p>`, [['Try Again', start], ['Continue Anyway', () => { c.complete('Stars or not, you are a legend! Moving on…'); go(7); }, 'ghost']]);
    }
  }
  c.onLeave(() => { clearInterval(tick); clearInterval(spawnT); });
  showOver('<h3>Ready?</h3><p>Stars appear for just a moment, so be quick!</p>', [['Start Game ⭐', start]]);
}

const SCRIPTS = [
  [{ who: 'mochi', say: "I'm ALWAYS right!", mood: 'smirk', act: 'hop', snd: 'pop' }, { who: 'pip', say: "Nope. It's me. Obviously.", mood: 'frown' },
   { who: 'mochi', say: "Let's ask the wall then!", mood: 'laugh' }, { who: 'pip', say: "...The wall says I'm right.", mood: 'smirk', act: 'hop' },
   { who: 'mochi', say: 'The wall is BIASED! 😂', mood: 'laugh', other: 'laugh', act: 'laugh', snd: 'giggle', w: 2200 }],
  [{ fx: 'cookie', who: 'mochi', say: 'My last cookie... mmm 🍪', mood: 'smile' }, { fx: 'steal', who: 'pip', say: '*sneaky nom nom*', mood: 'smirk', snd: 'boing' },
   { who: 'mochi', say: 'WHERE IS MY COOKIE?!', mood: 'wow', act: 'hop' }, { who: 'pip', say: 'What cookie? 😇', mood: 'smirk' },
   { who: 'mochi', say: 'You have crumbs on your face!', mood: 'frown' }, { who: 'pip', say: "...They're decorative.", mood: 'laugh', other: 'laugh', act: 'laugh', snd: 'giggle', w: 2200 }],
  [{ who: 'pip', say: 'Why did the cookie go to the doctor?', mood: 'smile' }, { who: 'pip', say: 'Because it felt crummy! 🍪', mood: 'laugh', act: 'laugh', snd: 'giggle', w: 1500 },
   { who: 'mochi', say: "HAHAHA! I can't breathe! 😭", mood: 'laugh', act: 'laugh' }, { who: 'pip', say: 'Nobody else would get this one.', mood: 'smirk' },
   { who: 'mochi', say: "Only us. That's why it's funny.", mood: 'laugh', act: 'hop', w: 2200 }],
  [{ fx: 'turn', who: 'mochi', say: "I'm not talking to you!", mood: 'frown', other: 'frown' }, { who: 'pip', say: "Fine! I'm not talking to YOU!", mood: 'frown' },
   { fx: 'later', w: 1700 }, { fx: 'unturn', who: 'pip', say: '...Want to share snacks?', mood: 'smile', other: 'smile' },
   { fx: 'hug', who: 'mochi', say: '...Yes. Obviously. 💜', mood: 'laugh', other: 'laugh', snd: 'cheer', w: 2400 }]
];
function s7(root, c) {
  head(root, 7, 'The Funny Friendship Zone 😂', 'Tap all four moments to see what Mochi and Pip get up to!');
  const info = el('p', 'counter', '<b>0</b> of 4 moments watched'); root.append(info);
  const stage = el('div', 'stage'), M = Char('mochi'), P = Char('pip');
  const bm = el('div', 'bubble m'), bp = el('div', 'bubble p'), snack = el('span', 'snack', '🍪');
  stage.append(M.el, P.el, bm, bp, snack); root.append(stage);
  const names = ["1. Who's always right?", '2. The snack thief', '3. Silly jokes only we get', "4. \"I'm not talking to you!\""];
  const grid = el('div', 'moments'), btns = names.map((n, i) => { const b = el('button', 'moment'); b.textContent = n; b.onclick = () => play(i); grid.append(b); return b; });
  root.append(grid);
  const seen = new Set(); let running = false;
  const rect = n => { const r = n.getBoundingClientRect(), s = stage.getBoundingClientRect(); return { l: r.left - s.left, w: r.width }; };
  function reset() {
    M.mood('smile'); P.mood('smile'); [M, P].forEach(x => { x.set('turned', false); x.set('laugh', false); }); stage.classList.remove('hugging');
    bm.classList.remove('show'); bp.classList.remove('show'); snack.style.opacity = 0; $('.timecard', stage)?.remove();
  }
  async function play(i) {
    if (running) return; running = true; btns.forEach(b => b.disabled = true); reset();
    for (const s of SCRIPTS[i]) {
      const who = s.who === 'mochi' ? M : P, other = s.who === 'mochi' ? P : M, b = s.who === 'mochi' ? bm : bp, ob = s.who === 'mochi' ? bp : bm;
      if (s.who) { ob.classList.remove('show'); who.mood(s.mood || 'smile'); if (s.other) other.mood(s.other); b.textContent = s.say; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); if (s.act) who.act(s.act, 1500); if (s.act === 'laugh' || s.other === 'laugh') other.act('laugh', 1500); }
      if (s.snd) Sound.play(s.snd);
      switch (s.fx) {
        case 'cookie': { const m = rect(M.el); snack.style.left = (m.l + m.w * .62) + 'px'; snack.style.opacity = 1; break; }
        case 'steal': { const p = rect(P.el); snack.style.left = (p.l + p.w * .25) + 'px'; await c.sleep(700); snack.style.opacity = 0; break; }
        case 'turn': M.set('turned'); P.set('turned'); break;
        case 'later': { bm.classList.remove('show'); bp.classList.remove('show'); stage.append(el('div', 'timecard', '⏱ Two minutes later...')); break; }
        case 'unturn': $('.timecard', stage)?.remove(); M.set('turned', false); P.set('turned', false); break;
        case 'hug': { const m = rect(M.el), p = rect(P.el); stage.style.setProperty('--hug', Math.max(0, (p.l - (m.l + m.w)) / 2 + m.w * .22) + 'px'); stage.classList.add('hugging'); const [x, y] = [stage.clientWidth / 2 - 14, stage.clientHeight / 2]; floatEmoji(stage, '💜', x, y); floatEmoji(stage, '💜', x - 40, y + 10); floatEmoji(stage, '💜', x + 40, y + 10); break; }
      }
      await c.sleep(s.w || 1800);
    }
    await c.sleep(500); reset(); seen.add(i); btns[i].classList.add('seen'); btns[i].textContent = '✓ ' + names[i];
    $('b', info).textContent = seen.size; running = false; btns.forEach(b => b.disabled = false);
    if (seen.size === 4 && !c.done()) c.complete('All four moments watched! Press Continue for the cake.');
  }
}

function cakeSVG(n = 5) {
  const cols = ['#ff9ec6', '#9fc8ff', '#ffd86b', '#b9a3f5', '#7fd8c7'];
  const drips = (x0, y, cnt, w, d) => `M${x0} ${y - 12} L${x0} ${y}` + ` q${w / 2} ${d} ${w} 0`.repeat(cnt) + ` L${x0 + w * cnt} ${y - 12}Z`;
  let sp = ''; for (let i = 0; i < 22; i++) sp += `<rect x="${50 + (i * 37) % 200}" y="${142 + (i * 53) % 110}" width="7" height="3" rx="1.5" fill="${cols[i % 5]}" transform="rotate(${(i * 47) % 180} ${54 + (i * 37) % 200} ${143 + (i * 53) % 110})"/>`;
  let cd = ''; for (let i = 0; i < n; i++) {
    const x = 150 + (i - (n - 1) / 2) * 22;
    cd += `<g transform="translate(${x},0)"><g class="candle" tabindex="0" role="button" aria-label="Candle ${i + 1}, tap to blow out" data-i="${i}">
<rect x="-5" y="52" width="10" height="32" rx="3" fill="${cols[i % 5]}"/><rect x="-5" y="60" width="10" height="4" fill="#fff" opacity=".6"/>
<g transform="translate(0,47)"><g class="fl"><path d="M0 -17 C8 -6 8 4 0 6 C-8 4 -8 -6 0 -17Z" fill="#ffb938"/><path d="M0 -8 C4 -3 4 2 0 3 C-4 2 -4 -3 0 -8Z" fill="#fff3b0"/></g></g>
<g transform="translate(0,34)"><circle class="sm" r="5"/><circle class="sm" r="4" cx="3"/><circle class="sm" r="3" cx="-3"/></g><rect x="-14" y="30" width="28" height="60" fill="transparent"/></g></g>`;
  }
  return `<svg class="cake" viewBox="0 0 300 290" role="group" aria-label="Birthday cake with candles">
<ellipse cx="150" cy="274" rx="136" ry="13" fill="#e6d3fa"/>
<rect x="38" y="190" width="224" height="80" rx="16" fill="#FFD6E7"/><path d="${drips(38, 204, 8, 28, 26)}" fill="#fff"/>
<rect x="66" y="132" width="168" height="62" rx="14" fill="#D8EAFE"/><path d="${drips(66, 146, 6, 28, 24)}" fill="#fff"/>
<rect x="96" y="84" width="108" height="52" rx="12" fill="#C8A2F0"/><path d="${drips(96, 98, 4, 27, 22)}" fill="#fff"/>${sp}${cd}</svg>`;
}
function s8(root, c) {
  head(root, 8, 'The Virtual Birthday Cake 🎂', 'Make a wish, Janani! 💫');
  const row = el('div', 'cake-row'), M = Char('mochi'), P = Char('pip'); row.append(M.el);
  const holder = el('div'); holder.innerHTML = cakeSVG(5); row.append(holder.firstChild, P.el); root.append(row);
  const cakeEl = $('.cake', row), cands = [...cakeEl.querySelectorAll('.candle')];
  const wish = el('p', 'wish'); wish.hidden = true; wish.textContent = 'May your next chapter be filled with happiness, success, laughter, and beautiful surprises!';
  const rowB = el('div', 'row'), blow = el('button', 'btn big', 'Blow Out the Candles'), relight = el('button', 'btn ghost', 'Light them again 🔥'); relight.hidden = true;
  rowB.append(blow, relight); root.append(rowB, wish);
  const hint = el('p', 'lead', 'Tip: you can also tap each candle.'); hint.style.fontSize = '.9rem'; root.append(hint);
  let finished = false;
  function out(cd) {
    if (cd.classList.contains('out')) return; cd.classList.add('out'); Sound.play('blow');
    if (cands.every(x => x.classList.contains('out'))) finish();
  }
  function finish() {
    if (finished) return; finished = true; blow.disabled = true; relight.hidden = false; wish.hidden = false; hint.hidden = true;
    const [x, y] = centerOf(cakeEl); FX.confetti(x, y - 40, 110); Sound.play('cheer');
    M.act('jump', 3000); P.act('jump', 3000); M.act('cheer', 3000); P.act('cheer', 3000); M.mood('laugh'); P.mood('laugh');
    if (!c.done()) c.complete('Your wish is on its way! Press Continue.');
  }
  blow.onclick = () => { cands.forEach((cd, i) => c.later(() => out(cd), i * 140)); };
  relight.onclick = () => { cands.forEach(cd => cd.classList.remove('out')); finished = false; blow.disabled = false; relight.hidden = true; wish.hidden = true; hint.hidden = false; M.mood('smile'); P.mood('smile'); };
  cands.forEach(cd => { cd.addEventListener('click', () => out(cd)); cd.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); out(cd); } }); });
}

const LETTER = ['Dear Janani,', 'Happy Birthday to one of the most special people in my life!',
  'Life becomes more fun when we have someone who understands us, laughs with us, listens to our nonsense, and makes even ordinary days memorable.',
  'Thank you for being yourself. Never forget how valuable, talented, and amazing you are.',
  'I hope this new year of your life brings you countless reasons to smile, courage to chase your dreams, success in everything you work towards, and happiness that stays with you every day.',
  'No matter how busy life becomes or how much things change, I will always be cheering for you as your best friend.',
  'Keep smiling, keep shining, and never stop being the wonderful person you are.',
  'Happy Birthday once again, Janani!', 'With lots of friendship and best wishes,', 'Your Best Friend,\nVasanth S 💜'];
function s9(root, c) {
  head(root, 9, 'A Letter for My Best Friend 💌', 'Tap the wax seal to open the envelope.');
  const env = el('div', 'env'); env.innerHTML = '<div class="env-back"></div><div class="env-paper"></div><div class="env-front"></div><div class="env-flap"></div>';
  const seal = el('button', 'seal', '💜'); seal.setAttribute('aria-label', 'Open the letter'); env.append(seal); root.append(env);
  const wrap = el('div', 'letter-wrap'); wrap.hidden = true;
  const sheet = el('div', 'letter'); sheet.tabIndex = 0; sheet.setAttribute('aria-label', 'Letter from Vasanth');
  LETTER.forEach(t => { const p = el('p'); p.textContent = t; sheet.append(p); });
  wrap.append(sheet);
  for (let i = 0; i < 8; i++) { const s = el('span', 'spark', pick(['✨', '💜', '⭐'])); s.style.cssText = `left:${rand(0, 95)}%;top:${rand(30, 95)}%;--dl:${rand(0, 4)}s`; wrap.append(s); }
  root.append(wrap);
  let opened = false;
  async function open() {
    if (opened) return; opened = true; env.classList.add('open'); Sound.play('whoosh');
    await c.sleep(reduce ? 100 : 1500); env.classList.add('gone'); wrap.hidden = false; sheet.scrollTop = 0;
    const [x, y] = centerOf(wrap); FX.confetti(x, y - 100, 50); Sound.play('chime');
    await c.sleep(600); if (!c.done()) c.complete('Letter opened! Scroll to read it all, then press Continue.');
  }
  env.onclick = open;
  if (c.done()) { env.classList.add('open', 'gone'); wrap.hidden = false; opened = true; }
}

const GIFTS = [
  { k: 'g1', name: 'Happiness', e: '😊', msg: 'You deserve a million reasons to smile!', c1: '#ffd86b', c2: '#ff9ec6' },
  { k: 'g2', name: 'Success', e: '🏆', msg: 'May every dream you work for bring you closer to success!', c1: '#ff9ec6', c2: '#ffffff' },
  { k: 'g3', name: 'Friendship', e: '🤗', msg: 'No matter where life takes us, I hope our friendship keeps growing!', c1: '#C8A2F0', c2: '#FFD6E7' }
];
function s10(root, c) {
  head(root, 10, 'Three Magical Friendship Gifts 🎁', 'Open every gift box to unlock what is inside.');
  const info = el('p', 'counter', '<b>0</b> of 3 gifts opened'); root.append(info);
  const grid = el('div', 'gifts'); root.append(grid); const opened = new Set();
  GIFTS.forEach(g => {
    const cell = el('div', 'gcell'), b = el('button', 'gift ' + g.k); b.style.cssText = `--c1:${g.c1};--c2:${g.c2}`; b.setAttribute('aria-label', `Open the ${g.name} gift`);
    b.innerHTML = `<span class="prize">${g.e}</span><span class="lid"></span><span class="box"></span>`;
    const msg = el('p', 'gmsg'); msg.setAttribute('aria-live', 'polite');
    cell.append(b, el('h3', '', g.name), msg); grid.append(cell);
    b.onclick = async () => {
      if (b.classList.contains('open') || b.classList.contains('shake')) return;
      b.classList.add('shake'); Sound.play('boing'); await c.sleep(reduce ? 0 : 420); b.classList.remove('shake'); b.classList.add('open'); Sound.play('gift');
      const [x, y] = centerOf(b); FX.confetti(x, y - 30, 40, .8); msg.textContent = g.msg;
      opened.add(g.k); $('b', info).textContent = opened.size;
      if (opened.size === 3 && !c.done()) c.complete('All three gifts opened! Press Continue.');
    };
  });
}

/* ================= SECTIONS 11-15 ================= */
function s11(root, c) {
  head(root, 11, 'The Friendship Promise Tree 🌳', 'Tap each glowing leaf to read a promise.');
  const info = el('p', 'counter', '<b>0</b> of 5 promises revealed'); root.append(info);
  const promises = ['I will cheer for your achievements.', 'I will listen when you need someone.', 'I will celebrate your happiness.', 'I will encourage you when things feel difficult.', 'I will always wish the best for your future.'];
  const pos = [[26, 42], [50, 22], [74, 42], [38, 60], [62, 58]];
  const tree = el('div', 'tree');
  tree.innerHTML = `<svg viewBox="0 0 400 440" aria-hidden="true"><path d="M182 440 C190 380 180 330 174 290 L226 290 C220 330 212 380 220 440Z" fill="#8a6a7a"/>
<path d="M200 310 C170 270 140 250 110 215 M200 310 C230 270 262 250 292 215 M200 300 C200 260 200 230 200 190" stroke="#8a6a7a" stroke-width="12" fill="none" stroke-linecap="round"/>
<g class="canopy"><circle cx="120" cy="190" r="72" fill="#7cc99a"/><circle cx="280" cy="190" r="72" fill="#7cc99a"/><circle cx="200" cy="200" r="86" fill="#86d1a4"/><circle cx="200" cy="130" r="95" fill="#8fd7ae"/><circle cx="145" cy="120" r="68" fill="#9be0b9"/><circle cx="255" cy="120" r="68" fill="#9be0b9"/></g></svg>`;
  for (let i = 0; i < 12; i++) { const f = el('i', 'ff'); f.style.cssText = `left:${rand(0, 95)}%;top:${rand(10, 90)}%;--dl:${-rand(0, 7)}s`; tree.append(f); }
  const box = el('div', 'msg card'); box.setAttribute('aria-live', 'polite'); box.innerHTML = '<span>🍃 Tap a glowing leaf</span>';
  const got = new Set();
  promises.forEach((p, i) => {
    const b = el('button', 'leaf'); b.style.left = pos[i][0] + '%'; b.style.top = pos[i][1] + '%'; b.setAttribute('aria-label', `Leaf ${i + 1}, tap to read a promise`); b.innerHTML = '<span class="lf"></span>';
    b.onclick = () => {
      b.classList.add('on'); box.innerHTML = '<span></span>'; box.firstChild.textContent = '🍃 ' + p; Sound.play('star');
      const [x, y] = centerOf(b); FX.confetti(x, y, 18, .5); got.add(i); $('b', info).textContent = got.size;
      if (got.size === 5) {
        tree.classList.add('lit'); FX.confetti(innerWidth / 2, innerHeight / 2, 100); Sound.play('cheer');
        if (!c.done()) c.complete('The whole tree is glowing! Promises made 🌳✨ Press Continue.');
      }
    };
    tree.append(b);
  });
  root.append(tree, box);
}
function s12(root, c) {
  head(root, 12, 'The Dream Universe 🌌', 'Janani, your dreams deserve the biggest sky!');
  const info = el('p', 'counter', '<b>0</b> of 6 wishes discovered'); root.append(info);
  const wishes = [['Happiness', 'May your days be full of genuine, glowing happiness.'], ['Good health', 'May you always stay healthy, strong and full of energy.'], ['Career success', 'May your hard work turn into the success you dream of.'], ['New adventures', 'May every year bring exciting new places and experiences.'], ['Wonderful friendships', 'May you always be surrounded by genuine, caring people.'], ['Endless reasons to smile', 'May life give you a million reasons to smile every day.']];
  const pos = [[14, 62], [32, 26], [52, 70], [66, 34], [86, 58], [46, 46]];
  const sky = el('div', 'sky'), far = el('div', 'layer'), mid = el('div', 'layer'), near = el('div', 'layer');
  far.style.setProperty('--d', 6); mid.style.setProperty('--d', 14); near.style.setProperty('--d', 26);
  for (let i = 0; i < 46; i++) { const s = el('i', 'st lt'); s.style.cssText = `left:${rand(0, 100)}%;top:${rand(0, 100)}%;--s:${rand(3, 8)}px;--dl:${rand(0, 4)}s;--du:${rand(2, 6)}s`; far.append(s); }
  mid.append(el('div', 'moon'));
  const p1 = el('div', 'planet ring'); p1.style.cssText = 'left:8%;top:14%;width:clamp(36px,8vw,54px);aspect-ratio:1;--a:#ffd6e7;--b:#c8a2f0;--g:rgba(200,162,240,.6)';
  const p2 = el('div', 'planet ring'); p2.style.cssText = 'left:72%;top:76%;width:clamp(40px,9vw,64px);aspect-ratio:1;--a:#d8eafe;--b:#6aa0e8;--g:rgba(150,200,255,.6)';
  mid.append(p1, p2);
  const box = el('div', 'msg card'); box.setAttribute('aria-live', 'polite'); box.innerHTML = '<span>✨ Tap a star to reveal a wish</span>';
  const got = new Set();
  wishes.forEach(([t, m], i) => {
    const b = el('button', 'wstar', STAR); b.style.left = pos[i][0] + '%'; b.style.top = pos[i][1] + '%'; b.style.setProperty('--dl', (i * .5) + 's'); b.setAttribute('aria-label', `Wish star ${i + 1}`);
    b.onclick = () => {
      b.classList.add('on'); box.innerHTML = '<span></span>'; box.firstChild.textContent = `⭐ ${t}: ${m}`; Sound.play('star');
      const [x, y] = centerOf(b); FX.burst(x, y, '#ffd86b'); got.add(i); $('b', info).textContent = got.size;
      if (got.size === 6 && !c.done()) { FX.confetti(innerWidth / 2, innerHeight / 3, 90); c.complete('Every wish is written in the stars! Press Continue.'); }
    };
    near.append(b);
  });
  sky.append(far, mid, near); root.append(sky, box);
  sky.addEventListener('pointermove', e => { const r = sky.getBoundingClientRect(); sky.style.setProperty('--px', ((e.clientX - r.left) / r.width - .5) * 2); sky.style.setProperty('--py', ((e.clientY - r.top) / r.height - .5) * 2); });
}
function s13(root, c) {
  head(root, 13, 'The Best-Friend Appreciation Wall 💜', 'Flip every card to read what is on the back.');
  const info = el('p', 'counter', '<b>0</b> of 6 cards flipped'); root.append(info);
  const cards = [['Thank you for being YOU.', '🌟'], ['Never underestimate your abilities.', '💪'], ['Your happiness matters.', '🌈'], ['Keep chasing your dreams.', '🚀'], ['You deserve genuine people and beautiful experiences.', '🌸'], ['The world is better with people like you in it.', '🌍']];
  const pal = [['#ffd6e7', '#ffb3d1'], ['#d8eafe', '#a9ccff'], ['#e6d3fa', '#c8a2f0'], ['#fff1c9', '#ffd86b'], ['#d5f5e6', '#8fdcb8'], ['#ffe0cf', '#ffb88a']];
  const wall = el('div', 'wall'); root.append(wall); const seen = new Set();
  cards.forEach(([t, e], i) => {
    const b = el('button', 'fcard'); b.style.cssText = `--a:${pal[i][1]};--b:${pal[i][0]}`; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="in"><span class="face front"><span>${e}</span><small>Tap to flip</small></span><span class="face back"></span></span>`; $('.back', b).textContent = t;
    b.onclick = () => {
      const on = b.classList.toggle('flip'); b.setAttribute('aria-pressed', String(on)); Sound.play('pop');
      if (on) { const [x, y] = centerOf(b); FX.confetti(x, y, 14, .5); seen.add(i); $('b', info).textContent = seen.size; }
      if (seen.size === 6 && !c.done()) c.complete('You read every card! Press Continue.');
    };
    wall.append(b);
  });
}
function s14(root, c) {
  root.append(el('p', 'kicker', `Section 14 · 🎊 ${SECTIONS[13].t}`));
  const t = el('h2', 'ptitle'); t.textContent = 'JANANI SINDHU — YOU ARE AMAZING! 🎉'; t.tabIndex = -1; root.append(t);
  const row = el('div', 'party-row'), M = Char('mochi', 'laugh'), P = Char('pip', 'laugh'); M.set('dance'); P.set('dance');
  const cb = el('div', 'cake-bounce'); cb.innerHTML = cakeSVG(3); cb.querySelectorAll('.candle').forEach(x => x.style.pointerEvents = 'none');
  row.append(M.el, cb, P.el); root.append(row);
  const p = el('p', 'lead fade-up', 'Thank you for being a wonderful best friend. May your life be filled with laughter, success, happiness, and unforgettable adventures!'); p.style.fontWeight = '800'; p.style.animationDelay = '1.2s'; root.append(p);
  const btn = el('button', 'btn big', 'One Last Surprise 💫'); btn.hidden = !c.done(); root.append(btn);
  c.later(() => { btn.hidden = false; btn.classList.add('ready'); }, reduce ? 0 : 3000);
  c.every(() => FX.burst(rand(.1, .9) * innerWidth, rand(.1, .5) * innerHeight), 900);
  c.every(() => FX.rain(24), 2600); FX.rain(40); Sound.play('cheer');
  btn.onclick = async () => {
    btn.disabled = true; Sound.play('whoosh'); Progress.complete(14);
    const cine = el('div'); cine.id = 'cine'; cine.append(el('i'), el('b'), el('i')); document.body.append(cine);
    await c.sleep(reduce ? 50 : 1000); Sound.play('chime'); go(15); chrome();
    setTimeout(() => cine.remove(), reduce ? 50 : 1000);
  };
}
function s15(root, c) {
  root.append(el('p', 'kicker', `Section 15 · 🌈 ${SECTIONS[14].t}`));
  const land = el('div', 'land'); land.append(el('div', 'rainbow'), el('div', 'hills'));
  const M = Char('mochi'), P = Char('pip'), duo = el('div', 'duo'); duo.append(M.el, P.el); M.set('wave'); P.set('cheer'); land.append(duo); root.append(land);
  const fin = el('div', 'fin'); root.append(fin);
  const line = (cls, tag, txt) => { const e = el(tag, cls + ' fade-up'); e.textContent = txt; fin.append(e); e.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); return e; };
  const btns = el('div', 'row fade-up'); btns.hidden = true;
  const again = el('button', 'btn', 'Celebrate Again 🎉'), replay = el('button', 'btn ghost', 'Replay My Favourite Moments ✨');
  again.onclick = confirmReset; replay.onclick = () => sectionMenu(true); btns.append(again, replay);
  c.every(() => FX.burst(rand(.1, .9) * innerWidth, rand(.08, .45) * innerHeight), 800);
  c.every(() => FX.confetti(rand(.2, .8) * innerWidth, innerHeight * .9, 40, 1.3), 3200);
  async function run() {
    const t = line('t1', 'h2', 'HAPPY BIRTHDAY, JANANI SINDHU! 🎂'); t.tabIndex = -1; FX.confetti(innerWidth / 2, innerHeight / 3, 120); Sound.play('cheer');
    const gap = reduce ? 200 : 2800;
    await c.sleep(gap); line('', 'p', 'Keep smiling. Keep growing. Keep being YOU.');
    await c.sleep(gap); line('', 'p', 'May all your beautiful dreams come true.');
    await c.sleep(gap); line('', 'p', 'And never forget that you have a best friend cheering for you!');
    await c.sleep(gap); P.mood('laugh'); M.mood('laugh'); duo.classList.add('hugging');
    line('credit', 'p', 'Made with friendship, happiness, and lots of care by Vasanth S 💜');
    fin.append(btns); btns.hidden = false; FX.confetti(innerWidth / 2, innerHeight / 2, 140); FX.rain(60);
    if (!c.done()) c.complete('You finished the whole experience! 🎉');
  }
  run();
}

/* ================= init ================= */
$('#menuBtn').onclick = () => sectionMenu(false);
$('#soundBtn').onclick = () => Sound.set(!Sound.on);
$('#backBtn').onclick = () => go(cur - 1);
$('#nextBtn').onclick = () => go(cur + 1);
document.addEventListener('click', e => { if (e.target.closest('.btn,.ibtn')) Sound.play('click'); });
Progress.load();
go(Progress.current);
})();
