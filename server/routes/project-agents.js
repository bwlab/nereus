import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { extractProjectDirectory } from '../projects.js';

const router = express.Router();

const GLOBAL_AGENTS_DIR = path.join(os.homedir(), '.claude', 'agents');
const NAME_RE = /^[a-zA-Z0-9_-]+$/;

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { frontmatter: {}, body: raw };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    fm[kv[1]] = value;
  }
  return { frontmatter: fm, body: m[2] };
}

function listAgents(baseDir) {
  if (!fs.existsSync(baseDir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md')) continue;
    const filePath = path.join(baseDir, entry.name);
    let frontmatter = {};
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      ({ frontmatter } = parseFrontmatter(raw));
    } catch { /* ignore unreadable file */ }
    const fallbackName = entry.name.replace(/\.md$/, '');
    const name = (frontmatter.name && NAME_RE.test(frontmatter.name)) ? frontmatter.name : fallbackName;
    out.push({
      name,
      fileName: entry.name,
      description: frontmatter.description || null,
      model: frontmatter.model || null,
      tools: frontmatter.tools || null,
      filePath,
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function safeAgentFile(baseDir, rawName) {
  if (typeof rawName !== 'string' || !NAME_RE.test(rawName)) return null;
  const filePath = path.join(baseDir, `${rawName}.md`);
  const resolved = path.resolve(filePath);
  const resolvedBase = path.resolve(baseDir);
  if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) return null;
  if (!fs.existsSync(resolved)) return null;
  try {
    const stat = fs.lstatSync(resolved);
    if (stat.isSymbolicLink()) {
      const realTarget = fs.realpathSync(resolved);
      if (!realTarget.startsWith(resolvedBase + path.sep)) return null;
    }
  } catch { return null; }
  return resolved;
}

function readAgentContent(filePath, fallbackName) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(raw);
  const name = (frontmatter.name && NAME_RE.test(frontmatter.name)) ? frontmatter.name : fallbackName;
  return { name, frontmatter, body, raw };
}

// GET /api/project-agents/global/list
router.get('/global/list', (req, res) => {
  try {
    res.json({ success: true, dir: GLOBAL_AGENTS_DIR, agents: listAgents(GLOBAL_AGENTS_DIR) });
  } catch (error) {
    console.error('Error listing global agents:', error);
    res.status(500).json({ error: 'Failed to list global agents' });
  }
});

// GET /api/project-agents/global/content?name=<name>
router.get('/global/content', (req, res) => {
  try {
    const { name } = req.query;
    const filePath = safeAgentFile(GLOBAL_AGENTS_DIR, name);
    if (!filePath) return res.status(400).json({ error: 'Invalid or missing agent name' });
    const content = readAgentContent(filePath, name);
    res.json({ success: true, scope: 'global', ...content, filePath });
  } catch (error) {
    console.error('Error reading global agent:', error);
    res.status(500).json({ error: 'Failed to read agent' });
  }
});

async function resolveProjectAgentsDir(projectName) {
  const cwd = await extractProjectDirectory(projectName);
  if (!cwd || !fs.existsSync(cwd)) return null;
  return path.join(cwd, '.claude', 'agents');
}

// GET /api/project-agents/:projectName
router.get('/:projectName', async (req, res) => {
  try {
    const baseDir = await resolveProjectAgentsDir(req.params.projectName);
    if (!baseDir) return res.status(404).json({ error: 'Project not found' });
    res.json({ success: true, dir: baseDir, agents: listAgents(baseDir) });
  } catch (error) {
    console.error('Error listing project agents:', error);
    res.status(500).json({ error: 'Failed to list project agents' });
  }
});

// GET /api/project-agents/:projectName/content?name=<name>
router.get('/:projectName/content', async (req, res) => {
  try {
    const baseDir = await resolveProjectAgentsDir(req.params.projectName);
    if (!baseDir) return res.status(404).json({ error: 'Project not found' });
    const { name } = req.query;
    const filePath = safeAgentFile(baseDir, name);
    if (!filePath) return res.status(400).json({ error: 'Invalid or missing agent name' });
    const content = readAgentContent(filePath, name);
    res.json({ success: true, scope: 'project', projectName: req.params.projectName, ...content, filePath });
  } catch (error) {
    console.error('Error reading project agent:', error);
    res.status(500).json({ error: 'Failed to read agent' });
  }
});

export default router;
