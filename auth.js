/* ── SCHOLAR AUTH ── */
/* Uses localStorage for account storage (works on GitHub Pages) */

const USERS_KEY = 'scholar_users';
const SESSION_KEY = 'scholar_session';

function getUsers() {
  return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
}
function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
function getSession() {
  return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
}
function setSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

/* ── Redirect logic ── */
function requireAuth() {
  const s = getSession();
  if (!s) { window.location.href = 'index.html'; return null; }
  return s;
}
function redirectIfLoggedIn() {
  const s = getSession();
  if (s) window.location.href = 'dashboard.html';
}

/* ── Auto-redirect on auth page ── */
if (document.body.classList.contains('auth-page')) {
  redirectIfLoggedIn();
}

/* ── Tab switching ── */
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('form-' + tab).classList.add('active');
}

/* ── Login ── */
function handleLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');

  if (!email || !password) {
    showError(err, 'Please fill in all fields.');
    return;
  }

  const users = getUsers();
  const user = users[email];
  if (!user || user.password !== hashPassword(password)) {
    showError(err, 'Incorrect email or password.');
    return;
  }

  setSession({ email, firstName: user.firstName, lastName: user.lastName, grade: user.grade });
  window.location.href = 'dashboard.html';
}

/* ── Signup ── */
function handleSignup() {
  const first = document.getElementById('signup-first').value.trim();
  const last = document.getElementById('signup-last').value.trim();
  const email = document.getElementById('signup-email').value.trim().toLowerCase();
  const grade = document.getElementById('signup-grade').value;
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-confirm').value;
  const err = document.getElementById('signup-error');
  const success = document.getElementById('signup-success');

  err.classList.add('hidden');
  success.classList.add('hidden');

  if (!first || !last || !email || !grade || !password) {
    showError(err, 'Please fill in all fields.'); return;
  }
  if (!email.includes('@')) {
    showError(err, 'Please enter a valid email.'); return;
  }
  if (password.length < 8) {
    showError(err, 'Password must be at least 8 characters.'); return;
  }
  if (password !== confirm) {
    showError(err, 'Passwords do not match.'); return;
  }

  const users = getUsers();
  if (users[email]) {
    showError(err, 'An account with this email already exists.'); return;
  }

  users[email] = {
    firstName: first,
    lastName: last,
    grade,
    password: hashPassword(password),
    createdAt: Date.now(),
    classes: defaultClasses(),
    assignments: defaultAssignments(),
    streak: 1,
    lastLogin: Date.now()
  };
  saveUsers(users);

  success.textContent = 'Account created! Signing you in…';
  success.classList.remove('hidden');

  setTimeout(() => {
    setSession({ email, firstName: first, lastName: last, grade });
    window.location.href = 'dashboard.html';
  }, 900);
}

/* ── Demo ── */
function loadDemo() {
  const email = 'demo@scholar.app';
  const users = getUsers();
  if (!users[email]) {
    users[email] = {
      firstName: 'Demo',
      lastName: 'Student',
      grade: '11',
      password: hashPassword('demo1234'),
      createdAt: Date.now(),
      classes: defaultClasses(),
      assignments: defaultAssignments(),
      streak: 12,
      lastLogin: Date.now()
    };
    saveUsers(users);
  }
  setSession({ email, firstName: 'Demo', lastName: 'Student', grade: '11' });
  window.location.href = 'dashboard.html';
}

/* ── Sign out ── */
function handleSignOut() {
  clearSession();
  window.location.href = 'index.html';
}

/* ── Delete account ── */
function deleteAccount() {
  if (!confirm('Delete your account? All data will be removed. This cannot be undone.')) return;
  const s = getSession();
  if (s) {
    const users = getUsers();
    delete users[s.email];
    saveUsers(users);
  }
  clearSession();
  window.location.href = 'index.html';
}

/* ── Helpers ── */
function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

/* Very simple hash — fine for localStorage demo; not for production servers */
function hashPassword(pw) {
  let h = 0;
  for (let i = 0; i < pw.length; i++) {
    h = (Math.imul(31, h) + pw.charCodeAt(i)) | 0;
  }
  return h.toString(36) + pw.length;
}

function defaultClasses() {
  return [
    { name: 'AP Physics', color: '#3d6fff', grade: 91 },
    { name: 'Senior Seminar', color: '#2d8c5e', grade: 95 },
    { name: 'AP Calculus', color: '#9b59b6', grade: 84 },
    { name: 'World History', color: '#b85c00', grade: 88 },
    { name: 'Art Studio', color: '#e91e8c', grade: 98 },
    { name: 'English Lit', color: '#16a085', grade: 87 }
  ];
}

function defaultAssignments() {
  const today = new Date();
  const fmt = d => d.toISOString().slice(0,10);
  const add = n => { const d = new Date(today); d.setDate(d.getDate()+n); return fmt(d); };
  return [
    { id: 1, title: 'Physics Lab Report', className: 'AP Physics', color: '#3d6fff', due: add(2), status: 'in-progress' },
    { id: 2, title: 'Animation Essay Draft', className: 'Senior Seminar', color: '#2d8c5e', due: add(5), status: 'in-progress' },
    { id: 3, title: 'Calc Problem Set 9', className: 'AP Calculus', color: '#9b59b6', due: add(6), status: 'not-started' },
    { id: 4, title: 'WWI Primary Source Analysis', className: 'World History', color: '#b85c00', due: add(8), status: 'not-started' },
    { id: 5, title: 'Reflection Journal #6', className: 'English Lit', color: '#16a085', due: fmt(new Date(today.getTime()-86400000)), status: 'submitted' },
    { id: 6, title: 'Chiaroscuro Charcoal Study', className: 'Art Studio', color: '#e91e8c', due: fmt(new Date(today.getTime()-86400000*5)), status: 'submitted' }
  ];
}
