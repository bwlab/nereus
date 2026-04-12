import express from 'express';
import path from 'path';
import fs from 'fs';
import { extractProjectDirectory } from '../projects.js';

const router = express.Router();

async function resolveCwd(projectName) {
  const cwd = await extractProjectDirectory(projectName);
  if (!cwd || !fs.existsSync(cwd)) return null;
  return cwd;
}

function commandsDir(cwd) {
  return path.join(cwd, '.claude', 'commands');
}

function safeCommandName(name) {
  // Allow letters, digits, dash, underscore, dot. Strip leading '/'.
  return String(name || '').replace(/^\//, '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-');
}

// GET /api/project-commands/:projectName — list .claude/commands/*.md
router.get('/:projectName', async (req, res) => {
  try {
    const cwd = await resolveCwd(req.params.projectName);
    if (!cwd) return res.status(404).json({ error: 'Project not found' });
    const dir = commandsDir(cwd);
    if (!fs.existsSync(dir)) return res.json({ success: true, commands: [] });

    const items = [];
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      if (!stat.isFile()) continue;
      const raw = fs.readFileSync(full, 'utf8');
      const { frontmatter, body } = parseFrontmatter(raw);
      items.push({
        name: f.replace(/\.md$/, ''),
        path: full,
        description: frontmatter.description || '',
        namespace: frontmatter.namespace || null,
        body,
        updatedAt: stat.mtime.toISOString(),
      });
    }
    res.json({ success: true, commands: items });
  } catch (error) {
    console.error('Error listing project commands:', error);
    res.status(500).json({ error: 'Failed to list commands' });
  }
});

// POST /api/project-commands/:projectName — create or overwrite
router.post('/:projectName', async (req, res) => {
  try {
    const cwd = await resolveCwd(req.params.projectName);
    if (!cwd) return res.status(404).json({ error: 'Project not found' });
    const { name, description = '', namespace = null, body = '' } = req.body || {};
    const safe = safeCommandName(name);
    if (!safe) return res.status(400).json({ error: 'Invalid name' });

    const dir = commandsDir(cwd);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${safe}.md`);

    const content = buildMarkdown({ description, namespace, body });
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ success: true, command: { name: safe, path: filePath, description, namespace, body } });
  } catch (error) {
    console.error('Error creating command:', error);
    res.status(500).json({ error: 'Failed to create command' });
  }
});

// PUT /api/project-commands/:projectName/:name — update existing
router.put('/:projectName/:name', async (req, res) => {
  try {
    const cwd = await resolveCwd(req.params.projectName);
    if (!cwd) return res.status(404).json({ error: 'Project not found' });
    const safe = safeCommandName(req.params.name);
    const filePath = path.join(commandsDir(cwd), `${safe}.md`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Command not found' });

    const { description = '', namespace = null, body = '' } = req.body || {};
    const content = buildMarkdown({ description, namespace, body });
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating command:', error);
    res.status(500).json({ error: 'Failed to update command' });
  }
});

// DELETE /api/project-commands/:projectName/:name
router.delete('/:projectName/:name', async (req, res) => {
  try {
    const cwd = await resolveCwd(req.params.projectName);
    if (!cwd) return res.status(404).json({ error: 'Project not found' });
    const safe = safeCommandName(req.params.name);
    const filePath = path.join(commandsDir(cwd), `${safe}.md`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Command not found' });
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting command:', error);
    res.status(500).json({ error: 'Failed to delete command' });
  }
});

// POST /api/project-commands/:projectName/init — generate CLAUDE.md skeleton if missing
router.post('/:projectName/init', async (req, res) => {
  try {
    const cwd = await resolveCwd(req.params.projectName);
    if (!cwd) return res.status(404).json({ error: 'Project not found' });

    const claudeMdPath = path.join(cwd, 'CLAUDE.md');
    if (fs.existsSync(claudeMdPath)) {
      return res.json({ success: true, alreadyExists: true, path: claudeMdPath });
    }

    const displayName = path.basename(cwd);
    const template = `# CLAUDE.md

Questo file fornisce guide a Claude Code ([claude.com/code](https://claude.com/code)) per lavorare con il codice di questo repository.

## Contesto del progetto

${displayName} è [descrizione breve del progetto].

## Stack tecnico

- [Framework / linguaggio]
- [Database / infrastruttura]

## Convenzioni

- [Pattern importanti]
- [Cosa evitare]

## Comandi utili

\`\`\`bash
# Install deps
npm install

# Run dev
npm run dev

# Build
npm run build
\`\`\`
`;

    fs.writeFileSync(claudeMdPath, template, 'utf8');
    res.json({ success: true, alreadyExists: false, path: claudeMdPath });
  } catch (error) {
    console.error('Error generating CLAUDE.md:', error);
    res.status(500).json({ error: 'Failed to generate CLAUDE.md' });
  }
});

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw };
  const yaml = match[1];
  const body = match[2];
  const frontmatter = {};
  for (const line of yaml.split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) frontmatter[kv[1]] = kv[2].trim();
  }
  return { frontmatter, body };
}

function buildMarkdown({ description, namespace, body }) {
  const fm = [];
  if (description) fm.push(`description: ${description}`);
  if (namespace) fm.push(`namespace: ${namespace}`);
  const header = fm.length ? `---\n${fm.join('\n')}\n---\n\n` : '';
  return `${header}${body || ''}`;
}

export default router;
