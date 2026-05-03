import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { extractProjectDirectory } from '../projects.js';

const execFileP = promisify(execFile);

const router = express.Router();

const CLAUDE_PLUGINS_DIR = path.join(os.homedir(), '.claude', 'plugins');
const INSTALLED_FILE = path.join(CLAUDE_PLUGINS_DIR, 'installed_plugins.json');
const MARKETPLACES_FILE = path.join(CLAUDE_PLUGINS_DIR, 'known_marketplaces.json');
const MARKETPLACES_DIR = path.join(CLAUDE_PLUGINS_DIR, 'marketplaces');

function readJsonSafe(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function countDirEntries(dir, predicate) {
  if (!fs.existsSync(dir)) return 0;
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter(predicate).length;
  } catch {
    return 0;
  }
}

function readPluginManifest(installPath) {
  if (!installPath || !fs.existsSync(installPath)) return null;
  const candidates = [
    path.join('.claude-plugin', 'plugin.json'),
    'plugin.json',
    'manifest.json',
    'package.json',
  ];
  let manifest = null;
  let manifestFile = null;
  for (const rel of candidates) {
    const fp = path.join(installPath, rel);
    if (fs.existsSync(fp)) {
      try {
        manifest = JSON.parse(fs.readFileSync(fp, 'utf8'));
        manifestFile = rel;
        break;
      } catch { /* ignore */ }
    }
  }

  const agentsCount = countDirEntries(path.join(installPath, 'agents'), (e) => e.isFile() && e.name.endsWith('.md'));
  const commandsCount = countDirEntries(path.join(installPath, 'commands'), (e) => e.isFile() && e.name.endsWith('.md'));
  const skillsCount = countDirEntries(path.join(installPath, 'skills'), (e) => e.isDirectory());
  const hooksCount = countDirEntries(path.join(installPath, 'hooks'), (e) => e.isFile());
  const hasMcp = fs.existsSync(path.join(installPath, '.mcp.json'))
    || fs.existsSync(path.join(installPath, 'mcp.json'));

  return {
    manifestFile,
    description: manifest?.description || null,
    author: (manifest?.author && (manifest.author.name || manifest.author)) || null,
    authorEmail: manifest?.author?.email || null,
    homepage: manifest?.homepage || (typeof manifest?.repository === 'string' ? manifest.repository : manifest?.repository?.url) || null,
    license: manifest?.license || null,
    keywords: Array.isArray(manifest?.keywords) ? manifest.keywords : [],
    counts: {
      agents: agentsCount,
      commands: commandsCount,
      skills: skillsCount,
      hooks: hooksCount,
      mcp: hasMcp ? 1 : 0,
    },
  };
}

// GET /api/claude-plugins/catalog
router.get('/catalog', (req, res) => {
  try {
    const installed = readJsonSafe(INSTALLED_FILE);
    const marketplacesJson = readJsonSafe(MARKETPLACES_FILE);
    const userSettings = readJsonSafe(path.join(os.homedir(), '.claude', 'settings.json')) || {};
    const userEnabled = userSettings.enabledPlugins || {};

    const plugins = [];
    if (installed && installed.plugins && typeof installed.plugins === 'object') {
      for (const [fullName, instances] of Object.entries(installed.plugins)) {
        const [name, marketplace] = fullName.split('@');
        const list = Array.isArray(instances) ? instances : [instances];
        for (const inst of list) {
          const manifest = readPluginManifest(inst.installPath);
          plugins.push({
            fullName,
            name,
            marketplace: marketplace || null,
            scope: inst.scope || null,
            version: inst.version || null,
            installPath: inst.installPath || null,
            installedAt: inst.installedAt || null,
            lastUpdated: inst.lastUpdated || null,
            gitCommitSha: inst.gitCommitSha || null,
            description: manifest?.description || null,
            author: manifest?.author || null,
            authorEmail: manifest?.authorEmail || null,
            homepage: manifest?.homepage || null,
            license: manifest?.license || null,
            keywords: manifest?.keywords || [],
            manifestFile: manifest?.manifestFile || null,
            counts: manifest?.counts || { agents: 0, commands: 0, skills: 0, hooks: 0, mcp: 0 },
            enabled: userEnabled[fullName] === true,
            exists: inst.installPath ? fs.existsSync(inst.installPath) : false,
          });
        }
      }
    }
    plugins.sort((a, b) => a.name.localeCompare(b.name));

    const marketplaces = [];
    if (marketplacesJson && typeof marketplacesJson === 'object') {
      for (const [mname, m] of Object.entries(marketplacesJson)) {
        marketplaces.push({
          name: mname,
          source: m.source || null,
          installLocation: m.installLocation || null,
          lastUpdated: m.lastUpdated || null,
          exists: m.installLocation ? fs.existsSync(m.installLocation) : false,
        });
      }
    }
    marketplaces.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      dir: CLAUDE_PLUGINS_DIR,
      exists: fs.existsSync(CLAUDE_PLUGINS_DIR),
      marketplacesDir: MARKETPLACES_DIR,
      plugins,
      marketplaces,
    });
  } catch (error) {
    console.error('Error reading claude plugins catalog:', error);
    res.status(500).json({ error: 'Failed to read claude plugins catalog' });
  }
});

// GET /api/claude-plugins/marketplaces — enumerate plugins available in registered marketplaces
router.get('/marketplaces', (req, res) => {
  try {
    const items = [];
    if (fs.existsSync(MARKETPLACES_DIR)) {
      for (const entry of fs.readdirSync(MARKETPLACES_DIR, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const mpName = entry.name;
        const mpDir = path.join(MARKETPLACES_DIR, mpName);
        const candidates = [
          path.join(mpDir, '.claude-plugin', 'marketplace.json'),
          path.join(mpDir, 'marketplace.json'),
        ];
        let manifest = null;
        for (const c of candidates) {
          if (fs.existsSync(c)) {
            try { manifest = JSON.parse(fs.readFileSync(c, 'utf8')); break; } catch { /* ignore */ }
          }
        }
        if (!manifest) continue;
        const plugins = Array.isArray(manifest.plugins) ? manifest.plugins.map(p => ({
          name: p.name,
          description: p.description || null,
          author: p.author?.name || p.author || null,
          category: p.category || null,
          homepage: p.homepage || null,
          source: p.source || null,
        })) : [];
        items.push({
          name: mpName,
          description: manifest.description || null,
          owner: manifest.owner?.name || manifest.owner || null,
          plugins,
        });
      }
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ success: true, marketplaces: items });
  } catch (error) {
    console.error('Error reading marketplaces:', error);
    res.status(500).json({ error: 'Failed to read marketplaces' });
  }
});

async function resolveProjectCwd(projectName) {
  const cwd = await extractProjectDirectory(projectName);
  if (!cwd || !fs.existsSync(cwd)) return null;
  return cwd;
}

function readProjectSettings(cwd) {
  const file = path.join(cwd, '.claude', 'settings.json');
  if (!fs.existsSync(file)) return { file, json: {} };
  try {
    return { file, json: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return { file, json: {} };
  }
}

function writeProjectSettings(file, json) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
}

// GET /api/claude-plugins/project/:projectName/settings
router.get('/project/:projectName/settings', async (req, res) => {
  try {
    const cwd = await resolveProjectCwd(req.params.projectName);
    if (!cwd) return res.status(404).json({ error: 'Project not found' });
    const { file, json } = readProjectSettings(cwd);
    res.json({
      success: true,
      file,
      enabledPlugins: json.enabledPlugins || {},
      extraKnownMarketplaces: json.extraKnownMarketplaces || {},
    });
  } catch (error) {
    console.error('Error reading project settings:', error);
    res.status(500).json({ error: 'Failed to read project settings' });
  }
});

// PUT /api/claude-plugins/project/:projectName/plugin  body: { fullName, enabled }
router.put('/project/:projectName/plugin', async (req, res) => {
  try {
    const cwd = await resolveProjectCwd(req.params.projectName);
    if (!cwd) return res.status(404).json({ error: 'Project not found' });
    const { fullName, enabled, value } = req.body || {};
    if (typeof fullName !== 'string' || !fullName.includes('@')) {
      return res.status(400).json({ error: 'fullName must be "name@marketplace"' });
    }
    // Tri-state: value === null → delete (revert inherited); true/false → set explicit
    // Backward-compat: enabled boolean (true→set true, false→delete)
    let v;
    if (value === null) v = null;
    else if (value === true || value === false) v = value;
    else if (enabled === true) v = true;
    else if (enabled === false) v = null;
    else return res.status(400).json({ error: 'value (true|false|null) or enabled (bool) required' });

    const { file, json } = readProjectSettings(cwd);
    json.enabledPlugins = json.enabledPlugins || {};
    if (v === null) delete json.enabledPlugins[fullName];
    else json.enabledPlugins[fullName] = v;
    writeProjectSettings(file, json);
    res.json({ success: true, enabledPlugins: json.enabledPlugins });
  } catch (error) {
    console.error('Error updating project plugin:', error);
    res.status(500).json({ error: 'Failed to update project plugin' });
  }
});

// POST /api/claude-plugins/project/:projectName/marketplace  body: { name, source }
router.post('/project/:projectName/marketplace', async (req, res) => {
  try {
    const cwd = await resolveProjectCwd(req.params.projectName);
    if (!cwd) return res.status(404).json({ error: 'Project not found' });
    const { name, source } = req.body || {};
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!source || typeof source !== 'object' || !source.source) {
      return res.status(400).json({ error: 'source is required' });
    }
    const { file, json } = readProjectSettings(cwd);
    json.extraKnownMarketplaces = json.extraKnownMarketplaces || {};
    json.extraKnownMarketplaces[name.trim()] = { source };
    writeProjectSettings(file, json);
    res.json({ success: true, extraKnownMarketplaces: json.extraKnownMarketplaces });
  } catch (error) {
    console.error('Error adding marketplace:', error);
    res.status(500).json({ error: 'Failed to add marketplace' });
  }
});

// POST /api/claude-plugins/action  body: { action:'enable'|'disable'|'uninstall', fullName, scope?, projectName? }
router.post('/action', async (req, res) => {
  try {
    const { action, fullName, scope, projectName } = req.body || {};
    if (!['enable', 'disable', 'uninstall'].includes(action)) {
      return res.status(400).json({ error: 'invalid action' });
    }
    if (typeof fullName !== 'string' || !fullName.includes('@')) {
      return res.status(400).json({ error: 'fullName must be "name@marketplace"' });
    }
    const validScope = ['user', 'project', 'local'].includes(scope) ? scope : 'user';

    let cwd = process.cwd();
    if (projectName) {
      const pcwd = await resolveProjectCwd(projectName);
      if (pcwd) cwd = pcwd;
    }

    const args = ['plugin', action, fullName, '-s', validScope];
    if (action === 'uninstall') args.push('-y');

    const { stdout, stderr } = await execFileP('claude', args, {
      cwd,
      env: { ...process.env },
      timeout: 120000,
    });
    res.json({ success: true, action, fullName, scope: validScope, stdout, stderr });
  } catch (error) {
    console.error('Error running plugin action:', error);
    res.status(500).json({
      error: 'Plugin action failed',
      details: error?.stderr || error?.message || String(error),
    });
  }
});

// DELETE /api/claude-plugins/project/:projectName/marketplace/:name
router.delete('/project/:projectName/marketplace/:name', async (req, res) => {
  try {
    const cwd = await resolveProjectCwd(req.params.projectName);
    if (!cwd) return res.status(404).json({ error: 'Project not found' });
    const { file, json } = readProjectSettings(cwd);
    if (json.extraKnownMarketplaces) {
      delete json.extraKnownMarketplaces[req.params.name];
      writeProjectSettings(file, json);
    }
    res.json({ success: true, extraKnownMarketplaces: json.extraKnownMarketplaces || {} });
  } catch (error) {
    console.error('Error removing marketplace:', error);
    res.status(500).json({ error: 'Failed to remove marketplace' });
  }
});

export default router;
