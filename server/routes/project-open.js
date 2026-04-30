import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { spawn, spawnSync } from 'child_process';
import { extractProjectDirectory } from '../projects.js';
import { appConfigDb } from '../database/db.js';

const router = express.Router();

const DEFAULT_IDE_COMMAND = 'code';

// GUI apps (xdg-open, nautilus, IDE GUIs) need DBUS_SESSION_BUS_ADDRESS and
// XDG_RUNTIME_DIR to reach the user's desktop session. Node processes
// started without these vars spawn the app but it has nothing to bind to
// and exits silently.
function buildGuiEnv() {
  const env = { ...process.env };
  if (process.platform === 'linux') {
    const uid = typeof process.getuid === 'function' ? process.getuid() : null;
    if (uid != null) {
      if (!env.XDG_RUNTIME_DIR) env.XDG_RUNTIME_DIR = `/run/user/${uid}`;
      if (!env.DBUS_SESSION_BUS_ADDRESS) env.DBUS_SESSION_BUS_ADDRESS = `unix:path=/run/user/${uid}/bus`;
    }
    if (!env.DISPLAY) env.DISPLAY = ':0';
  }
  return env;
}

function detectLinuxTerminal() {
  // 1. User preference from DB
  const stored = appConfigDb.get('terminal_command');
  if (stored) return stored.trim();
  // 2. $TERMINAL env var
  if (process.env.TERMINAL) return process.env.TERMINAL;
  // 3. Debian/Ubuntu alternatives system
  try {
    const w = spawnSync('which', ['x-terminal-emulator']);
    if (w.status === 0) return 'x-terminal-emulator';
  } catch { /* ignore */ }
  // 4. Detection list
  const candidates = ['tilix', 'konsole', 'xfce4-terminal', 'alacritty', 'kitty', 'gnome-terminal', 'xterm'];
  for (const c of candidates) {
    try {
      const w = spawnSync('which', [c]);
      if (w.status === 0) return c;
    } catch { /* continue */ }
  }
  return null;
}

// GET /api/project-open/config/ide
router.get('/config/ide', (_req, res) => {
  const stored = appConfigDb.get('ide_command');
  res.json({ success: true, command: stored || DEFAULT_IDE_COMMAND, defaultCommand: DEFAULT_IDE_COMMAND });
});

// PUT /api/project-open/config/ide
router.put('/config/ide', (req, res) => {
  try {
    const { command } = req.body || {};
    if (typeof command !== 'string' || !command.trim()) {
      return res.status(400).json({ error: 'command is required' });
    }
    appConfigDb.set('ide_command', command.trim());
    res.json({ success: true, command: command.trim() });
  } catch (error) {
    console.error('Error saving ide command:', error);
    res.status(500).json({ error: 'Failed to save ide command' });
  }
});

// GET /api/project-open/config/terminal
router.get('/config/terminal', (_req, res) => {
  const stored = appConfigDb.get('terminal_command');
  res.json({ success: true, command: stored || '' });
});

// PUT /api/project-open/config/terminal (accept empty string to reset to auto-detect)
router.put('/config/terminal', (req, res) => {
  try {
    const { command } = req.body || {};
    if (typeof command !== 'string') {
      return res.status(400).json({ error: 'command must be a string' });
    }
    appConfigDb.set('terminal_command', command.trim());
    res.json({ success: true, command: command.trim() });
  } catch (error) {
    console.error('Error saving terminal command:', error);
    res.status(500).json({ error: 'Failed to save terminal command' });
  }
});

// POST /api/project-open/:projectName/in-file-manager
router.post('/:projectName/in-file-manager', async (req, res) => {
  try {
    const cwd = await extractProjectDirectory(req.params.projectName);
    if (!cwd || !fs.existsSync(cwd)) {
      return res.status(404).json({ error: 'Project path not found' });
    }

    const platform = process.platform;
    let command;
    let args;

    if (platform === 'darwin') {
      command = 'open';
      args = [cwd];
    } else if (platform === 'win32') {
      command = 'explorer';
      args = [cwd];
    } else {
      // Linux / *nix — xdg-open is the cross-DE launcher that respects the user's preferred file manager
      command = 'xdg-open';
      args = [cwd];
    }

    try {
      const child = spawn(command, args, { detached: true, stdio: 'ignore', env: buildGuiEnv() });
      child.on('error', (err) => console.error('File manager spawn error:', err));
      child.unref();
    } catch (err) {
      return res.status(500).json({ error: `Failed to launch ${command}: ${err?.message || err}` });
    }

    res.json({ success: true, platform, command, path: cwd });
  } catch (error) {
    console.error('Error opening project in file manager:', error);
    res.status(500).json({ error: 'Failed to open file manager' });
  }
});

// POST /api/project-open/:projectName/in-ide
router.post('/:projectName/in-ide', async (req, res) => {
  try {
    const cwd = await extractProjectDirectory(req.params.projectName);
    if (!cwd || !fs.existsSync(cwd)) {
      return res.status(404).json({ error: 'Project path not found' });
    }

    const storedCommand = appConfigDb.get('ide_command') || DEFAULT_IDE_COMMAND;
    // Support composite command with extra args like "phpstorm --line 1"
    const parts = storedCommand.split(/\s+/).filter(Boolean);
    const command = parts[0];
    const extraArgs = parts.slice(1);

    try {
      const child = spawn(command, [...extraArgs, cwd], { detached: true, stdio: 'ignore', env: buildGuiEnv() });
      child.on('error', (err) => console.error('IDE spawn error:', err));
      child.unref();
    } catch (err) {
      return res.status(500).json({ error: `Failed to launch ${command}: ${err?.message || err}` });
    }

    res.json({ success: true, command, path: cwd });
  } catch (error) {
    console.error('Error opening project in IDE:', error);
    res.status(500).json({ error: 'Failed to open IDE' });
  }
});

/**
 * Wraps a value in single quotes so the shell (zsh/bash) treats it as a
 * literal. Safer than double quotes because it also disables globbing
 * (`opus[1m]` would otherwise trigger "no matches found" on zsh).
 */
function shellQuote(value) {
  const s = String(value);
  // Escape embedded single quotes using the standard `'\''` pattern
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function buildClaudeCommand(options = {}) {
  const parts = ['claude'];
  const { resume, continueSession, permissionMode, model, verbose, debug } = options;

  if (continueSession) {
    parts.push('--continue');
  } else if (resume) {
    parts.push('--resume', shellQuote(resume));
  }

  if (permissionMode) {
    if (permissionMode === 'bypassPermissions') {
      parts.push('--dangerously-skip-permissions');
    } else if (permissionMode !== 'default') {
      parts.push('--permission-mode', shellQuote(permissionMode));
    }
  }

  if (model) parts.push('--model', shellQuote(model));
  if (verbose) parts.push('--verbose');
  if (debug) parts.push('--debug');

  return parts.join(' ');
}

function buildClaudeCommandWindows(options = {}) {
  const parts = ['claude'];
  const { resume, continueSession, permissionMode, model, verbose, debug } = options;
  const q = (v) => `"${String(v).replace(/"/g, '\\"')}"`;

  if (continueSession) parts.push('--continue');
  else if (resume) parts.push('--resume', q(resume));

  if (permissionMode === 'bypassPermissions') parts.push('--dangerously-skip-permissions');
  else if (permissionMode && permissionMode !== 'default') parts.push('--permission-mode', q(permissionMode));

  if (model) parts.push('--model', q(model));
  if (verbose) parts.push('--verbose');
  if (debug) parts.push('--debug');

  return parts.join(' ');
}

/**
 * Writes a wrapper shell script that runs the claude command as a login shell
 * (so PATH from ~/.zshrc / ~/.bashrc is loaded), then keeps the terminal open.
 * Returns the absolute path of the script.
 */
function writeClaudeLauncherScript(cwd, claudeCmd) {
  const userShell = process.env.SHELL || '/bin/bash';
  const scriptPath = path.join(os.tmpdir(), `cloudcli-claude-${crypto.randomBytes(6).toString('hex')}.sh`);
  // Use -i -l -c: interactive + login shell so BOTH .zshrc/.bashrc AND .zprofile/.bash_profile
  // are sourced. Without -i, zsh skips .zshrc (where most users put their PATH tweaks like
  // export PATH="$PATH:$HOME/.local/bin"), leading to "command not found: claude".
  const content = `#!/bin/bash
# Auto-generated by Nereus — launches claude with the user's interactive login shell
cd ${JSON.stringify(cwd)}
exec "${userShell}" -i -l -c ${shellQuote(`${claudeCmd}; exec "${userShell}"`)}
`;
  fs.writeFileSync(scriptPath, content, { mode: 0o755 });
  // Best-effort auto-cleanup after 60s
  setTimeout(() => { try { fs.unlinkSync(scriptPath); } catch { /* ignore */ } }, 60000);
  return scriptPath;
}

/**
 * Returns argv for launching <terminalCmd> at <cwd> running the given <scriptPath>.
 * The script handles login shell / PATH / keep-open by itself, so we just need
 * each terminal's flag to run an executable without extra quoting gymnastics.
 */
function buildLinuxTerminalArgsForScript(terminalCmd, cwd, scriptPath) {
  switch (terminalCmd) {
    case 'gnome-terminal':
      return ['--working-directory', cwd, '--', scriptPath];
    case 'konsole':
      return ['--workdir', cwd, '-e', scriptPath];
    case 'xfce4-terminal':
      return ['--working-directory', cwd, '-x', scriptPath];
    case 'tilix':
      return ['--working-directory', cwd, '-e', scriptPath];
    case 'alacritty':
      return ['--working-directory', cwd, '-e', scriptPath];
    case 'kitty':
      return ['--directory', cwd, scriptPath];
    case 'xterm':
      return ['-e', scriptPath];
    default:
      // x-terminal-emulator fallback: most accept -e with a single command
      return ['-e', scriptPath];
  }
}


/**
 * Risolve filePath assoluto controllando che ricada in una delle dir consentite:
 * - ~/.claude/ (agenti globali, progetti claude, memoria)
 * - <projectCwd>/.claude/ (agenti per-progetto) se projectName fornito
 * Ritorna { resolved } o { error, status }.
 */
async function resolveAllowedFilePath(filePath, projectName) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    return { error: 'filePath is required', status: 400 };
  }
  const resolved = path.resolve(filePath);
  const allowedRoots = [path.resolve(path.join(os.homedir(), '.claude'))];
  if (typeof projectName === 'string' && projectName) {
    try {
      const cwd = await extractProjectDirectory(projectName);
      if (cwd && fs.existsSync(cwd)) {
        allowedRoots.push(path.resolve(path.join(cwd, '.claude')));
      }
    } catch { /* ignore lookup error */ }
  }
  const inAllowed = allowedRoots.some((root) => resolved === root || resolved.startsWith(root + path.sep));
  if (!inAllowed) return { error: 'File path not in an allowed directory', status: 400 };
  if (!fs.existsSync(resolved)) return { error: 'File not found', status: 404 };
  try {
    const stat = fs.lstatSync(resolved);
    if (stat.isSymbolicLink()) {
      const realTarget = fs.realpathSync(resolved);
      const realIn = allowedRoots.some((root) => realTarget === root || realTarget.startsWith(root + path.sep));
      if (!realIn) return { error: 'Symlink target not in allowed directory', status: 400 };
    }
  } catch { /* ignore stat error */ }
  return { resolved };
}

// POST /api/project-open/file-in-file-manager — body: { filePath, projectName? }
// Apre la directory contenente il file nel file manager dell'OS. Su Linux usa
// xdg-open sulla parent dir; nautilus/dolphin verranno avviati con la cartella.
router.post('/file-in-file-manager', async (req, res) => {
  try {
    const { filePath, projectName } = req.body || {};
    const check = await resolveAllowedFilePath(filePath, projectName);
    if (check.error) return res.status(check.status).json({ error: check.error });
    const dir = path.dirname(check.resolved);

    const platform = process.platform;
    let command;
    let args;
    if (platform === 'darwin') {
      command = 'open';
      args = ['-R', check.resolved]; // -R rivela il file nel Finder
    } else if (platform === 'win32') {
      command = 'explorer';
      args = [`/select,${check.resolved}`];
    } else {
      command = 'xdg-open';
      args = [dir];
    }

    try {
      const child = spawn(command, args, { detached: true, stdio: 'ignore', env: buildGuiEnv() });
      child.on('error', (err) => console.error('File manager spawn error (file):', err));
      child.unref();
    } catch (err) {
      return res.status(500).json({ error: `Failed to launch ${command}: ${err?.message || err}` });
    }

    res.json({ success: true, platform, command, path: dir });
  } catch (error) {
    console.error('Error opening file in file manager:', error);
    res.status(500).json({ error: 'Failed to open file in file manager' });
  }
});

// POST /api/project-open/file-in-ide — body: { filePath, projectName? }
// Apre un singolo file nell'IDE configurato. Il file deve trovarsi dentro una
// directory consentita (per evitare apertura arbitraria di qualunque path).
router.post('/file-in-ide', async (req, res) => {
  try {
    const { filePath, projectName } = req.body || {};
    const check = await resolveAllowedFilePath(filePath, projectName);
    if (check.error) return res.status(check.status).json({ error: check.error });

    const storedCommand = appConfigDb.get('ide_command') || DEFAULT_IDE_COMMAND;
    const parts = storedCommand.split(/\s+/).filter(Boolean);
    const command = parts[0];
    const extraArgs = parts.slice(1);

    try {
      const child = spawn(command, [...extraArgs, check.resolved], { detached: true, stdio: 'ignore', env: buildGuiEnv() });
      child.on('error', (err) => console.error('IDE spawn error (file):', err));
      child.unref();
    } catch (err) {
      return res.status(500).json({ error: `Failed to launch ${command}: ${err?.message || err}` });
    }

    res.json({ success: true, command, path: check.resolved });
  } catch (error) {
    console.error('Error opening file in IDE:', error);
    res.status(500).json({ error: 'Failed to open file in IDE' });
  }
});

// POST /api/project-open/:projectName/in-terminal-with-claude — body: { resume, continueSession, permissionMode, model, verbose, debug }
router.post('/:projectName/in-terminal-with-claude', async (req, res) => {
  try {
    const cwd = await extractProjectDirectory(req.params.projectName);
    if (!cwd || !fs.existsSync(cwd)) {
      return res.status(404).json({ error: 'Project path not found' });
    }

    const claudeCmd = buildClaudeCommand(req.body || {});
    const platform = process.platform;

    if (platform === 'darwin') {
      // Use osascript to open a new Terminal.app window with the command.
      // Inner command uses single quotes, so no escape needed here.
      const cwdForApplescript = cwd.replace(/"/g, '\\"');
      const script = `tell application "Terminal" to do script "cd \\"${cwdForApplescript}\\" && ${claudeCmd}"`;
      const child = spawn('osascript', ['-e', script], { detached: true, stdio: 'ignore' });
      child.on('error', (err) => console.error('osascript error:', err));
      child.unref();
      return res.json({ success: true, platform, command: claudeCmd, path: cwd });
    }

    if (platform === 'win32') {
      // cmd.exe does not treat single quotes as quotes, so re-build the command with double quotes for Windows.
      const winClaudeCmd = buildClaudeCommandWindows(req.body || {});
      const child = spawn('cmd', ['/c', 'start', 'cmd', '/K', `cd /d "${cwd}" && ${winClaudeCmd}`], { detached: true, stdio: 'ignore' });
      child.on('error', (err) => console.error('cmd error:', err));
      child.unref();
      return res.json({ success: true, platform, command: claudeCmd, path: cwd });
    }

    // Linux — pick a terminal (user pref, $TERMINAL, x-terminal-emulator, detection)
    const chosen = detectLinuxTerminal();
    if (!chosen) return res.status(500).json({ error: 'Nessun terminale trovato' });

    // Build a wrapper script to avoid quoting/escaping issues across terminals
    const scriptPath = writeClaudeLauncherScript(cwd, claudeCmd);
    const args = buildLinuxTerminalArgsForScript(chosen, cwd, scriptPath);
    const child = spawn(chosen, args, { detached: true, stdio: 'ignore', env: buildGuiEnv() });
    child.on('error', (err) => console.error('Terminal spawn error:', err));
    child.unref();

    res.json({ success: true, platform, terminal: chosen, command: claudeCmd, path: cwd, script: scriptPath });
  } catch (error) {
    console.error('Error opening terminal with claude:', error);
    res.status(500).json({ error: 'Failed to open terminal' });
  }
});

export default router;
