/* ======================= utilities ======================= */
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s),
  $$ = (s, r = document) => [...r.querySelectorAll(s)];
const I = {
  arrow: '<path d="M7 17 17 7M8 7h9v9"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  up: '<path d="M7 14l5-5 5 5"/>',
  dn: '<path d="M7 10l5 5 5-5"/>',
  export: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  filter:
    '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  pulse: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  inhaler:
    '<path d="M9 3h5v6l3 2v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8l2-2z"/><path d="M9 9h5"/>',
  pill: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-35 12 12)"/><path d="m9.5 8.5 5 7"/>',
  lungs:
    '<path d="M12 4v8M12 10c-1.5 1-3 1.5-3 1.5S7 7 5 8c-2 1-2 6-2 9 0 2 2 3 4 2s3-3 3-6M12 10c1.5 1 3 1.5 3 1.5S17 7 19 8c2 1 2 6 2 9 0 2-2 3-4 2s-3-3-3-6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14a6 6 0 0 1 3 6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
};
const ic = (n, sw = 1.7) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pct = (v) => (v * 100).toFixed(1) + '%';
function safeFrom(targets, vars) {
  const resolved = gsap.utils.toArray(targets);
  if (resolved.length) return gsap.from(resolved, vars);
}
function safeFromTo(targets, fromVars, toVars) {
  const resolved = gsap.utils.toArray(targets);
  if (resolved.length) return gsap.fromTo(resolved, fromVars, toVars);
}

/* ======================= API-backed data ======================= */
const COHORTS = [
  {
    id: 'asthma-a',
    name: 'Asthma, adult',
    short: 'Asthma adult',
    color: '#087BFF',
    hatch: 'h-blue',
  },
  {
    id: 'asthma-p',
    name: 'Asthma, pediatric',
    short: 'Asthma pediatric',
    color: '#B9DAFF',
    hatch: 'h-sky',
  },
  { id: 'copd', name: 'COPD', short: 'COPD', color: '#111111', hatch: 'h-ink' },
];
const DAYS = 90; // history kept per patient
const PATIENTS = window.__ADHERIUM_BOOT__.patients;
window.__ADHERIUM_PATIENTS__ = PATIENTS;
const TODAY = new Date();
TODAY.setUTCHours(0, 0, 0, 0);
const dayName = (off) =>
  new Date(TODAY.getTime() - off * 864e5)
    .toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
    .slice(0, 1);
const dayLong = (off) =>
  new Date(TODAY.getTime() - off * 864e5).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
const adh = (p, from, to) => {
  let t = 0,
    n = 0;
  for (let d = from; d < to; d++) {
    const value = p.doses[DAYS - 1 - d];
    if (Number.isFinite(value)) {
      t += value;
      n++;
    }
  }
  return n ? t / (n * 2) : 0;
}; // average over recorded days only
const rescueSum = (p, from, to) => {
  let t = 0;
  for (let d = from; d < to; d++) {
    const value = p.rescue[DAYS - 1 - d];
    if (Number.isFinite(value)) t += value;
  }
  return t;
};

/* ======================= state ======================= */
const ST = {
  patient: 'PT-001',
  range: 7,
  cohort: 'all',
  week: 0,
  trendMode: 'controller',
  actFilter: 'all',
  role: 'provider',
  page: 'dashboard',
  selDot: null,
};
const HELLO = (() => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
})();
const ROLES = {
  provider: ['Healthcare Provider', 'HP', HELLO + ',<br>care team.'],
  coordinator: ['Care Coordinator', 'CC', HELLO + ',<br>coordinator.'],
  resp: ['Respiratory Care Team', 'RT', HELLO + ',<br>respiratory team.'],
};
const pool = () =>
  ST.cohort === 'all'
    ? PATIENTS
    : PATIENTS.filter((p) =>
        ST.cohort === 'asthma'
          ? p.cohort.id !== 'copd'
          : p.cohort.id === 'copd',
      );
const onTrack = (p) =>
  adh(p, 0, ST.range) >= 0.8 &&
  rescueSum(p, 0, 7) < 6 &&
  p.status !== 'offline';
const followUp = (p) => p.status !== 'offline' && !onTrack(p);

/* ======================= overlays ======================= */
const tip = $('#tip');
function showTip(html, e) {
  tip.innerHTML = html;
  tip.classList.add('on');
  moveTip(e);
}
function moveTip(e) {
  const w = tip.offsetWidth,
    h = tip.offsetHeight;
  let x = e.clientX + 14,
    y = e.clientY - h - 12;
  if (x + w > innerWidth - 8) x = e.clientX - w - 14;
  if (y < 8) y = e.clientY + 16;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}
function hideTip() {
  tip.classList.remove('on');
}
function bindTip(el, html) {
  el.addEventListener('pointerenter', (e) =>
    showTip(typeof html === 'function' ? html() : html, e),
  );
  el.addEventListener('pointermove', moveTip);
  el.addEventListener('pointerleave', hideTip);
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  $('#toasts').appendChild(t);
  if (!RM)
    safeFrom(t, { y: 14, opacity: 0, duration: 0.4, ease: 'power3.out' });
  setTimeout(() => {
    if (!RM)
      gsap.to(t, {
        opacity: 0,
        y: 8,
        duration: 0.25,
        onComplete: () => t.remove(),
      });
    else t.remove();
  }, 3200);
}
function closeMenus() {
  $$('.menu').forEach((m) => m.remove());
}
function menu(anchor, title, opts, cur, onPick) {
  closeMenus();
  const r = anchor.getBoundingClientRect();
  const m = document.createElement('div');
  m.className = 'menu';
  m.setAttribute('role', 'listbox');
  m.innerHTML =
    (title ? `<div class="mh">${title}</div>` : '') +
    opts
      .map(
        ([v, l]) =>
          `<button role="option" data-v="${v}" class="${v === cur ? 'on' : ''} ${v === '__out' ? 'menu-logout' : ''}">${l}</button>`,
      )
      .join('');
  document.body.appendChild(m);
  const w = Math.min(m.offsetWidth, Math.max(0, innerWidth - 16));
  m.style.width = `${w}px`;
  m.style.maxHeight = Math.max(0, innerHeight - 16) + 'px';
  m.style.overflowY = 'auto';
  const mh = m.offsetHeight;
  m.style.left =
    clamp(r.right - w, 8, Math.max(8, innerWidth - w - 8)) + 'px';
  m.style.top =
    (r.bottom + 8 + mh > innerHeight - 8
      ? Math.max(8, r.top - mh - 8)
      : r.bottom + 8) + 'px';
  if (!RM)
    safeFrom(m, {
      opacity: 0,
      y: -6,
      scale: 0.97,
      transformOrigin: 'top right',
      duration: 0.3,
      ease: 'power3.out',
    });
  $$('button', m).forEach(
    (b) =>
      (b.onclick = () => {
        m.remove();
        onPick(b.dataset.v);
      }),
  );
  setTimeout(
    () =>
      document.addEventListener('pointerdown', function h(e) {
        if (!m.contains(e.target) && !anchor.contains(e.target)) {
          m.remove();
          document.removeEventListener('pointerdown', h);
        }
      }),
    0,
  );
}
const scrim = $('#scrim');
function openDrawer(html) {
  const d = $('#drawer');
  d.innerHTML = html;
  d.classList.add('open');
  scrim.classList.add('on');
  $$('[data-close]', d).forEach((b) => (b.onclick = closeAll));
}
function openModal(html) {
  const m = $('#modal');
  m.innerHTML = html;
  m.classList.add('open');
  scrim.classList.add('on');
  $$('[data-close]', m).forEach((b) => (b.onclick = closeAll));
  return m;
}
function closeAll() {
  $('#drawer').classList.remove('open');
  $('#modal').classList.remove('open');
  scrim.classList.remove('on');
  $('#side').classList.remove('open');
}
scrim.onclick = closeAll;
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAll();
    closeMenus();
  }
});

/* downloads via runtime capability, with a copy fallback */
let DL = null;
(async () => {
  try {
    if (window.claude && claude.use) DL = await claude.use('downloads');
  } catch (e) {}
})();
async function save(filename, data) {
  if (DL) {
    try {
      await DL.save({ filename, data });
      toast('Exported ' + filename);
      return;
    } catch (e) {
      if (e && e.code === 'declined') {
        toast('Export cancelled');
        return;
      }
    }
  }
  const m = openModal(
    `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div><h2 style="font-size:22px;font-weight:500">Export ${filename}</h2><p style="color:var(--muted);margin:6px 0 14px;font-size:13px">File saving isn’t available in this view. Copy the contents into a file with this name.</p></div><button class="arrow" data-close aria-label="Close">${ic('x')}</button></div><textarea readonly style="width:100%;height:240px;border:1px solid var(--line);border-radius:16px;padding:12px;font-size:12px;background:var(--bg)">${data.replace(/</g, '&lt;')}</textarea><div style="text-align:right;margin-top:12px"><button class="btn-blue" id="cpy"><span>Copy to clipboard</span></button></div>`,
  );
  $('#cpy', m).onclick = async () => {
    try {
      await navigator.clipboard.writeText(data);
      toast('Copied to clipboard');
    } catch (e) {
      toast('Select the text and copy it');
    }
  };
}
const csv = (rows) =>
  rows
    .map((r) =>
      r
        .map((v) =>
          /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v,
        )
        .join(','),
    )
    .join('\n');

/* ======================= navigation ======================= */
const SIDE_A = [
  ['dashboard', 'Overview', 'grid'],
  ['patients', 'Patient Monitoring', 'pulse'],
  ['patient-profile', 'Patient Health Profile', 'user'],
  ['devices', 'Smart Inhaler Devices', 'inhaler'],
  ['medication-adherence', 'Medication Adherence', 'pill'],
];
const SIDE_B = [
  ['respiratory-analytics', 'Respiratory Analytics', 'lungs'],
  ['alerts', 'Alerts & Follow-up', 'bell'],
  ['care-team', 'Care Team Workspace', 'team'],
  ['reports', 'Reports & Insights', 'chart'],
  ['data-management', 'Data & Device Management', 'db'],
];
const TITLES = Object.fromEntries(
  [...SIDE_A, ...SIDE_B].map((x) => [x[0], x[1]]),
);
function navHTML(list) {
  return list
    .map(
      ([id, l, i]) =>
        `<button class="nav-i ${ST.page === id ? 'on' : ''}" data-p="${id}">${ic(i)}<span>${l}</span>${ST.page === id ? `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${I.down}</svg>` : ''}</button>`,
    )
    .join('');
}
function renderNav() {
  $('#nav-a').innerHTML = navHTML(SIDE_A);
  $('#nav-b').innerHTML = navHTML(SIDE_B);
  $$('.nav-i').forEach((b) => (b.onclick = () => go(b.dataset.p)));
  $$('.pill-nav').forEach((b) =>
    b.classList.toggle('on', b.dataset.p === ST.page),
  );
  placePill();
}
function placePill() {
  const on = $('.pill-nav.on'),
    ind = $('#pill-ind');
  if (!on) {
    ind.style.width = '0';
    return;
  }
  ind.style.left = on.offsetLeft + 'px';
  ind.style.width = on.offsetWidth + 'px';
}
$$('.pill-nav').forEach((b) => (b.onclick = () => go(b.dataset.p)));
let navigationRequest = 0;
function go(p) {
  const request = ++navigationRequest;
  ST.page = p;
  closeAll();
  renderNav();
  const route = window.__ADHERIUM_ROUTE_FOR_PAGE__?.(p, ST.patient);
  if (route) history.replaceState(null, '', route);
  const w = $('#work');
  document.title = 'Adherium · ' + (TITLES[p] || 'Overview');
  const show = async () => {
    hideTip();
    w.innerHTML = `<section class="card" style="margin:20px;padding:24px"><h2>Loading ${TITLES[p] || 'page'}</h2><p style="color:var(--muted);margin-top:8px">Fetching this screen’s data…</p></section>`;
    w.style.opacity = '1';
    w.style.transform = 'none';
    try {
      await window.__ADHERIUM_ENSURE_PAGE_DATA__?.(p);
      if (request !== navigationRequest) return;
      if (p === 'patient-profile' && window.__ADHERIUM_LOAD_PROFILE__) {
        await window.__ADHERIUM_LOAD_PROFILE__(ST.patient);
        if (request !== navigationRequest) return;
        if (window.PAGES && PAGES[p]) PAGES[p]();
      } else if (window.PAGES && PAGES[p]) PAGES[p]();
      else renderDashboard(true);
    } catch (error) {
      window.__ADHERIUM_SHOW_ERROR__?.(error);
      return;
    }
    $('#work').scrollTop = 0;
    scrollTo({ top: 0 });
    if (!RM)
      safeFromTo(
        w,
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          ease: 'power3.out',
          clearProps: 'transform',
        },
      );
  };
  if (RM) {
    void show();
    return;
  }
  gsap.to(w, {
    opacity: 0,
    y: 6,
    duration: 0.18,
    ease: 'power2.in',
    onComplete: () => void show(),
  });
}
function renderPending(p) {
  const name =
    TITLES[p] ||
    {
      monitoring: 'Patient Monitoring',
      inhalers: 'Smart Inhaler Devices',
      analytics: 'Respiratory Health Analytics',
      reports: 'Reports & Insights',
    }[p];
  $('#work').innerHTML =
    `<div class="whead"><div><h1>${name}</h1><div class="crumb">Overview ${ic('right')} ${name}</div></div></div>
    <div class="pending"><h2>This screen is next in line</h2><p>The overview dashboard is being reviewed first. Once its design is approved, ${name} will be rebuilt in the same system.</p><button class="btn-blue" id="back"><span>Back to overview</span><i>${ic('arrow')}</i></button></div>`;
  $('#back').onclick = () => go('dashboard');
}

/* ======================= dashboard ======================= */
function renderDashboard(animate) {
  const P = pool();
  const n = P.length;
  const RANGE_LBL = {
    7: 'Last 7 days',
    14: 'Last 14 days',
    30: 'Last 30 days',
  }[ST.range];
  const overall = P.reduce((a, p) => a + adh(p, 0, ST.range), 0) / n;
  const prev = P.reduce((a, p) => a + adh(p, ST.range, ST.range * 2), 0) / n;
  const st = {
    connected: P.filter((p) => p.status === 'connected').length,
    pending: P.filter((p) => p.status === 'pending').length,
    offline: P.filter((p) => p.status === 'offline').length,
  };
  const coLbl = { all: 'All patients', asthma: 'Asthma', copd: 'COPD' }[
    ST.cohort
  ];
  const w = $('#work');
  w.innerHTML = `
  <div class="whead"><div><h1>Respiratory Overview</h1><div class="crumb">Overview ${ic('right')} ${coLbl}</div></div>
    <div class="ctrls"><span class="demo">● Synthetic demo data</span>
      <button class="cbtn" id="c-range" aria-haspopup="listbox">${RANGE_LBL}<span class="cic">${ic('down')}</span></button>
      <button class="cbtn" id="c-export">Export<span class="cic">${ic('export')}</span></button>
      <button class="cbtn" id="c-filter" aria-haspopup="listbox">${ST.cohort === 'all' ? 'Filter' : coLbl}<span class="cic">${ic('filter')}</span></button></div></div>
  <div class="grid">
    <section class="card c7" id="mx-card">
      <div class="card-h"><h2>Respiratory Monitoring Overview</h2><div style="display:flex;gap:6px"><button class="mini" id="mx-week">${ST.week ? 'Last week' : 'This week'}${ic('down')}</button><button class="arrow" data-goto="medication-adherence" aria-label="Open medication adherence">${ic('arrow')}</button></div></div>
      <div class="mx-top"><div><div class="big" id="mx-big">0<small>%</small></div><div style="color:var(--muted);font-size:13px;margin-top:6px">Controller doses taken, ${ST.week ? 'last week' : 'this week'}</div></div>
        <div class="mx-leg"><span><i class="h-blue"></i>85% or more</span><span><i class="h-sky"></i>75 to 84%</span><span><i class="h-ink"></i>Below 75%</span><span><i class="h-off"></i>No patients</span></div></div>
      <div class="mx" id="mx"></div>
    </section>
    <div class="c5 rcol" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;grid-auto-rows:min-content">
      <section class="card dark" style="grid-column:1/-1">
        <h2>Smart inhaler <b>connectivity</b></h2>
        <div class="devs" id="devs" aria-label="Device status grid"></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap">
          <div class="dstat"><span><i style="background:#087BFF"></i><b>${st.connected}</b>Connected</span><span><i style="background:#8A8A8A"></i><b>${st.pending}</b>Sync pending</span><span><i style="border:1.5px solid #8A8A8A"></i><b>${st.offline}</b>Offline</span></div>
          <button class="btn-blue" id="dev-btn"><span>Review devices</span><i>${ic('arrow')}</i></button></div>
      </section>
      <section class="card metric">
        <div class="ttl"><button class="arrow" id="am-exp" aria-label="Show cohort breakdown" aria-expanded="false" style="width:44px;height:44px">${ic('down')}</button><span>Active<br>monitoring</span></div>
        <div class="val" data-count="${n}">0</div>
        <div class="foot"><span class="tag">+${P.filter((p) => p.enrolled < 30).length} this month</span><span style="color:var(--muted);font-size:12.5px">patients</span></div>
        <div class="expand" id="am-more">${COHORTS.map((c) => `<div class="exp-row"><span>${c.short}</span><b>${P.filter((p) => p.cohort.id === c.id).length}</b></div>`).join('')}</div>
      </section>
      <section class="card report">
        <div class="acts"><button class="wcirc g" id="rp-x" aria-label="Dismiss report card">${ic('x')}</button><div><button class="wcirc" id="rp-prev" aria-label="Preview weekly report">${ic('doc')}</button><button class="wcirc" id="rp-dl" aria-label="Export weekly report">${ic('arrow')}</button></div></div>
        <div><span class="lab">Preview and export</span><h3>Weekly adherence report</h3></div>
      </section>
    </div>

    <section class="card c8">
      <div class="card-h"><h2>Medication Adherence Trends</h2><div style="display:flex;gap:6px;align-items:center"><div class="seg" id="tr-mode"><button data-m="controller" class="${ST.trendMode === 'controller' ? 'on' : ''}">Controller</button><button data-m="rescue" class="${ST.trendMode === 'rescue' ? 'on' : ''}">Rescue use</button></div></div></div>
      <div class="trend"><div><span class="pill-dark">6 weeks</span><div class="big" style="margin-top:14px" id="tr-big"></div><div style="color:var(--muted);font-size:13px;margin-top:8px;max-width:22ch" id="tr-sub"></div>
        <div class="legend" style="margin-top:28px" id="tr-leg"></div></div>
        <div style="position:relative;padding-bottom:24px"><div class="bars" id="bars"></div></div></div>
    </section>
    <section class="card c4">
      <div class="card-h"><h2>Patient Monitoring Status</h2><button class="arrow" data-goto="alerts" aria-label="Open alerts and follow-up">${ic('arrow')}</button></div>
      <div class="legend" id="g-leg" style="justify-content:space-between"></div>
      <svg class="gauge" id="gauge" viewBox="0 0 300 170" role="img" aria-label="Share of patients on track"></svg>
      <div class="g-center"><b id="g-val">0%</b><small>on track, ${RANGE_LBL.toLowerCase()}</small></div>
      <div class="g-note" id="g-note"></div>
    </section>

    <section class="card c6">
      <div class="card-h"><h2>Recent Monitoring Activity</h2><div class="seg" id="act-f"><button data-f="all" class="${ST.actFilter === 'all' ? 'on' : ''}">All</button><button data-f="action" class="${ST.actFilter === 'action' ? 'on' : ''}">Needs action</button></div></div>
      <div class="tl" id="tl"></div>
    </section>
    <section class="card c6">
      <div class="card-h"><h2>Patient Cohort Overview</h2><button class="mini" id="coh-all">${ST.cohort === 'all' ? 'All cohorts' : 'Show all'}</button></div>
      <div class="coh" id="coh"></div>
      <div class="coh-bar" id="coh-bar"></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><b style="font-weight:500;font-size:13.5px">Adherence, 7-day average</b><span class="legend">${COHORTS.map((c) => `<span><i style="background:${c.color}"></i>${c.short}</span>`).join('')}</span></div>
      <svg class="lc" id="lc" viewBox="0 0 600 150" preserveAspectRatio="none" style="height:150px"></svg>
    </section>
  </div>`;

  drawMatrix(animate);
  drawDevices(P, animate);
  drawTrend(animate);
  drawGauge(P, animate);
  drawActivity();
  drawCohorts(animate);
  counters(animate);
  // controls
  $('#c-range').onclick = (e) =>
    menu(
      e.currentTarget,
      'Date range',
      [
        ['7', 'Last 7 days'],
        ['14', 'Last 14 days'],
        ['30', 'Last 30 days'],
      ],
      String(ST.range),
      (v) => {
        ST.range = +v;
        refresh();
        toast(
          'Showing ' +
            {
              7: 'the last 7 days',
              14: 'the last 14 days',
              30: 'the last 30 days',
            }[v],
        );
      },
    );
  $('#c-filter').onclick = (e) =>
    menu(
      e.currentTarget,
      'Patient cohort',
      [
        ['all', 'All patients'],
        ['asthma', 'Asthma'],
        ['copd', 'COPD'],
      ],
      ST.cohort,
      (v) => {
        ST.cohort = v;
        refresh();
      },
    );
  $('#c-export').onclick = exportPatients;
  $('#mx-week').onclick = (e) =>
    menu(
      e.currentTarget,
      null,
      [
        ['0', 'This week'],
        ['1', 'Last week'],
      ],
      String(ST.week),
      (v) => {
        ST.week = +v;
        $('#mx-week').firstChild.textContent = ST.week
          ? 'Last week'
          : 'This week';
        drawMatrix(true);
      },
    );
  $$('#tr-mode button').forEach(
    (b) =>
      (b.onclick = () => {
        ST.trendMode = b.dataset.m;
        $$('#tr-mode button').forEach((x) => x.classList.toggle('on', x === b));
        drawTrend(true);
      }),
  );
  $$('#act-f button').forEach(
    (b) =>
      (b.onclick = () => {
        ST.actFilter = b.dataset.f;
        $$('#act-f button').forEach((x) => x.classList.toggle('on', x === b));
        drawActivity(true);
      }),
  );
  $('#coh-all').onclick = () => {
    ST.cohort = 'all';
    refresh();
  };
  $('#dev-btn').onclick = () => go('devices');
  $$('[data-goto]', w).forEach((b) => (b.onclick = () => go(b.dataset.goto)));
  $('#am-exp').onclick = (e) => {
    const el = $('#am-more'),
      open = e.currentTarget.getAttribute('aria-expanded') === 'true';
    e.currentTarget.setAttribute('aria-expanded', !open);
    e.currentTarget.style.transform = open ? '' : 'rotate(180deg)';
    if (RM) el.style.height = open ? '0' : 'auto';
    else
      gsap.to(el, {
        height: open ? 0 : 'auto',
        duration: 0.45,
        ease: 'power3.inOut',
      });
  };
  $('#rp-prev').onclick = reportPreview;
  $('#rp-dl').onclick = exportReport;
  $('#rp-x').onclick = (e) => {
    const c = e.currentTarget.closest('.report');
    if (RM) {
      c.style.display = 'none';
      return;
    }
    gsap.to(c, {
      opacity: 0,
      scale: 0.96,
      duration: 0.3,
      onComplete: () => {
        c.style.visibility = 'hidden';
        toast('Report card hidden until the next visit');
      },
    });
  };
  if (animate && !RM) intro();
}
function refresh() {
  // brief skeleton sweep, then redraw so the change reads as a data update
  $$('#work .card').forEach((c) => {
    c.classList.remove('skel');
    void c.offsetWidth;
    c.classList.add('skel');
  });
  setTimeout(() => renderDashboard(false), RM ? 0 : 220);
}
function counters(animate) {
  $$('[data-count]').forEach((el) => {
    const to = +el.dataset.count;
    if (!animate || RM) {
      el.textContent = to;
      return;
    }
    const o = { v: 0 };
    gsap.to(o, {
      v: to,
      duration: 1.3,
      ease: 'power3.out',
      onUpdate: () => (el.textContent = Math.round(o.v)),
    });
  });
}
function intro() {
  safeFrom('.whead > *', {
    y: 10,
    opacity: 0,
    duration: 0.6,
    stagger: 0.06,
    ease: 'power3.out',
    clearProps: 'all',
  });
  safeFrom('#work .card', {
    opacity: 0,
    duration: 0.5,
    stagger: 0.03,
    ease: 'power2.out',
    clearProps: 'opacity',
  });
}

/* circular adherence matrix */
function drawMatrix(animate) {
  const el = $('#mx');
  const P = pool();
  const off = ST.week * 7;
  const cols = [6, 5, 4, 3, 2, 1, 0].map((d) => d + off);
  let html =
    '<span></span>' +
    cols.map((d) => `<span class="dl">${dayName(d)}</span>`).join('');
  let tot = 0,
    cnt = 0;
  const cells = [];
  COHORTS.forEach((c) => {
    html += `<span class="rl">${c.short}</span>`;
    const ps = P.filter((p) => p.cohort.id === c.id);
    cols.forEach((d) => {
      if (!ps.length) {
        html += `<button class="dot h-off" aria-label="${c.short}, no patients in filter"></button>`;
        return;
      }
      const recorded = ps
        .map((p) => p.doses[DAYS - 1 - d])
        .filter(Number.isFinite);
      if (!recorded.length) {
        html += `<button class="dot h-off" aria-label="${c.short}, ${dayLong(d)}: no adherence records"></button>`;
        return;
      }
      const v =
        recorded.reduce((a, value) => a + value, 0) / (recorded.length * 2);
      tot += v * recorded.length;
      cnt += recorded.length;
      const cls = v >= 0.85 ? 'h-blue' : v >= 0.75 ? 'h-sky' : 'h-ink';
      cells.push({ c, d, v, n: recorded.length });
      html += `<button class="dot ${cls}" data-i="${cells.length - 1}" aria-label="${c.short}, ${dayLong(d)}: ${pct(v)} of doses taken"></button>`;
    });
  });
  el.innerHTML = html;
  const big = cnt ? tot / cnt : 0;
  const bigEl = $('#mx-big');
  const setBig = (v) =>
    (bigEl.innerHTML = (v * 100).toFixed(1) + '<small>%</small>');
  // Render the actual API-derived value immediately; animate the matrix below.
  setBig(big);
  $$('.dot[data-i]', el).forEach((b) => {
    const c = cells[+b.dataset.i];
    bindTip(
      b,
      `<b>${c.c.name}, ${dayLong(c.d)}</b>${pct(c.v)} of ${c.n * 2} scheduled doses taken`,
    );
    b.onclick = () => openCell(c, b);
  });
  if (animate && !RM) {
    const dots = $$('.dot', el);
    safeFromTo(
      dots,
      { scale: 0, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.5,
        ease: 'back.out(1.6)',
        stagger: { each: 0.035, grid: [3, 7], from: 'start', axis: 'x' },
        clearProps: 'transform,opacity',
      },
    );
  }
}
function openCell(c, btn) {
  $$('.dot.sel').forEach((x) => x.classList.remove('sel'));
  btn.classList.add('sel');
  const ps = pool()
    .filter((p) => p.cohort.id === c.c.id)
    .map((p) => ({ p, v: p.doses[DAYS - 1 - c.d] }))
    .filter((x) => x.v < 2)
    .slice(0, 8);
  openDrawer(`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div><div style="color:var(--muted);font-size:13px">${c.c.name}</div><h2 style="font-size:24px;font-weight:500;margin-top:4px">${dayLong(c.d)}</h2></div><button class="arrow" data-close aria-label="Close">${ic('x')}</button></div>
    <div class="big" style="margin:20px 0 4px">${(c.v * 100).toFixed(1)}<small>%</small></div><div style="color:var(--muted);font-size:13px">of ${c.n * 2} scheduled controller doses taken</div>
    <h3 style="font-size:15px;font-weight:500;margin:24px 0 10px">Patients with missed doses that day</h3>
    ${ps.length ? ps.map((x) => `<button class="ev" data-pt="${x.p.id}" style="--c:${x.v ? '#B9DAFF' : '#111'}"><b>${x.p.id}</b><span class="t">${x.v ? '1 of 2 taken' : 'Both missed'}</span><small>${x.p.status === 'offline' ? 'Inhaler offline' : 'Inhaler connected'}</small></button>`).join('') : '<div class="empty"><b>No missed doses</b>Every patient in this cohort took both doses.</div>'}`);
  $$('#drawer [data-pt]').forEach(
    (b) => (b.onclick = () => openPatient(b.dataset.pt)),
  );
}

/* connected device graphic */
function drawDevices(P, animate) {
  const el = $('#devs');
  const sample = P.slice(0, 96);
  el.innerHTML = sample
    .map(
      (p) =>
        `<i data-id="${p.id}" style="background:${p.status === 'connected' ? '#087BFF' : p.status === 'pending' ? '#8A8A8A' : 'transparent'};${p.status === 'offline' ? 'box-shadow:inset 0 0 0 1.5px #8A8A8A' : ''}"></i>`,
    )
    .join('');
  $$('i', el).forEach((t) => {
    const p = PATIENTS.find((x) => x.id === t.dataset.id);
    bindTip(
      t,
      `<b>${p.id} inhaler</b>${p.status === 'connected' ? 'Connected' : p.status === 'pending' ? 'Sync pending' : 'Offline'}. Last sync ${fmtAgo(p.lastSync)}. Battery ${p.battery}%`,
    );
    t.style.cursor = 'pointer';
    t.onclick = () => openPatient(p.id);
  });
  if (animate && !RM)
    safeFrom($$('i', el), {
      opacity: 0,
      duration: 0.35,
      stagger: { each: 0.006, from: 'random' },
      delay: 0.2,
    });
}
const fmtAgo = (m) =>
  !Number.isFinite(m) || m < 0
    ? 'Unavailable'
    : m < 60
      ? m + ' min ago'
      : m < 1440
        ? Math.round(m / 60) + ' h ago'
        : Math.round(m / 1440) + ' days ago';

/* rounded vertical usage bars */
function drawTrend(animate) {
  const P = pool();
  const el = $('#bars');
  const ctrl = ST.trendMode === 'controller';
  if (window.__ADHERIUM_BOOT__.historyDays < 42) {
    el.innerHTML =
      '<div class="empty"><b>Loading history</b>Six-week trends will appear as the remaining adherence history loads.</div>';
    $('#tr-big').textContent = '…';
    $('#tr-sub').textContent = 'Loading six-week history';
    $('#tr-leg').innerHTML = '';
    return;
  }
  const weeks = [5, 4, 3, 2, 1, 0].map((k) => {
    const v = ctrl
      ? P.reduce((a, p) => a + adh(p, k * 7, k * 7 + 7), 0) / P.length
      : P.reduce((a, p) => a + rescueSum(p, k * 7, k * 7 + 7), 0) / P.length;
    return { k, v, lbl: k === 0 ? 'This wk' : k + ' wk ago' };
  });
  const max = ctrl
      ? Math.min(1, Math.max(...weeks.map((w) => w.v)) + 0.04)
      : Math.max(...weeks.map((w) => w.v)) * 1.25,
    min = ctrl ? Math.min(0.7, Math.min(...weeks.map((w) => w.v)) - 0.06) : 0;
  const h = (v) => clamp((v - min) / (max - min), 0.08, 1) * 100;
  el.innerHTML =
    weeks
      .map((w, i) => {
        const prev = weeks[i - 1];
        const up = prev ? w.v >= prev.v : true;
        const good = ctrl
          ? w.v >= 0.8
          : w.v <= weeks.reduce((a, x) => a + x.v, 0) / 6;
        const cls = w.k === 0 ? 'h-blue' : good ? 'h-sky' : 'h-ink';
        return `<div class="bar ${cls}" data-i="${i}" style="height:${h(w.v)}%" role="img" aria-label="${w.lbl}: ${ctrl ? pct(w.v) : w.v.toFixed(2) + ' rescue uses per patient'}"><span class="bl">${prev ? ic(up ? 'up' : 'dn', 2.4) : ''}${ctrl ? (w.v * 100).toFixed(0) + '%' : w.v.toFixed(1)}</span><span class="wk">${w.lbl}</span></div>`;
      })
      .join('') +
    (ctrl
      ? `<div class="target" style="bottom:${h(0.8)}%"><span>80% target</span></div>`
      : '');
  $$('.bar', el).forEach((b) => {
    const w = weeks[+b.dataset.i];
    bindTip(
      b,
      `<b>${w.k === 0 ? 'This week' : w.k + ' weeks ago'}</b>${ctrl ? pct(w.v) + ' of controller doses taken' : w.v.toFixed(2) + ' rescue inhaler uses per patient'}`,
    );
  });
  const first = weeks[0].v,
    last = weeks[5].v;
  const ch = ctrl ? (last - first) * 100 : ((last - first) / first) * 100;
  $('#tr-big').innerHTML =
    `<span style="color:${(ctrl ? ch >= 0 : ch <= 0) ? 'var(--blue)' : 'var(--text)'}">${ch >= 0 ? '+' : ''}${ch.toFixed(1)}${ctrl ? '<small>pts</small>' : '<small>%</small>'}</span>`;
  $('#tr-sub').textContent = ctrl
    ? 'Change in controller adherence over six weeks'
    : 'Change in rescue inhaler use per patient over six weeks';
  $('#tr-leg').innerHTML = ctrl
    ? '<span><i class="h-blue"></i>This week</span><span><i class="h-sky"></i>At or above target</span><span><i class="h-ink"></i>Below target</span>'
    : '<span><i class="h-blue"></i>This week</span><span><i class="h-sky"></i>At or below average</span><span><i class="h-ink"></i>Above average</span>';
  if (animate && !RM)
    safeFrom($$('.bar', el), {
      scaleY: 0,
      duration: 0.9,
      stagger: 0.07,
      ease: 'power3.out',
      clearProps: 'transform',
    });
}

/* semicircular monitoring indicator */
function drawGauge(P, animate) {
  const on = P.filter(onTrack).length,
    fu = P.filter(followUp).length,
    off = P.length - on - fu;
  const share = on / P.length;
  const prevShare =
    P.filter((p) => adh(p, ST.range, ST.range * 2) >= 0.8).length / P.length;
  const N = 28,
    cx = 150,
    cy = 150,
    r1 = 92,
    r2 = 138;
  let svg = '';
  const onSeg = Math.round(share * N),
    fuSeg = Math.round((fu / P.length) * N);
  for (let i = 0; i < N; i++) {
    const a = Math.PI - ((i + 0.5) / N) * Math.PI;
    const col =
      i < onSeg ? '#087BFF' : i < onSeg + fuSeg ? '#B9DAFF' : '#E6E6E6';
    const x = cx + (Math.cos(a) * (r1 + r2)) / 2,
      y = cy - (Math.sin(a) * (r1 + r2)) / 2,
      deg = (-a * 180) / Math.PI + 90;
    svg += `<rect class="gs" x="${x - 6}" y="${y - (r2 - r1) / 2}" width="12" height="${r2 - r1}" rx="6" fill="${col}" transform="rotate(${deg} ${x} ${y})"/>`;
  }
  $('#gauge').innerHTML = svg;
  $('#g-leg').innerHTML =
    `<span><i style="background:#087BFF"></i>On track ${on}</span><span><i style="background:#B9DAFF"></i>Follow-up ${fu}</span><span><i style="background:#E6E6E6"></i>Offline ${off}</span>`;
  const gv = $('#g-val');
  if (animate && !RM) {
    const o = { v: 0 };
    gsap.to(o, {
      v: share * 100,
      duration: 1.2,
      ease: 'power3.out',
      onUpdate: () => (gv.textContent = Math.round(o.v) + '%'),
    });
    safeFrom($$('.gs'), {
      opacity: 0,
      scale: 0.6,
      transformOrigin: '50% 50%',
      duration: 0.4,
      stagger: 0.025,
      ease: 'power2.out',
    });
  } else gv.textContent = Math.round(share * 100) + '%';
  const d = (share - prevShare) * 100;
  $('#g-note').innerHTML =
    `<span>${d >= 0 ? 'Up' : 'Down'} ${Math.abs(d).toFixed(1)} pts from the previous period</span><span class="tag ${d >= 0 ? 'blue' : 'gray'}">${d >= 0 ? '+' : ''}${d.toFixed(1)}</span>`;
}

/* activity timeline (anonymous IDs only) */
function activityEvents() {
  return (window.__ADHERIUM_BOOT__.alerts || [])
    .filter((alert) => alert.status !== 'ack')
    .map((alert) => ({
      p: alert.p,
      t: alert.mins,
      kind: 'action',
      c:
        alert.sev === 'high'
          ? '#D93B3B'
          : alert.sev === 'low'
            ? '#111'
            : '#C77A00',
      title: alert.p.id + ': ' + alert.kind,
      sub: alert.text,
    }))
    .sort((a, b) => a.t - b.t);
}
function drawActivity(animate) {
  const ev = activityEvents()
    .filter((e) => ST.actFilter === 'all' || e.kind === 'action')
    .slice(0, 5);
  const el = $('#tl');
  el.innerHTML = ev.length
    ? ev
        .map(
          (e) =>
            `<button class="ev" data-pt="${e.p.id}" style="--c:${e.c}"><b>${e.title}</b><span class="t">${fmtAgo(e.t)}</span><small>${e.sub}</small></button>`,
        )
        .join('')
    : '<div class="empty"><b>Nothing needs action</b>No rescue spikes, missed-dose streaks or offline inhalers in this cohort.</div>';
  $$('[data-pt]', el).forEach(
    (b) => (b.onclick = () => openPatient(b.dataset.pt)),
  );
  if (animate && !RM)
    safeFrom($$('.ev', el), {
      x: -8,
      opacity: 0,
      duration: 0.35,
      stagger: 0.04,
      ease: 'power2.out',
      clearProps: 'all',
    });
}

/* cohort overview + minimal line chart */
function drawCohorts(animate) {
  const el = $('#coh');
  el.innerHTML = COHORTS.map((c) => {
    const ps = PATIENTS.filter((p) => p.cohort.id === c.id);
    const a = ps.reduce((s, p) => s + adh(p, 0, ST.range), 0) / ps.length;
    const rs = ps.reduce((s, p) => s + rescueSum(p, 0, 7), 0) / ps.length;
    const active =
      ST.cohort === 'all' || (ST.cohort === 'copd') === (c.id === 'copd');
    return `<button class="coh-i ${ST.cohort !== 'all' && active ? 'on' : ''}" data-c="${c.id}" style="${active ? '' : 'opacity:.45'}"><span style="font-size:13px"><i class="sw" style="background:${c.color};${c.id === 'asthma-p' ? 'box-shadow:inset 0 0 0 1px #8DBEF5' : ''}"></i>${c.short}</span><span class="n">${ps.length}</span><small>${pct(a)} adherence</small><small>${rs.toFixed(1)} rescue uses per week</small></button>`;
  }).join('');
  $$('.coh-i', el).forEach(
    (b) =>
      (b.onclick = () => {
        ST.cohort = b.dataset.c === 'copd' ? 'copd' : 'asthma';
        refresh();
      }),
  );
  const tot = PATIENTS.length;
  $('#coh-bar').innerHTML = COHORTS.map(
    (c) =>
      `<span class="${c.hatch}" style="flex-grow:${PATIENTS.filter((p) => p.cohort.id === c.id).length / tot}" title="${c.short}"></span>`,
  ).join('');
  // line chart
  const W = 600,
    H = 150,
    pad = 22;
  const svg = $('#lc');
  if (window.__ADHERIUM_BOOT__.historyDays < 36) {
    svg.innerHTML =
      '<text x="300" y="75" text-anchor="middle" fill="var(--muted)">Loading adherence history…</text>';
    return;
  }
  const series = COHORTS.map((c) => {
    const ps = PATIENTS.filter((p) => p.cohort.id === c.id);
    const daily = Array.from({ length: 36 }, (_, i) => {
      const values = ps
        .map((p) => p.doses[DAYS - 36 + i])
        .filter(Number.isFinite);
      return values.length
        ? values.reduce((sum, value) => sum + value, 0) / (values.length * 2)
        : Number.NaN;
    });
    return {
      c,
      v: Array.from({ length: 30 }, (_, i) => {
        const values = daily.slice(i, i + 7).filter(Number.isFinite);
        return values.length
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : Number.NaN;
      }),
    };
  });
  const all = series.flatMap((s) => s.v).filter(Number.isFinite);
  const lo = all.length ? Math.floor(Math.min(...all) * 20) / 20 : 0;
  const hi = all.length ? Math.ceil(Math.max(...all) * 20) / 20 : 1;
  const top = hi > lo ? hi : lo + 0.05;
  const x = (i) => pad + (i / 29) * (W - pad * 2),
    y = (v) => H - 18 - ((v - lo) / (top - lo)) * (H - 34);
  let s = `<g>${[lo, (lo + top) / 2, top].map((v) => `<line x1="${pad}" x2="${W - pad}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-dasharray="3 5" vector-effect="non-scaling-stroke"/><text x="0" y="${y(v) + 4}">${Math.round(v * 100)}</text>`).join('')}</g>`;
  series.forEach((se) => {
    let hasPoint = false;
    const d = se.v
      .map((v, i) => {
        if (!Number.isFinite(v)) {
          hasPoint = false;
          return '';
        }
        const command = hasPoint ? 'L' : 'M';
        hasPoint = true;
        return command + x(i).toFixed(1) + ',' + y(v).toFixed(1);
      })
      .filter(Boolean)
      .join(' ');
    const dim =
      ST.cohort !== 'all' && (ST.cohort === 'copd') !== (se.c.id === 'copd');
    s += `<path class="ln" d="${d}" fill="none" stroke="${se.c.id === 'asthma-p' ? '#7FB7F7' : se.c.color}" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linejoin="round" opacity="${dim ? 0.18 : 1}"/>`;
  });
  s += `<line id="lc-x" y1="6" y2="${H - 16}" stroke="var(--muted)" stroke-width="1" vector-effect="non-scaling-stroke" opacity="0"/><rect id="lc-hit" x="${pad}" y="0" width="${W - pad * 2}" height="${H}" fill="transparent"/>`;
  svg.innerHTML = s;
  const hit = $('#lc-hit'),
    xl = $('#lc-x');
  hit.addEventListener('pointermove', (e) => {
    const b = svg.getBoundingClientRect();
    const i = clamp(
      Math.round(
        ((((e.clientX - b.left) / b.width) * W - pad) / (W - pad * 2)) * 29,
      ),
      0,
      29,
    );
    xl.setAttribute('x1', x(i));
    xl.setAttribute('x2', x(i));
    xl.setAttribute('opacity', 0.5);
    showTip(
      `<b>${dayLong(29 - i)}</b>${series.map((se) => `${se.c.short}: ${Number.isFinite(se.v[i]) ? pct(se.v[i]) : 'No adherence data'}`).join('<br>')}`,
      e,
    );
  });
  hit.addEventListener('pointerleave', () => {
    xl.setAttribute('opacity', 0);
    hideTip();
  });
  if (animate && !RM)
    $$('.ln', svg).forEach((p, i) => {
      if (!p.getAttribute('d')) return;
      const L = p.getTotalLength();
      safeFromTo(
        p,
        { strokeDasharray: L, strokeDashoffset: L },
        {
          strokeDashoffset: 0,
          duration: 1.4,
          delay: 0.2 + i * 0.12,
          ease: 'power2.inOut',
          clearProps: 'strokeDasharray,strokeDashoffset',
        },
      );
    });
}

/* patient summary drawer */
function openPatient(id) {
  const p = PATIENTS.find((x) => x.id === id);
  if (!p) return;
  hideTip();
  const a7 = adh(p, 0, 7),
    a30 = adh(p, 0, 30);
  openDrawer(`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div><div style="color:var(--muted);font-size:13px">${p.cohort.name}. Synthetic record</div><h2 style="font-size:28px;font-weight:500;margin-top:4px">Patient ${p.id}</h2></div><button class="arrow" data-close aria-label="Close">${ic('x')}</button></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:22px 0">
      <div style="background:var(--bg);border-radius:20px;padding:14px"><small style="color:var(--muted)">Adherence, 7 days</small><div class="big" style="font-size:30px;margin-top:6px">${(a7 * 100).toFixed(0)}<small>%</small></div></div>
      <div style="background:var(--bg);border-radius:20px;padding:14px"><small style="color:var(--muted)">Rescue uses, 7 days</small><div class="big" style="font-size:30px;margin-top:6px">${rescueSum(p, 0, 7)}</div></div></div>
    <b style="font-weight:500;font-size:13.5px">Controller doses, last 14 days</b>
    <div class="dose-row" style="margin:10px 0 6px">${p.doses
      .slice(-14)
      .map(
        (d) =>
          `<i class="${!Number.isFinite(d) ? 'h-off' : d === 2 ? 'h-blue' : d === 1 ? 'h-sky' : 'h-ink'}" title="${Number.isFinite(d) ? d + ' of 2 doses' : 'No record'}"></i>`,
      )
      .join('')}</div>
    <div class="legend" style="margin-bottom:22px"><span><i class="h-blue"></i>Both doses</span><span><i class="h-sky"></i>One dose</span><span><i class="h-ink"></i>Missed</span></div>
    <dl class="kv"><dt>Adherence, 30 days</dt><dd>${pct(a30)}</dd><dt>Smart inhaler</dt><dd>${p.status === 'connected' ? 'Connected' : p.status === 'pending' ? 'Sync pending' : 'Offline'}</dd><dt>Last sync</dt><dd>${fmtAgo(p.lastSync)}</dd><dt>Battery</dt><dd>${p.battery}%</dd><dt>Monitoring status</dt><dd>${onTrack(p) ? 'On track' : p.status === 'offline' ? 'Offline' : 'Needs follow-up'}</dd></dl>
    <div style="display:flex;gap:8px;margin-top:26px;flex-wrap:wrap"><button class="btn-blue" id="pp-open"><span>Open health profile</span><i>${ic('arrow')}</i></button></div>`);
  $('#pp-open').onclick = () => {
    ST.patient = p.id;
    go('patient-profile');
  };
  if (!RM)
    safeFrom($$('.dose-row i'), {
      scale: 0,
      duration: 0.35,
      stagger: 0.025,
      delay: 0.2,
      ease: 'back.out(2)',
    });
}

/* exports and report */
function exportPatients() {
  const P = pool();
  const rows = [
    [
      'patient_id',
      'cohort',
      `adherence_${ST.range}d`,
      'rescue_uses_7d',
      'inhaler_status',
      'last_sync_min',
      'status',
      'data_status',
    ],
  ].concat(
    P.map((p) => [
      p.id,
      p.cohort.name,
      adh(p, 0, ST.range).toFixed(3),
      rescueSum(p, 0, 7),
      p.status,
      p.lastSync,
      onTrack(p)
        ? 'on_track'
        : p.status === 'offline'
          ? 'offline'
          : 'follow_up',
      'synthetic demo',
    ]),
  );
  save(`adherium-patients-${ST.cohort}-${ST.range}d.csv`, csv(rows));
}
function reportData() {
  const P = pool();
  return {
    P,
    a: P.reduce((s, p) => s + adh(p, 0, 7), 0) / P.length,
    on: P.filter(onTrack).length,
    fu: P.filter(followUp).length,
    off: P.filter((p) => p.status === 'offline').length,
    ev: activityEvents().filter((e) => e.kind === 'action').length,
  };
}
function reportPreview() {
  const d = reportData();
  const m =
    openModal(`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div><div style="color:var(--muted);font-size:13px">Week ending ${TODAY.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}. Synthetic demo data</div><h2 style="font-size:26px;font-weight:500;margin-top:4px">Weekly adherence report</h2></div><button class="arrow" data-close aria-label="Close">${ic('x')}</button></div>
    <dl class="kv" style="margin:22px 0"><dt>Patients monitored</dt><dd>${d.P.length}</dd><dt>Controller adherence</dt><dd>${pct(d.a)}</dd><dt>On track</dt><dd>${d.on}</dd><dt>Needs follow-up</dt><dd>${d.fu}</dd><dt>Inhalers offline</dt><dd>${d.off}</dd><dt>Events needing action</dt><dd>${d.ev}</dd></dl>
    <div style="display:flex;justify-content:flex-end"><button class="btn-blue" id="m-dl"><span>Export report</span><i>${ic('export')}</i></button></div>`);
  $('#m-dl', m).onclick = exportReport;
}
function exportReport() {
  const d = reportData();
  save(
    'adherium-weekly-adherence-report.md',
    `# Weekly adherence report\n\nWeek ending ${TODAY.toISOString().slice(0, 10)}. Cohort: ${ST.cohort}. All values are synthetic demo data.\n\n| Measure | Value |\n|---|---|\n| Patients monitored | ${d.P.length} |\n| Controller adherence, 7 days | ${pct(d.a)} |\n| On track | ${d.on} |\n| Needs follow-up | ${d.fu} |\n| Inhalers offline | ${d.off} |\n| Events needing action | ${d.ev} |\n`,
  );
}

/* top bar + role controls */
function renderRoles() {
  $('#roles').innerHTML = Object.entries(ROLES)
    .map(
      ([k, [l]]) =>
        `<button data-r="${k}" class="${ST.role === k ? 'on' : ''}">${l}</button>`,
    )
    .join('');
  $$('#roles button').forEach((b) => (b.onclick = () => setRole(b.dataset.r)));
}
function setRole(k) {
  ST.role = k;
  const [l, a, g] = ROLES[k];
  $('#role-lbl').textContent = l;
  $('#av').textContent = a;
  const gr = $('#greet');
  if (RM) gr.innerHTML = g;
  else
    gsap.to(gr, {
      opacity: 0,
      y: -6,
      duration: 0.18,
      onComplete: () => {
        gr.innerHTML = g;
        gsap.to(gr, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' });
      },
    });
  renderRoles();
  toast('Viewing as ' + l);
}
$('#acct').onclick = (e) =>
  menu(
    e.currentTarget,
    'Viewing as',
    [
      ...Object.entries(ROLES).map(([k, [l]]) => [k, l]),
      ['__out', 'Log out'],
    ],
    ST.role,
    (value) => {
      if (value === '__out') void window.__ADHERIUM_LOGOUT__?.();
      else setRole(value);
    },
  );
$('#settings').onclick = (e) =>
  menu(
    e.currentTarget,
    'Settings',
    [
      ['light', 'Light theme'],
      ['dark', 'Dark theme'],
    ],
    document.documentElement.dataset.theme,
    (v) => {
      document.documentElement.dataset.theme = v;
      toast(v === 'dark' ? 'Dark theme on' : 'Light theme on');
    },
  );
$('#bell').onclick = (e) => {
  const b = $('#bell .badge');
  b && b.remove();
  const ev = activityEvents()
    .filter((x) => x.kind === 'action')
    .slice(0, 4);
  menu(
    e.currentTarget,
    'Needs action',
    ev.map((x) => [x.p.id, x.title]),
    null,
    (id) => openPatient(id),
  );
};
$('#mnav').onclick = () => {
  $('#side').classList.add('open');
  scrim.classList.add('on');
};
addEventListener('resize', placePill);

$('#greet').innerHTML = ROLES.provider[2];
window.__ADHERIUM_REFRESH_OVERVIEW__ = () => {
  if (ST.page === 'dashboard') renderDashboard(false);
};
document.fonts && document.fonts.ready.then(placePill);
