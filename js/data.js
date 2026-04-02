/* ── SCHOLAR DATA LAYER ── */

let currentUser = null;
let userData = null;

function initData() {
  currentUser = requireAuth();
  if (!currentUser) return;
  const users = getUsers();
  userData = users[currentUser.email];
  updateStreak();
}

function saveUserData() {
  const users = getUsers();
  users[currentUser.email] = userData;
  saveUsers(users);
}

function updateStreak() {
  const last = userData.lastLogin || 0;
  const now = Date.now();
  const dayMs = 86400000;
  const daysSince = Math.floor((now - last) / dayMs);
  if (daysSince === 1) userData.streak = (userData.streak || 1) + 1;
  else if (daysSince > 1) userData.streak = 1;
  userData.lastLogin = now;
  saveUserData();
}

/* ── INTEGRATIONS ── */
function getIntegrations() {
  return userData.integrations || {
    googleClassroom: false,
    googleDocs: false,
    notion: false,
    googleCalendar: false
  };
}

function connectIntegration(key) {
  userData.integrations = getIntegrations();
  userData.integrations[key] = true;
  saveUserData();
}

function disconnectIntegration(key) {
  userData.integrations = getIntegrations();
  userData.integrations[key] = false;
  saveUserData();
}

function anyConnected() {
  const i = getIntegrations();
  return i.googleClassroom || i.googleDocs || i.notion || i.googleCalendar;
}

/* ── CLASSES ── */
function getClasses() { return userData.classes || []; }

function addClassItem(cls) {
  userData.classes = userData.classes || [];
  userData.classes.push(cls);
  saveUserData();
}

function removeClassItem(name) {
  userData.classes = userData.classes.filter(c => c.name !== name);
  saveUserData();
}

/* ── ASSIGNMENTS ── */
function getAssignments() { return userData.assignments || []; }

function addAssignment(a) {
  userData.assignments = userData.assignments || [];
  a.id = Date.now();
  const cls = getClasses().find(c => c.name === a.className);
  a.color = cls ? cls.color : '#888';
  userData.assignments.push(a);
  saveUserData();
}

function removeAssignment(id) {
  userData.assignments = userData.assignments.filter(a => a.id !== id);
  saveUserData();
}

/* ── PROFILE ── */
function updateProfile(first, last, grade) {
  userData.firstName = first;
  userData.lastName = last;
  userData.grade = grade;
  currentUser.firstName = first;
  currentUser.lastName = last;
  currentUser.grade = grade;
  setSession(currentUser);
  saveUserData();
}

/* ── COMPUTED ── */
function computeGPA() {
  const classes = getClasses();
  if (!classes.length) return '—';
  const avg = classes.reduce((s, c) => s + (c.grade || 0), 0) / classes.length;
  return Math.round((avg / 100) * 4.3 * 10) / 10;
}

function countDueSoon() {
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 86400000);
  return getAssignments().filter(a => {
    if (a.status === 'submitted') return false;
    const d = new Date(a.due + 'T00:00:00');
    return d >= now && d <= week;
  }).length;
}

function gradeLabel(pct) {
  if (pct >= 97) return ['A+', 'badge-green'];
  if (pct >= 93) return ['A',  'badge-green'];
  if (pct >= 90) return ['A−', 'badge-blue'];
  if (pct >= 87) return ['B+', 'badge-amber'];
  if (pct >= 83) return ['B',  'badge-amber'];
  if (pct >= 80) return ['B−', 'badge-amber'];
  return ['C', 'badge-gray'];
}

function statusBadge(s) {
  return {
    'submitted':   ['Submitted',   'badge-green'],
    'in-progress': ['In Progress', 'badge-blue'],
    'not-started': ['Not Started', 'badge-gray'],
  }[s] || ['Unknown', 'badge-gray'];
}

function formatDue(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date(); now.setHours(0,0,0,0);
  const diff = Math.round((d - now) / 86400000);
  if (diff < 0) return 'Past due';
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 7) return `In ${diff} days`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatGrade(g) {
  return {
    '6':'6th Grade','7':'7th Grade','8':'8th Grade',
    '9':'9th Grade','10':'10th Grade','11':'11th Grade','12':'12th Grade',
    'college-1':'College · Year 1','college-2':'College · Year 2',
    'college-3':'College · Year 3','college-4':'College · Year 4',
  }[g] || `Grade ${g}`;
}

/* ── STATIC DEMO DATA (only shown when integrations not connected) ── */
const DEMO_SCHEDULE = [
  { time: '8:15 am', title: 'AP Physics', sub: 'Room 204', color: '#4f6ef7' },
  { time: '10:00 am', title: 'Senior Seminar', sub: 'Library', color: '#16a34a' },
  { time: '1:00 pm', title: 'AP Calculus', sub: 'Room 118', color: '#7c3aed' },
  { time: '3:30 pm', title: 'Art Studio', sub: 'Elective', color: '#d97706' },
];

const DEMO_EVENTS = [
  { date: 'Apr 7', title: 'Animation Essay Draft', sub: 'Senior Seminar', color: '#16a34a' },
  { date: 'Apr 10', title: 'WWI Source Analysis', sub: 'World History', color: '#d97706' },
  { date: 'Apr 15', title: 'AP Calculus Midterm', sub: 'Room 118 · 7:30am', color: '#7c3aed' },
  { date: 'Apr 22', title: 'Art Show Opening', sub: 'Main Gallery · 6pm', color: '#e91e8c' },
];

const DEMO_GDOCS = [
  { icon: '📄', title: 'Sample Essay Draft', meta: 'Connect Google Docs to see your real files', badge: 'Example', badgeCls: 'badge-gray' },
  { icon: '📊', title: 'Sample Lab Report', meta: 'Connect Google Docs to see your real files', badge: 'Example', badgeCls: 'badge-gray' },
];

const DEMO_NOTION = [
  { icon: '📋', title: 'Sample Notes Page', meta: 'Connect Notion to see your real pages', tag: 'Example' },
];

const GRADE_TREND = {
  months: ['Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr'],
  datasets: [
    { label: 'Physics',   data: [88,89,90,91,90,92,91,91], color: '#4f6ef7' },
    { label: 'Calculus',  data: [80,81,82,84,83,84,84,84], color: '#7c3aed' },
    { label: 'Art',       data: [95,96,97,98,97,98,98,98], color: '#e91e8c' },
    { label: 'English',   data: [84,85,86,87,87,87,88,87], color: '#16a34a' },
  ]
};

const ATTENDANCE_DATA = {
  months: ['Sep','Oct','Nov','Dec','Jan','Feb','Mar'],
  present: [20,21,19,18,20,20,20],
  absent:  [0, 0, 1, 0, 0, 1, 0],
};
