# Scholar — Student Dashboard

Your personal academic hub. Track grades, assignments, attendance, and more.

## Features
- Account system (sign up, sign in, demo mode)
- Grade tracker with trend charts
- Assignment manager (add, track, remove)
- Attendance tracker with pip visualizer
- Weekly calendar view
- Google Docs & Notion document list
- Built-in AI Tutor (powered by Claude)

## How to deploy to GitHub Pages

### Step 1 — Create a GitHub repo
1. Go to [github.com](https://github.com) and sign in
2. Click **+** → **New repository**
3. Name it `scholar` (or anything you like)
4. Set it to **Public**
5. Click **Create repository**

### Step 2 — Upload the files
1. On the repo page, click **Add file** → **Upload files**
2. Drag the entire `scholar` folder contents (index.html, dashboard.html, css/, js/)
3. Make sure the folder structure looks like this:
   ```
   index.html
   dashboard.html
   css/
     style.css
     dashboard.css
   js/
     auth.js
     data.js
     dashboard.js
   README.md
   ```
4. Click **Commit changes**

### Step 3 — Enable GitHub Pages
1. Go to **Settings** → **Pages** (in the left sidebar)
2. Under **Source**, select **Deploy from a branch**
3. Choose branch: **main**, folder: **/ (root)**
4. Click **Save**
5. Wait ~1 minute, then your site will be live at:
   `https://YOUR-USERNAME.github.io/scholar/`

## Notes
- All account data is stored in your browser's localStorage
- The AI Tutor feature requires an internet connection
- Works fully offline except for the AI chat
- No server required — runs entirely in the browser
