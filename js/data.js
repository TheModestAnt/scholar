/* ── SCHOLAR DATA LAYER v3 ── */
/* All data lives in localStorage under the user's email key */

let currentUser = null;
let userData = null;

function initData() {
  currentUser = requireAuth();
  if (!currentUser) return;
  const users = getUsers();
  userData = users[currentUser.email];
  // Migrate old accounts missing new fields
  if (!userData.assignments) userData.assignments = [];
  if (!userData.classes) userData.classes = [];
  if (!userData.schedule) userData.schedule = [];      // [{day,startTime,endTime,className,room}]
  if (!userData.attendance) userData.attendance = {};   // {classId: [{date, present}]}
  if (!userData.gradeEntries) userData.gradeEntries = []; // [{id,classId,title,earned,possible,date,category}]
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
  const daysSince = Math.floor((now - last) / 86400000);
  if (daysSince === 1) userData.streak = (userData.streak || 1) + 1;
  else if (daysSince > 1) userData.streak = 1;
  userData.lastLogin = now;
  saveUserData();
}

/* ── CLASSES ── */
function getClasses() { return userData.classes || []; }

function addClassItem(cls) {
  cls.id = cls.id || 'cls_' + Date.now();
  userData.classes.push(cls);
  saveUserData();
  return cls;
}

function removeClassItem(id) {
  userData.classes = userData.classes.filter(c => c.id !== id);
  // Also clean up related data
  userData.assignments = userData.assignments.filter(a => a.classId !== id);
  userData.gradeEntries = userData.gradeEntries.filter(g => g.classId !== id);
  if (userData.attendance[id]) delete userData.attendance[id];
  userData.schedule = userData.schedule.filter(s => s.classId !== id);
  saveUserData();
}

function getClassById(id) { return getClasses().find(c => c.id === id); }

/* ── SCHEDULE ── */
function getSchedule() { return userData.schedule || []; }

function addScheduleBlock(block) {
  block.id = 'sch_' + Date.now();
  userData.schedule.push(block);
  saveUserData();
  return block;
}

function removeScheduleBlock(id) {
  userData.schedule = userData.schedule.filter(s => s.id !== id);
  saveUserData();
}

function getScheduleForDay(day) {
  return getSchedule()
    .filter(s => s.day === day)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function getTodaySchedule() {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today = days[new Date().getDay()];
  return getScheduleForDay(today);
}

/* ── ASSIGNMENTS ── */
function getAssignments() { return userData.assignments || []; }

function addAssignment(a) {
  a.id = 'asn_' + Date.now();
  const cls = getClassById(a.classId);
  a.color = cls ? cls.color : '#888';
  a.className = cls ? cls.name : a.className || '';
  userData.assignments.push(a);
  saveUserData();
  return a;
}

function updateAssignment(id, changes) {
  const idx = userData.assignments.findIndex(a => a.id === id);
  if (idx >= 0) {
    userData.assignments[idx] = { ...userData.assignments[idx], ...changes };
    saveUserData();
  }
}

function removeAssignment(id) {
  userData.assignments = userData.assignments.filter(a => a.id !== id);
  saveUserData();
}

function countDueSoon() {
  const now = new Date(); now.setHours(0,0,0,0);
  const week = new Date(now.getTime() + 7 * 86400000);
  return getAssignments().filter(a => {
    if (a.status === 'submitted' || a.status === 'graded') return false;
    const d = new Date(a.due + 'T00:00:00');
    return d >= now && d <= week;
  }).length;
}

/* ── GRADE ENTRIES ── */
function getGradeEntries() { return userData.gradeEntries || []; }

function addGradeEntry(entry) {
  entry.id = 'grd_' + Date.now();
  userData.gradeEntries.push(entry);
  // Also update assignment status to graded
  if (entry.assignmentId) {
    updateAssignment(entry.assignmentId, { status: 'graded', earned: entry.earned, possible: entry.possible });
  }
  saveUserData();
  return entry;
}

function removeGradeEntry(id) {
  userData.gradeEntries = userData.gradeEntries.filter(g => g.id !== id);
  saveUserData();
}

function getGradeEntriesForClass(classId) {
  return getGradeEntries().filter(g => g.classId === classId);
}

function computeClassGrade(classId) {
  const entries = getGradeEntriesForClass(classId);
  if (!entries.length) return null;
  const totalEarned = entries.reduce((s, e) => s + (Number(e.earned) || 0), 0);
  const totalPossible = entries.reduce((s, e) => s + (Number(e.possible) || 0), 0);
  if (!totalPossible) return null;
  return Math.round((totalEarned / totalPossible) * 1000) / 10;
}

function computeGPA() {
  const classes = getClasses();
  if (!classes.length) return '—';
  const grades = classes.map(c => computeClassGrade(c.id)).filter(g => g !== null);
  if (!grades.length) return '—';
  const avg = grades.reduce((s, g) => s + g, 0) / grades.length;
  return (Math.round((avg / 100) * 4.3 * 10) / 10).toFixed(1);
}

/* ── ATTENDANCE ── */
function getAttendanceForClass(classId) {
  return userData.attendance[classId] || [];
}

function logAttendance(classId, date, present) {
  if (!userData.attendance[classId]) userData.attendance[classId] = [];
  const existing = userData.attendance[classId].findIndex(a => a.date === date);
  if (existing >= 0) {
    userData.attendance[classId][existing].present = present;
  } else {
    userData.attendance[classId].push({ date, present });
  }
  saveUserData();
}

function getAttendanceRate(classId) {
  const records = getAttendanceForClass(classId);
  if (!records.length) return null;
  const present = records.filter(r => r.present).length;
  return Math.round((present / records.length) * 100);
}

function getOverallAttendanceRate() {
  const classes = getClasses();
  if (!classes.length) return null;
  const rates = classes.map(c => getAttendanceRate(c.id)).filter(r => r !== null);
  if (!rates.length) return null;
  return Math.round(rates.reduce((s,r) => s+r, 0) / rates.length);
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

/* ── HELPERS ── */
function formatDue(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date(); now.setHours(0,0,0,0);
  const diff = Math.round((d - now) / 86400000);
  if (diff < -1) return `${Math.abs(diff)}d overdue`;
  if (diff === -1) return 'Yesterday';
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 7) return `${diff}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function gradeLabel(pct) {
  if (pct === null || pct === undefined) return ['—', 'badge-gray'];
  if (pct >= 97) return ['A+', 'badge-green'];
  if (pct >= 93) return ['A',  'badge-green'];
  if (pct >= 90) return ['A−', 'badge-blue'];
  if (pct >= 87) return ['B+', 'badge-amber'];
  if (pct >= 83) return ['B',  'badge-amber'];
  if (pct >= 80) return ['B−', 'badge-amber'];
  if (pct >= 77) return ['C+', 'badge-gray'];
  return ['C or below', 'badge-red'];
}

function statusBadge(s) {
  return {
    'graded':      ['Graded',      'badge-green'],
    'submitted':   ['Submitted',   'badge-blue'],
    'in-progress': ['In Progress', 'badge-amber'],
    'not-started': ['Not Started', 'badge-gray'],
  }[s] || ['Unknown', 'badge-gray'];
}

function formatGrade(g) {
  return {'6':'6th','7':'7th','8':'8th','9':'9th','10':'10th','11':'11th','12':'12th',
    'college-1':'College Y1','college-2':'College Y2','college-3':'College Y3','college-4':'College Y4'}[g] || g;
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${m.toString().padStart(2,'0')} ${ampm}`;
}

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DAYS_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const GRADE_COLORS = [
  '#4f6ef7','#16a34a','#7c3aed','#d97706','#e91e8c',
  '#0891b2','#dc2626','#65a30d','#9333ea','#ea580c'
];
