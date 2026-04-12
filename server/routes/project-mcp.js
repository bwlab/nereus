import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { extractProjectDirectory } from '../projects.js';

const router = express.Router();

async function resolveCwd(projectName) {
  const cwd = await extractProjectDirectory(projectName);
  if (!cwd || !fs.existsSync(cwd)) return null;
  return cwd;
}

function loadClaudeJson() {
  const p = path.join(os.homedir(), '.claude.json');
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

function loadLocalSettings(cwd) {
  const p = path.join(cwd, '.claude', 'settings.local.json');
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

function saveLocalSettings(cwd, settings) {
  const dir = path.join(cwd, '.claude');
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, 'settings.local.json');
  fs.writeFileSync(p, JSON.stringify(settings, null, 2), 'utf8');
}

function collectMcpServers(cwd) {
  const cj = loadClaudeJson();
  const result = {};

  if (cj.mcpServers && typeof cj.mcpServers === 'object') {
    for (const [name, cfg] of Object.entries(cj.mcpServers)) {
      result[name] = { name, scope: 'user', config: cfg };
    }
  }

  if (cj.claudeProjects && cwd && cj.claudeProjects[cwd]?.mcpServers) {
    for (const [name, cfg] of Object.entries(cj.claudeProjects[cwd].mcpServers)) {
      result[name] = { name, scope: 'project', config: cfg };
    }
  }

  return Object.values(result);
}

// GET /api/project-mcp/:projectName
router.get('/:projectName', async (req, res) => {
  try {
    const cwd = await resolveCwd(req.params.projectName);
    if (!cwd) return res.status(404).json({ error: 'Project not found' });

    const servers = collectMcpServers(cwd);
    const local = loadLocalSettings(cwd);
    const disabled = new Set(local?.cloudcli?.disabledMcpServers ?? []);

    const result = servers.map((s) => ({
      name: s.name,
      scope: s.scope,
      type: s.config?.type || 'stdio',
      command: s.config?.command || s.config?.url || null,
      args: Array.isArray(s.config?.args) ? s.config.args : [],
      enabled: !disabled.has(s.name),
    }));

    res.json({ success: true, servers: result });
  } catch (error) {
    console.error('Error listing project MCP servers:', error);
    res.status(500).json({ error: 'Failed to list MCP servers' });
  }
});

// POST /api/project-mcp/:projectName/toggle
router.post('/:projectName/toggle', async (req, res) => {
  try {
    const cwd = await resolveCwd(req.params.projectName);
    if (!cwd) return res.status(404).json({ error: 'Project not found' });

    const { name, enabled } = req.body || {};
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be boolean' });
    }

    const local = loadLocalSettings(cwd);
    if (!local.cloudcli) local.cloudcli = {};
    const current = new Set(local.cloudcli.disabledMcpServers ?? []);

    if (enabled) current.delete(name);
    else current.add(name);

    local.cloudcli.disabledMcpServers = Array.from(current);
    saveLocalSettings(cwd, local);

    res.json({ success: true, disabledMcpServers: local.cloudcli.disabledMcpServers });
  } catch (error) {
    console.error('Error toggling MCP server:', error);
    res.status(500).json({ error: 'Failed to toggle MCP server' });
  }
});

export default router;
