import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getProjects } from '../projects.js';

const router = express.Router();

const CLAUDE_DIR = process.env.CLAUDE_DIR || path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

function safeReadFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    return {
      path: filePath,
      size: stat.size,
      content: fs.readFileSync(filePath, 'utf8'),
      modifiedAt: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Walk della gerarchia CLAUDE.md dal più generale al più specifico:
 *   user (~/.claude/CLAUDE.md) → ancestors intermedi sotto home → project → project/.claude
 * Sono incluse solo le voci il cui file esiste davvero.
 */
export function loadClaudeMdHierarchy(projectPath) {
  const result = [];

  const userPath = path.join(CLAUDE_DIR, 'CLAUDE.md');
  const userFile = safeReadFile(userPath);
  if (userFile) {
    result.push({
      scope: 'user',
      path: userPath,
      size: userFile.size,
      content: userFile.content,
      modifiedAt: userFile.modifiedAt,
    });
  }

  if (!projectPath) return result;

  const projectResolved = path.resolve(projectPath);
  const home = path.resolve(os.homedir());

  // Walk ancestors solo se projectPath è sotto home
  const rel = path.relative(home, projectResolved);
  const underHome = rel && !rel.startsWith('..') && !path.isAbsolute(rel);

  if (underHome) {
    const segments = rel.split(path.sep).filter(Boolean);
    // Costruisce ogni ancestor intermedio (home escluso, projectPath escluso)
    let current = home;
    for (let i = 0; i < segments.length - 1; i++) {
      current = path.join(current, segments[i]);
      const candidate = path.join(current, 'CLAUDE.md');
      const file = safeReadFile(candidate);
      if (file) {
        result.push({
          scope: 'ancestor',
          path: candidate,
          size: file.size,
          content: file.content,
          modifiedAt: file.modifiedAt,
        });
      }
    }
  }

  const projPath = path.join(projectResolved, 'CLAUDE.md');
  const projFile = safeReadFile(projPath);
  if (projFile) {
    result.push({
      scope: 'project',
      path: projPath,
      size: projFile.size,
      content: projFile.content,
      modifiedAt: projFile.modifiedAt,
    });
  }

  const localPath = path.join(projectResolved, '.claude', 'CLAUDE.md');
  const localFile = safeReadFile(localPath);
  if (localFile) {
    result.push({
      scope: 'local',
      path: localPath,
      size: localFile.size,
      content: localFile.content,
      modifiedAt: localFile.modifiedAt,
    });
  }

  return result;
}

function loadClaudeMdFiles(projectPath) {
  const result = [];

  // User scope
  const userPath = path.join(CLAUDE_DIR, 'CLAUDE.md');
  const userFile = safeReadFile(userPath);
  result.push({
    scope: 'user',
    path: userPath,
    size: userFile?.size ?? 0,
    content: userFile?.content ?? null,
    modifiedAt: userFile?.modifiedAt ?? null,
    exists: Boolean(userFile),
  });

  if (projectPath) {
    // Project scope
    const projectPathResolved = path.resolve(projectPath);
    const projPath = path.join(projectPathResolved, 'CLAUDE.md');
    const projFile = safeReadFile(projPath);
    result.push({
      scope: 'project',
      path: projPath,
      size: projFile?.size ?? 0,
      content: projFile?.content ?? null,
      modifiedAt: projFile?.modifiedAt ?? null,
      exists: Boolean(projFile),
    });

    // Local scope
    const localPath = path.join(projectPathResolved, '.claude', 'CLAUDE.md');
    const localFile = safeReadFile(localPath);
    result.push({
      scope: 'local',
      path: localPath,
      size: localFile?.size ?? 0,
      content: localFile?.content ?? null,
      modifiedAt: localFile?.modifiedAt ?? null,
      exists: Boolean(localFile),
    });
  }

  return result;
}

/**
 * Find the jsonl file for a session id by scanning all project directories.
 */
function findSessionJsonlPath(sessionId) {
  if (!fs.existsSync(PROJECTS_DIR)) return null;
  for (const dir of fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const candidate = path.join(PROJECTS_DIR, dir.name, `${sessionId}.jsonl`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Best-effort extraction of a plain text payload from a Claude JSONL record.
 * Handles: string content, array of content blocks, nested message objects.
 * Always returns a string (or null) — never an object.
 */
function extractText(data) {
  if (!data || typeof data !== 'object') return null;

  // Top-level string fields
  if (typeof data.content === 'string') return data.content;
  if (typeof data.text === 'string') return data.text;

  // content as array of blocks like [{ type: 'text', text: '...' }, ...]
  if (Array.isArray(data.content)) {
    return data.content
      .map((c) => {
        if (typeof c === 'string') return c;
        if (c && typeof c.text === 'string') return c.text;
        return '';
      })
      .join('');
  }

  // nested message object: { role, content }
  if (data.message && typeof data.message === 'object') {
    if (typeof data.message.content === 'string') return data.message.content;
    if (Array.isArray(data.message.content)) {
      return data.message.content
        .map((c) => {
          if (typeof c === 'string') return c;
          if (c && typeof c.text === 'string') return c.text;
          return '';
        })
        .join('');
    }
  } else if (typeof data.message === 'string') {
    return data.message;
  }

  return null;
}

/**
 * Extract the initial prompt (system message or first prompt) from a JSONL file.
 * Reads the first ~512KB to capture the system prompt which can include a concatenated CLAUDE.md.
 */
function extractInitialPrompt(jsonlPath) {
  if (!jsonlPath || !fs.existsSync(jsonlPath)) return null;

  try {
    const fd = fs.openSync(jsonlPath, 'r');
    const buf = Buffer.alloc(524288);
    const n = fs.readSync(fd, buf, 0, 524288, 0);
    fs.closeSync(fd);

    const lines = buf.toString('utf8', 0, n).split('\n');
    let systemMessage = null;
    let firstUserMessage = null;

    for (const line of lines) {
      if (!line.trim()) continue;
      let data;
      try { data = JSON.parse(line); } catch { continue; }

      if (!systemMessage && (data.type === 'system' || data.role === 'system')) {
        const text = extractText(data);
        if (text && typeof text === 'string') {
          systemMessage = { role: 'system', text, createdAt: data.timestamp || data.createdAt || null };
        }
      }

      if (!firstUserMessage && (data.type === 'user' || data.role === 'user')) {
        const text = extractText(data);
        if (text && typeof text === 'string') {
          firstUserMessage = { role: 'user', text, createdAt: data.timestamp || data.createdAt || null };
        }
      }

      if (systemMessage && firstUserMessage) break;
    }

    return systemMessage || firstUserMessage || null;
  } catch (err) {
    console.error('Error extracting initial prompt:', err);
    return null;
  }
}

async function resolveAllowedProjectPath(rawProjectPath) {
  if (typeof rawProjectPath !== 'string' || !rawProjectPath) return null;
  const requested = path.resolve(rawProjectPath);
  const projects = await getProjects();
  for (const p of projects) {
    const candidates = [p.fullPath, p.path].filter(Boolean);
    for (const c of candidates) {
      if (path.resolve(c) === requested) return requested;
    }
  }
  return null;
}

// GET /api/session-context/:sessionId?projectPath=...
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const projectPath = await resolveAllowedProjectPath(req.query.projectPath);

    const claudeMdFiles = loadClaudeMdFiles(projectPath);
    const jsonlPath = findSessionJsonlPath(sessionId);
    const firstUserMessage = extractInitialPrompt(jsonlPath);

    res.json({
      success: true,
      sessionId,
      projectPath,
      jsonlPath,
      claudeMdFiles,
      firstUserMessage,
    });
  } catch (error) {
    console.error('Error loading session context:', error);
    res.status(500).json({ error: 'Failed to load session context' });
  }
});

export default router;
