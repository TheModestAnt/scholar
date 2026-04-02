/* ── SCHOLAR DASHBOARD v3 ── */

let asnTabMode = 'upcoming';
let aiHistory = [];
let attendChartInst = null;

document.addEventListener('DOMContentLoaded', () => {
  initData();
  if (!currentUser) return;
  renderSidebar();
  renderOverview();
  renderAssignments();
  renderSchedule();
  renderGrades();
  renderAttendance();
  renderSettings();
});

/* ══ SIDEBAR ══ */
function renderSidebar() {
  const name = userData.firstName || currentUser.firstName || 'Student';
  document.getElementById('sidebar-name').textContent = name;
  document.getElementById('sidebar-grade').textContent = formatGrade(userData.grade || currentUser.grade || '');
  document.getElementById('user-avatar').textContent = name[0].toUpperCase();
}

/* ══ OVERVIEW ══ */
function renderOverview() {
  const name = userData.firstName || currentUser.firstName || 'there';
  const h = new Date().getHours();
  document.getElementById('greeting').textContent =
    `${h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}, ${name}`;
  document.getElementById('today-str').textContent =
    new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });

  const gpa = computeGPA();
  document.getElementById('ov-gpa').textContent = gpa;
  document.getElementById('ov-gpa-sub').textContent = gpa === '—' ? 'add grades to calculate' : 'current GPA';
  document.getElementById('ov-due').textContent = countDueSoon();
  document.getElementById('ov-streak').textContent = userData.streak || 1;

  const rate = getOverallAttendanceRate();
  document.getElementById('ov-attend').textContent = rate !== null ? rate + '%' : '—';

  // Today's schedule
  const todaySched = getTodaySchedule();
  const schedEl = document.getElementById('ov-today-schedule');
  if (!todaySched.length) {
    schedEl.innerHTML = `<div class="today-none">No classes scheduled today. <a href="#" onclick="nav('schedule',document.querySelector('[data-page=schedule]'));return false" style="color:var(--accent)">Set up your schedule →</a></div>`;
  } else {
    schedEl.innerHTML = `<div class="today-strip">${todaySched.map(b => {
      const cls = getClassById(b.classId);
      const color = cls ? cls.color : '#888';
      return `<div class="today-block" style="background:${color}18;border:1px solid ${color}30">
        <div class="today-block-time" style="color:${color}">${formatTime(b.startTime)} – ${formatTime(b.endTime)}</div>
        <div class="today-block-name" style="color:${color}">${escHtml(b.className)}</div>
        ${b.room ? `<div class="today-block-room" style="color:${color}">${escHtml(b.room)}</div>` : ''}
      </div>`;
    }).join('')}</div>`;
  }

  // Upcoming assignments
  const upcoming = getAssignments()
    .filter(a => a.status !== 'submitted' && a.status !== 'graded')
    .sort((a,b) => a.due.localeCompare(b.due))
    .slice(0, 5);

  const asnEl = document.getElementById('ov-assignments');
  if (!upcoming.length) {
    asnEl.innerHTML = `<div class="empty-state" style="padding:20px 0"><div class="empty-icon">🎉</div><p>Nothing due soon!</p></div>`;
  } else {
    asnEl.innerHTML = upcoming.map(a => asnRow(a)).join('');
  }
}

function asnRow(a, showRemove) {
  const [badge, cls] = statusBadge(a.status);
  const due = formatDue(a.due);
  const overdue = due.includes('overdue');
  const urgent = (due === 'Today' || due === 'Tomorrow' || overdue) && a.status !== 'submitted' && a.status !== 'graded';
  return `<div class="row-item">
    <div class="row-dot" style="background:${a.color || '#888'}"></div>
    <div style="flex:1;min-width:0">
      <div class="row-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(a.title)}</div>
      <div class="row-sub">${escHtml(a.className)}${a.type ? ' · ' + a.type : ''}</div>
    </div>
    <div class="row-right">
      <div style="font-size:11px;font-weight:500;color:${urgent ? 'var(--red)' : 'var(--ink3)'};margin-bottom:3px">${due}</div>
      <span class="badge ${cls}">${badge}</span>
    </div>
    ${showRemove ? `<button class="row-remove" onclick="removeAssignment('${a.id}');renderAll()" title="Remove">×</button>` : ''}
  </div>`;
}

/* ══ ASSIGNMENTS ══ */
function setAsnTab(mode, el) {
  asnTabMode = mode;
  document.querySelectorAll('#page-assignments .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderAssignments();
}

function renderAssignments() {
  // Update filter dropdown
  const filter = document.getElementById('asn-filter');
  const filterVal = filter ? filter.value : 'all';
  rebuildClassFilter('asn-filter');
  if (filter) filter.value = filterVal;

  let all = getAssignments();
  if (filterVal && filterVal !== 'all') {
    all = all.filter(a => a.classId === filterVal);
  }

  let filtered;
  const now = new Date(); now.setHours(0,0,0,0);
  if (asnTabMode === 'upcoming') {
    filtered = all.filter(a => a.status !== 'submitted' && a.status !== 'graded')
      .sort((a,b) => a.due.localeCompare(b.due));
  } else if (asnTabMode === 'graded') {
    filtered = all.filter(a => a.status === 'graded' || a.status === 'submitted')
      .sort((a,b) => b.due.localeCompare(a.due));
  } else {
    filtered = [...all].sort((a,b) => a.due.localeCompare(b.due));
  }

  const el = document.getElementById('assignment-list');
  if (!filtered.length) {
    const msgs = { upcoming:'No upcoming assignments! Enjoy the break.', graded:'No graded assignments yet.', all:'No assignments yet. Add one above!' };
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">✦</div><p>${msgs[asnTabMode]}</p></div>`;
    return;
  }
  el.innerHTML = filtered.map(a => asnRow(a, true)).join('');
}

/* ══ SCHEDULE ══ */
function renderSchedule() {
  const grid = document.getElementById('schedule-grid');
  const todayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];

  grid.innerHTML = DAYS.map(day => {
    const blocks = getScheduleForDay(day);
    const isToday = day === todayName;
    return `<div class="schedule-day-col">
      <div class="schedule-day-header${isToday?' today-header':''}">${day.slice(0,3)}</div>
      ${blocks.length ? blocks.map(b => {
        const cls = getClassById(b.classId);
        const color = cls ? cls.color : '#888';
        return `<div class="schedule-block" style="background:${color}18;border:1px solid ${color}35;color:${color}">
          <button class="remove-block" onclick="removeScheduleBlock('${b.id}');renderSchedule();renderOverview()" title="Remove">×</button>
          <div class="schedule-block-name">${escHtml(b.className)}</div>
          <div class="schedule-block-time">${formatTime(b.startTime)}–${formatTime(b.endTime)}</div>
          ${b.room ? `<div class="schedule-block-room">${escHtml(b.room)}</div>` : ''}
        </div>`;
      }).join('') : `<div class="schedule-empty">—</div>`}
    </div>`;
  }).join('');
}

/* ══ GRADES ══ */
function renderGrades() {
  rebuildClassFilter('grade-class-filter');
  renderGradeSummaries();
  renderGradeEntries();
}

function renderGradeSummaries() {
  const classes = getClasses();
  const el = document.getElementById('grade-summaries');
  if (!classes.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">◎</div><p>Add classes in Settings first, then add grades here.</p></div>`;
    return;
  }
  el.innerHTML = classes.map(c => {
    const pct = computeClassGrade(c.id);
    const [letter, badge] = gradeLabel(pct);
    const entries = getGradeEntriesForClass(c.id);
    return `<div class="grade-row">
      <span class="grade-name">${escHtml(c.name)}</span>
      <div class="grade-bar-wrap"><div class="grade-bar" style="width:${pct !== null ? pct : 0}%;background:${c.color}"></div></div>
      <span class="grade-pct">${pct !== null ? pct + '%' : '—'}</span>
      <span class="grade-letter badge ${badge}">${letter}</span>
      <span style="font-size:11px;color:var(--ink3);min-width:60px;text-align:right">${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}</span>
    </div>`;
  }).join('');
}

function renderGradeEntries() {
  const filterSel = document.getElementById('grade-class-filter');
  const filterVal = filterSel ? filterSel.value : 'all';
  let entries = getGradeEntries();
  if (filterVal && filterVal !== 'all') {
    entries = entries.filter(e => e.classId === filterVal);
  }
  entries = entries.sort((a,b) => (b.date || '').localeCompare(a.date || ''));

  const el = document.getElementById('grade-entries');
  if (!entries.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">◎</div><p>No grades entered yet.<br>Click "+ Add grade" to record a score.</p></div>`;
    return;
  }

  el.innerHTML = `<table class="grade-table">
    <thead><tr>
      <th>Assignment</th><th>Class</th><th>Category</th><th>Date</th><th>Score</th><th></th>
    </tr></thead>
    <tbody>${entries.map(e => {
      const pct = Math.round((Number(e.earned) / Number(e.possible)) * 1000) / 10;
      const [letter, badge] = gradeLabel(pct);
      const cls = getClassById(e.classId);
      return `<tr>
        <td>${escHtml(e.title)}</td>
        <td><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:7px;height:7px;border-radius:50%;background:${cls ? cls.color : '#888'};flex-shrink:0"></span>${escHtml(cls ? cls.name : '—')}</span></td>
        <td style="color:var(--ink3)">${escHtml(e.category || '—')}</td>
        <td style="color:var(--ink3)">${formatDate(e.date)}</td>
        <td><span class="grade-pct-pill badge ${badge}">${e.earned}/${e.possible} <span style="opacity:.7">(${pct}%)</span></span></td>
        <td><button class="row-remove" onclick="removeGradeEntry('${e.id}');renderGrades();renderOverview()" title="Remove">×</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

/* ══ ATTENDANCE ══ */
function renderAttendance() {
  const classes = getClasses();
  let totalPresent = 0, totalAbsent = 0;
  classes.forEach(c => {
    const records = getAttendanceForClass(c.id);
    records.forEach(r => r.present ? totalPresent++ : totalAbsent++);
  });
  const total = totalPresent + totalAbsent;
  const rate = total ? Math.round((totalPresent/total)*100) : null;
  document.getElementById('att-rate').textContent = rate !== null ? rate + '%' : '—';
  document.getElementById('att-present').textContent = totalPresent || '—';
  document.getElementById('att-absent').textContent = totalAbsent || '—';

  const el = document.getElementById('attend-list');
  if (!classes.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">▦</div><p>Add classes in Settings, then log attendance here.</p></div>`;
    return;
  }
  el.innerHTML = classes.map(c => {
    const records = getAttendanceForClass(c.id).slice(-15);
    const classRate = getAttendanceRate(c.id);
    const pips = records.map(r =>
      `<div class="pip" title="${r.date}: ${r.present?'Present':'Absent'}" style="background:${r.present?'var(--green)':'var(--red)'}"></div>`
    ).join('');
    return `<div class="attend-row">
      <span class="attend-name">${escHtml(c.name)}</span>
      <div class="attend-pips">${pips || '<span style="font-size:11px;color:var(--ink3)">No records yet</span>'}</div>
      <span class="attend-rate">${classRate !== null ? classRate + '%' : '—'}</span>
      <button class="attend-log-btn" onclick="quickLogAttendance('${c.id}')">Log today</button>
    </div>`;
  }).join('');
}

function quickLogAttendance(classId) {
  const cls = getClassById(classId);
  if (!cls) return;
  const today = todayISO();
  const existing = getAttendanceForClass(classId).find(r => r.date === today);
  const wasPresent = existing ? existing.present : null;
  const msg = wasPresent !== null
    ? `Today's record: ${wasPresent ? 'Present ✓' : 'Absent ✗'}\nChange to:`
    : `Log attendance for ${cls.name} today (${today}):`;
  const choice = confirm(`${msg}\n\nOK = Present  |  Cancel = Absent`);
  logAttendance(classId, today, choice);
  renderAttendance();
  renderOverview();
}

/* ══ SETTINGS ══ */
function renderSettings() {
  document.getElementById('set-first').value = userData.firstName || '';
  document.getElementById('set-last').value = userData.lastName || '';
  document.getElementById('set-email').value = currentUser.email || '';
  document.getElementById('set-grade').value = userData.grade || '11';
  renderSettingsClassList();
}

function renderSettingsClassList() {
  const classes = getClasses();
  document.getElementById('settings-class-list').innerHTML = classes.length
    ? classes.map(c => `
      <div class="class-row">
        <div class="class-dot" style="background:${c.color}"></div>
        <span class="class-name-text">${escHtml(c.name)}</span>
        <button class="row-remove" onclick="removeClassItem('${c.id}');renderAll()" title="Remove class">×</button>
      </div>`).join('')
    : `<p style="font-size:12px;color:var(--ink3);padding:6px 0">No classes yet.</p>`;
}

function addNewClass() {
  const name = document.getElementById('new-class-name').value.trim();
  const color = document.getElementById('new-class-color').value;
  if (!name) return;
  if (getClasses().find(c => c.name.toLowerCase() === name.toLowerCase())) {
    alert('A class with that name already exists.'); return;
  }
  addClassItem({ name, color });
  document.getElementById('new-class-name').value = '';
  renderSettingsClassList();
  rebuildAllClassFilters();
}

function saveProfile() {
  const first = document.getElementById('set-first').value.trim();
  const last  = document.getElementById('set-last').value.trim();
  const grade = document.getElementById('set-grade').value;
  if (!first || !last) return;
  updateProfile(first, last, grade);
  renderSidebar();
  renderOverview();
  const msg = document.getElementById('set-msg');
  msg.textContent = 'Saved!';
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 2000);
}

/* ══ MODALS ══ */
function openModal(name) {
  if (name === 'add-assignment') {
    rebuildClassSelect('m-asn-class');
    if (!getClasses().length) { alert('Add classes in Settings first!'); return; }
    const d = new Date(); d.setDate(d.getDate()+1);
    document.getElementById('m-asn-due').value = d.toISOString().slice(0,10);
    document.getElementById('m-asn-title').value = '';
  }
  if (name === 'add-block') {
    rebuildClassSelect('m-sch-class');
    if (!getClasses().length) { alert('Add classes in Settings first!'); return; }
  }
  if (name === 'add-grade') {
    rebuildClassSelect('m-grd-class');
    if (!getClasses().length) { alert('Add classes in Settings first!'); return; }
    document.getElementById('m-grd-date').value = todayISO();
    document.getElementById('m-grd-earned').value = '';
    document.getElementById('m-grd-preview').style.display = 'none';
    rebuildAssignmentSelect();
    document.getElementById('m-grd-title-group').style.display = 'flex';
    // Live preview
    ['m-grd-earned','m-grd-possible'].forEach(id => {
      document.getElementById(id).addEventListener('input', updateGradePreview);
    });
  }
  if (name === 'log-attendance') {
    document.getElementById('m-att-date').value = todayISO();
    buildAttendanceClassList();
  }
  document.getElementById('modal-' + name).classList.remove('hidden');
}

function closeModal(name) {
  document.getElementById('modal-' + name).classList.add('hidden');
}
function closeModalClick(e, name) {
  if (e.target === document.getElementById('modal-' + name)) closeModal(name);
}

function rebuildClassSelect(selectId) {
  const sel = document.getElementById(selectId);
  const classes = getClasses();
  sel.innerHTML = classes.length
    ? classes.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')
    : '<option value="">No classes — add in Settings</option>';
}

function rebuildAssignmentSelect() {
  const sel = document.getElementById('m-grd-assignment');
  const ungradedAsn = getAssignments().filter(a => a.status !== 'graded');
  sel.innerHTML = `<option value="">— pick an assignment —</option>
    ${ungradedAsn.map(a => `<option value="${a.id}">${escHtml(a.title)} (${escHtml(a.className)})</option>`).join('')}
    <option value="__new__">Enter manually</option>`;
  sel.onchange = () => {
    const val = sel.value;
    const titleGroup = document.getElementById('m-grd-title-group');
    if (val === '__new__' || val === '') {
      titleGroup.style.display = 'flex';
      document.getElementById('m-grd-title').value = '';
    } else {
      titleGroup.style.display = 'none';
      const asn = getAssignments().find(a => a.id === val);
      if (asn) {
        document.getElementById('m-grd-class').value = asn.classId;
        document.getElementById('m-grd-title').value = asn.title;
      }
    }
  };
}

function updateGradePreview() {
  const earned = parseFloat(document.getElementById('m-grd-earned').value);
  const possible = parseFloat(document.getElementById('m-grd-possible').value);
  const prev = document.getElementById('m-grd-preview');
  if (!isNaN(earned) && !isNaN(possible) && possible > 0) {
    const pct = Math.round((earned/possible)*1000)/10;
    const [letter] = gradeLabel(pct);
    prev.style.display = 'block';
    prev.textContent = `${earned} / ${possible} = ${pct}%  ·  ${letter}`;
  } else {
    prev.style.display = 'none';
  }
}

function buildAttendanceClassList() {
  const classes = getClasses();
  document.getElementById('m-att-classes').innerHTML = classes.length
    ? `<div class="card-title" style="margin-bottom:10px">Mark each class:</div>` +
      classes.map(c => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:13px;display:flex;align-items:center;gap:8px">
            <span style="width:8px;height:8px;border-radius:50%;background:${c.color};flex-shrink:0"></span>
            ${escHtml(c.name)}
          </span>
          <div style="display:flex;gap:6px">
            <button id="att-p-${c.id}" onclick="setAttBtn('${c.id}',true)" style="padding:5px 12px;font-size:11px;border-radius:6px;border:1px solid var(--green-border);background:var(--green-soft);color:var(--green);cursor:pointer;font-family:var(--font);font-weight:500">Present</button>
            <button id="att-a-${c.id}" onclick="setAttBtn('${c.id}',false)" style="padding:5px 12px;font-size:11px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--ink3);cursor:pointer;font-family:var(--font)">Absent</button>
          </div>
        </div>`).join('')
    : '<p style="font-size:12px;color:var(--ink3)">Add classes in Settings first.</p>';
}

function setAttBtn(classId, present) {
  const pBtn = document.getElementById('att-p-' + classId);
  const aBtn = document.getElementById('att-a-' + classId);
  if (!pBtn || !aBtn) return;
  if (present) {
    pBtn.style.cssText = 'padding:5px 12px;font-size:11px;border-radius:6px;border:1px solid var(--green);background:var(--green);color:#fff;cursor:pointer;font-family:var(--font);font-weight:500';
    aBtn.style.cssText = 'padding:5px 12px;font-size:11px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--ink3);cursor:pointer;font-family:var(--font)';
  } else {
    aBtn.style.cssText = 'padding:5px 12px;font-size:11px;border-radius:6px;border:1px solid var(--red);background:var(--red);color:#fff;cursor:pointer;font-family:var(--font);font-weight:500';
    pBtn.style.cssText = 'padding:5px 12px;font-size:11px;border-radius:6px;border:1px solid var(--border2);background:none;color:var(--ink3);cursor:pointer;font-family:var(--font)';
  }
  pBtn.dataset.selected = present ? 'true' : '';
  aBtn.dataset.selected = !present ? 'true' : '';
}

/* ══ SAVE MODALS ══ */
function saveAssignmentModal() {
  const title  = document.getElementById('m-asn-title').value.trim();
  const classId = document.getElementById('m-asn-class').value;
  const due    = document.getElementById('m-asn-due').value;
  const type   = document.getElementById('m-asn-type').value;
  const status = document.getElementById('m-asn-status').value;
  if (!title || !classId || !due) { alert('Please fill in title, class, and due date.'); return; }
  addAssignment({ title, classId, due, type, status });
  closeModal('add-assignment');
  renderAll();
}

function saveScheduleBlock() {
  const classId   = document.getElementById('m-sch-class').value;
  const day       = document.getElementById('m-sch-day').value;
  const startTime = document.getElementById('m-sch-start').value;
  const endTime   = document.getElementById('m-sch-end').value;
  const room      = document.getElementById('m-sch-room').value.trim();
  if (!classId || !day || !startTime || !endTime) return;
  const cls = getClassById(classId);
  addScheduleBlock({ classId, className: cls ? cls.name : '', day, startTime, endTime, room });
  closeModal('add-block');
  renderSchedule();
  renderOverview();
}

function saveGradeModal() {
  const asnSel   = document.getElementById('m-grd-assignment').value;
  const classId  = document.getElementById('m-grd-class').value;
  const earned   = parseFloat(document.getElementById('m-grd-earned').value);
  const possible = parseFloat(document.getElementById('m-grd-possible').value);
  const category = document.getElementById('m-grd-category').value;
  const date     = document.getElementById('m-grd-date').value;
  let title      = document.getElementById('m-grd-title').value.trim();

  if (!classId || isNaN(earned) || isNaN(possible) || possible <= 0) {
    alert('Please fill in class, earned points, and possible points.'); return;
  }
  if (!title) {
    const asn = asnSel && asnSel !== '__new__' ? getAssignments().find(a => a.id === asnSel) : null;
    title = asn ? asn.title : 'Untitled';
  }

  addGradeEntry({
    classId, title, earned, possible, category, date,
    assignmentId: (asnSel && asnSel !== '__new__' && asnSel !== '') ? asnSel : null
  });
  closeModal('add-grade');
  renderGrades();
  renderOverview();
}

function saveAttendanceModal() {
  const date = document.getElementById('m-att-date').value;
  const classes = getClasses();
  classes.forEach(c => {
    const pBtn = document.getElementById('att-p-' + c.id);
    const aBtn = document.getElementById('att-a-' + c.id);
    if (!pBtn) return;
    const pSelected = pBtn.dataset.selected === 'true';
    const aSelected = aBtn.dataset.selected === 'true';
    if (pSelected || aSelected) {
      logAttendance(c.id, date, pSelected);
    }
  });
  closeModal('log-attendance');
  renderAttendance();
  renderOverview();
}

/* ══ HELPERS ══ */
function rebuildClassFilter(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = `<option value="all">All classes</option>` +
    getClasses().map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
  if (cur) sel.value = cur;
}

function rebuildAllClassFilters() {
  rebuildClassFilter('asn-filter');
  rebuildClassFilter('grade-class-filter');
}

function renderAll() {
  renderOverview();
  renderAssignments();
  renderSchedule();
  renderGrades();
  renderAttendance();
  renderSettings();
  rebuildAllClassFilters();
}

function nav(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (el) el.classList.add('active');
}

/* ══ AI TUTOR ══ */
function quickAsk() {
  const v = document.getElementById('quick-input').value.trim();
  if (!v) return;
  document.getElementById('quick-input').value = '';
  nav('ai', document.querySelector('[data-page="ai"]'));
  setTimeout(() => { document.getElementById('ai-input').value = v; sendAI(); }, 50);
}

function sendToChat(msg) {
  nav('ai', document.querySelector('[data-page="ai"]'));
  setTimeout(() => { document.getElementById('ai-input').value = msg; sendAI(); }, 50);
}

async function sendAI() {
  const input = document.getElementById('ai-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  const msgs = document.getElementById('ai-messages');
  msgs.innerHTML += `<div class="ai-msg user">${escHtml(msg)}</div>`;
  const thinkId = 'tk' + Date.now();
  msgs.innerHTML += `<div class="ai-msg thinking" id="${thinkId}">Thinking…</div>`;
  msgs.scrollTop = msgs.scrollHeight;
  aiHistory.push({ role: 'user', content: msg });

  const classes = getClasses().map(c => {
    const pct = computeClassGrade(c.id);
    return `${c.name}${pct !== null ? ' (' + pct + '%)' : ''}`;
  }).join(', ') || 'none added yet';

  const assignments = getAssignments()
    .filter(a => a.status !== 'graded')
    .sort((a,b) => a.due.localeCompare(b.due))
    .slice(0, 10)
    .map(a => `${a.title} [${a.className}, due ${a.due}, ${a.status}]`)
    .join('; ') || 'none';

  const todaySched = getTodaySchedule().map(b => `${b.className} ${formatTime(b.startTime)}-${formatTime(b.endTime)}`).join(', ') || 'nothing scheduled';
  const name = userData.firstName || currentUser.firstName || 'Student';

  const system = `You are Scholar's AI tutor for ${name} (${formatGrade(userData.grade||'')}). Be warm, encouraging, and concise. Their classes with current grades: ${classes}. Upcoming assignments: ${assignments}. Today's schedule: ${todaySched}. Help with studying, homework questions, and school planning. Keep responses focused. No markdown formatting.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, system, messages: aiHistory.slice(-12) })
    });
    const data = await res.json();
    const reply = data.content?.find(b => b.type === 'text')?.text || "Sorry, I couldn't respond. Try again!";
    aiHistory.push({ role: 'assistant', content: reply });
    document.getElementById(thinkId)?.remove();
    msgs.innerHTML += `<div class="ai-msg assistant">${escHtml(reply)}</div>`;
  } catch(e) {
    document.getElementById(thinkId)?.remove();
    msgs.innerHTML += `<div class="ai-msg assistant">Connection issue — check you're online and try again.</div>`;
  }
  msgs.scrollTop = msgs.scrollHeight;
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ══ INTEGRATIONS PAGE (real) ══ */
function renderIntegrationsPage() {
  const googleConn = isGoogleConnected();
  const notionConn = isNotionConnected();

  document.getElementById('integrations-grid').innerHTML = `
    <div class="integration-card${googleConn ? ' connected' : ''}">
      <div class="int-left">
        <div class="int-icon">🎓</div>
        <div>
          <div class="int-name">Google Classroom</div>
          <div class="int-status${googleConn ? ' live' : ''}">${googleConn ? '● Synced — courses & assignments imported' : 'Import courses and assignments'}</div>
        </div>
      </div>
      ${googleConn
        ? `<button class="btn-secondary" style="font-size:11px" onclick="disconnectGoogle()">Disconnect</button>`
        : `<button class="connect-btn" onclick="connectGoogle()">Connect →</button>`}
    </div>

    <div class="integration-card${googleConn ? ' connected' : ''}">
      <div class="int-left">
        <div class="int-icon">📄</div>
        <div>
          <div class="int-name">Google Docs</div>
          <div class="int-status${googleConn ? ' live' : ''}">${googleConn ? '● Live — recent docs synced' : 'Access your documents'}</div>
        </div>
      </div>
      ${googleConn
        ? `<button class="btn-secondary" style="font-size:11px" onclick="disconnectGoogle()">Disconnect</button>`
        : `<button class="connect-btn" onclick="connectGoogle()">Connect →</button>`}
    </div>

    <div class="integration-card${googleConn ? ' connected' : ''}">
      <div class="int-left">
        <div class="int-icon">📅</div>
        <div>
          <div class="int-name">Google Calendar</div>
          <div class="int-status${googleConn ? ' live' : ''}">${googleConn ? '● Live — next 30 days synced' : 'See your schedule and events'}</div>
        </div>
      </div>
      ${googleConn
        ? `<button class="btn-secondary" style="font-size:11px" onclick="disconnectGoogle()">Disconnect</button>`
        : `<button class="connect-btn" onclick="connectGoogle()">Connect →</button>`}
    </div>

    <div class="integration-card${notionConn ? ' connected' : ''}">
      <div class="int-left">
        <div class="int-icon">◈</div>
        <div>
          <div class="int-name">Notion</div>
          <div class="int-status${notionConn ? ' live' : ''}">${notionConn ? '● Live — pages and databases synced' : 'Browse your notes and pages'}</div>
        </div>
      </div>
      ${notionConn
        ? `<button class="btn-secondary" style="font-size:11px" onclick="disconnectNotion()">Disconnect</button>`
        : `<button class="connect-btn" onclick="connectNotion()">Connect →</button>`}
    </div>`;

  // Sync button
  if (googleConn || notionConn) {
    document.getElementById('sync-btn-wrap').innerHTML =
      `<button class="btn-secondary" onclick="syncAll()">↻ Sync now</button>`;
  }
}

async function syncAll() {
  showToast('Syncing…');
  if (isGoogleConnected()) await loadGoogleData();
  if (isNotionConnected()) await loadNotionPages();
  renderAll();
  showToast('All data synced!');
}

/* ══ OVERRIDE CALENDAR with real events ══ */
function renderCalendarReal() {
  const events = getCalendarEvents();
  const el = document.getElementById('event-list');
  if (!el) return;

  const upcoming = events
    .filter(e => new Date(e.start) >= new Date())
    .slice(0, 8);

  if (!upcoming.length) {
    // Fall back to assignment-based calendar
    renderCalendar();
    return;
  }

  el.innerHTML = upcoming.map(e => {
    const d = new Date(e.start);
    const label = e.allDay
      ? d.toLocaleDateString('en-US', { month:'short', day:'numeric' })
      : d.toLocaleDateString('en-US', { month:'short', day:'numeric' }) + ' · ' +
        d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
    return `<div class="event-item">
      <div class="event-time">${label}</div>
      <div class="event-dot" style="background:var(--accent)"></div>
      <div>
        <div class="event-title">${escHtml(e.title)}</div>
        ${e.location ? `<div class="event-sub">${escHtml(e.location)}</div>` : ''}
      </div>
      ${e.link ? `<a href="${e.link}" target="_blank" style="font-size:11px;color:var(--accent);text-decoration:none;margin-left:auto;flex-shrink:0">Open ↗</a>` : ''}
    </div>`;
  }).join('');
}

/* ══ OVERRIDE DOCUMENTS with real data ══ */
function renderDocumentsReal() {
  const docs = getGoogleDocs();
  const gdocsEl = document.getElementById('gdocs-list');
  if (gdocsEl) {
    if (docs.length) {
      gdocsEl.innerHTML = docs.map(d => `
        <div class="doc-item" onclick="window.open('${d.link}','_blank')">
          <div class="doc-icon">📄</div>
          <div style="flex:1;min-width:0">
            <div class="doc-title">${escHtml(d.title)}</div>
            <div class="doc-meta">Edited ${formatRelativeTime(d.modified)}</div>
          </div>
          <span style="font-size:11px;color:var(--accent)">Open ↗</span>
        </div>`).join('');
    } else if (isGoogleConnected()) {
      gdocsEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📄</div><p>No Google Docs found in your Drive.</p></div>`;
    }
  }

  const notionPages = getNotionPages();
  const notionEl = document.getElementById('notion-list');
  if (notionEl) {
    if (notionPages.length) {
      notionEl.innerHTML = notionPages.map(p => `
        <div class="doc-item" onclick="window.open('${p.link}','_blank')">
          <div class="doc-icon">${p.icon}</div>
          <div style="flex:1;min-width:0">
            <div class="doc-title">${escHtml(p.title)}</div>
            <div class="doc-meta">${p.type === 'database' ? 'Database' : 'Page'} · Edited ${formatRelativeTime(p.edited)}</div>
          </div>
          <span style="font-size:11px;color:var(--accent)">Open ↗</span>
        </div>`).join('');
    } else if (isNotionConnected()) {
      notionEl.innerHTML = `<div class="empty-state"><div class="empty-icon">◈</div><p>No Notion pages found.<br>Make sure you've shared pages with the Scholar integration in Notion.</p></div>`;
    }
  }
}
