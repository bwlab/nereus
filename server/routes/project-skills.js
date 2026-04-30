import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { extractProjectDirectory } from '../projects.js';
import { appConfigDb } from '../database/db.js';

const router = express.Router();

const DEFAULT_MASTER_DIR = path.join(os.homedir(), 'Google Drive', 'ai-global', 'per-progetto', 'skills');
const DEFAULT_GLOBAL_MASTER_DIR = path.join(os.homedir(), 'Google Drive', 'ai-global', 'globale', 'skills');
const USER_SKILLS_DIR = path.join(os.homedir(), '.claude', 'skills');
const DISABLED_SUFFIX = '.disabled';

function getMasterDir() {
  const stored = appConfigDb.get('skills_master_dir');
  return stored || process.env.CLAUDECODEUI_SKILLS_MASTER_DIR || DEFAULT_MASTER_DIR;
}

function getGlobalMasterDir() {
  const stored = appConfigDb.get('skills_global_master_dir');
  return stored || process.env.CLAUDECODEUI_SKILLS_GLOBAL_MASTER_DIR || DEFAULT_GLOBAL_MASTER_DIR;
}

function listSkillsInDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(dir, entry.name);
    out.push({
      name: entry.name,
      fullPath,
      description: readSkillDescription(fullPath),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function resolveCwd(projectName) {
  const cwd = await extractProjectDirectory(projectName);
  if (!cwd || !fs.existsSync(cwd)) return null;
  return cwd;
}

function readSkillDescription(skillDir) {
  const skillFile = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillFile)) return null;
  try {
    const raw = fs.readFileSync(skillFile, 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return null;
    const desc = match[1].match(/^description:\s*(.+)$/m);
    return desc ? desc[1].trim() : null;
  } catch {
    return null;
  }
}

// GET /api/config/skills-master-dir
router.get('/config/skills-master-dir', (req, res) => {
  res.json({ success: true, path: getMasterDir(), defaultPath: DEFAULT_MASTER_DIR });
});

// PUT /api/config/skills-master-dir
router.put('/config/skills-master-dir', (req, res) => {
  try {
    const { path: newPath } = req.body || {};
    if (typeof newPath !== 'string' || !newPath.trim()) {
      return res.status(400).json({ error: 'path is required' });
    }
    appConfigDb.set('skills_master_dir', newPath.trim());
    res.json({ success: true, path: newPath.trim() });
  } catch (error) {
    console.error('Error setting skills master dir:', error);
    res.status(500).json({ error: 'Failed to set skills master dir' });
  }
});

// GET /api/project-skills/config/skills-global-master-dir
router.get('/config/skills-global-master-dir', (req, res) => {
  res.json({ success: true, path: getGlobalMasterDir(), defaultPath: DEFAULT_GLOBAL_MASTER_DIR });
});

// PUT /api/project-skills/config/skills-global-master-dir
router.put('/config/skills-global-master-dir', (req, res) => {
  try {
    const { path: newPath } = req.body || {};
    if (typeof newPath !== 'string' || !newPath.trim()) {
      return res.status(400).json({ error: 'path is required' });
    }
    appConfigDb.set('skills_global_master_dir', newPath.trim());
    res.json({ success: true, path: newPath.trim() });
  } catch (error) {
    console.error('Error setting skills global master dir:', error);
    res.status(500).json({ error: 'Failed to set skills global master dir' });
  }
});

// GET /api/project-skills/catalog — read-only catalog of all skills (global master + per-project master)
router.get('/catalog', (req, res) => {
  try {
    const globalMasterDir = getGlobalMasterDir();
    const projectMasterDir = getMasterDir();
    res.json({
      success: true,
      global: {
        dir: globalMasterDir,
        exists: fs.existsSync(globalMasterDir),
        skills: listSkillsInDir(globalMasterDir),
      },
      project: {
        dir: projectMasterDir,
        exists: fs.existsSync(projectMasterDir),
        skills: listSkillsInDir(projectMasterDir),
      },
    });
  } catch (error) {
    console.error('Error building skills catalog:', error);
    res.status(500).json({ error: 'Failed to build skills catalog' });
  }
});

// GET /api/project-skills/:projectName
router.get('/:projectName', async (req, res) => {
  try {
    const cwd = await resolveCwd(req.params.projectName);
    if (!cwd) return res.status(404).json({ error: 'Project not found' });

    const masterDir = getMasterDir();
    const skills = [];
    const projectSkillsDir = path.join(cwd, '.claude', 'skills');

    if (fs.existsSync(masterDir)) {
      for (const entry of fs.readdirSync(masterDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const masterPath = path.join(masterDir, entry.name);
        const description = readSkillDescription(masterPath);

        let enabled = false;
        let linkInfo = null;
        const linkPath = path.join(projectSkillsDir, entry.name);
        if (fs.existsSync(linkPath)) {
          try {
            const stat = fs.lstatSync(linkPath);
            if (stat.isSymbolicLink()) {
              const target = fs.readlinkSync(linkPath);
              enabled = true;
              linkInfo = target;
            } else {
              linkInfo = 'real-dir';
            }
          } catch { /* ignore */ }
        }

        skills.push({
          name: entry.name,
          masterPath,
          description,
          enabled,
          linkInfo,
        });
      }
    }

    res.json({
      success: true,
      masterDir,
      masterExists: fs.existsSync(masterDir),
      projectSkillsDir,
      skills,
    });
  } catch (error) {
    console.error('Error listing project skills:', error);
    res.status(500).json({ error: 'Failed to list project skills' });
  }
});

// POST /api/project-skills/:projectName/toggle
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

    const masterDir = getMasterDir();
    const masterSkillPath = path.join(masterDir, name);
    const projectSkillsDir = path.join(cwd, '.claude', 'skills');
    const linkPath = path.join(projectSkillsDir, name);

    if (enabled) {
      if (!fs.existsSync(masterSkillPath)) {
        return res.status(404).json({ error: 'Master skill not found' });
      }
      fs.mkdirSync(projectSkillsDir, { recursive: true });
      // Remove any existing entry first (if not a real dir)
      if (fs.existsSync(linkPath)) {
        const stat = fs.lstatSync(linkPath);
        if (stat.isSymbolicLink()) fs.unlinkSync(linkPath);
        else return res.status(409).json({ error: 'A real directory exists at that path — refusing to overwrite' });
      }
      fs.symlinkSync(masterSkillPath, linkPath, 'dir');
    } else {
      if (fs.existsSync(linkPath)) {
        const stat = fs.lstatSync(linkPath);
        if (stat.isSymbolicLink()) fs.unlinkSync(linkPath);
        else return res.status(409).json({ error: 'Target is a real directory — refusing to delete' });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling project skill:', error);
    res.status(500).json({ error: 'Failed to toggle project skill' });
  }
});

// GET /api/project-skills/global — list global user-scope skills (~/.claude/skills/)
router.get('/global/list', (req, res) => {
  try {
    if (!fs.existsSync(USER_SKILLS_DIR)) {
      return res.json({ success: true, dir: USER_SKILLS_DIR, skills: [] });
    }

    const skills = [];
    for (const entry of fs.readdirSync(USER_SKILLS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const rawName = entry.name;
      const isDisabled = rawName.endsWith(DISABLED_SUFFIX);
      const displayName = isDisabled ? rawName.slice(0, -DISABLED_SUFFIX.length) : rawName;
      const fullPath = path.join(USER_SKILLS_DIR, rawName);
      const description = readSkillDescription(fullPath);
      skills.push({
        name: displayName,
        rawDirName: rawName,
        fullPath,
        description,
        enabled: !isDisabled,
      });
    }

    // De-duplicate if both <name> and <name>.disabled exist (shouldn't happen, but safe)
    const byName = new Map();
    for (const s of skills) {
      if (!byName.has(s.name) || s.enabled) byName.set(s.name, s);
    }

    res.json({ success: true, dir: USER_SKILLS_DIR, skills: Array.from(byName.values()) });
  } catch (error) {
    console.error('Error listing global skills:', error);
    res.status(500).json({ error: 'Failed to list global skills' });
  }
});

// POST /api/project-skills/global/toggle — body { name, enabled } -> rename to add/remove .disabled suffix
router.post('/global/toggle', (req, res) => {
  try {
    const { name, enabled } = req.body || {};
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be boolean' });
    }

    const activePath = path.join(USER_SKILLS_DIR, name);
    const disabledPath = path.join(USER_SKILLS_DIR, `${name}${DISABLED_SUFFIX}`);

    if (enabled) {
      // Rename <name>.disabled -> <name>
      if (!fs.existsSync(disabledPath)) {
        if (fs.existsSync(activePath)) return res.json({ success: true, alreadyEnabled: true });
        return res.status(404).json({ error: 'Disabled skill not found' });
      }
      if (fs.existsSync(activePath)) {
        return res.status(409).json({ error: 'Both enabled and disabled dirs exist' });
      }
      fs.renameSync(disabledPath, activePath);
    } else {
      // Rename <name> -> <name>.disabled
      if (!fs.existsSync(activePath)) {
        if (fs.existsSync(disabledPath)) return res.json({ success: true, alreadyDisabled: true });
        return res.status(404).json({ error: 'Skill not found' });
      }
      if (fs.existsSync(disabledPath)) {
        return res.status(409).json({ error: 'Disabled version already exists' });
      }
      fs.renameSync(activePath, disabledPath);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling global skill:', error);
    res.status(500).json({ error: 'Failed to toggle global skill' });
  }
});

export default router;
