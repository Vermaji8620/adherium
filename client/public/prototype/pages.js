/* ======================= persisted demo state ======================= */
const DB = window.__ADHERIUM_BOOT__.db;
function persist() {}
function audit() {
  window.__ADHERIUM_REFRESH_AUDIT__?.();
}

/* ======================= derived helpers ======================= */
const PT = (id) => PATIENTS.find((p) => p.id === id);
const statusOf = (p) =>
  onTrack(p) ? 'on' : p.status === 'offline' ? 'off' : 'fu';
const STATUS = {
  on: ['On track', '#087BFF'],
  fu: ['Needs follow-up', '#7FB7F7'],
  off: ['Offline', '#BDBDBD'],
};
const DEV = {
  connected: ['Connected', '#087BFF'],
  pending: ['Sync pending', '#8A8A8A'],
  offline: ['Offline', '#D0D0D0'],
};
const stTag = (p) => {
  const [l, c] = STATUS[statusOf(p)];
  return `<span class="st" style="--c:${c}">${l}</span>`;
};
const devTag = (p) => {
  const [l, c] = DEV[p.status];
  return `<span class="st" style="--c:${c}">${l}</span>`;
};
const doseDots = (p, n = 14) =>
  `<span class="dd">${p.doses
    .slice(-n)
    .map(
      (d) =>
        `<i class="${!Number.isFinite(d) ? 'h-off' : d === 2 ? 'h-blue' : d === 1 ? 'h-sky' : 'h-ink'}"></i>`,
    )
    .join('')}</span>`;
function ringSVG(v, size = 120, sw = 12, col = '#087BFF', label = '') {
  const r = (size - sw) / 2,
    c = 2 * Math.PI * r;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--off)" stroke-width="${sw}"/><circle class="fg" data-v="${v}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}
function animateUI(root = $('#work')) {
  requestAnimationFrame(() => {
    $$('.ring .fg', root).forEach((c) => {
      const r = +c.getAttribute('r');
      c.style.strokeDashoffset = 2 * Math.PI * r * (1 - c.dataset.v);
    });
    $$('.hbar i', root).forEach((i) => (i.style.width = i.dataset.w + '%'));
  });
  $$('[data-count]', root).forEach((el) => {
    const to = +el.dataset.count,
      dec = +(el.dataset.dec || 0);
    if (RM) {
      el.textContent = to.toFixed(dec);
      return;
    }
    const o = { v: 0 };
    gsap.to(o, {
      v: to,
      duration: 1.2,
      ease: 'power3.out',
      onUpdate: () => (el.textContent = o.v.toFixed(dec)),
    });
  });
  if (!RM)
    safeFrom(
      $$(
        ':scope > .whead > *, :scope > .kpis > *, :scope > .toolbar, :scope > .grid > *, :scope > .split > *',
        root,
      ),
      {
        y: 12,
        opacity: 0,
        duration: 0.55,
        stagger: 0.04,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      },
    );
}
const head = (title, crumb, ctrls = '') =>
  `<div class="whead"><div><h1>${title}</h1><div class="crumb">Overview ${ic('right')} ${crumb}</div></div><div class="ctrls"><span class="demo">● Synthetic demo data</span>${ctrls}</div></div>`;
const rangeBtn = () =>
  `<button class="cbtn" id="pg-range">${{ 7: 'Last 7 days', 14: 'Last 14 days', 30: 'Last 30 days' }[ST.range]}<span class="cic">${ic('down')}</span></button>`;
function bindRange(cb) {
  const b = $('#pg-range');
  if (b)
    b.onclick = (e) =>
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
          skeleton(cb);
        },
      );
}
function skeleton(cb) {
  const w = $('#work');
  const h = w.offsetHeight;
  w.innerHTML = `<div class="sk" style="height:60px;margin-bottom:16px"></div><div class="grid"><div class="sk c8" style="height:${Math.min(360, h / 2)}px"></div><div class="sk c4" style="height:${Math.min(360, h / 2)}px"></div></div>`;
  setTimeout(cb, RM ? 0 : 320);
}
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtRel = (iso) => {
  const m = Math.round((Date.now() - new Date(iso)) / 6e4);
  return m < 1 ? 'Just now' : fmtAgo(m);
};
function rescueHours(p, days) {
  const from = Date.now() - days * 86400000;
  return window.__ADHERIUM_BOOT__.events
    .filter(
      (event) =>
        event.patientId === p.id &&
        event.type === 'rescue-use' &&
        new Date(event.occurredAt).getTime() >= from,
    )
    .map((event) => event.hour ?? new Date(event.occurredAt).getHours());
}

/* ======================= alerts model ======================= */
function buildAlerts() {
  return window.__ADHERIUM_BOOT__.alerts;
}
function setAlert(a, patch, msg) {
  const api = window.__ADHERIUM_API__;
  const request =
    patch.status === 'ack'
      ? api('/alerts/' + encodeURIComponent(a.id) + '/acknowledge', {
          method: 'POST',
          body: { role: patch.by },
        })
      : api('/alerts/' + encodeURIComponent(a.id), {
          method: 'PATCH',
          body: {
            status: patch.status,
            assignedTo: patch.status === 'assigned' ? patch.by : undefined,
            role: ROLES[ST.role][0],
          },
        });
  return request
    .then(({ item }) => {
      a.status = item.status;
      a.by = item.assignedTo || item.acknowledgedBy || null;
      a.mins = Math.max(
        0,
        Math.round(
          (Date.now() - new Date(item.createdAt || Date.now()).getTime()) /
            60000,
        ),
      );
      DB.alerts[a.id] = {
        status: a.status,
        by: a.by,
        at: item.acknowledgedAt || item.createdAt,
      };
      audit(msg);
      return item;
    })
    .catch((error) => {
      window.__ADHERIUM_SHOW_ERROR__?.(error);
      throw error;
    });
}

const PAGES = { dashboard: () => renderDashboard(true) };

/* ======================= 2. Patient monitoring ======================= */
let PM = { q: '', st: 'all', coh: 'all', sort: 'risk', limit: 24 };
PAGES.patients = () => {
  const w = $('#work');
  const base = PATIENTS.filter(
    (p) => PM.coh === 'all' || (PM.coh === 'copd') === (p.cohort.id === 'copd'),
  );
  const counts = {
    all: base.length,
    on: base.filter((p) => statusOf(p) === 'on').length,
    fu: base.filter((p) => statusOf(p) === 'fu').length,
    off: base.filter((p) => statusOf(p) === 'off').length,
  };
  w.innerHTML =
    head(
      'Patient Monitoring',
      'Patients',
      `${rangeBtn()}<button class="cbtn" id="pm-exp">Export<span class="cic">${ic('export')}</span></button>`,
    ) +
    `
    <div class="toolbar"><div class="search">${ic('pulse')}<input id="pm-q" placeholder="Search by patient ID, for example PT-042" value="${PM.q}" aria-label="Search patients"></div>
      <div class="chipset" id="pm-st">${[
        ['all', 'All'],
        ['fu', 'Needs follow-up'],
        ['on', 'On track'],
        ['off', 'Offline'],
      ]
        .map(
          ([k, l]) =>
            `<button class="chip ${PM.st === k ? 'on' : ''}" data-k="${k}">${l}<span class="ct">${counts[k]}</span></button>`,
        )
        .join('')}</div>
      <select class="sel" id="pm-coh" aria-label="Cohort"><option value="all">All cohorts</option><option value="asthma" ${PM.coh === 'asthma' ? 'selected' : ''}>Asthma</option><option value="copd" ${PM.coh === 'copd' ? 'selected' : ''}>COPD</option></select>
      <select class="sel" id="pm-sort" aria-label="Sort"><option value="risk">Sort by need</option><option value="adh" ${PM.sort === 'adh' ? 'selected' : ''}>Lowest adherence</option><option value="rescue" ${PM.sort === 'rescue' ? 'selected' : ''}>Most rescue use</option><option value="id" ${PM.sort === 'id' ? 'selected' : ''}>Patient ID</option></select></div>
    <div class="split"><section class="card" style="padding:16px 14px"><table class="rt"><thead><tr><th>Patient</th><th>Cohort</th><th>Last 14 days</th><th class="r">Adherence</th><th class="r">Rescue, 7d</th><th>Inhaler</th><th>Status</th></tr></thead><tbody id="pm-body"></tbody></table><div id="pm-more"></div></section>
    <aside class="card dark sticky" id="pm-side"></aside></div>`;
  function rows() {
    let r = base.filter(
      (p) =>
        (PM.st === 'all' || statusOf(p) === PM.st) &&
        (!PM.q || p.id.toLowerCase().includes(PM.q.toLowerCase().trim())),
    );
    const need = (p) =>
      (1 - adh(p, 0, ST.range)) * 2 +
      rescueSum(p, 0, 7) * 0.15 +
      (p.status === 'offline' ? 0.6 : 0);
    r.sort(
      PM.sort === 'adh'
        ? (a, b) => adh(a, 0, ST.range) - adh(b, 0, ST.range)
        : PM.sort === 'rescue'
          ? (a, b) => rescueSum(b, 0, 7) - rescueSum(a, 0, 7)
          : PM.sort === 'id'
            ? (a, b) => a.id.localeCompare(b.id)
            : (a, b) => need(b) - need(a),
    );
    return r;
  }
  function draw(anim) {
    const r = rows();
    const show = r.slice(0, PM.limit);
    $('#pm-body').innerHTML = show.length
      ? show
          .map(
            (p) =>
              `<tr data-id="${p.id}"><td class="pri" data-l="Patient"><b style="font-weight:600">${p.id}</b></td><td data-l="Cohort">${p.cohort.short}</td><td data-l="Last 14 days">${doseDots(p)}</td><td class="r" data-l="Adherence"><b style="font-weight:600">${(adh(p, 0, ST.range) * 100).toFixed(0)}%</b></td><td class="r" data-l="Rescue, 7d">${rescueSum(p, 0, 7)}</td><td data-l="Inhaler">${devTag(p)}</td><td data-l="Status">${stTag(p)}</td></tr>`,
          )
          .join('')
      : `<tr><td colspan="7" style="background:none"><div class="empty"><b>No patients match</b>Clear the search or choose a different status.</div></td></tr>`;
    $('#pm-more').innerHTML =
      r.length > PM.limit
        ? `<button class="btn more" id="pm-m">Show more (${r.length - PM.limit} remaining)</button>`
        : `<div class="k" style="text-align:center;margin-top:10px">${r.length} patients shown</div>`;
    const m = $('#pm-m');
    if (m)
      m.onclick = () => {
        PM.limit += 24;
        draw();
      };
    $$('#pm-body tr[data-id]').forEach(
      (tr) =>
        (tr.onclick = () => {
          ST.patient = tr.dataset.id;
          go('patient-profile');
        }),
    );
    if (anim && !RM)
      safeFrom($$('#pm-body tr'), {
        opacity: 0,
        y: 6,
        duration: 0.3,
        stagger: 0.012,
        ease: 'power2.out',
        clearProps: 'all',
      });
    const fu = base.filter((p) => statusOf(p) === 'fu');
    $('#pm-side').innerHTML =
      `<h2>Follow-up <b>today</b></h2><p style="color:#BDBDBD;font-size:13px;margin:6px 0 16px">${fu.length} patients are below the 80% adherence target or using rescue inhalers more than usual.</p>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">${ringSVG(counts.on / counts.all, 96, 10, '#087BFF', 'Share on track')}<div><div class="big" style="color:#fff">${Math.round((counts.on / counts.all) * 100)}<small style="color:#BDBDBD">%</small></div><small style="color:#BDBDBD">on track</small></div></div>
      ${fu
        .slice(0, 5)
        .map(
          (p) =>
            `<button class="ev" data-id="${p.id}" style="--c:#7FB7F7;color:#fff"><b>${p.id}</b><span class="t" style="color:#9A9A9A">${(adh(p, 0, ST.range) * 100).toFixed(0)}%</span><small style="color:#9A9A9A">${p.cohort.short}. ${rescueSum(p, 0, 7)} rescue uses this week</small></button>`,
        )
        .join('')}
      <button class="btn-blue" id="pm-al" style="margin-top:12px"><span>Open alerts</span><i>${ic('arrow')}</i></button>`;
    $$('#pm-side [data-id]').forEach(
      (b) =>
        (b.onclick = () => {
          ST.patient = b.dataset.id;
          go('patient-profile');
        }),
    );
    $('#pm-al').onclick = () => go('alerts');
    animateUI($('#pm-side'));
  }
  $('#pm-q').oninput = (e) => {
    PM.q = e.target.value;
    PM.limit = 24;
    draw();
  };
  $$('#pm-st .chip').forEach(
    (c) =>
      (c.onclick = () => {
        PM.st = c.dataset.k;
        PM.limit = 24;
        $$('#pm-st .chip').forEach((x) => x.classList.toggle('on', x === c));
        draw(true);
      }),
  );
  $('#pm-coh').onchange = (e) => {
    PM.coh = e.target.value;
    PAGES.patients();
  };
  $('#pm-sort').onchange = (e) => {
    PM.sort = e.target.value;
    draw(true);
  };
  $('#pm-exp').onclick = () =>
    save(
      `adherium-patients-${PM.st}.csv`,
      csv([
        [
          'patient_id',
          'cohort',
          `adherence_${ST.range}d`,
          'rescue_7d',
          'inhaler',
          'status',
          'data_status',
        ],
        ...rows().map((p) => [
          p.id,
          p.cohort.name,
          adh(p, 0, ST.range).toFixed(3),
          rescueSum(p, 0, 7),
          p.status,
          STATUS[statusOf(p)][0],
          'synthetic demo',
        ]),
      ]),
    );
  bindRange(PAGES.patients);
  draw(true);
  animateUI();
};

/* ======================= 3. Patient health profile ======================= */
PAGES['patient-profile'] = () => {
  const p = PT(ST.patient) || PATIENTS[0];
  ST.patient = p.id;
  const w = $('#work');
  const a7 = adh(p, 0, 7),
    a30 = adh(p, 0, 30),
    r30 = rescueSum(p, 0, 30),
    sfd = null;
  const alerts = buildAlerts().filter((a) => a.p === p && a.status !== 'ack');
  const notes = DB.notes.filter((n) => n.pt === p.id);
  w.innerHTML =
    head(
      `Patient ${p.id}`,
      'Patient Health Profile',
      `<div class="picker"><div class="search" style="min-width:220px">${ic('user')}<input id="pp-q" placeholder="Switch patient" aria-label="Find a patient" autocomplete="off"></div><div class="picker-r" id="pp-r"></div></div><button class="cbtn" id="pp-exp">Export<span class="cic">${ic('export')}</span></button>`,
    ) +
    `
    <div class="kpis"><div class="kpi dk"><span class="k">Cohort</span><b style="font-size:22px">${p.cohort.name}</b></div><div class="kpi"><span class="k">Adherence, 30 days</span><b><span data-count="${(a30 * 100).toFixed(1)}" data-dec="1">0</span><small>%</small></b></div><div class="kpi"><span class="k">Rescue uses, 30 days</span><b data-count="${r30}">0</b></div><div class="kpi bl"><span class="k">Symptom-free days</span><b>—<small style="color:#D5E7FF">unavailable</small></b></div></div>
    <div class="grid">
      <section class="card c8"><div class="card-h"><div><h2>Dose calendar</h2><div class="k">Each circle is one day. Left half is the morning dose, right half the evening dose</div></div><div class="legend"><span><i class="h-blue"></i>Taken</span><span><i class="h-ink"></i>Missed</span></div></div>
        <div class="cal" id="pp-cal"></div></section>
      <section class="card c4" style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px"><div class="card-h" style="width:100%"><h2>This week</h2>${stTag(p)}</div>
        <div style="position:relative">${ringSVG(a7, 170, 16, '#087BFF', 'Adherence this week')}<div style="position:absolute;inset:0;display:grid;place-items:center"><div><div class="big">${(a7 * 100).toFixed(0)}<small>%</small></div><div class="k">controller doses</div></div></div></div>
        <div class="k" style="max-width:28ch">${a7 >= 0.8 ? 'At or above the 80% target.' : 'Below the 80% target. Consider a reminder or a call.'}</div></section>
      <section class="card c8"><div class="card-h"><div><h2>Rescue inhaler timeline</h2><div class="k">Time of day for each use over the last 14 days</div></div></div><svg id="pp-tl" viewBox="0 0 700 220" style="width:100%;height:auto;display:block" role="img" aria-label="Rescue use by time of day"></svg></section>
      <section class="card dark c4" id="pp-dev"></section>
      <section class="card c6"><div class="card-h"><h2>Open alerts</h2><span class="tag ${alerts.length ? 'gray' : ''}">${alerts.length} open</span></div><div id="pp-al">${alerts.length ? '' : '<div class="empty"><b>No open alerts</b>This patient has nothing waiting for follow-up.</div>'}</div></section>
      <section class="card c6"><div class="card-h"><h2>Care notes</h2><button class="btn dk" id="pp-note">Add note</button></div><div id="pp-notes">${notes.length ? notes.map(noteHTML).join('') : '<div class="empty"><b>No notes yet</b>Add a note to record a call, review or device support.</div>'}</div></section>
    </div>`;
  // calendar: last 35 days aligned to weekdays
  const cal = $('#pp-cal');
  const start = new Date(TODAY.getTime() - 34 * 864e5);
  const lead = (start.getDay() + 6) % 7;
  cal.innerHTML =
    ['M', 'T', 'W', 'T', 'F', 'S', 'S']
      .map((d) => `<span class="wd">${d}</span>`)
      .join('') +
    Array(lead).fill('<span class="cday empty"></span>').join('') +
    Array.from({ length: 35 }, (_, i) => {
      const off = 34 - i;
      const d = p.doses[DAYS - 1 - off];
      const am = d >= 1,
        pm = d === 2;
      const recorded = Number.isFinite(d);
      const date = new Date(TODAY.getTime() - off * 864e5);
      return `<button class="half" data-off="${off}" aria-label="${dayLong(off)}: ${recorded ? d + ' of 2 doses' : 'no record'}"><i class="${recorded ? (am ? 'h-blue' : 'h-ink') : 'h-off'}"></i><i class="${recorded ? (pm ? 'h-blue' : 'h-ink') : 'h-off'}"></i></button>`;
    }).join('');
  $$('.half', cal).forEach((b) => {
    const off = +b.dataset.off;
    bindTip(
      b,
      `<b>${dayLong(off)}</b>${Number.isFinite(p.doses[DAYS - 1 - off]) ? p.doses[DAYS - 1 - off] + ' of 2 controller doses' : 'No adherence record'}. ${Number.isFinite(p.rescue[DAYS - 1 - off]) ? p.rescue[DAYS - 1 - off] + ' rescue uses' : 'No rescue-use record'}`,
    );
  });
  if (!RM)
    safeFrom($$('.half', cal), {
      scale: 0,
      duration: 0.4,
      stagger: 0.012,
      ease: 'back.out(1.8)',
      clearProps: 'transform',
    });
  // rescue timeline: x = hour of day, rows = days
  const tl = $('#pp-tl');
  const events =
    window.__ADHERIUM_PROFILE__?.patientId === p.id
      ? window.__ADHERIUM_PROFILE__.events.filter(
          (event) => event.type === 'rescue-use',
        )
      : [];
  let svg = '';
  for (let h = 0; h <= 24; h += 6) {
    const x = 40 + (h / 24) * 640;
    svg += `<line x1="${x}" x2="${x}" y1="10" y2="196" stroke="var(--line)" stroke-dasharray="3 5"/><text x="${x}" y="214" text-anchor="middle" font-size="11" fill="var(--muted)">${h === 24 ? '24:00' : String(h).padStart(2, '0') + ':00'}</text>`;
  }
  for (let d = 0; d < 14; d++) {
    const y = 18 + d * 13;
    svg += `<text x="0" y="${y + 4}" font-size="10" fill="var(--muted)">${d === 0 ? 'Today' : d === 13 ? '13 d' : ''}</text><line x1="40" x2="680" y1="${y}" y2="${y}" stroke="var(--off)"/>`;
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - d);
    const key = date.toISOString().slice(0, 10);
    for (const event of events.filter(
      (item) => String(item.occurredAt).slice(0, 10) === key,
    )) {
      const hr = event.hour ?? new Date(event.occurredAt).getHours();
      svg += `<circle class="tld" cx="${40 + (hr / 24) * 640}" cy="${y}" r="5.5" fill="${hr < 6 ? '#111' : '#087BFF'}"><title>${dayLong(d)}, ${String(Math.floor(hr)).padStart(2, '0')}:${String(Math.floor((hr % 1) * 60)).padStart(2, '0')}</title></circle>`;
    }
  }
  tl.innerHTML =
    svg +
    (r30
      ? ''
      : `<text x="360" y="110" text-anchor="middle" fill="var(--muted)" font-size="13">No rescue inhaler use in this period</text>`);
  const timelineDots = $$('.tld', tl);
  if (!RM && timelineDots.length)
    safeFrom(timelineDots, {
      attr: { r: 0 },
      duration: 0.4,
      stagger: 0.03,
      ease: 'back.out(2)',
    });
  drawDeviceCard($('#pp-dev'), p);
  // alerts
  const al = $('#pp-al');
  alerts.forEach((a) => {
    const el = document.createElement('div');
    el.innerHTML = alertHTML(a, true);
    al.appendChild(el.firstElementChild);
  });
  $$('#pp-al [data-ack]').forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        const a = alerts.find((x) => x.id === b.dataset.ack);
        setAlert(
          a,
          { status: 'ack', by: ROLES[ST.role][0] },
          `Acknowledged ${a.kind.toLowerCase()} for ${p.id}`,
        )
          .then(() => {
            const row = b.closest('.alert');
            gsap.to(row, {
              opacity: 0,
              height: 0,
              marginBottom: 0,
              padding: 0,
              duration: RM ? 0 : 0.35,
              onComplete: () => row.remove(),
            });
            toast('Alert acknowledged');
          })
          .catch(() => {});
      }),
  );
  $('#pp-note').onclick = () =>
    noteModal(p.id, () => PAGES['patient-profile']());
  $('#pp-exp').onclick = () =>
    save(
      `adherium-${p.id}.csv`,
      csv([
        ['date', 'controller_doses_taken', 'rescue_uses', 'data_status'],
        ...Array.from({ length: 30 }, (_, d) => [
          new Date(TODAY.getTime() - d * 864e5).toISOString().slice(0, 10),
          p.doses[DAYS - 1 - d],
          p.rescue[DAYS - 1 - d],
          'synthetic demo',
        ]),
      ]),
    );
  const q = $('#pp-q'),
    rr = $('#pp-r');
  q.oninput = () => {
    const s = q.value.trim().toUpperCase();
    const hits = PATIENTS.filter((x) =>
      x.id.includes(s.replace(/^(\d)/, 'PT-$1')),
    ).slice(0, 8);
    rr.innerHTML =
      hits
        .map(
          (x) =>
            `<button data-id="${x.id}"><b style="font-weight:500">${x.id}</b><span class="k">${x.cohort.short}</span></button>`,
        )
        .join('') ||
      '<div class="k" style="padding:10px">No patient with that ID</div>';
    rr.classList.toggle('open', !!s);
    $$('[data-id]', rr).forEach(
      (b) =>
        (b.onclick = () => {
          ST.patient = b.dataset.id;
          go('patient-profile');
        }),
    );
  };
  q.onblur = () => setTimeout(() => rr.classList.remove('open'), 150);
  animateUI();
};

/* device card + illustration (shared by profile and devices) */
function inhalerSVG(id) {
  return `<svg class="device-ill" viewBox="0 0 220 200" aria-hidden="true"><g class="bt" transform="translate(150 40)"><path d="M0 18a18 18 0 0 1 18-18"/><path d="M-8 26a28 28 0 0 1 34-34" transform="translate(0 -2)"/><path d="M-16 34a40 40 0 0 1 50-50" transform="translate(0 -4)"/></g>
    <rect x="70" y="20" width="56" height="96" rx="16" fill="#2A2A2A"/><rect x="70" y="20" width="56" height="30" rx="14" fill="#087BFF"/><circle cx="98" cy="35" r="5" fill="#fff" class="led"/>
    <path d="M62 112h72l10 46a12 12 0 0 1-12 14H64a12 12 0 0 1-12-14z" fill="#3A3A3A"/><rect x="82" y="168" width="40" height="18" rx="6" fill="#1E1E1E"/><text x="98" y="138" text-anchor="middle" font-size="11" fill="#9A9A9A" font-family="Onest,sans-serif">${id}</text></svg>`;
}
function drawDeviceCard(el, p) {
  el.innerHTML = `<div class="card-h"><h2>Smart <b>inhaler</b></h2>${devTag(p).replace('class="st"', 'class="st" style="color:#fff"')}</div><div id="dc-ill">${inhalerSVG(p.id)}</div>
    <dl class="kv" style="color:#fff;margin-top:6px"><dt style="color:#9A9A9A">Last sync</dt><dd id="dc-sync">${fmtAgo(p.lastSync)}</dd><dt style="color:#9A9A9A">Sensor battery</dt><dd>${p.battery}%</dd></dl>
    <div class="progress" style="margin:16px 0 6px;opacity:0" id="dc-pr"><i></i></div><div class="k" id="dc-msg" style="color:#9A9A9A;min-height:18px"></div>
    <button class="btn-blue" id="dc-sync-btn"><span>Request sync</span><i>${ic('arrow')}</i></button>`;
  $('#dc-sync-btn', el).onclick = () =>
    runSync(p, el, () => {
      $('#dc-sync', el).textContent = 'Just now';
    });
}
function runSync(p, el, done) {
  const ill = $('.device-ill', el),
    pr = $('.progress', el),
    bar = $('.progress i', el),
    msg = $('[id$="msg"]', el),
    btn = $('.btn-blue', el);
  ill.classList.add('syncing');
  pr.style.opacity = 1;
  btn.disabled = true;
  msg.textContent = 'Recording simulated sync request';
  gsap.to(bar, {
    width: '100%',
    duration: RM ? 0.01 : 0.6,
    onComplete: () =>
      window
        .__ADHERIUM_API__('/devices/' + encodeURIComponent(p.id) + '/sync', {
          method: 'POST',
          body: {},
        })
        .then((result) => {
          ill.classList.remove('syncing');
          btn.disabled = false;
          msg.textContent = result.message;
          audit();
          done && done();
          toast('Simulated sync request recorded');
        })
        .catch((error) => {
          ill.classList.remove('syncing');
          btn.disabled = false;
          msg.textContent = error.message;
          window.__ADHERIUM_SHOW_ERROR__?.(error);
        }),
  });
}

/* ======================= 4. Smart inhaler devices ======================= */
let DV = { f: 'all', sel: null };
PAGES.devices = () => {
  const w = $('#work');
  const c = {
    connected: PATIENTS.filter((p) => p.status === 'connected').length,
    pending: PATIENTS.filter((p) => p.status === 'pending').length,
    offline: PATIENTS.filter((p) => p.status === 'offline').length,
    low: PATIENTS.filter((p) => p.battery < 26).length,
  };
  w.innerHTML =
    head(
      'Smart Inhaler Devices',
      'Devices',
      `<button class="cbtn" id="dv-exp">Export<span class="cic">${ic('export')}</span></button>`,
    ) +
    `
    <div class="grid" style="margin-bottom:16px">
      <section class="card dark c5" id="dv-hero"><div class="card-h"><h2>Fleet <b>sync</b></h2><span class="k" style="color:#9A9A9A">${PATIENTS.length} sensors</span></div>${inhalerSVG('Fleet')}
        <div class="progress" style="margin:12px 0 6px;opacity:0"><i></i></div><div class="k" id="dv-msg" style="color:#9A9A9A;min-height:18px">Request a sync for every inhaler that is pending or offline.</div>
        <button class="btn-blue" id="dv-all" style="margin-top:6px"><span>Sync pending devices</span><i>${ic('arrow')}</i></button></section>
      <section class="card c7"><div class="card-h"><h2>Connection status</h2></div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">${[
          ['connected', 'Connected', '#087BFF'],
          ['pending', 'Sync pending', '#8A8A8A'],
          ['offline', 'Offline', '#D0D0D0'],
          ['low', 'Battery under 25%', '#111'],
        ]
          .map(
            ([k, l, col]) =>
              `<div><div class="k">${l}</div><div class="big" style="font-size:32px;margin-top:6px" data-count="${c[k]}">0</div><div class="hbar" style="margin-top:10px"><i data-w="${(c[k] / PATIENTS.length) * 100}" style="background:${col}"></i></div></div>`,
          )
          .join('')}</div>
        <div class="k" style="margin-bottom:8px">Hours since last sync, all sensors</div><div class="bars" id="dv-hist" style="height:130px;gap:6px"></div></section></div>
    <div class="toolbar"><div class="chipset" id="dv-f">${[
      ['all', 'All devices'],
      ['connected', 'Connected'],
      ['pending', 'Sync pending'],
      ['offline', 'Offline'],
      ['low', 'Low battery'],
    ]
      .map(
        ([k, l]) =>
          `<button class="chip ${DV.f === k ? 'on' : ''}" data-k="${k}">${l}</button>`,
      )
      .join('')}</div></div>
    <div class="split"><section class="card"><div class="dev-grid" id="dv-grid"></div><div id="dv-more"></div></section><aside class="card dark sticky" id="dv-side"></aside></div>`;
  // last-sync histogram
  const bins = [
    [0, 1, '<1h'],
    [1, 6, '1–6h'],
    [6, 24, '6–24h'],
    [24, 72, '1–3d'],
    [72, 168, '3–7d'],
    [168, 1e9, '>7d'],
  ];
  const bc = bins.map(
    ([a, b]) =>
      PATIENTS.filter((p) => p.lastSync / 60 >= a && p.lastSync / 60 < b)
        .length,
  );
  const mx = Math.max(...bc);
  $('#dv-hist').innerHTML = bins
    .map(
      (b, i) =>
        `<div class="bar ${i < 2 ? 'h-blue' : i < 3 ? 'h-sky' : 'h-ink'}" style="height:${Math.max(8, (bc[i] / mx) * 100)}%;border-radius:12px"><span class="bl">${bc[i]}</span><span class="wk">${b[2]}</span></div>`,
    )
    .join('');
  if (!RM)
    safeFrom($$('#dv-hist .bar'), {
      scaleY: 0,
      duration: 0.8,
      stagger: 0.06,
      ease: 'power3.out',
      clearProps: 'transform',
    });
  let limit = 30;
  function list() {
    return PATIENTS.filter(
      (p) =>
        DV.f === 'all' || (DV.f === 'low' ? p.battery < 26 : p.status === DV.f),
    );
  }
  function grid(anim) {
    const L = list();
    $('#dv-grid').innerHTML =
      L.slice(0, limit)
        .map(
          (p) =>
            `<button class="dev ${DV.sel === p.id ? 'on' : ''}" data-id="${p.id}">${devTag(p)}<b>${p.id}</b><small>${p.cohort.short}. Synced ${fmtAgo(p.lastSync)}</small><div class="batt"><span><i style="width:${p.battery}%;background:${p.battery < 26 ? '#111' : '#087BFF'}"></i></span>${p.battery}%</div></button>`,
        )
        .join('') ||
      '<div class="empty"><b>No devices in this group</b>Choose another filter.</div>';
    $('#dv-more').innerHTML =
      L.length > limit
        ? `<button class="btn more" id="dv-m">Show more (${L.length - limit})</button>`
        : '';
    const m = $('#dv-m');
    if (m)
      m.onclick = () => {
        limit += 30;
        grid();
      };
    $$('#dv-grid .dev').forEach(
      (b) =>
        (b.onclick = () => {
          DV.sel = b.dataset.id;
          $$('#dv-grid .dev').forEach((x) => x.classList.toggle('on', x === b));
          side();
        }),
    );
    if (anim && !RM)
      safeFrom($$('#dv-grid .dev'), {
        opacity: 0,
        y: 8,
        duration: 0.35,
        stagger: 0.012,
        clearProps: 'all',
      });
  }
  function side() {
    const p = PT(DV.sel) || list()[0] || PATIENTS[0];
    DV.sel = p.id;
    drawDeviceCard($('#dv-side'), p);
    const b = document.createElement('button');
    b.className = 'btn';
    b.style.cssText =
      'margin-top:10px;width:100%;background:#2A2A2A;color:#fff';
    b.textContent = 'Open patient profile';
    b.onclick = () => {
      ST.patient = p.id;
      go('patient-profile');
    };
    $('#dv-side').appendChild(b);
    const orig = $('#dc-sync-btn', $('#dv-side'));
    orig.onclick = () =>
      runSync(p, $('#dv-side'), () => {
        grid();
      });
  }
  $$('#dv-f .chip').forEach(
    (c) =>
      (c.onclick = () => {
        DV.f = c.dataset.k;
        limit = 30;
        $$('#dv-f .chip').forEach((x) => x.classList.toggle('on', x === c));
        grid(true);
        side();
      }),
  );
  $('#dv-all').onclick = (e) => {
    const button = e.currentTarget;
    button.disabled = true;
    const hero = $('#dv-hero');
    $('.progress', hero).style.opacity = 1;
    $('.device-ill', hero).classList.add('syncing');
    $('#dv-msg').textContent = 'Recording simulated fleet sync request';
    gsap.to($('.progress i', hero), {
      width: '100%',
      duration: RM ? 0.01 : 0.6,
      onComplete: () =>
        window
          .__ADHERIUM_API__('/devices/sync', { method: 'POST', body: {} })
          .then((result) => {
            button.disabled = false;
            $('.device-ill', hero).classList.remove('syncing');
            $('#dv-msg').textContent = result.message;
            audit();
            toast(result.message);
          })
          .catch((error) => {
            button.disabled = false;
            $('.device-ill', hero).classList.remove('syncing');
            $('#dv-msg').textContent = error.message;
            window.__ADHERIUM_SHOW_ERROR__?.(error);
          }),
    });
  };
  $('#dv-exp').onclick = () =>
    save(
      'adherium-devices.csv',
      csv([
        ['patient_id', 'status', 'last_sync_min', 'battery_pct', 'data_status'],
        ...PATIENTS.map((p) => [
          p.id,
          p.status,
          p.lastSync,
          p.battery,
          'synthetic demo',
        ]),
      ]),
    );
  grid(true);
  side();
  animateUI();
};

/* ======================= 5. Medication adherence ======================= */
let MA = { coh: 'all', sel: 0 };
PAGES['medication-adherence'] = () => {
  const w = $('#work');
  const P = PATIENTS.filter(
    (p) => MA.coh === 'all' || (MA.coh === 'copd') === (p.cohort.id === 'copd'),
  );
  const dayRate = (off) => {
    const values = P.map((p) => p.doses[DAYS - 1 - off]).filter(
      Number.isFinite,
    );
    return values.length
      ? values.reduce((a, value) => a + value, 0) / (values.length * 2)
      : 0;
  };
  const observedDays = P.reduce(
    (total, p) =>
      total + p.doses.slice(-ST.range).filter(Number.isFinite).length,
    0,
  );
  const amTaken = P.reduce(
    (total, p) =>
      total +
      p.doses
        .slice(-ST.range)
        .filter((value) => Number.isFinite(value) && value >= 1).length,
    0,
  );
  const pmTaken = P.reduce(
    (total, p) =>
      total + p.doses.slice(-ST.range).filter((value) => value === 2).length,
    0,
  );
  const am = observedDays ? amTaken / observedDays : 0;
  const pm = observedDays ? pmTaken / observedDays : 0;
  const overall = P.reduce((a, p) => a + adh(p, 0, ST.range), 0) / P.length;
  const bands = [
    [0, 0.5, 'Under 50%'],
    [0.5, 0.7, '50–69%'],
    [0.7, 0.8, '70–79%'],
    [0.8, 0.9, '80–89%'],
    [0.9, 1.01, '90% +'],
  ];
  const bc = bands.map(
    ([a, b]) =>
      P.filter((p) => {
        const v = adh(p, 0, ST.range);
        return v >= a && v < b;
      }).length,
  );
  w.innerHTML =
    head(
      'Medication Adherence',
      'Medication Adherence',
      `${rangeBtn()}<select class="sel" id="ma-coh" aria-label="Cohort"><option value="all">All cohorts</option><option value="asthma" ${MA.coh === 'asthma' ? 'selected' : ''}>Asthma</option><option value="copd" ${MA.coh === 'copd' ? 'selected' : ''}>COPD</option></select>`,
    ) +
    `
    <div class="grid">
      <section class="card c7"><div class="card-h"><div><h2>Adherence calendar</h2><div class="k">Last 5 weeks. Click a day for detail</div></div><div class="legend"><span><i class="h-blue"></i>85% +</span><span><i class="h-sky"></i>75–84%</span><span><i class="h-ink"></i>Below 75%</span></div></div><div class="cal" id="ma-cal"></div></section>
      <section class="card c5" id="ma-day"></section>
      <section class="card dark c4"><h2>Doses <b>taken</b></h2><div style="display:flex;justify-content:center;margin:16px 0;position:relative">${ringSVG(overall, 180, 18, '#087BFF', 'Overall adherence')}<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center"><div><div class="big" style="color:#fff"><span data-count="${(overall * 100).toFixed(1)}" data-dec="1">0</span><small style="color:#9A9A9A">%</small></div><small style="color:#9A9A9A">${{ 7: 'last 7 days', 14: 'last 14 days', 30: 'last 30 days' }[ST.range]}</small></div></div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><div class="k" style="color:#9A9A9A">Morning dose</div><b style="font-size:22px;font-weight:500">${pct(am)}</b></div><div><div class="k" style="color:#9A9A9A">Evening dose</div><b style="font-size:22px;font-weight:500">${pct(pm)}</b></div></div></section>
      <section class="card c4"><div class="card-h"><div><h2>Patients by adherence</h2><div class="k">Share of scheduled controller doses taken</div></div></div><div class="bars" id="ma-bands" style="height:200px;gap:8px"></div></section>
      <section class="card c4"><div class="card-h"><div><h2>Day of week pattern</h2><div class="k">Average over the last 8 weeks</div></div></div><div class="bars" id="ma-wd" style="height:200px;gap:8px"></div></section>
    </div>`;
  // calendar
  const cal = $('#ma-cal');
  const start = new Date(TODAY.getTime() - 34 * 864e5);
  const lead = (start.getDay() + 6) % 7;
  cal.innerHTML =
    ['M', 'T', 'W', 'T', 'F', 'S', 'S']
      .map((d) => `<span class="wd">${d}</span>`)
      .join('') +
    Array(lead).fill('<span class="cday empty"></span>').join('') +
    Array.from({ length: 35 }, (_, i) => {
      const off = 34 - i;
      const v = dayRate(off);
      const d = new Date(TODAY.getTime() - off * 864e5);
      return `<button class="cday ${v >= 0.85 ? 'h-blue' : v >= 0.75 ? 'h-sky' : 'h-ink'} ${MA.sel === off ? 'sel' : ''}" data-off="${off}" aria-label="${dayLong(off)}: ${pct(v)}">${d.getDate()}</button>`;
    }).join('');
  $$('.cday[data-off]', cal).forEach((b) => {
    const off = +b.dataset.off;
    bindTip(b, `<b>${dayLong(off)}</b>${pct(dayRate(off))} of doses taken`);
    b.onclick = () => {
      MA.sel = off;
      $$('.cday', cal).forEach((x) => x.classList.toggle('sel', x === b));
      day(true);
    };
  });
  if (!RM)
    safeFrom($$('.cday[data-off]', cal), {
      scale: 0,
      duration: 0.4,
      stagger: 0.01,
      ease: 'back.out(1.8)',
      clearProps: 'transform',
    });
  function day(anim) {
    const off = MA.sel;
    const v = dayRate(off);
    const byC = COHORTS.map((c) => {
      const ps = P.filter((p) => p.cohort.id === c.id)
        .map((p) => p.doses[DAYS - 1 - off])
        .filter(Number.isFinite);
      return [
        c,
        ps.length
          ? ps.reduce((a, value) => a + value, 0) / (ps.length * 2)
          : null,
      ];
    });
    const missed = P.filter((p) => p.doses[DAYS - 1 - off] === 0);
    $('#ma-day').innerHTML =
      `<div class="card-h"><div><div class="k">${off === 0 ? 'Today' : off + ' days ago'}</div><h2>${dayLong(off)}</h2></div></div><div class="big">${(v * 100).toFixed(1)}<small>%</small></div><div class="k" style="margin:4px 0 16px">of ${P.filter((p) => Number.isFinite(p.doses[DAYS - 1 - off])).length * 2} recorded scheduled doses taken</div>
      ${byC
        .filter((x) => x[1] !== null)
        .map(
          ([c, r]) =>
            `<div style="display:grid;grid-template-columns:120px 1fr 48px;gap:10px;align-items:center;margin-bottom:10px;font-size:13px"><span>${c.short}</span><div class="hbar"><i data-w="${r * 100}" style="background:${c.id === 'copd' ? '#111' : c.id === 'asthma-p' ? '#7FB7F7' : '#087BFF'}"></i></div><b style="font-weight:600;text-align:right">${(r * 100).toFixed(0)}%</b></div>`,
        )
        .join('')}
      <div class="k" style="margin:16px 0 8px">${missed.length} patients missed both doses</div><div style="display:flex;flex-wrap:wrap;gap:6px">${missed
        .slice(0, 12)
        .map(
          (p) =>
            `<button class="chip" data-id="${p.id}" style="background:var(--bg)">${p.id}</button>`,
        )
        .join('')}</div>`;
    $$('#ma-day [data-id]').forEach(
      (b) =>
        (b.onclick = () => {
          ST.patient = b.dataset.id;
          go('patient-profile');
        }),
    );
    animateUI($('#ma-day'));
  }
  const mxb = Math.max(...bc);
  $('#ma-bands').innerHTML = bands
    .map(
      (b, i) =>
        `<div class="bar ${i >= 3 ? 'h-blue' : i === 2 ? 'h-sky' : 'h-ink'}" style="height:${Math.max(8, (bc[i] / mxb) * 100)}%;border-radius:14px"><span class="bl">${bc[i]}</span><span class="wk">${b[2]}</span></div>`,
    )
    .join('');
  const wd = Array.from({ length: 7 }, (_, k) => {
    let t = 0,
      n = 0;
    for (let off = 0; off < 56; off++) {
      const d = new Date(TODAY.getTime() - off * 864e5);
      if ((d.getDay() + 6) % 7 === k) {
        t += dayRate(off);
        n++;
      }
    }
    return t / n;
  });
  const lo = Math.min(...wd) - 0.04,
    hi = Math.max(...wd) + 0.02;
  const best = wd.indexOf(Math.max(...wd));
  $('#ma-wd').innerHTML = wd
    .map(
      (v, k) =>
        `<div class="bar ${k === best ? 'h-blue' : v < (lo + hi) / 2 ? 'h-ink' : 'h-sky'}" style="height:${((v - lo) / (hi - lo)) * 100}%;border-radius:14px"><span class="bl">${(v * 100).toFixed(0)}</span><span class="wk">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][k]}</span></div>`,
    )
    .join('');
  $$('#ma-bands .bar, #ma-wd .bar').forEach(
    (b) => (b.style.cursor = 'default'),
  );
  if (!RM)
    safeFrom($$('#ma-bands .bar, #ma-wd .bar'), {
      scaleY: 0,
      duration: 0.8,
      stagger: 0.05,
      ease: 'power3.out',
      clearProps: 'transform',
    });
  $('#ma-coh').onchange = (e) => {
    MA.coh = e.target.value;
    skeleton(PAGES['medication-adherence']);
  };
  bindRange(PAGES['medication-adherence']);
  day();
  animateUI();
};

/* ======================= 6. Respiratory analytics ======================= */
let RA = { coh: 'all' };
PAGES['respiratory-analytics'] = () => {
  const w = $('#work');
  const P = PATIENTS.filter(
    (p) => RA.coh === 'all' || (RA.coh === 'copd') === (p.cohort.id === 'copd'),
  );
  const days = ST.range;
  const hours = Array(24).fill(0);
  P.forEach((p) => rescueHours(p, days).forEach((h) => hours[h]++));
  const totR = hours.reduce((a, b) => a + b, 0);
  const night = hours.slice(0, 6).reduce((a, b) => a + b, 0);
  const sfd = [];
  w.innerHTML =
    head(
      'Respiratory Analytics',
      'Respiratory Analytics',
      `${rangeBtn()}<div class="seg" id="ra-c" style="background:var(--card)">${[
        ['all', 'All'],
        ['asthma', 'Asthma'],
        ['copd', 'COPD'],
      ]
        .map(
          ([k, l]) =>
            `<button data-k="${k}" class="${RA.coh === k ? 'on' : ''}">${l}</button>`,
        )
        .join('')}</div>`,
    ) +
    `
    <div class="kpis"><div class="kpi"><span class="k">Rescue uses, ${days} days</span><b data-count="${totR}">0</b></div><div class="kpi dk"><span class="k">Overnight share, 00:00–06:00</span><b><span data-count="${totR ? ((night / totR) * 100).toFixed(1) : 0}" data-dec="1">0</span><small style="color:#9A9A9A">%</small></b></div><div class="kpi"><span class="k">Rescue uses per patient per week</span><b data-count="${(totR / P.length / (days / 7)).toFixed(2)}" data-dec="2">0</b></div><div class="kpi bl"><span class="k">Median symptom-free days, 30 d</span><b>—<small style="color:#9A9A9A">unavailable</small></b></div></div>
    <div class="grid">
      <section class="card c5"><div class="card-h"><div><h2>Rescue use by hour</h2><div class="k">Each bar is one hour of the day. Black marks overnight use</div></div></div><svg class="clock" id="ra-clock" viewBox="0 0 320 320" style="width:100%;max-width:340px;display:block;margin:0 auto"></svg></section>
      <section class="card c7"><div class="card-h"><div><h2>Adherence against rescue use</h2><div class="k">Each point is a patient over 30 days. Click one to open the profile</div></div><div class="legend">${COHORTS.map((c) => `<span><i style="background:${c.id === 'asthma-p' ? '#7FB7F7' : c.color}"></i>${c.short}</span>`).join('')}</div></div><svg id="ra-sc" viewBox="0 0 640 320" style="width:100%;height:auto;display:block"></svg></section>
      <section class="card c7"><div class="card-h"><div><h2>Weekly rescue use trend</h2><div class="k">Uses per patient, last 12 weeks</div></div></div><svg id="ra-tr" viewBox="0 0 640 220" preserveAspectRatio="none" style="width:100%;height:220px;display:block"></svg></section>
      <section class="card c5"><div class="card-h"><div><h2>Symptom-free days</h2><div class="k">Not provided by the local API</div></div></div><div class="bars" id="ra-sfd" style="height:200px;gap:8px"></div></section>
    </div>`;
  // radial clock
  const cx = 160,
    cy = 160,
    r0 = 56,
    r1 = 140,
    mx = Math.max(...hours, 1);
  let s = `<circle cx="${cx}" cy="${cy}" r="${r0 - 8}" fill="var(--bg)"/>`;
  hours.forEach((v, h) => {
    const a0 = (h / 24) * 2 * Math.PI - Math.PI / 2 + 0.02,
      a1 = ((h + 1) / 24) * 2 * Math.PI - Math.PI / 2 - 0.02;
    const rr = r0 + (v / mx) * (r1 - r0);
    const p = (a, r) => `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
    s += `<path class="cb" data-h="${h}" d="M${p(a0, r0)} L${p(a0, rr)} A${rr},${rr} 0 0 1 ${p(a1, rr)} L${p(a1, r0)} A${r0},${r0} 0 0 0 ${p(a0, r0)}Z" fill="${h < 6 ? '#111' : '#087BFF'}" opacity="${0.35 + (v / mx) * 0.65}"/>`;
  });
  [0, 6, 12, 18].forEach((h) => {
    const a = (h / 24) * 2 * Math.PI - Math.PI / 2;
    s += `<text x="${cx + Math.cos(a) * 154}" y="${cy + Math.sin(a) * 154 + 4}" text-anchor="middle">${String(h).padStart(2, '0')}</text>`;
  });
  s += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" style="font-size:22px;font-weight:600;fill:var(--text)">${totR}</text><text x="${cx}" y="${cy + 14}" text-anchor="middle">uses</text>`;
  const clock = $('#ra-clock');
  clock.innerHTML = s;
  $$('.cb', clock).forEach((b) => {
    const h = +b.dataset.h;
    bindTip(
      b,
      `<b>${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00</b>${hours[h]} rescue uses`,
    );
  });
  if (!RM)
    safeFrom($$('.cb', clock), {
      opacity: 0,
      scale: 0.7,
      transformOrigin: '160px 160px',
      duration: 0.6,
      stagger: 0.025,
      ease: 'power3.out',
    });
  // scatter
  const sc = $('#ra-sc');
  const pts = P.map((p) => ({ p, x: adh(p, 0, 30), y: rescueSum(p, 0, 30) }));
  const ymax = Math.max(...pts.map((d) => d.y), 4);
  const X = (v) => 50 + ((v - 0.3) / 0.7) * 570,
    Y = (v) => 290 - (v / ymax) * 270;
  let g = '';
  [0.4, 0.6, 0.8, 1].forEach(
    (v) =>
      (g += `<line x1="${X(v)}" x2="${X(v)}" y1="20" y2="290" stroke="var(--line)" stroke-dasharray="3 5"/><text x="${X(v)}" y="310" text-anchor="middle" font-size="11" fill="var(--muted)">${v * 100}%</text>`),
  );
  [0, Math.round(ymax / 2), ymax].forEach(
    (v) =>
      (g += `<text x="40" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${v}</text>`),
  );
  g += `<line x1="${X(0.8)}" x2="${X(0.8)}" y1="20" y2="290" stroke="#087BFF" stroke-width="1.5"/><text x="${X(0.8) + 6}" y="30" font-size="11" fill="#087BFF">80% target</text>`;
  g += pts
    .map(
      (d, i) =>
        `<circle class="spt" data-i="${i}" cx="${X(clamp(d.x, 0.3, 1))}" cy="${Y(d.y)}" r="5" fill="${d.p.cohort.id === 'asthma-p' ? '#7FB7F7' : d.p.cohort.color}" fill-opacity=".8" style="cursor:pointer"/>`,
    )
    .join('');
  sc.innerHTML = g;
  $$('.spt', sc).forEach((c) => {
    const d = pts[+c.dataset.i];
    bindTip(c, `<b>${d.p.id}</b>${pct(d.x)} adherence. ${d.y} rescue uses`);
    c.onclick = () => {
      ST.patient = d.p.id;
      go('patient-profile');
    };
  });
  if (!RM)
    safeFrom($$('.spt', sc), {
      attr: { r: 0 },
      duration: 0.5,
      stagger: 0.003,
      ease: 'back.out(2)',
    });
  // weekly trend lines per cohort
  const tr = $('#ra-tr');
  const W = 640,
    H = 220;
  const series = COHORTS.filter(
    (c) => RA.coh === 'all' || (RA.coh === 'copd') === (c.id === 'copd'),
  ).map((c) => {
    const ps = PATIENTS.filter((p) => p.cohort.id === c.id);
    return {
      c,
      v: Array.from(
        { length: 12 },
        (_, k) =>
          ps.reduce(
            (a, p) => a + rescueSum(p, (11 - k) * 7, (11 - k) * 7 + 7),
            0,
          ) / ps.length,
      ),
    };
  });
  const all = series.flatMap((x) => x.v);
  const lo = 0,
    hi = Math.max(...all) * 1.15;
  const tx = (i) => 30 + (i / 11) * (W - 50),
    ty = (v) => H - 24 - ((v - lo) / (hi - lo)) * (H - 40);
  let t = [0, hi / 2, hi]
    .map(
      (v) =>
        `<line x1="30" x2="${W - 20}" y1="${ty(v)}" y2="${ty(v)}" stroke="var(--line)" stroke-dasharray="3 5" vector-effect="non-scaling-stroke"/><text x="0" y="${ty(v) + 4}" font-size="11" fill="var(--muted)">${v.toFixed(1)}</text>`,
    )
    .join('');
  series.forEach((se) => {
    t += `<path class="trl" d="${se.v.map((v, i) => (i ? 'L' : 'M') + tx(i) + ',' + ty(v)).join(' ')}" fill="none" stroke="${se.c.id === 'asthma-p' ? '#7FB7F7' : se.c.color}" stroke-width="2.4" vector-effect="non-scaling-stroke"/>`;
    t += se.v
      .map(
        (v, i) =>
          `<circle class="trd" cx="${tx(i)}" cy="${ty(v)}" r="3.5" fill="var(--card)" stroke="${se.c.id === 'asthma-p' ? '#7FB7F7' : se.c.color}" stroke-width="2" vector-effect="non-scaling-stroke"><title>${se.c.short}, ${11 - i} weeks ago: ${v.toFixed(2)}</title></circle>`,
      )
      .join('');
  });
  tr.innerHTML = t;
  if (!RM)
    $$('.trl', tr).forEach((p, i) => {
      const L = p.getTotalLength();
      safeFromTo(
        p,
        { strokeDasharray: L, strokeDashoffset: L },
        {
          strokeDashoffset: 0,
          duration: 1.3,
          delay: i * 0.12,
          ease: 'power2.inOut',
          clearProps: 'strokeDasharray,strokeDashoffset',
        },
      );
    });
  // symptom-free days histogram
  const sb = [
    [0, 10, '0–10'],
    [11, 20, '11–20'],
    [21, 25, '21–25'],
    [26, 28, '26–28'],
    [29, 30, '29–30'],
  ];
  const sbc = sb.map(([a, b]) => sfd.filter((x) => x >= a && x <= b).length);
  const sm = Math.max(...sbc);
  $('#ra-sfd').innerHTML =
    '<div class="empty"><b>Unavailable</b>The API does not record symptom-free days.</div>';
  if (!RM)
    safeFrom($$('#ra-sfd .bar'), {
      scaleY: 0,
      duration: 0.8,
      stagger: 0.05,
      ease: 'power3.out',
      clearProps: 'transform',
    });
  $$('#ra-c button').forEach(
    (b) =>
      (b.onclick = () => {
        RA.coh = b.dataset.k;
        skeleton(PAGES['respiratory-analytics']);
      }),
  );
  bindRange(PAGES['respiratory-analytics']);
  animateUI();
};

/* ======================= 7. Alerts & follow-up ======================= */
let AL = { status: 'open', sev: 'all', kind: 'all', sel: null };
function alertHTML(a, compact) {
  return `<div class="alert ${AL.sel === a.id && !compact ? 'on' : ''}" data-id="${a.id}" role="button" tabindex="0"><span class="sev ${a.sev}">${ic(a.icon)}</span><span style="min-width:0"><b>${compact ? a.kind : a.p.id + ': ' + a.kind}</b><small>${a.text}. ${fmtAgo(a.mins)}</small></span>${a.status === 'open' ? `<button class="btn ${compact ? '' : 'dk'}" data-ack="${a.id}" style="height:36px;padding:0 14px">Acknowledge</button>` : `<span class="tag ${a.status === 'ack' ? '' : 'gray'}">${a.status === 'ack' ? 'Acknowledged' : 'Assigned'}</span>`}</div>`;
}
PAGES.alerts = () => {
  const w = $('#work');
  const A = buildAlerts();
  const cnt = (s) => A.filter((a) => s === 'all' || a.status === s).length;
  w.innerHTML =
    head(
      'Alerts & Follow-up',
      'Alerts',
      `<button class="cbtn" id="al-exp">Export<span class="cic">${ic('export')}</span></button>`,
    ) +
    `
    <div class="kpis"><div class="kpi dk"><span class="k">Open alerts</span><b data-count="${cnt('open')}">0</b></div><div class="kpi"><span class="k">High severity open</span><b data-count="${A.filter((a) => a.sev === 'high' && a.status === 'open').length}">0</b></div><div class="kpi"><span class="k">Assigned to a role</span><b data-count="${cnt('assigned')}">0</b></div><div class="kpi bl"><span class="k">Acknowledged</span><b data-count="${cnt('ack')}">0</b></div></div>
    <div class="toolbar"><div class="chipset" id="al-s">${[
      ['open', 'Open'],
      ['assigned', 'Assigned'],
      ['ack', 'Acknowledged'],
      ['all', 'All'],
    ]
      .map(
        ([k, l]) =>
          `<button class="chip ${AL.status === k ? 'on' : ''}" data-k="${k}">${l}<span class="ct">${cnt(k)}</span></button>`,
      )
      .join('')}</div>
      <select class="sel" id="al-sev" aria-label="Severity"><option value="all">All severities</option><option value="high" ${AL.sev === 'high' ? 'selected' : ''}>High</option><option value="med" ${AL.sev === 'med' ? 'selected' : ''}>Medium</option><option value="low" ${AL.sev === 'low' ? 'selected' : ''}>Low</option></select>
      <select class="sel" id="al-kind" aria-label="Type"><option value="all">All types</option>${[...new Set(A.map((a) => a.kind))].map((k) => `<option ${AL.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
    <div class="split"><section id="al-list"></section><aside class="card sticky" id="al-side"></aside></div>`;
  const list = () =>
    A.filter(
      (a) =>
        (AL.status === 'all' || a.status === AL.status) &&
        (AL.sev === 'all' || a.sev === AL.sev) &&
        (AL.kind === 'all' || a.kind === AL.kind),
    );
  function draw(anim) {
    const L = list();
    $('#al-list').innerHTML = L.length
      ? L.slice(0, 40)
          .map((a) => alertHTML(a))
          .join('') +
        (L.length > 40
          ? `<div class="k" style="text-align:center">Showing 40 of ${L.length}. Narrow the filters to see more</div>`
          : '')
      : `<div class="empty" style="background:var(--card)"><b>${AL.status === 'open' ? 'All caught up' : 'No alerts here'}</b>${AL.status === 'open' ? 'Every alert in this view has been handled.' : 'Try a different status or type.'}</div>`;
    $$('#al-list .alert').forEach((el) => {
      el.onclick = (e) => {
        if (e.target.closest('[data-ack]')) return;
        AL.sel = el.dataset.id;
        $$('#al-list .alert').forEach((x) =>
          x.classList.toggle('on', x === el),
        );
        side();
      };
      el.onkeydown = (e) => {
        if (e.key === 'Enter') el.click();
      };
    });
    $$('#al-list [data-ack]').forEach(
      (b) =>
        (b.onclick = (e) => {
          e.stopPropagation();
          ack(
            A.find((a) => a.id === b.dataset.ack),
            b.closest('.alert'),
          );
        }),
    );
    if (anim && !RM)
      safeFrom($$('#al-list .alert'), {
        x: -10,
        opacity: 0,
        duration: 0.35,
        stagger: 0.02,
        ease: 'power2.out',
        clearProps: 'all',
      });
  }
  function ack(a, row) {
    if (AL.status === 'open' && AL.sel === a.id) AL.sel = null;
    setAlert(
      a,
      { status: 'ack', by: ROLES[ST.role][0] },
      `Acknowledged ${a.kind.toLowerCase()} for ${a.p.id}`,
    )
      .then(() => {
        toast(`Acknowledged ${a.p.id}`);
        const done = () => PAGES.alerts();
        if (row && !RM)
          gsap.to(row, { x: 30, opacity: 0, duration: 0.3, onComplete: done });
        else done();
      })
      .catch(() => {});
  }
  function side() {
    const L0 = list();
    const a = L0.find((x) => x.id === AL.sel) || L0[0];
    const el = $('#al-side');
    if (!a) {
      el.innerHTML =
        '<div class="empty"><b>Select an alert</b>Details and actions appear here.</div>';
      return;
    }
    AL.sel = a.id;
    const p = a.p;
    el.innerHTML = `<div class="card-h"><span class="sev ${a.sev}">${ic(a.icon)}</span><span class="tag ${a.sev === 'high' ? '' : 'gray'}" style="${a.sev === 'high' ? 'background:#111;color:#fff' : ''}">${{ high: 'High', med: 'Medium', low: 'Low' }[a.sev]} severity</span></div>
      <div class="k">${a.kind}</div><h2 style="font-size:24px;font-weight:500;margin:4px 0 6px">Patient ${p.id}</h2><p style="margin:0 0 16px;color:var(--muted);font-size:13.5px">${a.text}. Raised ${fmtAgo(a.mins)}.</p>
      <dl class="kv" style="margin-bottom:16px"><dt>Cohort</dt><dd>${p.cohort.short}</dd><dt>Adherence, 7 days</dt><dd>${pct(adh(p, 0, 7))}</dd><dt>Rescue uses, 7 days</dt><dd>${rescueSum(p, 0, 7)}</dd><dt>Inhaler</dt><dd>${DEV[p.status][0]}</dd>${a.by ? `<dt>${a.status === 'ack' ? 'Acknowledged by' : 'Assigned to'}</dt><dd>${a.by}</dd>` : ''}</dl>
      <div class="k" style="margin-bottom:6px">Last 14 days</div>${doseDots(p)}
      <div class="btnrow" style="margin-top:20px">${a.status !== 'ack' ? `<button class="btn dk" id="as-ack">Acknowledge</button>` : `<button class="btn" id="as-re">Reopen</button>`}<button class="btn" id="as-asg">Assign</button><button class="btn" id="as-note">Add note</button><button class="btn bl" id="as-open">Open profile</button></div>`;
    const b = (id) => $('#' + id, el);
    if (b('as-ack')) b('as-ack').onclick = () => ack(a);
    if (b('as-re'))
      b('as-re').onclick = () => {
        setAlert(a, { status: 'open', by: null }, `Reopened alert for ${p.id}`)
          .then(() => {
            toast('Alert reopened');
            PAGES.alerts();
          })
          .catch(() => {});
      };
    b('as-asg').onclick = (e) =>
      menu(
        e.currentTarget,
        'Assign to',
        Object.values(ROLES).map((r) => [r[0], r[0]]),
        a.by,
        (v) => {
          setAlert(
            a,
            { status: 'assigned', by: v },
            `Assigned ${p.id} ${a.kind.toLowerCase()} to ${v}`,
          )
            .then(() => {
              toast(`Assigned to ${v}`);
              PAGES.alerts();
            })
            .catch(() => {});
        },
      );
    b('as-note').onclick = () =>
      noteModal(
        p.id,
        () => toast('Note saved to the care team workspace'),
        a.kind === 'Inhaler offline' || a.kind === 'Low battery'
          ? 'Device support'
          : 'Follow-up call',
      );
    b('as-open').onclick = () => {
      ST.patient = p.id;
      go('patient-profile');
    };
    if (!RM)
      safeFrom(el.children, {
        opacity: 0,
        y: 8,
        duration: 0.35,
        stagger: 0.03,
        ease: 'power2.out',
        clearProps: 'all',
      });
  }
  $$('#al-s .chip').forEach(
    (c) =>
      (c.onclick = () => {
        AL.status = c.dataset.k;
        AL.sel = null;
        $$('#al-s .chip').forEach((x) => x.classList.toggle('on', x === c));
        draw(true);
        side();
      }),
  );
  $('#al-sev').onchange = (e) => {
    AL.sev = e.target.value;
    AL.sel = null;
    draw(true);
    side();
  };
  $('#al-kind').onchange = (e) => {
    AL.kind = e.target.value;
    AL.sel = null;
    draw(true);
    side();
  };
  $('#al-exp').onclick = () =>
    save(
      'adherium-alerts.csv',
      csv([
        [
          'alert_id',
          'patient_id',
          'type',
          'severity',
          'status',
          'handled_by',
          'detail',
          'data_status',
        ],
        ...list().map((a) => [
          a.id,
          a.p.id,
          a.kind,
          a.sev,
          a.status,
          a.by || '',
          a.text,
          'synthetic demo',
        ]),
      ]),
    );
  draw(true);
  side();
  animateUI();
};

/* ======================= 8. Care team workspace ======================= */
const CATS = [
  'Follow-up call',
  'Medication review',
  'Device support',
  'Education',
];
function noteHTML(n) {
  return `<div class="note"><div class="h"><span><b style="color:var(--text);font-weight:600">${n.pt}</b> <span class="cat">${n.cat}</span></span><span>${n.role}. ${fmtRel(n.at)}</span></div><p>${n.text.replace(/</g, '&lt;')}</p></div>`;
}
function noteModal(pt, after, cat) {
  const m =
    openModal(`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div><h2 style="font-size:24px;font-weight:500">New care note</h2><p class="k" style="margin:4px 0 16px">Saved to the local synthetic-data API</p></div><button class="arrow" data-close aria-label="Close">${ic('x')}</button></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px"><label class="field">Patient<input class="inp" id="nm-pt" value="${pt || ''}" placeholder="PT-001" list="pt-list"></label><label class="field">Category<select class="inp" id="nm-cat">${CATS.map((c) => `<option ${c === cat ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
    <label class="field" style="margin-bottom:12px">Written as<select class="inp" id="nm-role">${Object.entries(
      ROLES,
    )
      .map(
        ([k, r]) =>
          `<option value="${r[0]}" ${k === ST.role ? 'selected' : ''}>${r[0]}</option>`,
      )
      .join('')}</select></label>
    <label class="field">Note<textarea class="inp" id="nm-txt" rows="4" placeholder="What happened and what is the next step?"></textarea></label><div class="k" id="nm-err" style="color:var(--bad);min-height:18px;margin-top:6px"></div>
    <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn" data-close>Cancel</button><button class="btn dk" id="nm-save">Save note</button></div>
    <datalist id="pt-list">${PATIENTS.map((p) => `<option value="${p.id}">`).join('')}</datalist>`);
  setTimeout(() => $('#nm-txt', m).focus(), 50);
  $('#nm-save', m).onclick = () => {
    const id = $('#nm-pt', m).value.trim().toUpperCase(),
      txt = $('#nm-txt', m).value.trim();
    if (!PT(id)) {
      $('#nm-err', m).textContent =
        'Enter a patient ID from the list, for example PT-001.';
      return;
    }
    if (txt.length < 4) {
      $('#nm-err', m).textContent = 'Write a short note before saving.';
      return;
    }
    $('#nm-save', m).disabled = true;
    window
      .__ADHERIUM_API__('/notes', {
        method: 'POST',
        body: {
          patient: id,
          role: $('#nm-role', m).value,
          category: $('#nm-cat', m).value,
          text: txt,
        },
      })
      .then(({ item }) => {
        DB.notes.unshift({
          id: item.externalId,
          pt: id,
          role: item.role,
          cat: item.category,
          text: item.text,
          at: item.createdAt,
        });
        audit();
        closeAll();
        toast('Note saved');
        after && after();
      })
      .catch((error) => {
        $('#nm-save', m).disabled = false;
        $('#nm-err', m).textContent = error.message;
      });
  };
}
let CT = { role: 'all', q: '' };
PAGES['care-team'] = () => {
  const w = $('#work');
  const A = buildAlerts();
  w.innerHTML =
    head(
      'Care Team Workspace',
      'Care Team',
      `<button class="cbtn" id="ct-new">New note<span class="cic">${ic('doc')}</span></button>`,
    ) +
    `
    <div class="grid" style="margin-bottom:16px">${Object.values(ROLES)
      .map((r, i) => {
        const mine = A.filter((a) => a.status === 'assigned' && a.by === r[0]);
        const notes = DB.notes.filter((n) => n.role === r[0]);
        return `<section class="role-col c4 ${i === 0 ? '' : ''}" style="${i === 1 ? 'background:var(--ink);color:#fff' : ''}"><div style="display:flex;justify-content:space-between;align-items:center"><span class="av" style="width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-weight:600;background:${i === 1 ? '#087BFF' : 'var(--sky)'};color:${i === 1 ? '#fff' : '#0458BA'}">${r[1]}</span><span class="k" style="${i === 1 ? 'color:#9A9A9A' : ''}">${notes.length} notes</span></div><h3 style="margin-top:14px">${r[0]}</h3><div class="k" style="${i === 1 ? 'color:#9A9A9A' : ''}">${mine.length} assigned follow-ups</div>
      <div style="margin-top:10px">${
        mine
          .slice(0, 4)
          .map(
            (a) =>
              `<div class="q" data-id="${a.p.id}" style="${i === 1 ? 'border-color:#2A2A2A' : ''}"><span class="sev ${a.sev}" style="width:30px;height:30px">${ic(a.icon)}</span><span><b>${a.p.id}</b><br><small class="k" style="${i === 1 ? 'color:#9A9A9A' : ''}">${a.kind}</small></span></div>`,
          )
          .join('') ||
        `<div class="k" style="padding:10px 0;${i === 1 ? 'color:#9A9A9A' : ''}">Nothing assigned. Assign alerts from Alerts & Follow-up.</div>`
      }</div></section>`;
      })
      .join('')}</div>
    <div class="split"><section class="card"><div class="card-h"><h2>Care notes</h2><div style="display:flex;gap:8px;flex-wrap:wrap"><div class="search" style="min-width:180px">${ic('user')}<input id="ct-q" placeholder="Filter by patient ID" value="${CT.q}" aria-label="Filter notes by patient" style="background:var(--bg)"></div><select class="sel" id="ct-r" style="background-color:var(--bg)" aria-label="Role"><option value="all">All roles</option>${Object.values(
      ROLES,
    )
      .map(
        (r) => `<option ${CT.role === r[0] ? 'selected' : ''}>${r[0]}</option>`,
      )
      .join('')}</select></div></div><div id="ct-notes"></div></section>
    <aside class="card dark sticky"><h2>Quick <b>note</b></h2><p class="k" style="color:#9A9A9A;margin:6px 0 14px">Record a call, review or device fix without leaving the workspace.</p>
      <label class="field" style="color:#9A9A9A">Patient<input class="inp" id="qn-pt" placeholder="PT-001" list="qn-list" style="background:#1E1E1E;border-color:#2E2E2E;color:#fff"></label>
      <div class="chipset" id="qn-cat" style="margin:12px 0">${CATS.map((c, i) => `<button class="chip ${i === 0 ? 'on blue' : 'blue'}" data-c="${c}" style="${i === 0 ? '' : 'background:#1E1E1E;color:#ccc'}">${c}</button>`).join('')}</div>
      <textarea class="inp" id="qn-txt" rows="4" placeholder="Note" style="background:#1E1E1E;border-color:#2E2E2E;color:#fff;width:100%"></textarea><div class="k" id="qn-err" style="color:#FF8A8A;min-height:18px;margin:6px 0"></div>
      <button class="btn-blue" id="qn-save"><span>Save note</span><i>${ic('arrow')}</i></button><datalist id="qn-list">${PATIENTS.map((p) => `<option value="${p.id}">`).join('')}</datalist></aside></div>`;
  function notes(anim) {
    const L = DB.notes.filter(
      (n) =>
        (CT.role === 'all' || n.role === CT.role) &&
        (!CT.q || n.pt.toLowerCase().includes(CT.q.toLowerCase())),
    );
    $('#ct-notes').innerHTML = L.length
      ? L.map(noteHTML).join('')
      : '<div class="empty"><b>No notes match</b>Clear the filter or write the first note for this patient.</div>';
    if (anim && !RM)
      safeFrom($$('#ct-notes .note'), {
        y: 8,
        opacity: 0,
        duration: 0.35,
        stagger: 0.03,
        clearProps: 'all',
      });
  }
  let cat = CATS[0];
  $$('#qn-cat .chip').forEach(
    (b) =>
      (b.onclick = () => {
        cat = b.dataset.c;
        $$('#qn-cat .chip').forEach((x) => {
          x.classList.toggle('on', x === b);
          x.style.background = x === b ? '' : '#1E1E1E';
          x.style.color = x === b ? '' : '#ccc';
        });
      }),
  );
  $('#qn-save').onclick = () => {
    const id = $('#qn-pt').value.trim().toUpperCase(),
      txt = $('#qn-txt').value.trim();
    if (!PT(id)) {
      $('#qn-err').textContent =
        'Enter a patient ID from the list, for example PT-001.';
      return;
    }
    if (txt.length < 4) {
      $('#qn-err').textContent = 'Write a short note before saving.';
      return;
    }
    $('#qn-save').disabled = true;
    window
      .__ADHERIUM_API__('/notes', {
        method: 'POST',
        body: {
          patient: id,
          role: ROLES[ST.role][0],
          category: cat,
          text: txt,
        },
      })
      .then(({ item }) => {
        DB.notes.unshift({
          id: item.externalId,
          pt: id,
          role: item.role,
          cat: item.category,
          text: item.text,
          at: item.createdAt,
        });
        audit();
        toast('Note saved');
        PAGES['care-team']();
      })
      .catch((error) => {
        $('#qn-save').disabled = false;
        $('#qn-err').textContent = error.message;
      });
  };
  $('#ct-q').oninput = (e) => {
    CT.q = e.target.value;
    notes();
  };
  $('#ct-r').onchange = (e) => {
    CT.role = e.target.value;
    notes(true);
  };
  $('#ct-new').onclick = () => noteModal('', () => PAGES['care-team']());
  $$('.q[data-id]').forEach(
    (q) =>
      (q.onclick = () => {
        ST.patient = q.dataset.id;
        go('patient-profile');
      }),
  );
  notes(true);
  animateUI();
};

/* ======================= 9. Reports & insights ======================= */
const TPL = {
  weekly: [
    'Weekly adherence report',
    'Controller adherence, status and follow-up',
    'dk',
  ],
  devices: [
    'Device connectivity report',
    'Sync status and battery across sensors',
    'bl',
  ],
  cohort: ['Cohort summary', 'Asthma and COPD side by side', ''],
  followup: ['Follow-up log', 'Alerts handled and care notes', ''],
};
let RP = { sel: null };
function reportStats(r) {
  const P = PATIENTS.filter(
    (p) =>
      r.cohort === 'all' || (r.cohort === 'copd') === (p.cohort.id === 'copd'),
  );
  const A = buildAlerts();
  return {
    P,
    adh: P.reduce((a, p) => a + adh(p, 0, r.range), 0) / P.length,
    on: P.filter(onTrack).length,
    fu: P.filter(followUp).length,
    conn: P.filter((p) => p.status === 'connected').length,
    off: P.filter((p) => p.status === 'offline').length,
    low: P.filter((p) => p.battery < 26).length,
    res: P.reduce((a, p) => a + rescueSum(p, 0, r.range), 0),
    ack: A.filter((a) => a.status === 'ack').length,
    open: A.filter((a) => a.status === 'open').length,
    notes: DB.notes.length,
  };
}
PAGES.reports = () => {
  const w = $('#work');
  if (!RP.sel && DB.reports[0]) RP.sel = DB.reports[0].id;
  w.innerHTML =
    head('Reports & Insights', 'Reports', '') +
    `
    <div class="grid" style="margin-bottom:16px">${Object.entries(TPL)
      .map(
        ([k, [t, d, c]]) =>
          `<button class="tpl ${c} c3" data-t="${k}" style="grid-column:span 3"><span style="display:flex;justify-content:space-between;width:100%"><span class="wcirc ${c ? '' : 'g'}" style="${c ? '' : 'background:var(--bg);color:var(--text)'}">${ic('doc')}</span><span class="wcirc" style="${c ? '' : 'background:var(--ink);color:#fff'}">${ic('arrow')}</span></span><h3>${t}</h3><small>${d}</small></button>`,
      )
      .join('')}</div>
    <div class="split rev"><section class="card"><div class="card-h"><h2>Saved reports</h2><span class="k">${DB.reports.length}</span></div><div id="rp-list"></div></section><section class="card" id="rp-doc"></section></div>`;
  function list() {
    $('#rp-list').innerHTML = DB.reports
      .map(
        (r) =>
          `<button class="ev" data-id="${r.id}" style="--c:${r.id === RP.sel ? '#087BFF' : '#D0D0D0'};${r.id === RP.sel ? 'background:var(--bg)' : ''}"><b>${TPL[r.tpl][0]}</b><span class="t">${fmtDate(r.at)}</span><small>${r.id}. ${{ all: 'All patients', asthma: 'Asthma', copd: 'COPD' }[r.cohort]}. ${r.range} days</small></button>`,
      )
      .join('');
    $$('#rp-list .ev').forEach(
      (b) =>
        (b.onclick = () => {
          RP.sel = b.dataset.id;
          list();
          doc();
        }),
    );
  }
  function doc() {
    const r = DB.reports.find((x) => x.id === RP.sel);
    const el = $('#rp-doc');
    if (!r) {
      el.innerHTML =
        '<div class="empty"><b>No reports yet</b>Choose a template above to generate one.</div>';
      return;
    }
    const s = reportStats(r);
    el.innerHTML = `<div class="card-h" style="align-items:flex-start"><div><div class="k">${r.id}. Generated ${fmtDate(r.at)}. Synthetic demo data</div><h2 style="font-size:26px;font-weight:500;margin-top:4px">${TPL[r.tpl][0]}</h2></div><div class="btnrow"><button class="btn" id="rd-csv">CSV</button><button class="btn dk" id="rd-md">Export report</button><button class="btn" id="rd-del" aria-label="Delete report">${ic('x')}</button></div></div>
      <div class="kpis" style="margin-top:8px">${(r.tpl === 'devices'
        ? [
            ['Connected', s.conn],
            ['Offline', s.off],
            ['Battery under 25%', s.low],
            ['Patients', s.P.length],
          ]
        : r.tpl === 'followup'
          ? [
              ['Open alerts', s.open],
              ['Acknowledged', s.ack],
              ['Care notes', s.notes],
              ['Needs follow-up', s.fu],
            ]
          : [
              ['Patients', s.P.length],
              ['Adherence', pct(s.adh)],
              ['On track', s.on],
              ['Rescue uses', s.res],
            ]
      )
        .map(
          ([l, v], i) =>
            `<div class="kpi ${i === 0 ? 'dk' : i === 1 ? 'bl' : ''}" style="${i > 1 ? 'background:var(--bg)' : ''}"><span class="k">${l}</span><b style="font-size:26px">${v}</b></div>`,
        )
        .join('')}</div>
      <div class="k" style="margin-bottom:8px">${r.tpl === 'devices' ? 'Device status' : 'Monitoring status'}</div>
      <div class="coh-bar" style="height:16px">${(r.tpl === 'devices'
        ? [
            [s.conn, 'h-blue'],
            [s.P.length - s.conn - s.off, 'h-sky'],
            [s.off, 'h-ink'],
          ]
        : [
            [s.on, 'h-blue'],
            [s.fu, 'h-sky'],
            [s.P.length - s.on - s.fu, 'h-ink'],
          ]
      )
        .map(([v, c]) => `<span class="${c}" style="flex-grow:${v}"></span>`)
        .join('')}</div>
      <div class="legend" style="margin-bottom:18px">${(r.tpl === 'devices'
        ? [
            ['h-blue', 'Connected'],
            ['h-sky', 'Sync pending'],
            ['h-ink', 'Offline'],
          ]
        : [
            ['h-blue', 'On track'],
            ['h-sky', 'Needs follow-up'],
            ['h-ink', 'Offline'],
          ]
      )
        .map(([c, l]) => `<span><i class="${c}"></i>${l}</span>`)
        .join('')}</div>
      <table class="rt"><thead><tr><th>Patient</th><th>Cohort</th><th class="r">Adherence</th><th class="r">Rescue</th><th>Inhaler</th></tr></thead><tbody>${s.P.slice()
        .sort((a, b) => adh(a, 0, r.range) - adh(b, 0, r.range))
        .slice(0, 6)
        .map(
          (p) =>
            `<tr data-id="${p.id}"><td class="pri" data-l="Patient">${p.id}</td><td data-l="Cohort">${p.cohort.short}</td><td class="r" data-l="Adherence">${pct(adh(p, 0, r.range))}</td><td class="r" data-l="Rescue">${rescueSum(p, 0, r.range)}</td><td data-l="Inhaler">${devTag(p)}</td></tr>`,
        )
        .join(
          '',
        )}</tbody></table><div class="k" style="margin-top:6px">Lowest adherence first</div>`;
    $$('#rp-doc tr[data-id]').forEach(
      (tr) =>
        (tr.onclick = () => {
          ST.patient = tr.dataset.id;
          go('patient-profile');
        }),
    );
    if (!RM)
      safeFrom($$('#rp-doc .coh-bar span'), {
        scaleX: 0,
        transformOrigin: 'left',
        duration: 0.8,
        stagger: 0.08,
        ease: 'power3.out',
      });
    $('#rd-md').onclick = () =>
      save(
        `${r.id.toLowerCase()}-${r.tpl}.md`,
        `# ${TPL[r.tpl][0]}\n\n${r.id}. Generated ${new Date(r.at).toISOString().slice(0, 10)}. Cohort: ${r.cohort}. Window: ${r.range} days. All values are synthetic demo data.\n\n| Measure | Value |\n|---|---|\n| Patients | ${s.P.length} |\n| Controller adherence | ${pct(s.adh)} |\n| On track | ${s.on} |\n| Needs follow-up | ${s.fu} |\n| Inhalers connected | ${s.conn} |\n| Inhalers offline | ${s.off} |\n| Rescue uses | ${s.res} |\n| Alerts acknowledged | ${s.ack} |\n| Care notes | ${s.notes} |\n`,
      );
    $('#rd-csv').onclick = () =>
      window
        .__ADHERIUM_DOWNLOAD__(
          '/reports/' + encodeURIComponent(r.id) + '/export.csv',
          r.id + '.csv',
        )
        .catch((error) => window.__ADHERIUM_SHOW_ERROR__?.(error));
    $('#rd-del').onclick = () =>
      window
        .__ADHERIUM_API__('/reports/' + encodeURIComponent(r.id), {
          method: 'DELETE',
        })
        .then(() => {
          DB.reports = DB.reports.filter((x) => x.id !== r.id);
          RP.sel = DB.reports[0] && DB.reports[0].id;
          audit();
          toast('Report deleted');
          list();
          doc();
        })
        .catch((error) => window.__ADHERIUM_SHOW_ERROR__?.(error));
  }
  $$('.tpl').forEach((b) => (b.onclick = () => genModal(b.dataset.t)));
  function genModal(t) {
    const m =
      openModal(`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div><div class="k">New report</div><h2 style="font-size:24px;font-weight:500;margin-top:4px">${TPL[t][0]}</h2></div><button class="arrow" data-close aria-label="Close">${ic('x')}</button></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0"><label class="field">Cohort<select class="inp" id="g-c"><option value="all">All patients</option><option value="asthma">Asthma</option><option value="copd">COPD</option></select></label><label class="field">Window<select class="inp" id="g-r"><option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="30">Last 30 days</option></select></label></div>
      <div class="progress" style="background:var(--bg);opacity:0;margin-bottom:12px"><i></i></div><div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn" data-close>Cancel</button><button class="btn dk" id="g-go">Generate report</button></div>`);
    $('#g-go', m).onclick = () => {
      $('#g-go', m).disabled = true;
      window
        .__ADHERIUM_API__('/reports', {
          method: 'POST',
          body: {
            type: t,
            cohort: $('#g-c', m).value,
            rangeDays: +$('#g-r', m).value,
          },
        })
        .then(({ item }) => {
          const report = {
            id: item.externalId,
            tpl: item.type,
            cohort: item.cohort,
            range: item.rangeDays,
            at: item.createdAt,
            status: item.status,
            snapshot: item.snapshot,
          };
          DB.reports.unshift(report);
          RP.sel = report.id;
          audit();
          closeAll();
          toast(`Report ${report.id} generated`);
          list();
          doc();
        })
        .catch((error) => {
          $('#g-go', m).disabled = false;
          window.__ADHERIUM_SHOW_ERROR__?.(error);
        });
    };
  }
  list();
  doc();
  animateUI();
  if (!RM)
    safeFrom($$('.tpl'), {
      y: 16,
      opacity: 0,
      duration: 0.6,
      stagger: 0.06,
      ease: 'power3.out',
      clearProps: 'transform,opacity',
    });
};

/* ======================= 10. Data & device management ======================= */
PAGES['data-management'] = () => {
  const w = $('#work');
  const firmware = window.__ADHERIUM_BOOT__.firmware;
  const fw = Object.fromEntries(
    firmware.map((item) => [item.version, item.deviceCount || 0]),
  );
  const currentFirmware = firmware.find((item) => item.current)?.version;
  w.innerHTML =
    head(
      'Data & Device Management',
      'Data Management',
      `<button class="cbtn" id="dm-exp">Export audit log<span class="cic">${ic('export')}</span></button>`,
    ) +
    `
    <section class="card" style="margin-bottom:16px"><div class="card-h"><div><h2>Data flow</h2><div class="k">How dose events move from the inhaler sensor to this dashboard. Simulated in the demo</div></div><span class="tag blue">Demo pipeline</span></div>
      <div class="pipe">${[
        ['inhaler', 'dk'],
        ['pulse', ''],
        ['db', 'bl'],
        ['grid', 'dk'],
      ]
        .map(
          ([i, c], k) =>
            `${k ? '<div class="link"><i></i><i></i><i></i></div>' : ''}<div class="node ${c}">${ic(i)}</div>`,
        )
        .join('')}</div>
      <div class="pipe-l"><span>Inhaler sensor</span><span>Phone app</span><span>Cloud ingestion</span><span>Care dashboard</span></div></section>
    <div class="grid">
      <section class="card c4"><div class="card-h"><h2>Connections</h2></div>${window.__ADHERIUM_BOOT__.integrations
        .map((item) => {
          const active = /connected|active|ready/i.test(item.status || '');
          const label = item.simulated
            ? `${item.status} (simulated)`
            : item.status;
          return `<div class="q" style="cursor:default"><span class="node" style="width:40px;height:40px;${active ? 'background:#E4F0FF;color:#087BFF' : ''}">${ic(active ? 'pulse' : 'db')}</span><span style="flex:1"><b>${item.name}</b><br><small class="k">${item.details || ''}</small></span><span class="st" style="--c:${active ? '#087BFF' : '#D0D0D0'}">${label}</span></div>`;
        })
        .join('')}</section>
      <section class="card c4"><div class="card-h"><h2>Sensor firmware</h2></div>${Object.entries(
        fw,
      )
        .map(
          ([v, n], i) =>
            `<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span>Version ${v}${v === currentFirmware ? ' (current)' : ''}</span><b style="font-weight:600">${n}</b></div><div class="hbar"><i data-w="${(n / PATIENTS.length) * 100}" style="background:${i === 0 ? '#087BFF' : i === 1 ? '#7FB7F7' : '#111'}"></i></div></div>`,
        )
        .join(
          '',
        )}<button class="btn" id="dm-fw" style="margin-top:4px">Schedule update for older sensors</button></section>
      <section class="card c4"><div class="card-h"><h2>Import enrollment</h2></div><label class="drop" id="dm-drop"><input type="file" accept=".csv,text/csv" id="dm-file" hidden><b>Drop a CSV or browse</b>Columns: patient_id, cohort. Validated by the local API; enrollment is not performed</label>
        <button class="btn" id="dm-sample" style="margin-top:10px;width:100%">Use a sample file with errors</button><div id="dm-res" style="margin-top:10px"></div></section>
      <section class="card c6"><div class="card-h"><h2>Import history</h2></div><table class="rt"><thead><tr><th>Import</th><th class="r">Rows</th><th>Status</th><th>Date</th></tr></thead><tbody id="dm-imp"></tbody></table></section>
      <section class="card c6"><div class="card-h"><h2>Audit log</h2><span class="k">Actions recorded by the local API</span></div><div id="dm-audit"></div></section>
    </div>`;
  const imp = () => {
    $('#dm-imp').innerHTML = DB.imports
      .map(
        (i) =>
          `<tr style="cursor:default"><td class="pri" data-l="Import">${i.name}</td><td class="r" data-l="Rows">${i.rows}</td><td data-l="Status"><span class="tag ${i.status === 'Completed' ? '' : i.status === 'Failed' ? 'gray' : 'blue'}">${i.status}</span></td><td data-l="Date">${fmtDate(i.at)}</td></tr>`,
      )
      .join('');
  };
  const aud = () => {
    $('#dm-audit').innerHTML = DB.audit.length
      ? DB.audit
          .slice(0, 8)
          .map(
            (a) =>
              `<div class="ev" style="--c:#087BFF;cursor:default"><b>${a.msg}</b><span class="t">${fmtRel(a.at)}</span><small>${a.role}</small></div>`,
          )
          .join('')
      : '<div class="empty"><b>No actions yet</b>Actions recorded by the local API appear here.</div>';
  };
  window.__ADHERIUM_RENDER_AUDIT__ = aud;
  function validate(name, text) {
    const res = $('#dm-res');
    res.innerHTML =
      '<div class="progress" style="background:var(--bg)"><i style="width:25%"></i></div><div class="log" id="dm-log" style="margin-top:8px">Sending CSV to the local API for validation…</div>';
    window
      .__ADHERIUM_API__('/data/imports/validate', {
        method: 'POST',
        body: { name, csv: text },
      })
      .then(({ item, validRows, issues }) => {
        DB.imports.unshift({
          id: item.externalId,
          name: item.name,
          rows: item.rows,
          status: item.status,
          at: item.createdAt,
        });
        $('#dm-log').textContent =
          'Read ' +
          item.rows +
          ' rows. ' +
          validRows +
          ' valid rows. ' +
          issues.length +
          ' validation issues.';
        if (issues.length) {
          const detail = document.createElement('div');
          detail.className = 'warn';
          detail.textContent = issues
            .map((issue) => issue.message || issue.code)
            .join('; ');
          $('#dm-log').appendChild(detail);
        }
        imp();
        audit();
        toast('Import validation recorded: ' + item.status);
      })
      .catch((error) => {
        $('#dm-log').textContent = error.message;
        $('#dm-log').classList.add('err');
        window.__ADHERIUM_SHOW_ERROR__?.(error);
      });
  }
  const drop = $('#dm-drop'),
    file = $('#dm-file');
  const read = (f) => {
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) {
      toast('Choose a .csv file');
      return;
    }
    const r = new FileReader();
    r.onload = () => validate(f.name.replace(/\.csv$/i, ''), r.result);
    r.readAsText(f);
  };
  drop.ondragover = (e) => {
    e.preventDefault();
    drop.classList.add('over');
  };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    read(e.dataTransfer.files[0]);
  };
  file.onchange = () => read(file.files[0]);
  $('#dm-sample').onclick = () =>
    validate(
      'Sample enrollment file',
      'patient_id,cohort\nPT-301,asthma adult\nPT-302,COPD\nPT-302,COPD\nP-17,asthma pediatric\nPT-305,bronchiectasis\nPT-306,asthma adult',
    );
  $('#dm-fw').onclick = (e) => {
    const button = e.currentTarget;
    button.disabled = true;
    window
      .__ADHERIUM_API__('/data/firmware/schedule', { method: 'POST', body: {} })
      .then((result) => {
        button.textContent = 'Update scheduled for next sync (simulated)';
        audit();
        aud();
        toast(result.message || 'Firmware update scheduled (simulated)');
      })
      .catch((error) => {
        button.disabled = false;
        window.__ADHERIUM_SHOW_ERROR__?.(error);
      });
  };
  $('#dm-exp').onclick = () =>
    save(
      'adherium-audit-log.csv',
      csv([
        ['time', 'role', 'action'],
        ...DB.audit.map((a) => [a.at, a.role, a.msg]),
      ]),
    );
  imp();
  aud();
  animateUI();
};

/* ======================= boot ======================= */
window.PAGES = PAGES;
const start = window.__ADHERIUM_BOOT__.page || 'dashboard';
ST.page = PAGES[start] ? start : 'dashboard';
if (window.__ADHERIUM_BOOT__.patientId)
  ST.patient = window.__ADHERIUM_BOOT__.patientId;
renderNav();
renderRoles();
if (ST.page === 'dashboard') renderDashboard(true);
else if (
  ST.page !== 'patient-profile' ||
  window.__ADHERIUM_PROFILE__?.patientId === ST.patient
)
  PAGES[ST.page]();
document.title = 'Adherium · ' + (TITLES[ST.page] || 'Overview');
