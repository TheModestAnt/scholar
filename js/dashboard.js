/* ── SCHOLAR DASHBOARD ── */

let gradeChartInst = null;
let attendChartInst = null;
let trendInit = false;
let aiHistory = [];

document.addEventListener('DOMContentLoaded', () => {
  initData();
  if (!currentUser) return;
  renderSidebar();
  renderOverview();
  renderGrades();
  renderAssignments();
  renderAttendance();
  renderCalendar();
  renderDocuments();
  renderSettings();
  setTimeout(() => {
    initAttendChart();
  }, 100);
});

/* ── SIDEBAR ── */
function renderSidebar() {
  const name = userData.firstName || currentUser.firstName;
  const grade = userData.grade || currentUser.grade;
  document.getElementById('user-name-sidebar').textContent = name;
  document.getElementById('user-grade-sidebar').textContent = formatGrade(grade);
  document.getElementById('user-avatar').textContent = (name[0] || 'S').toUpperCase();
}

/* ── OVERVIEW ── */
function renderOverview() {
  const name = userData.firstName || currentUser.firstName;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('greeting').textContent = `${greet}, ${name} ✦`;

  const now = new Date();
  document.getElementById('today-date').textContent =
    now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) +
    ' · ' + countDueSoon() + ' assignment' + (countDueSoon() !== 1 ? 's' : '') + ' due this week';

  document.getElementById('stat-gpa').textContent = computeGPA();
  document.getElementById('stat-due').textContent = countDueSoon();
  document.getElementById('stat-streak').textContent = userData.streak || 1;

  // Assignments preview
  const container = document.getElementById('overview-assignments');
  const upcoming = getAssignments()
    .filter(a => a.status !== 'submitted')
    .sort((a,b) => a.due.localeCompare(b.due))
    .slice(0, 4);
  container.innerHTML = upcoming.map(a => assignRow(a)).join('') || '<p style="font-size:12px;color:var(--ink3);padding:8px 0">No upcoming assignments 🎉</p>';

  // Schedule
  document.getElementById('overview-schedule').innerHTML = SCHEDULE.map(e => `
    <div class="event-item">
      <div class="event-time">${e.time}</div>
      <div class="event-dot" style="background:${e.color}"></div>
      <div><div class="event-title">${e.title}</div><div class="event-sub">${e.sub}</div></div>
    </div>`).join('');
}

function assignRow(a) {
  const [badge, cls] = statusBadge(a.status);
  const due = formatDue(a.due);
  const urgent = due === 'Today' || due === 'Tomorrow' || due === 'Past due';
  return `<div class="assign-item" style="${a.status==='submitted'?'opacity:.55':''}">
    <div class="assign-dot" style="background:${a.color}"></div>
    <div style="flex:1"><div class="assign-title">${a.title}</div><div class="assign-class">${a.className}</div></div>
    <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:3px">
      <div class="assign-due" style="${urgent&&a.status!=='submitted'?'color:var(--red)':''}">${due}</div>
      <span class="badge ${cls}">${badge}</span>
    </div>
  </div>`;
}

/* ── GRADES ── */
function renderGrades() {
  const classes = getClasses();
  document.getElementById('grade-bars').innerHTML = classes.map(c => {
    const [letter, cls] = gradeLabel(c.grade);
    return `<div class="grade-row">
      <span class="grade-name">${c.name}</span>
      <div class="grade-bar-wrap"><div class="grade-bar" style="width:${c.grade}%;background:${c.color}"></div></div>
      <span class="grade-pct">${c.grade}%</span>
      <span class="grade-letter badge ${cls}">${letter}</span>
    </div>`;
  }).join('');
  document.getElementById('current-gpa').textContent = computeGPA();
}

function initGradeChart() {
  const el = document.getElementById('gradeChart');
  if (!el) return;
  if (gradeChartInst) { gradeChartInst.destroy(); gradeChartInst = null; }
  gradeChartInst = new Chart(el, {
    type: 'line',
    data: {
      labels: GRADE_TREND.months,
      datasets: GRADE_TREND.datasets.map(d => ({
        label: d.label, data: d.data, borderColor: d.color,
        tension: .4, pointRadius: 3, fill: false, borderWidth: 2
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 10, padding: 14, font: { size: 11, family: 'DM Sans' } } } },
      scales: {
        y: { min: 75, max: 100, ticks: { font: { size: 11 } }, grid: { color: 'rgba(128,128,128,.1)' } },
        x: { ticks: { font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

/* ── ASSIGNMENTS ── */
function renderAssignments() {
  const all = getAssignments().sort((a,b) => {
    if (a.status === 'submitted' && b.status !== 'submitted') return 1;
    if (b.status === 'submitted' && a.status !== 'submitted') return -1;
    return a.due.localeCompare(b.due);
  });
  document.getElementById('assignment-list').innerHTML = all.map(a => `
    <div class="assign-item" style="${a.status==='submitted'?'opacity:.55':''}">
      <div class="assign-dot" style="background:${a.color}"></div>
      <div style="flex:1"><div class="assign-title">${a.title}</div><div class="assign-class">${a.className}</div></div>
      <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:3px">
        <div class="assign-due">${formatDue(a.due)}</div>
        <span class="badge ${statusBadge(a.status)[1]}">${statusBadge(a.status)[0]}</span>
      </div>
      <button onclick="removeAssignment(${a.id});renderAssignments();renderOverview()" style="background:none;border:none;cursor:pointer;color:var(--ink3);font-size:14px;margin-left:8px;padding:2px 4px" title="Remove">×</button>
    </div>`).join('') || '<p style="font-size:12px;color:var(--ink3);padding:12px 0">No assignments yet. Add one above!</p>';
}

function openAddAssignment() {
  // Populate class dropdown
  const sel = document.getElementById('modal-class');
  sel.innerHTML = getClasses().map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  // Default due date to tomorrow
  const d = new Date(); d.setDate(d.getDate()+1);
  document.getElementById('modal-due').value = d.toISOString().slice(0,10);
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function saveAssignment() {
  const title = document.getElementById('modal-title').value.trim();
  const className = document.getElementById('modal-class').value;
  const due = document.getElementById('modal-due').value;
  const status = document.getElementById('modal-status').value;
  if (!title || !due) return;
  addAssignment({ title, className, due, status });
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-title').value = '';
  renderAssignments();
  renderOverview();
}

function closeModal(e) {
  if (e.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay').classList.add('hidden');
  }
}

/* ── ATTENDANCE ── */
function renderAttendance() {
  const total = ATTENDANCE_DATA.present.reduce((a,b)=>a+b,0) + ATTENDANCE_DATA.absent.reduce((a,b)=>a+b,0);
  const totalPresent = ATTENDANCE_DATA.present.reduce((a,b)=>a+b,0);
  const totalAbsent = ATTENDANCE_DATA.absent.reduce((a,b)=>a+b,0);
  const rate = Math.round((totalPresent / total) * 100);
  document.getElementById('att-present').textContent = totalPresent;
  document.getElementById('att-absent').textContent = totalAbsent;
  document.getElementById('att-rate').textContent = rate + '%';

  const classAttend = [
    { name: 'AP Physics',     pips: [1,1,1,1,1,1,1,1,1,1], rate: '100%', badge: 'badge-green' },
    { name: 'Senior Seminar', pips: [1,1,1,1,1,1,1,1,1,1], rate: '100%', badge: 'badge-green' },
    { name: 'AP Calculus',    pips: [1,1,1,1,0,1,1,1,1,0], rate: '80%',  badge: 'badge-amber' },
    { name: 'World History',  pips: [1,1,1,1,1,1,1,1,1,1], rate: '100%', badge: 'badge-green' },
    { name: 'Art Studio',     pips: [1,1,1,1,1,1,1,1,1,1], rate: '100%', badge: 'badge-green' },
  ];
  document.getElementById('attendance-pips').innerHTML = classAttend.map(c => `
    <div class="attend-row">
      <span class="attend-name">${c.name}</span>
      <div class="attend-pips">${c.pips.map(p=>`<div class="pip" style="background:${p?'var(--green)':'var(--red)'}"></div>`).join('')}</div>
      <span class="badge ${c.badge}" style="margin-left:12px">${c.rate}</span>
    </div>`).join('');
}

function initAttendChart() {
  const el = document.getElementById('attendChart');
  if (!el || attendChartInst) return;
  attendChartInst = new Chart(el, {
    type: 'bar',
    data: {
      labels: ATTENDANCE_DATA.months,
      datasets: [
        { label: 'Present', data: ATTENDANCE_DATA.present, backgroundColor: 'rgba(45,140,94,.2)', borderColor: '#2d8c5e', borderWidth: 1.5, borderRadius: 4 },
        { label: 'Absent',  data: ATTENDANCE_DATA.absent,  backgroundColor: 'rgba(192,57,43,.2)',  borderColor: '#c0392b', borderWidth: 1.5, borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 10, padding: 12, font: { size: 11 } } } },
      scales: {
        y: { ticks: { font: { size: 11 } }, grid: { color: 'rgba(128,128,128,.1)' } },
        x: { ticks: { font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

/* ── CALENDAR ── */
function renderCalendar() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1);

  const days = ['Mon','Tue','Wed','Thu','Fri'];
  document.getElementById('week-view').innerHTML = days.map((d, i) => {
    const date = new Date(monday); date.setDate(monday.getDate() + i);
    const isToday = date.toDateString() === today.toDateString();
    const num = date.getDate();
    return `<div class="week-day${isToday?' today':''}">
      <div class="week-day-label">${d}</div>
      <div class="week-day-num">${num}</div>
      ${isToday ? '<div class="week-event" style="background:var(--accent2);color:var(--accent)">Today</div>' : ''}
    </div>`;
  }).join('');

  const upcoming = getAssignments()
    .filter(a => a.status !== 'submitted')
    .sort((a,b) => a.due.localeCompare(b.due))
    .slice(0, 6);

  document.getElementById('event-list').innerHTML = [
    ...SCHEDULE.map(e => ({ time: 'Today', title: e.title, sub: `Class · ${e.sub}`, color: e.color })),
    ...upcoming.map(a => ({ time: formatDue(a.due), title: a.title, sub: a.className, color: a.color }))
  ].slice(0, 8).map(e => `
    <div class="event-item">
      <div class="event-time">${e.time}</div>
      <div class="event-dot" style="background:${e.color}"></div>
      <div><div class="event-title">${e.title}</div><div class="event-sub">${e.sub}</div></div>
    </div>`).join('');
}

/* ── DOCUMENTS ── */
function renderDocuments() {
  document.getElementById('gdocs-list').innerHTML = GDOCS.map(d => `
    <div class="doc-item">
      <div class="doc-icon">${d.icon}</div>
      <div style="flex:1"><div class="doc-title">${d.title}</div><div class="doc-meta">${d.meta}</div></div>
      <span class="badge ${d.badgeCls}">${d.badge}</span>
    </div>`).join('');

  document.getElementById('notion-list').innerHTML = NOTION_DOCS.map(d => `
    <div class="doc-item">
      <div class="doc-icon">${d.icon}</div>
      <div style="flex:1"><div class="doc-title">${d.title}</div><div class="doc-meta">${d.meta}</div></div>
      <span class="tag">${d.tag}</span>
    </div>`).join('');
}

/* ── SETTINGS ── */
function renderSettings() {
  document.getElementById('settings-first').value = userData.firstName || '';
  document.getElementById('settings-last').value = userData.lastName || '';
  document.getElementById('settings-email').value = currentUser.email || '';
  document.getElementById('settings-grade').value = userData.grade || '11';
  renderClassList();
}

function renderClassList() {
  document.getElementById('class-list').innerHTML = getClasses().map(c => `
    <div class="class-item">
      <div class="class-dot" style="background:${c.color}"></div>
      <span class="class-name">${c.name}</span>
      <span style="font-size:11px;color:var(--ink3)">${c.grade}%</span>
      <button class="class-remove" onclick="removeClassAndRender('${c.name}')">×</button>
    </div>`).join('');
}

function removeClassAndRender(name) {
  removeClass(name);
  renderClassList();
  renderGrades();
}

function addClass() {
  const name = document.getElementById('new-class-name').value.trim();
  const color = document.getElementById('new-class-color').value;
  if (!name) return;
  if (getClasses().find(c => c.name === name)) return;
  addClassFn({ name, color, grade: 85 });
  document.getElementById('new-class-name').value = '';
  renderClassList();
  renderGrades();
}

// Alias to avoid name collision with data.js
function addClassFn(cls) { addClass(cls); }
// Actual call
function addClass(cls) {
  userData.classes = userData.classes || [];
  userData.classes.push(cls);
  saveUserData();
}

function saveSettings() {
  const first = document.getElementById('settings-first').value.trim();
  const last = document.getElementById('settings-last').value.trim();
  const grade = document.getElementById('settings-grade').value;
  if (!first || !last) return;
  updateProfile(first, last, grade);
  renderSidebar();
  renderOverview();
  const msg = document.getElementById('settings-msg');
  msg.textContent = 'Changes saved!';
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 2500);
}

/* ── PAGE SWITCHING ── */
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  el.classList.add('active');
  if (id === 'settings') renderSettings();
  if (id === 'attendance') { setTimeout(initAttendChart, 80); }
}

function setTab(el, show, hide) {
  const parent = el.closest('.page') || document.body;
  parent.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById(show).classList.remove('hidden');
  document.getElementById(hide).classList.add('hidden');
}

/* ── AI TUTOR ── */
function quickAsk() {
  const v = document.getElementById('quick-input').value.trim();
  if (!v) return;
  showPage('ai', document.querySelector('[data-page="ai"]'));
  document.getElementById('quick-input').value = '';
  sendToChat(v);
}

function sendToChat(msg) {
  showPage('ai', document.querySelector('[data-page="ai"]'));
  document.getElementById('ai-input').value = msg;
  sendAI();
}

async function sendAI() {
  const input = document.getElementById('ai-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  const messages = document.getElementById('ai-messages');

  // Show user message
  messages.innerHTML += `<div class="ai-msg user">${escHtml(msg)}</div>`;

  // Show thinking
  const thinkId = 'think-' + Date.now();
  messages.innerHTML += `<div class="ai-msg thinking" id="${thinkId}">Thinking…</div>`;
  messages.scrollTop = messages.scrollHeight;

  aiHistory.push({ role: 'user', content: msg });

  // Context string
  const classes = getClasses().map(c => `${c.name} (${c.grade}%)`).join(', ');
  const assignments = getAssignments().filter(a=>a.status!=='submitted').map(a=>`${a.title} [${a.className}, due ${a.due}]`).join('; ');
  const systemPrompt = `You are Scholar's built-in AI tutor for a student named ${currentUser.firstName}. Be warm, concise, and encouraging. Their classes: ${classes}. Upcoming assignments: ${assignments || 'none'}. Answer questions about school, homework, and studying. Keep responses focused and helpful. No markdown formatting.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: aiHistory.slice(-10)
      })
    });
    const data = await res.json();
    const reply = data.content?.find(b=>b.type==='text')?.text || 'Sorry, I had trouble responding. Try again!';
    aiHistory.push({ role: 'assistant', content: reply });
    document.getElementById(thinkId)?.remove();
    messages.innerHTML += `<div class="ai-msg assistant">${escHtml(reply)}</div>`;
  } catch(e) {
    document.getElementById(thinkId)?.remove();
    messages.innerHTML += `<div class="ai-msg assistant">Couldn't connect to the AI tutor right now. Make sure you're online!</div>`;
  }
  messages.scrollTop = messages.scrollHeight;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
