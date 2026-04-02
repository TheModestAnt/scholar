// ── SCHOLAR INTEGRATIONS ──
// Handles connecting to Google + Notion via the Worker backend

const WORKER = 'https://scholar-worker.eden-a2d.workers.dev';

/* ── TOKEN STORAGE ── */
function saveGoogleTokens(tokens) {
  localStorage.setItem('scholar_google_tokens', JSON.stringify({
    ...tokens,
    saved_at: Date.now(),
  }));
}

function getGoogleTokens() {
  const t = localStorage.getItem('scholar_google_tokens');
  return t ? JSON.parse(t) : null;
}

function clearGoogleTokens() {
  localStorage.removeItem('scholar_google_tokens');
}

function isGoogleConnected() {
  const t = getGoogleTokens();
  return !!(t && t.access_token);
}

function isNotionConnected() {
  return !!localStorage.getItem('scholar_notion_connected');
}

/* ── TOKEN REFRESH ── */
async function getValidGoogleToken() {
  const tokens = getGoogleTokens();
  if (!tokens) return null;

  const age = (Date.now() - tokens.saved_at) / 1000;
  // Refresh if token is older than 55 minutes
  if (age > 3300 && tokens.refresh_token) {
    try {
      const res = await fetch(`${WORKER}/api/google/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: tokens.refresh_token }),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.access_token) {
        saveGoogleTokens({ ...tokens, access_token: data.access_token, saved_at: Date.now() });
        return data.access_token;
      }
    } catch (e) {
      console.error('Token refresh failed:', e);
    }
  }
  return tokens.access_token;
}

/* ── CONNECT GOOGLE ── */
function connectGoogle() {
  // Store current page so we can return after OAuth
  localStorage.setItem('scholar_oauth_return', 'integrations');
  window.location.href = `${WORKER}/auth/google/start`;
}

function disconnectGoogle() {
  clearGoogleTokens();
  renderIntegrationsPage();
  showToast('Google disconnected');
}

/* ── CONNECT NOTION ── */
function connectNotion() {
  // Notion internal integrations use a token directly — user just confirms
  localStorage.setItem('scholar_notion_connected', 'true');
  renderIntegrationsPage();
  loadNotionPages();
  showToast('Notion connected!');
}

function disconnectNotion() {
  localStorage.removeItem('scholar_notion_connected');
  renderIntegrationsPage();
  showToast('Notion disconnected');
}

/* ── HANDLE OAUTH RETURN ── */
function handleOAuthReturn() {
  const params = new URLSearchParams(window.location.search);

  if (params.get('google_tokens')) {
    try {
      const tokens = JSON.parse(decodeURIComponent(params.get('google_tokens')));
      saveGoogleTokens(tokens);
      showToast('Google connected successfully!');
      // Load data immediately
      loadGoogleData();
    } catch (e) {
      showToast('Google connection failed — try again', 'error');
    }
    // Clean URL
    window.history.replaceState({}, '', '/dashboard.html');
  }

  if (params.get('auth_error')) {
    showToast('Connection was cancelled or failed', 'error');
    window.history.replaceState({}, '', '/dashboard.html');
  }
}

/* ── LOAD GOOGLE DATA ── */
async function loadGoogleData() {
  const token = await getValidGoogleToken();
  if (!token) return;

  try {
    await Promise.all([
      loadClassroomCourses(token),
      loadCalendarEvents(token),
      loadGoogleDocs(token),
    ]);
    renderAll();
  } catch (e) {
    console.error('Failed to load Google data:', e);
  }
}

async function loadClassroomCourses(token) {
  const res = await fetch(`${WORKER}/api/google/classroom/courses`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  const data = await res.json();
  if (!data.courses) return;

  // Merge courses into Scholar classes
  const existing = getClasses();
  const colors = GRADE_COLORS;
  let colorIdx = existing.length;

  data.courses.forEach(course => {
    const alreadyExists = existing.find(c => c.gcId === course.id);
    if (!alreadyExists) {
      addClassItem({
        name: course.name,
        color: colors[colorIdx % colors.length],
        gcId: course.id,
        gcSection: course.section || '',
        source: 'google_classroom',
      });
      colorIdx++;
    }
  });

  // Load assignments for each course
  for (const course of data.courses) {
    await loadClassroomAssignments(token, course.id, course.name);
  }
}

async function loadClassroomAssignments(token, courseId, courseName) {
  try {
    const res = await fetch(`${WORKER}/api/google/classroom/assignments?courseId=${courseId}`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.courseWork) return;

    const existing = getAssignments();
    const cls = getClasses().find(c => c.gcId === courseId);

    data.courseWork.forEach(work => {
      const alreadyExists = existing.find(a => a.gcId === work.id);
      if (!alreadyExists && cls) {
        // Parse due date
        let due = '';
        if (work.dueDate) {
          const { year, month, day } = work.dueDate;
          due = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        }

        addAssignment({
          title: work.title,
          classId: cls.id,
          className: cls.name,
          due: due || new Date().toISOString().slice(0,10),
          type: work.workType === 'ASSIGNMENT' ? 'homework' :
                work.workType === 'SHORT_ANSWER_QUESTION' ? 'quiz' : 'other',
          status: 'not-started',
          gcId: work.id,
          source: 'google_classroom',
          description: work.description || '',
          maxPoints: work.maxPoints || 100,
        });
      }
    });
  } catch (e) {
    console.error('Failed to load assignments for', courseId, e);
  }
}

async function loadCalendarEvents(token) {
  const res = await fetch(`${WORKER}/api/google/calendar/events`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  const data = await res.json();
  if (!data.items) return;

  // Store calendar events for display
  localStorage.setItem('scholar_calendar_events', JSON.stringify(
    data.items.map(e => ({
      id: e.id,
      title: e.summary || '(No title)',
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      allDay: !e.start?.dateTime,
      location: e.location || '',
      link: e.htmlLink,
    }))
  ));
}

async function loadGoogleDocs(token) {
  const res = await fetch(`${WORKER}/api/google/docs`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  const data = await res.json();
  if (!data.files) return;

  localStorage.setItem('scholar_gdocs', JSON.stringify(
    data.files.map(f => ({
      id: f.id,
      title: f.name,
      modified: f.modifiedTime,
      link: f.webViewLink,
    }))
  ));
}

/* ── LOAD NOTION DATA ── */
async function loadNotionPages() {
  try {
    const [pagesRes, dbRes] = await Promise.all([
      fetch(`${WORKER}/api/notion/pages`, { credentials: 'include' }),
      fetch(`${WORKER}/api/notion/databases`, { credentials: 'include' }),
    ]);
    const pages = await pagesRes.json();
    const dbs = await dbRes.json();

    const allItems = [
      ...(pages.results || []).map(p => ({
        id: p.id,
        type: 'page',
        title: p.properties?.title?.title?.[0]?.plain_text ||
               p.properties?.Name?.title?.[0]?.plain_text ||
               'Untitled',
        edited: p.last_edited_time,
        link: p.url,
        icon: p.icon?.emoji || '📄',
      })),
      ...(dbs.results || []).map(d => ({
        id: d.id,
        type: 'database',
        title: d.title?.[0]?.plain_text || 'Untitled Database',
        edited: d.last_edited_time,
        link: d.url,
        icon: d.icon?.emoji || '🗃️',
      })),
    ].sort((a,b) => new Date(b.edited) - new Date(a.edited));

    localStorage.setItem('scholar_notion_pages', JSON.stringify(allItems));
  } catch (e) {
    console.error('Notion load failed:', e);
  }
}

/* ── GET STORED DATA ── */
function getCalendarEvents() {
  const d = localStorage.getItem('scholar_calendar_events');
  return d ? JSON.parse(d) : [];
}

function getGoogleDocs() {
  const d = localStorage.getItem('scholar_gdocs');
  return d ? JSON.parse(d) : [];
}

function getNotionPages() {
  const d = localStorage.getItem('scholar_notion_pages');
  return d ? JSON.parse(d) : [];
}

/* ── TOAST ── */
function showToast(msg, type = 'success') {
  const existing = document.getElementById('scholar-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'scholar-toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    padding: 10px 20px; border-radius: 8px; font-size: 13px; font-family: var(--font);
    font-weight: 500; z-index: 9999; transition: opacity .3s;
    background: ${type === 'error' ? 'var(--red)' : 'var(--ink)'};
    color: ${type === 'error' ? '#fff' : 'var(--surface)'};
    box-shadow: 0 4px 16px rgba(0,0,0,.2);
  `;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

/* ── FORMAT HELPERS ── */
function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
  if (diff < 10080) return `${Math.floor(diff/1440)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
