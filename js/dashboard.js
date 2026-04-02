/* ── SCHOLAR DASHBOARD ── */

let gradeChartInst = null;
let attendChartInst = null;
let trendInit = false;
let aiHistory = [];

document.addEventListener('DOMContentLoaded', () => {
  initData();
  if (!currentUser) return;
  renderSidebar();
  renderAll();
});

function renderAll() {
  renderOverview();
  renderGrades();
  renderAssignments();
  renderAttendance();
  renderCalendar();
  renderDocuments();
  renderSettings();
  renderIntegrationsPage();
  setTimeout(initAttendChart, 120);
}

/* ── SIDEBAR ── */
function renderSidebar() {
  const name = userData.firstName || currentUser.firstName || 'Student';
  const grade = userData.grade || currentUser.grade || '';
  document.getElementById('user-name-sidebar').textContent = name;
  document.getElementById('user-grade-sidebar').textContent = formatGrade(grade);
  document.getElementById('user-avatar').textContent = name[0].toUpperCase();
}

/* ── OVERVIEW ── */
function renderOverview() {
  const name = userData.firstName || currentUser.firstName || 'there';
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('greeting').textContent = `${greet}, ${name}`;

  const now = new Date();
  document.getElementById('today-date').textContent =
    now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const gpa = computeGPA();
  document.getElementById('stat-gpa').textContent = gpa;
  document.getElementById('stat-due').textContent = countDueSoon();
  document.getElementById('stat-streak').textContent = userData.streak || 1;

  // Upcoming assignments
  const container = document.getElementById('overview-assignments');
  const upcoming = getAssignments()
    .filter(a => a.status !== 'submitted')
    .sort((a,b) => a.due.localeCompare(b.due))
    .slice(0, 4);

  if (!upcoming.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🎉</div><p>No upcoming assignments!<br>Add one in the Assignments tab.</p></div>`;
  } else {
    container.innerHTML = upcoming.map(a => assignRow(a)).join('');
  }

  // Schedule — show notice if Google Calendar not connected
  const integ = getIntegrations();
  const schedContainer = document.getElementById('overview-schedule');
  if (!integ.googleCalendar) {
    schedContainer.innerHTML = `
      <div class="notice"><span class="notice-icon">📅</span>Connect Google Calendar to see your real schedule</div>
      ${DEMO_SCHEDULE.map(e => `
        <div class="event-item" style="opacity:.5">
          <div class="event-time">${e.time}</div>
          <div class="event-dot" style="background:${e.color}"></div>
          <div><div class="event-title">${e.title}</div><div class="event-sub">${e.sub}</div></div>
        </div>`).join('')}
      <button class="connect-btn" style="margin-top:12px;width:100%;padding:8px" onclick="showPage('integrations',document.querySelector('[data-page=integrations]'))">Connect Google Calendar →</button>`;
  } else {
    schedContainer.innerHTML = DEMO_SCHEDULE.map(e => `
      <div class="event-item">
        <div class="event-time">${e.time}</div>
        <div class="event-dot" style="background:${e.color}"></div>
        <div><div class="event-title">${e.title}</div><div class="event-sub">${e.sub}</div></div>
      </div>`).join('');
  }
}

function assignRow(a) {
  const [badge, cls] = statusBadge(a.status);
  const due = formatDue(a.due);
  const urgent = (due === 'Today' || due === 'Tomorrow' || due === 'Past due') && a.status !== 'submitted';
  return `<div class="assign-item" style="${a.status==='submitted'?'opacity:.5':''}">
    <div class="assign-dot" style="background:${a.color}"></div>
    <div style="flex:1"><div class="assign-title">${escHtml(a.title)}</div><div class="assign-class">${escHtml(a.className)}</div></div>
    <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:3px">
      <div class="assign-due" style="${urgent?'color:var(--red);font-weight:500':''}">${due}</div>
      <span class="badge ${cls}">${badge}</span>
    </div>
  </div>`;
}

/* ── GRADES ── */
function renderGrades() {
  const classes = getClasses();
  const integ = getIntegrations();

  let html = '';
  if (!integ.googleClassroom && !classes.length) {
    html = `<div class="notice"><span class="notice-icon">📚</span>Connect Google Classroom to import your grades automatically</div>
      <div class="empty-state"><div class="empty-state-icon">◎</div><p>No classes yet.<br>Add classes manually in Settings, or connect Google Classroom.</p>
      <button class="connect-btn" style="margin-top:14px" onclick="showPage('integrations',document.querySelector('[data-page=integrations]'))">Connect Google Classroom →</button></div>`;
  } else {
    html = classes.map(c => {
      const [letter, cls] = gradeLabel(c.grade);
      return `<div class="grade-row">
        <span class="grade-name">${escHtml(c.name)}</span>
        <div class="grade-bar-wrap"><div class="grade-bar" style="width:${c.grade}%;background:${c.color}"></div></div>
        <span class="grade-pct">${c.grade}%</span>
        <span class="grade-letter badge ${cls}">${letter}</span>
      </div>`;
    }).join('');
  }
  document.getElementById('grade-bars').innerHTML = html;

  const gpa = computeGPA();
  const gpaEl = document.getElementById('current-gpa');
  if (gpaEl) gpaEl.textContent = gpa;
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
        tension: .4, pointRadius: 3, fill: false, borderWidth: 2,
        pointBackgroundColor: d.color,
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 8, padding: 14, font: { size: 11, family: 'DM Sans' }, usePointStyle: true } } },
      scales: {
        y: { min: 75, max: 100, ticks: { font: { size: 11 } }, grid: { color: 'rgba(128,128,128,.1)' } },
        x: { ticks: { font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

/* ── ASSIGNMENTS ── */
function renderAssignments() {
  const integ = getIntegrations();
  const all = getAssignments().sort((a,b) => {
    if (a.status === 'submitted' && b.status !== 'submitted') return 1;
    if (b.status === 'submitted' && a.status !== 'submitted') return -1;
    return a.due.localeCompare(b.due);
  });

  let html = '';
  if (!integ.googleClassroom && !all.length) {
    html = `<div class="notice"><span class="notice-icon">📚</span>Connect Google Classroom to sync assignments automatically</div>
      <div class="empty-state"><div class="empty-state-icon">✦</div><p>No assignments yet.<br>Add one with the button above, or connect Google Classroom.</p></div>`;
  } else {
    html = all.map(a => `
      <div class="assign-item" style="${a.status==='submitted'?'opacity:.5':''}">
        <div class="assign-dot" style="background:${a.color}"></div>
        <div style="flex:1"><div class="assign-title">${escHtml(a.title)}</div><div class="assign-class">${escHtml(a.className)}</div></div>
        <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:3px">
          <div class="assign-due">${formatDue(a.due)}</div>
          <span class="badge ${statusBadge(a.status)[1]}">${statusBadge(a.status)[0]}</span>
        </div>
        <button onclick="removeAssignment(${a.id});renderAssignments();renderOverview()" title="Remove"
          style="background:none;border:none;cursor:pointer;color:var(--ink3);font-size:16px;margin-left:8px;padding:0 2px;line-height:1;transition:color .12s"
          onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--ink3)'">×</button>
      </div>`).join('') || `<div class="empty-state"><div class="empty-state-icon">🎉</div><p>All done! No assignments remaining.</p></div>`;
  }
  document.getElementById('assignment-list').innerHTML = html;
}

function openAddAssignment() {
  const sel = document.getElementById('modal-class');
  const classes = getClasses();
  if (!classes.length) {
    alert('Add some classes in Settings first!');
    return;
  }
  sel.innerHTML = classes.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  const d = new Date(); d.setDate(d.getDate()+1);
  document.getElementById('modal-due').value = d.toISOString().slice(0,10);
  document.getElementById('modal-title').value = '';
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
  renderAssignments();
  renderOverview();
}

function closeModal(e) {
  if (e.target === document.getElementById('modal-overlay'))
    document.getElementById('modal-overlay').classList.add('hidden');
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

  const integ = getIntegrations();
  const pipsContainer = document.getElementById('attendance-pips');

  if (!integ.googleClassroom) {
    pipsContainer.innerHTML = `<div class="notice" style="margin:0"><span class="notice-icon">▦</span>Connect Google Classroom to track real attendance. Showing example data below.</div>`;
    const exampleClasses = getClasses().slice(0, 5);
    const patterns = [[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,0,1,1,1,1,0],[1,1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1,1]];
    const rates = ['100%','100%','80%','100%','100%'];
    const badges = ['badge-green','badge-green','badge-amber','badge-green','badge-green'];
    const names = exampleClasses.length ? exampleClasses.map(c=>c.name) : ['AP Physics','Senior Seminar','AP Calculus','World History','Art Studio'];
    pipsContainer.innerHTML += names.map((name,i) => `
      <div class="attend-row" style="opacity:.6">
        <span class="attend-name">${escHtml(name)}</span>
        <div class="attend-pips">${(patterns[i]||patterns[0]).map(p=>`<div class="pip" style="background:${p?'var(--green)':'var(--red)'}"></div>`).join('')}</div>
        <span class="badge ${badges[i]}" style="margin-left:12px">${rates[i]}</span>
      </div>`).join('');
  } else {
    const classes = getClasses();
    pipsContainer.innerHTML = classes.map(c => `
      <div class="attend-row">
        <span class="attend-name">${escHtml(c.name)}</span>
        <div class="attend-pips">${[1,1,1,1,1,1,1,1,1,1].map(p=>`<div class="pip" style="background:var(--green)"></div>`).join('')}</div>
        <span class="badge badge-green" style="margin-left:12px">100%</span>
      </div>`).join('');
  }
}

function initAttendChart() {
  const el = document.getElementById('attendChart');
  if (!el || attendChartInst) return;
  attendChartInst = new Chart(el, {
    type: 'bar',
    data: {
      labels: ATTENDANCE_DATA.months,
      datasets: [
        { label: 'Present', data: ATTENDANCE_DATA.present, backgroundColor: 'rgba(22,163,74,.15)', borderColor: '#16a34a', borderWidth: 1.5, borderRadius: 5 },
        { label: 'Absent',  data: ATTENDANCE_DATA.absent,  backgroundColor: 'rgba(220,38,38,.15)', borderColor: '#dc2626', borderWidth: 1.5, borderRadius: 5 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 8, padding: 14, font: { size: 11 }, usePointStyle: true } } },
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
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  document.getElementById('week-view').innerHTML = ['Mon','Tue','Wed','Thu','Fri'].map((d, i) => {
    const date = new Date(monday); date.setDate(monday.getDate() + i);
    const isToday = date.toDateString() === today.toDateString();
    return `<div class="week-day${isToday?' today':''}">
      <div class="week-day-label">${d}</div>
      <div class="week-day-num">${date.getDate()}</div>
      ${isToday ? '<div class="week-event" style="background:var(--accent-soft);color:var(--accent)">Today</div>' : ''}
    </div>`;
  }).join('');

  const integ = getIntegrations();
  const eventList = document.getElementById('event-list');

  const upcoming = getAssignments()
    .filter(a => a.status !== 'submitted')
    .sort((a,b) => a.due.localeCompare(b.due))
    .slice(0, 5)
    .map(a => ({ date: formatDue(a.due), title: a.title, sub: a.className, color: a.color }));

  if (!integ.googleCalendar && !upcoming.length) {
    eventList.innerHTML = `
      <div class="notice"><span class="notice-icon">📅</span>Connect Google Calendar to see all your events here</div>
      ${DEMO_EVENTS.map(e=>`<div class="event-item" style="opacity:.45">
        <div class="event-time">${e.date}</div>
        <div class="event-dot" style="background:${e.color}"></div>
        <div><div class="event-title">${e.title}</div><div class="event-sub">${e.sub}</div></div>
      </div>`).join('')}
      <button class="connect-btn" style="margin-top:12px;width:100%;padding:8px" onclick="showPage('integrations',document.querySelector('[data-page=integrations]'))">Connect Google Calendar →</button>`;
  } else {
    eventList.innerHTML = (upcoming.length ? upcoming : DEMO_EVENTS).map(e => `
      <div class="event-item">
        <div class="event-time">${e.date}</div>
        <div class="event-dot" style="background:${e.color}"></div>
        <div><div class="event-title">${escHtml(e.title)}</div><div class="event-sub">${escHtml(e.sub)}</div></div>
      </div>`).join('');
  }
}

/* ── DOCUMENTS ── */
function renderDocuments() {
  const integ = getIntegrations();

  const gdocsEl = document.getElementById('gdocs-list');
  if (!integ.googleDocs) {
    gdocsEl.innerHTML = `
      <div class="notice"><span class="notice-icon">📄</span>Connect Google Docs to see your real documents here</div>
      ${DEMO_GDOCS.map(d=>`<div class="doc-item" style="opacity:.45">
        <div class="doc-icon">${d.icon}</div>
        <div style="flex:1"><div class="doc-title">${d.title}</div><div class="doc-meta">${d.meta}</div></div>
        <span class="badge ${d.badgeCls}">${d.badge}</span>
      </div>`).join('')}
      <button class="connect-btn" style="margin-top:12px;width:100%;padding:8px" onclick="showPage('integrations',document.querySelector('[data-page=integrations]'))">Connect Google Docs →</button>`;
  } else {
    gdocsEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📄</div><p>Google Docs connected!<br>Full API integration coming soon.</p></div>`;
  }

  const notionEl = document.getElementById('notion-list');
  if (!integ.notion) {
    notionEl.innerHTML = `
      <div class="notice"><span class="notice-icon">◈</span>Connect Notion to see your pages here</div>
      ${DEMO_NOTION.map(d=>`<div class="doc-item" style="opacity:.45">
        <div class="doc-icon">${d.icon}</div>
        <div style="flex:1"><div class="doc-title">${d.title}</div><div class="doc-meta">${d.meta}</div></div>
        <span class="tag">${d.tag}</span>
      </div>`).join('')}
      <button class="connect-btn" style="margin-top:12px;width:100%;padding:8px" onclick="showPage('integrations',document.querySelector('[data-page=integrations]'))">Connect Notion →</button>`;
  } else {
    notionEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">◈</div><p>Notion connected!<br>Full API integration coming soon.</p></div>`;
  }
}

/* ── INTEGRATIONS PAGE ── */
function renderIntegrationsPage() {
  const integ = getIntegrations();
  const integrations = [
    { key: 'googleClassroom', icon: '🏫', name: 'Google Classroom', desc: 'Sync grades, assignments & attendance', color: 'var(--accent)' },
    { key: 'googleDocs',      icon: '📄', name: 'Google Docs',      desc: 'Access your documents & drafts', color: '#16a34a' },
    { key: 'googleCalendar',  icon: '📅', name: 'Google Calendar',  desc: 'See your schedule & due dates', color: '#d97706' },
    { key: 'notion',          icon: '◈',  name: 'Notion',           desc: 'Browse your notes & pages', color: '#7c3aed' },
  ];

  document.getElementById('integrations-grid').innerHTML = integrations.map(i => {
    const connected = integ[i.key];
    return `<div class="integration-card${connected?' connected':''}">
      <div class="int-left">
        <div class="int-icon">${i.icon}</div>
        <div>
          <div class="int-name">${i.name}</div>
          <div class="int-status${connected?' live':''}">${connected ? '● Connected' : i.desc}</div>
        </div>
      </div>
      ${connected
        ? `<button class="btn-secondary" style="font-size:11px;padding:5px 10px;color:var(--ink3)" onclick="disconnectIntegration('${i.key}');renderAll()">Disconnect</button>`
        : `<button class="connect-btn" onclick="handleConnect('${i.key}')">Connect →</button>`
      }
    </div>`;
  }).join('');
}

function handleConnect(key) {
  // In production this would open an OAuth flow.
  // For now, mark as connected so the UI reflects the state.
  const names = {
    googleClassroom: 'Google Classroom',
    googleDocs: 'Google Docs',
    googleCalendar: 'Google Calendar',
    notion: 'Notion',
  };
  if (confirm(`Connect ${names[key]}?\n\n(In the full version this opens OAuth login. For now it will mark as connected so you can see how the dashboard changes.)`)) {
    connectIntegration(key);
    renderAll();
  }
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
  const classes = getClasses();
  document.getElementById('class-list').innerHTML = classes.length
    ? classes.map(c => `
      <div class="class-item">
        <div class="class-dot" style="background:${c.color}"></div>
        <span class="class-name">${escHtml(c.name)}</span>
        <span style="font-size:11px;color:var(--ink3)">${c.grade}%</span>
        <button class="class-remove" onclick="removeClassItem('${c.name.replace(/'/g,"\\'")}');renderClassList();renderGrades();renderAssignments()">×</button>
      </div>`).join('')
    : `<p style="font-size:12px;color:var(--ink3);padding:8px 0">No classes yet. Add one below!</p>`;
}

function addClassFromSettings() {
  const name = document.getElementById('new-class-name').value.trim();
  const color = document.getElementById('new-class-color').value;
  const gradeVal = parseInt(document.getElementById('new-class-grade').value) || 85;
  if (!name) return;
  if (getClasses().find(c => c.name === name)) return;
  addClassItem({ name, color, grade: gradeVal });
  document.getElementById('new-class-name').value = '';
  document.getElementById('new-class-grade').value = '85';
  renderClassList();
  renderGrades();
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
  if (el) el.classList.add('active');
  if (id === 'attendance') setTimeout(initAttendChart, 80);
  if (id === 'integrations') renderIntegrationsPage();
}

function setTab(el, show, hide) {
  const tabs = el.parentElement.querySelectorAll('.tab');
  tabs.forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById(show).classList.remove('hidden');
  document.getElementById(hide).classList.add('hidden');
}

/* ── AI TUTOR ── */
function quickAsk() {
  const v = document.getElementById('quick-input').value.trim();
  if (!v) return;
  document.getElementById('quick-input').value = '';
  showPage('ai', document.querySelector('[data-page="ai"]'));
  setTimeout(() => {
    document.getElementById('ai-input').value = v;
    sendAI();
  }, 50);
}

function sendToChat(msg) {
  showPage('ai', document.querySelector('[data-page="ai"]'));
  setTimeout(() => {
    document.getElementById('ai-input').value = msg;
    sendAI();
  }, 50);
}

async function sendAI() {
  const input = document.getElementById('ai-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  const messages = document.getElementById('ai-messages');
  messages.innerHTML += `<div class="ai-msg user">${escHtml(msg)}</div>`;

  const thinkId = 'think-' + Date.now();
  messages.innerHTML += `<div class="ai-msg thinking" id="${thinkId}">Thinking…</div>`;
  messages.scrollTop = messages.scrollHeight;

  aiHistory.push({ role: 'user', content: msg });

  const classes = getClasses().map(c => `${c.name} (${c.grade}%)`).join(', ') || 'none added yet';
  const assignments = getAssignments().filter(a=>a.status!=='submitted').map(a=>`${a.title} [${a.className}, due ${a.due}]`).join('; ') || 'none';
  const systemPrompt = `You are Scholar's AI tutor for a student named ${currentUser.firstName}. Be warm, concise, and encouraging. Their classes: ${classes}. Upcoming assignments: ${assignments}. Help with studying, homework, and school questions. Keep responses clear and focused. No markdown.`;

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
    const reply = data.content?.find(b=>b.type==='text')?.text || "Sorry, I couldn't respond. Try again!";
    aiHistory.push({ role: 'assistant', content: reply });
    document.getElementById(thinkId)?.remove();
    messages.innerHTML += `<div class="ai-msg assistant">${escHtml(reply)}</div>`;
  } catch(e) {
    document.getElementById(thinkId)?.remove();
    messages.innerHTML += `<div class="ai-msg assistant">Couldn't connect right now. Make sure you're online!</div>`;
  }
  messages.scrollTop = messages.scrollHeight;
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
