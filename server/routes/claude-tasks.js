import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import chokidar from 'chokidar';

const router = express.Router();

const CLAUDE_DIR = process.env.CLAUDE_DIR || path.join(os.homedir(), '.claude');
const TASKS_DIR = path.join(CLAUDE_DIR, 'tasks');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

// SSE clients
const sseClients = new Set();

// Session metadata cache
let metadataCache = {};
let lastMetaRefresh = 0;
const META_TTL = 10000;

function readSessionInfo(jsonlPath) {
  const result = { customTitle: null, slug: null, projectPath: null };
  try {
    if (!fs.existsSync(jsonlPath)) return result;
    const fd = fs.openSync(jsonlPath, 'r');
    const buf = Buffer.alloc(65536);
    const n = fs.readSync(fd, buf, 0, 65536, 0);
    fs.closeSync(fd);
    for (const line of buf.toString('utf8', 0, n).split('\n')) {
      if (!line.trim()) continue;
      try {
        const d = JSON.parse(line);
        if (d.type === 'custom-title' && d.customTitle) result.customTitle = d.customTitle;
        if (d.slug && !result.slug) result.slug = d.slug;
        if (d.cwd && !result.projectPath) result.projectPath = d.cwd;
        if (result.customTitle && result.slug && result.projectPath) break;
      } catch { /* skip */ }
    }
  } catch { /* partial */ }
  return result;
}

function loadMetadata() {
  if (Date.now() - lastMetaRefresh < META_TTL) return metadataCache;
  const meta = {};
  try {
    if (!fs.existsSync(PROJECTS_DIR)) return meta;
    for (const dir of fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const dirPath = path.join(PROJECTS_DIR, dir.name);
      for (const f of fs.readdirSync(dirPath).filter(f => f.endsWith('.jsonl'))) {
        const sid = f.replace('.jsonl', '');
        const info = readSessionInfo(path.join(dirPath, f));
        meta[sid] = { customTitle: info.customTitle, slug: info.slug, project: info.projectPath };
      }
      const idxPath = path.join(dirPath, 'sessions-index.json');
      if (fs.existsSync(idxPath)) {
        try {
          const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
          for (const e of (idx.entries || [])) {
            if (e.sessionId && meta[e.sessionId]) {
              meta[e.sessionId].description = e.description || null;
              meta[e.sessionId].gitBranch = e.gitBranch || null;
              meta[e.sessionId].created = e.created || null;
            }
          }
        } catch { /* skip */ }
      }
    }
  } catch (e) { console.error('Error loading session metadata:', e); }
  metadataCache = meta;
  lastMetaRefresh = Date.now();
  return meta;
}

function sessionName(sid, m) {
  return m?.customTitle || m?.slug || null;
}

// GET /api/claude-tasks/sessions — list all sessions with task counts
router.get('/sessions', (req, res) => {
  try {
    const metadata = loadMetadata();
    const sessions = [];
    if (!fs.existsSync(TASKS_DIR)) return res.json({ success: true, sessions: [] });

    for (const entry of fs.readdirSync(TASKS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sp = path.join(TASKS_DIR, entry.name);
      const files = fs.readdirSync(sp).filter(f => f.endsWith('.json'));
      let completed = 0, inProgress = 0, pending = 0, newest = null;
      for (const f of files) {
        try {
          const tp = path.join(sp, f);
          const t = JSON.parse(fs.readFileSync(tp, 'utf8'));
          if (t.status === 'completed') completed++;
          else if (t.status === 'in_progress') inProgress++;
          else pending++;
          const mt = fs.statSync(tp).mtime;
          if (!newest || mt > newest) newest = mt;
        } catch { /* skip */ }
      }
      const m = metadata[entry.name] || {};
      sessions.push({
        id: entry.name,
        name: sessionName(entry.name, m),
        project: m.project || null,
        taskCount: files.length,
        completed, inProgress, pending,
        modifiedAt: newest ? newest.toISOString() : fs.statSync(sp).mtime.toISOString(),
      });
    }
    sessions.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
    res.json({ success: true, sessions });
  } catch (error) {
    console.error('Error listing claude task sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// GET /api/claude-tasks/sessions/:sessionId — get tasks for a session
router.get('/sessions/:sessionId', (req, res) => {
  try {
    const sp = path.join(TASKS_DIR, req.params.sessionId);
    if (!fs.existsSync(sp)) return res.status(404).json({ error: 'Session not found' });
    const tasks = [];
    for (const f of fs.readdirSync(sp).filter(f => f.endsWith('.json'))) {
      try {
        const tp = path.join(sp, f);
        const t = JSON.parse(fs.readFileSync(tp, 'utf8'));
        const s = fs.statSync(tp);
        t.createdAt = s.birthtime.toISOString();
        t.updatedAt = s.mtime.toISOString();
        tasks.push(t);
      } catch { /* skip */ }
    }
    tasks.sort((a, b) => parseInt(a.id) - parseInt(b.id));
    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Error getting claude tasks:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

// GET /api/claude-tasks/by-project/:projectPath — tasks for a specific project path
router.get('/by-project/*', (req, res) => {
  try {
    const projectPath = '/' + req.params[0];
    const metadata = loadMetadata();
    if (!fs.existsSync(TASKS_DIR)) return res.json({ success: true, sessions: [] });

    const sessions = [];
    for (const entry of fs.readdirSync(TASKS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const m = metadata[entry.name] || {};
      if (m.project !== projectPath) continue;

      const sp = path.join(TASKS_DIR, entry.name);
      const files = fs.readdirSync(sp).filter(f => f.endsWith('.json'));
      const tasks = [];
      for (const f of files) {
        try {
          const tp = path.join(sp, f);
          const t = JSON.parse(fs.readFileSync(tp, 'utf8'));
          const s = fs.statSync(tp);
          t.createdAt = s.birthtime.toISOString();
          t.updatedAt = s.mtime.toISOString();
          tasks.push(t);
        } catch { /* skip */ }
      }
      tasks.sort((a, b) => parseInt(a.id) - parseInt(b.id));
      sessions.push({
        id: entry.name,
        name: sessionName(entry.name, m),
        tasks,
      });
    }
    sessions.sort((a, b) => {
      const ma = a.tasks.reduce((m, t) => { const d = new Date(t.updatedAt); return d > m ? d : m; }, new Date(0));
      const mb = b.tasks.reduce((m, t) => { const d = new Date(t.updatedAt); return d > m ? d : m; }, new Date(0));
      return mb - ma;
    });
    res.json({ success: true, sessions });
  } catch (error) {
    console.error('Error getting tasks by project:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

// GET /api/claude-tasks/summary — task counts per project (for dashboard badges)
router.get('/summary', (req, res) => {
  try {
    const metadata = loadMetadata();
    const summary = {};
    if (!fs.existsSync(TASKS_DIR)) return res.json({ success: true, summary: {} });

    for (const entry of fs.readdirSync(TASKS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const m = metadata[entry.name] || {};
      const proj = m.project;
      if (!proj) continue;

      if (!summary[proj]) summary[proj] = { pending: 0, inProgress: 0, completed: 0 };
      const sp = path.join(TASKS_DIR, entry.name);
      for (const f of fs.readdirSync(sp).filter(f => f.endsWith('.json'))) {
        try {
          const t = JSON.parse(fs.readFileSync(path.join(sp, f), 'utf8'));
          if (t.status === 'completed') summary[proj].completed++;
          else if (t.status === 'in_progress') summary[proj].inProgress++;
          else summary[proj].pending++;
        } catch { /* skip */ }
      }
    }
    res.json({ success: true, summary });
  } catch (error) {
    console.error('Error getting task summary:', error);
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

// SSE endpoint for live updates
router.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
  res.write('data: {"type":"connected"}\n\n');
});

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const c of sseClients) c.write(msg);
}

// File watchers
if (fs.existsSync(TASKS_DIR) || true) {
  const watcher = chokidar.watch(TASKS_DIR, { persistent: true, ignoreInitial: true, depth: 2 });
  watcher.on('all', (event, filePath) => {
    if (filePath.endsWith('.json')) {
      const rel = path.relative(TASKS_DIR, filePath);
      broadcast({ type: 'task-update', event, sessionId: rel.split(path.sep)[0], file: path.basename(filePath) });
    }
  });
}

const projectsWatcher = chokidar.watch(PROJECTS_DIR, { persistent: true, ignoreInitial: true, depth: 2 });
projectsWatcher.on('all', (event, filePath) => {
  if (filePath.endsWith('.jsonl')) {
    lastMetaRefresh = 0;
    broadcast({ type: 'metadata-update' });
  }
});

export default router;
