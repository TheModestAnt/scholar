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
  if (daysSince === 1) {
    userData.streak = (userData.streak || 1) + 1;
  } else if (daysSince > 1) {
    userData.streak = 1;
  }
  userData.lastLogin = now;
  saveUserData();
}

function getClasses() { return userData.classes || []; }
function getAssignments() { return userData.assignments || []; }

function addAssignment(a) {
  userData.assignments = userData.assignments || [];
  a.id = Date.now();
  // Inherit color from class
  const cls = getClasses().find(c => c.name === a.className);
  a.color = cls ? cls.color : '#888';
  userData.assignments.push(a);
  saveUserData();
}

function removeAssignment(id) {
  userData.assignments = userData.assignments.filter(a => a.id !== id);
  saveUserData();
}

function addClass(cls) {
  userData.classes = userData.classes || [];
  userData.classes.push(cls);
  saveUserData();
}

function removeClass(name) {
  userData.classes = userData.classes.filter(c => c.name !== name);
  saveUserData();
}

function updateProfile(first, last, grade) {
  userData.firstName = first;
  userData.lastName = last;
  userData.grade = grade;
  // Update session too
  currentUser.firstName = first;
  currentUser.lastName = last;
  currentUser.grade = grade;
  setSession(currentUser);
  saveUserData();
}

function computeGPA() {
  const classes = getClasses();
  if (!classes.length) return 0;
  const avg = classes.reduce((s, c) => s + (c.grade || 0), 0) / classes.length;
  const gpa = (avg / 100) * 4.3;
  return Math.round(gpa * 10) / 10;
}

function countDueSoon() {
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 86400000);
  return getAssignments().filter(a => {
    if (a.status === 'submitted') return false;
    const d = new Date(a.due);
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
  if (pct >= 77) return ['C+', 'badge-gray'];
  return ['C', 'badge-gray'];
}

function gradeColor(pct) {
  if (pct >= 90) return '#2d8c5e';
  if (pct >= 80) return '#3d6fff';
  if (pct >= 70) return '#b85c00';
  return '#c0392b';
}

function statusBadge(s) {
  const m = {
    'submitted':   ['Submitted',   'badge-green'],
    'in-progress': ['In Progress', 'badge-blue'],
    'not-started': ['Not Started', 'badge-gray'],
  };
  return m[s] || ['Unknown', 'badge-gray'];
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
  const m = {
    '6':'6th Grade','7':'7th Grade','8':'8th Grade',
    '9':'9th Grade','10':'10th Grade','11':'11th Grade','12':'12th Grade',
    'college-1':'College · Year 1','college-2':'College · Year 2',
    'college-3':'College · Year 3','college-4':'College · Year 4',
  };
  return m[g] || `Grade ${g}`;
}

/* Static schedule + events for demo */
const SCHEDULE = [
  { time: '8:15 am', title: 'AP Physics', sub: 'Room 204 · 50 min', color: '#3d6fff' },
  { time: '10:00 am', title: 'Senior Seminar', sub: 'Library · 50 min', color: '#2d8c5e' },
  { time: '1:00 pm', title: 'AP Calculus', sub: 'Room 118 · 50 min', color: '#9b59b6' },
  { time: '3:30 pm', title: 'Art Studio', sub: 'Elective · 90 min', color: '#b85c00' },
];

const GDOCS = [
  { icon: '📄', title: 'Animation Essay — Senior Project', meta: 'Edited 2 hours ago · Senior Seminar', badge: 'Draft', badgeCls: 'badge-blue' },
  { icon: '📄', title: 'Physics Cheat Sheet — Kinematics', meta: 'Edited yesterday · AP Physics', badge: 'Final', badgeCls: 'badge-green' },
  { icon: '📄', title: 'WWI Primary Source Notes', meta: 'Edited 3 days ago · World History', badge: 'In Progress', badgeCls: 'badge-amber' },
  { icon: '📊', title: 'Lab Report — Projectile Motion', meta: 'Edited 4 days ago · AP Physics', badge: 'Draft', badgeCls: 'badge-amber' },
  { icon: '📄', title: 'English Lit Reflection #6', meta: 'Edited last week · English Lit', badge: 'Submitted', badgeCls: 'badge-green' },
];

const NOTION_DOCS = [
  { icon: '🌌', title: 'Veyra & Cael Universe Notes', meta: 'Personal worldbuilding · Updated today', tag: 'Creative' },
  { icon: '⚛️', title: 'Physics Notes — All Units', meta: 'AP Physics · Converted from Notion', tag: 'School' },
  { icon: '🎮', title: 'Void Drift — Game Design Doc', meta: 'Godot project · Updated 2 days ago', tag: 'Project' },
  { icon: '🎨', title: 'Art Techniques Reference', meta: 'Watercolor, ink, oil · Updated this week', tag: 'Art' },
  { icon: '📋', title: 'Senior Project Tracker', meta: 'Milestones + deadlines', tag: 'School' },
];

const ATTENDANCE_DATA = {
  months: ['Sep','Oct','Nov','Dec','Jan','Feb','Mar'],
  present: [20,21,19,18,20,20,20],
  absent:  [0, 0, 1, 0, 0, 1, 0],
};

const GRADE_TREND = {
  months: ['Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr'],
  datasets: [
    { label: 'AP Physics',     data: [88,89,90,91,90,92,91,91], color: '#3d6fff' },
    { label: 'AP Calculus',    data: [80,81,82,84,83,84,84,84], color: '#9b59b6' },
    { label: 'Art Studio',     data: [95,96,97,98,97,98,98,98], color: '#e91e8c' },
    { label: 'English Lit',    data: [84,85,86,87,87,87,88,87], color: '#16a085' },
  ]
};
