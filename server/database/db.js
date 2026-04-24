import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
};

const c = {
    info: (text) => `${colors.cyan}${text}${colors.reset}`,
    bright: (text) => `${colors.bright}${text}${colors.reset}`,
    dim: (text) => `${colors.dim}${text}${colors.reset}`,
};

// Use DATABASE_PATH environment variable if set, otherwise use default location
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'auth.db');
const INIT_SQL_PATH = path.join(__dirname, 'init.sql');

// Ensure database directory exists if custom path is provided
if (process.env.DATABASE_PATH) {
  const dbDir = path.dirname(DB_PATH);
  try {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`Created database directory: ${dbDir}`);
    }
  } catch (error) {
    console.error(`Failed to create database directory ${dbDir}:`, error.message);
    throw error;
  }
}

// As part of 1.19.2 we are introducing a new location for auth.db. The below handles exisitng moving legacy database from install directory to new location
const LEGACY_DB_PATH = path.join(__dirname, 'auth.db');
if (DB_PATH !== LEGACY_DB_PATH && !fs.existsSync(DB_PATH) && fs.existsSync(LEGACY_DB_PATH)) {
  try {
    fs.copyFileSync(LEGACY_DB_PATH, DB_PATH);
    console.log(`[MIGRATION] Copied database from ${LEGACY_DB_PATH} to ${DB_PATH}`);
    for (const suffix of ['-wal', '-shm']) {
      if (fs.existsSync(LEGACY_DB_PATH + suffix)) {
        fs.copyFileSync(LEGACY_DB_PATH + suffix, DB_PATH + suffix);
      }
    }
  } catch (err) {
    console.warn(`[MIGRATION] Could not copy legacy database: ${err.message}`);
  }
}

// Create database connection
const db = new Database(DB_PATH);

// app_config must exist before any other module imports (auth.js reads the JWT secret at load time).
// runMigrations() also creates this table, but it runs too late for existing installations
// where auth.js is imported before initializeDatabase() is called.
db.exec(`CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Show app installation path prominently
const appInstallPath = path.join(__dirname, '../..');
console.log('');
console.log(c.dim('═'.repeat(60)));
console.log(`${c.info('[INFO]')} App Installation: ${c.bright(appInstallPath)}`);
console.log(`${c.info('[INFO]')} Database: ${c.dim(path.relative(appInstallPath, DB_PATH))}`);
if (process.env.DATABASE_PATH) {
  console.log(`       ${c.dim('(Using custom DATABASE_PATH from environment)')}`);
}
console.log(c.dim('═'.repeat(60)));
console.log('');

const runMigrations = () => {
  try {
    const tableInfo = db.prepare("PRAGMA table_info(users)").all();
    const columnNames = tableInfo.map(col => col.name);

    if (!columnNames.includes('git_name')) {
      console.log('Running migration: Adding git_name column');
      db.exec('ALTER TABLE users ADD COLUMN git_name TEXT');
    }

    if (!columnNames.includes('git_email')) {
      console.log('Running migration: Adding git_email column');
      db.exec('ALTER TABLE users ADD COLUMN git_email TEXT');
    }

    if (!columnNames.includes('has_completed_onboarding')) {
      console.log('Running migration: Adding has_completed_onboarding column');
      db.exec('ALTER TABLE users ADD COLUMN has_completed_onboarding BOOLEAN DEFAULT 0');
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS user_notification_preferences (
        user_id INTEGER PRIMARY KEY,
        preferences_json TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS vapid_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        public_key TEXT NOT NULL,
        private_key TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        endpoint TEXT NOT NULL UNIQUE,
        keys_p256dh TEXT NOT NULL,
        keys_auth TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    // Create app_config table if it doesn't exist (for existing installations)
    db.exec(`CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create session_names table if it doesn't exist (for existing installations)
    db.exec(`CREATE TABLE IF NOT EXISTS session_names (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'claude',
      custom_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, provider)
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_session_names_lookup ON session_names(session_id, provider)');

    // Kanban board tables
    db.exec(`CREATE TABLE IF NOT EXISTS kanban_columns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      column_name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      is_default BOOLEAN NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_kanban_columns_project ON kanban_columns(project_name)');

    db.exec(`CREATE TABLE IF NOT EXISTS kanban_session_assignments (
      session_id TEXT NOT NULL,
      column_id INTEGER NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id),
      FOREIGN KEY (column_id) REFERENCES kanban_columns(id) ON DELETE CASCADE
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS session_notes (
      session_id TEXT NOT NULL,
      project_name TEXT NOT NULL,
      note_text TEXT NOT NULL DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (session_id, project_name)
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS session_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT NOT NULL,
      label_name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3b82f6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_session_labels_project ON session_labels(project_name)');

    db.exec(`CREATE TABLE IF NOT EXISTS session_label_assignments (
      session_id TEXT NOT NULL,
      label_id INTEGER NOT NULL,
      PRIMARY KEY (session_id, label_id),
      FOREIGN KEY (label_id) REFERENCES session_labels(id) ON DELETE CASCADE
    )`);

    // Dashboard tables
    db.exec(`CREATE TABLE IF NOT EXISTS dashboards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      is_default BOOLEAN NOT NULL DEFAULT 0,
      sort_mode TEXT NOT NULL DEFAULT 'alpha',
      view_mode TEXT NOT NULL DEFAULT 'kanban',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_dashboards_user ON dashboards(user_id)');

    db.exec(`CREATE TABLE IF NOT EXISTS dashboard_raccoglitori (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dashboard_id INTEGER NOT NULL,
      parent_id INTEGER,
      depth INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3b82f6',
      icon TEXT NOT NULL DEFAULT 'Folder',
      notes TEXT DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES dashboard_raccoglitori(id) ON DELETE CASCADE
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_raccoglitori_dashboard ON dashboard_raccoglitori(dashboard_id)');

    // Migration: add parent_id/depth to existing dashboard_raccoglitori tables
    const raccoglitoriInfo = db.prepare("PRAGMA table_info(dashboard_raccoglitori)").all();
    const raccoglitoriCols = raccoglitoriInfo.map(col => col.name);
    if (!raccoglitoriCols.includes('parent_id')) {
      console.log('Running migration: Adding parent_id column to dashboard_raccoglitori');
      db.exec('ALTER TABLE dashboard_raccoglitori ADD COLUMN parent_id INTEGER REFERENCES dashboard_raccoglitori(id) ON DELETE CASCADE');
    }
    if (!raccoglitoriCols.includes('depth')) {
      console.log('Running migration: Adding depth column to dashboard_raccoglitori');
      db.exec('ALTER TABLE dashboard_raccoglitori ADD COLUMN depth INTEGER NOT NULL DEFAULT 0');
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_raccoglitori_parent ON dashboard_raccoglitori(parent_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_raccoglitori_dashboard_parent ON dashboard_raccoglitori(dashboard_id, parent_id)');

    db.exec(`CREATE TABLE IF NOT EXISTS dashboard_project_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      raccoglitore_id INTEGER NOT NULL,
      project_name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (raccoglitore_id) REFERENCES dashboard_raccoglitori(id) ON DELETE CASCADE
    )`);
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_dpa_unique ON dashboard_project_assignments(raccoglitore_id, project_name)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_dpa_raccoglitore ON dashboard_project_assignments(raccoglitore_id)');

    // Migration: add is_favorite column to existing dashboard_project_assignments tables
    const dpaInfo = db.prepare("PRAGMA table_info(dashboard_project_assignments)").all();
    const dpaCols = dpaInfo.map(col => col.name);
    if (!dpaCols.includes('is_favorite')) {
      console.log('Running migration: Adding is_favorite column to dashboard_project_assignments');
      db.exec('ALTER TABLE dashboard_project_assignments ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0');
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_dpa_favorite ON dashboard_project_assignments(is_favorite) WHERE is_favorite = 1');

    // Favorites for orphan (unassigned) projects
    db.exec(`CREATE TABLE IF NOT EXISTS user_favorite_projects (
      user_id INTEGER NOT NULL,
      project_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, project_name),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_user_fav_projects_user ON user_favorite_projects(user_id)');

    // Session archives
    db.exec(`CREATE TABLE IF NOT EXISTS session_archives (
      session_id TEXT NOT NULL,
      project_name TEXT NOT NULL,
      archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (session_id, project_name)
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_session_archives_project ON session_archives(project_name)');

    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error.message);
    throw error;
  }
};

// Initialize database with schema
const initializeDatabase = async () => {
  try {
    const initSQL = fs.readFileSync(INIT_SQL_PATH, 'utf8');
    db.exec(initSQL);
    console.log('Database initialized successfully');
    runMigrations();
  } catch (error) {
    console.error('Error initializing database:', error.message);
    throw error;
  }
};

// User database operations
const userDb = {
  // Check if any users exist
  hasUsers: () => {
    try {
      const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
      return row.count > 0;
    } catch (err) {
      throw err;
    }
  },

  // Create a new user
  createUser: (username, passwordHash) => {
    try {
      const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
      const result = stmt.run(username, passwordHash);
      return { id: result.lastInsertRowid, username };
    } catch (err) {
      throw err;
    }
  },

  // Get user by username
  getUserByUsername: (username) => {
    try {
      const row = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Update last login time (non-fatal — logged but not thrown)
  updateLastLogin: (userId) => {
    try {
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    } catch (err) {
      console.warn('Failed to update last login:', err.message);
    }
  },

  // Get user by ID
  getUserById: (userId) => {
    try {
      const row = db.prepare('SELECT id, username, created_at, last_login FROM users WHERE id = ? AND is_active = 1').get(userId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  getFirstUser: () => {
    try {
      const row = db.prepare('SELECT id, username, created_at, last_login FROM users WHERE is_active = 1 LIMIT 1').get();
      return row;
    } catch (err) {
      throw err;
    }
  },

  updateGitConfig: (userId, gitName, gitEmail) => {
    try {
      const stmt = db.prepare('UPDATE users SET git_name = ?, git_email = ? WHERE id = ?');
      stmt.run(gitName, gitEmail, userId);
    } catch (err) {
      throw err;
    }
  },

  getGitConfig: (userId) => {
    try {
      const row = db.prepare('SELECT git_name, git_email FROM users WHERE id = ?').get(userId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  completeOnboarding: (userId) => {
    try {
      const stmt = db.prepare('UPDATE users SET has_completed_onboarding = 1 WHERE id = ?');
      stmt.run(userId);
    } catch (err) {
      throw err;
    }
  },

  hasCompletedOnboarding: (userId) => {
    try {
      const row = db.prepare('SELECT has_completed_onboarding FROM users WHERE id = ?').get(userId);
      return row?.has_completed_onboarding === 1;
    } catch (err) {
      throw err;
    }
  }
};

// API Keys database operations
const apiKeysDb = {
  // Generate a new API key
  generateApiKey: () => {
    return 'ck_' + crypto.randomBytes(32).toString('hex');
  },

  // Create a new API key
  createApiKey: (userId, keyName) => {
    try {
      const apiKey = apiKeysDb.generateApiKey();
      const stmt = db.prepare('INSERT INTO api_keys (user_id, key_name, api_key) VALUES (?, ?, ?)');
      const result = stmt.run(userId, keyName, apiKey);
      return { id: result.lastInsertRowid, keyName, apiKey };
    } catch (err) {
      throw err;
    }
  },

  // Get all API keys for a user
  getApiKeys: (userId) => {
    try {
      const rows = db.prepare('SELECT id, key_name, api_key, created_at, last_used, is_active FROM api_keys WHERE user_id = ? ORDER BY created_at DESC').all(userId);
      return rows;
    } catch (err) {
      throw err;
    }
  },

  // Validate API key and get user
  validateApiKey: (apiKey) => {
    try {
      const row = db.prepare(`
        SELECT u.id, u.username, ak.id as api_key_id
        FROM api_keys ak
        JOIN users u ON ak.user_id = u.id
        WHERE ak.api_key = ? AND ak.is_active = 1 AND u.is_active = 1
      `).get(apiKey);

      if (row) {
        // Update last_used timestamp
        db.prepare('UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?').run(row.api_key_id);
      }

      return row;
    } catch (err) {
      throw err;
    }
  },

  // Delete an API key
  deleteApiKey: (userId, apiKeyId) => {
    try {
      const stmt = db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?');
      const result = stmt.run(apiKeyId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // Toggle API key active status
  toggleApiKey: (userId, apiKeyId, isActive) => {
    try {
      const stmt = db.prepare('UPDATE api_keys SET is_active = ? WHERE id = ? AND user_id = ?');
      const result = stmt.run(isActive ? 1 : 0, apiKeyId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  }
};

// User credentials database operations (for GitHub tokens, GitLab tokens, etc.)
const credentialsDb = {
  // Create a new credential
  createCredential: (userId, credentialName, credentialType, credentialValue, description = null) => {
    try {
      const stmt = db.prepare('INSERT INTO user_credentials (user_id, credential_name, credential_type, credential_value, description) VALUES (?, ?, ?, ?, ?)');
      const result = stmt.run(userId, credentialName, credentialType, credentialValue, description);
      return { id: result.lastInsertRowid, credentialName, credentialType };
    } catch (err) {
      throw err;
    }
  },

  // Get all credentials for a user, optionally filtered by type
  getCredentials: (userId, credentialType = null) => {
    try {
      let query = 'SELECT id, credential_name, credential_type, description, created_at, is_active FROM user_credentials WHERE user_id = ?';
      const params = [userId];

      if (credentialType) {
        query += ' AND credential_type = ?';
        params.push(credentialType);
      }

      query += ' ORDER BY created_at DESC';

      const rows = db.prepare(query).all(...params);
      return rows;
    } catch (err) {
      throw err;
    }
  },

  // Get active credential value for a user by type (returns most recent active)
  getActiveCredential: (userId, credentialType) => {
    try {
      const row = db.prepare('SELECT credential_value FROM user_credentials WHERE user_id = ? AND credential_type = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1').get(userId, credentialType);
      return row?.credential_value || null;
    } catch (err) {
      throw err;
    }
  },

  // Delete a credential
  deleteCredential: (userId, credentialId) => {
    try {
      const stmt = db.prepare('DELETE FROM user_credentials WHERE id = ? AND user_id = ?');
      const result = stmt.run(credentialId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  },

  // Toggle credential active status
  toggleCredential: (userId, credentialId, isActive) => {
    try {
      const stmt = db.prepare('UPDATE user_credentials SET is_active = ? WHERE id = ? AND user_id = ?');
      const result = stmt.run(isActive ? 1 : 0, credentialId, userId);
      return result.changes > 0;
    } catch (err) {
      throw err;
    }
  }
};

const DEFAULT_NOTIFICATION_PREFERENCES = {
  channels: {
    inApp: false,
    webPush: false
  },
  events: {
    actionRequired: true,
    stop: true,
    error: true
  }
};

const normalizeNotificationPreferences = (value) => {
  const source = value && typeof value === 'object' ? value : {};

  return {
    channels: {
      inApp: source.channels?.inApp === true,
      webPush: source.channels?.webPush === true
    },
    events: {
      actionRequired: source.events?.actionRequired !== false,
      stop: source.events?.stop !== false,
      error: source.events?.error !== false
    }
  };
};

const notificationPreferencesDb = {
  getPreferences: (userId) => {
    try {
      const row = db.prepare('SELECT preferences_json FROM user_notification_preferences WHERE user_id = ?').get(userId);
      if (!row) {
        const defaults = normalizeNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
        db.prepare(
          'INSERT INTO user_notification_preferences (user_id, preferences_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
        ).run(userId, JSON.stringify(defaults));
        return defaults;
      }

      let parsed;
      try {
        parsed = JSON.parse(row.preferences_json);
      } catch {
        parsed = DEFAULT_NOTIFICATION_PREFERENCES;
      }
      return normalizeNotificationPreferences(parsed);
    } catch (err) {
      throw err;
    }
  },

  updatePreferences: (userId, preferences) => {
    try {
      const normalized = normalizeNotificationPreferences(preferences);
      db.prepare(
        `INSERT INTO user_notification_preferences (user_id, preferences_json, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO UPDATE SET
           preferences_json = excluded.preferences_json,
           updated_at = CURRENT_TIMESTAMP`
      ).run(userId, JSON.stringify(normalized));
      return normalized;
    } catch (err) {
      throw err;
    }
  }
};

const pushSubscriptionsDb = {
  saveSubscription: (userId, endpoint, keysP256dh, keysAuth) => {
    try {
      db.prepare(
        `INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET
           user_id = excluded.user_id,
           keys_p256dh = excluded.keys_p256dh,
           keys_auth = excluded.keys_auth`
      ).run(userId, endpoint, keysP256dh, keysAuth);
    } catch (err) {
      throw err;
    }
  },

  getSubscriptions: (userId) => {
    try {
      return db.prepare('SELECT endpoint, keys_p256dh, keys_auth FROM push_subscriptions WHERE user_id = ?').all(userId);
    } catch (err) {
      throw err;
    }
  },

  removeSubscription: (endpoint) => {
    try {
      db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
    } catch (err) {
      throw err;
    }
  },

  removeAllForUser: (userId) => {
    try {
      db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(userId);
    } catch (err) {
      throw err;
    }
  }
};

// Session custom names database operations
const sessionNamesDb = {
  // Set (insert or update) a custom session name
  setName: (sessionId, provider, customName) => {
    db.prepare(`
      INSERT INTO session_names (session_id, provider, custom_name)
      VALUES (?, ?, ?)
      ON CONFLICT(session_id, provider)
      DO UPDATE SET custom_name = excluded.custom_name, updated_at = CURRENT_TIMESTAMP
    `).run(sessionId, provider, customName);
  },

  // Get a single custom session name
  getName: (sessionId, provider) => {
    const row = db.prepare(
      'SELECT custom_name FROM session_names WHERE session_id = ? AND provider = ?'
    ).get(sessionId, provider);
    return row?.custom_name || null;
  },

  // Batch lookup — returns Map<sessionId, customName>
  getNames: (sessionIds, provider) => {
    if (!sessionIds.length) return new Map();
    const placeholders = sessionIds.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT session_id, custom_name FROM session_names
       WHERE session_id IN (${placeholders}) AND provider = ?`
    ).all(...sessionIds, provider);
    return new Map(rows.map(r => [r.session_id, r.custom_name]));
  },

  // Delete a custom session name
  deleteName: (sessionId, provider) => {
    return db.prepare(
      'DELETE FROM session_names WHERE session_id = ? AND provider = ?'
    ).run(sessionId, provider).changes > 0;
  },
};

// Apply custom session names from the database (overrides CLI-generated summaries)
function applyCustomSessionNames(sessions, provider) {
  if (!sessions?.length) return;
  try {
    const ids = sessions.map(s => s.id);
    const customNames = sessionNamesDb.getNames(ids, provider);
    for (const session of sessions) {
      const custom = customNames.get(session.id);
      if (custom) session.summary = custom;
    }
  } catch (error) {
    console.warn(`[DB] Failed to apply custom session names for ${provider}:`, error.message);
  }
}

// App config database operations
const appConfigDb = {
  get: (key) => {
    try {
      const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(key);
      return row?.value || null;
    } catch (err) {
      return null;
    }
  },

  set: (key, value) => {
    db.prepare(
      'INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(key, value);
  },

  getOrCreateJwtSecret: () => {
    let secret = appConfigDb.get('jwt_secret');
    if (!secret) {
      secret = crypto.randomBytes(64).toString('hex');
      appConfigDb.set('jwt_secret', secret);
    }
    return secret;
  }
};

// Kanban board database operations
const kanbanDb = {
  getColumns: (projectName) => {
    return db.prepare(
      'SELECT id, project_name, column_name, position, is_default FROM kanban_columns WHERE project_name = ? ORDER BY position'
    ).all(projectName);
  },

  createColumn: (projectName, columnName, isDefault = false) => {
    const maxPos = db.prepare(
      'SELECT COALESCE(MAX(position), -1) as maxPos FROM kanban_columns WHERE project_name = ?'
    ).get(projectName);
    const position = (maxPos?.maxPos ?? -1) + 1;
    const result = db.prepare(
      'INSERT INTO kanban_columns (project_name, column_name, position, is_default) VALUES (?, ?, ?, ?)'
    ).run(projectName, columnName, position, isDefault ? 1 : 0);
    return { id: result.lastInsertRowid, projectName, columnName, position, isDefault };
  },

  updateColumn: (columnId, columnName, position) => {
    if (columnName !== undefined && position !== undefined) {
      db.prepare('UPDATE kanban_columns SET column_name = ?, position = ? WHERE id = ?').run(columnName, position, columnId);
    } else if (columnName !== undefined) {
      db.prepare('UPDATE kanban_columns SET column_name = ? WHERE id = ?').run(columnName, columnId);
    } else if (position !== undefined) {
      db.prepare('UPDATE kanban_columns SET position = ? WHERE id = ?').run(position, columnId);
    }
  },

  reorderColumns: (projectName, columnIds) => {
    const stmt = db.prepare('UPDATE kanban_columns SET position = ? WHERE id = ? AND project_name = ?');
    const transaction = db.transaction((ids) => {
      ids.forEach((id, index) => stmt.run(index, id, projectName));
    });
    transaction(columnIds);
  },

  deleteColumn: (columnId) => {
    db.prepare('DELETE FROM kanban_columns WHERE id = ? AND is_default = 0').run(columnId);
  },

  getDefaultColumn: (projectName) => {
    return db.prepare(
      'SELECT id FROM kanban_columns WHERE project_name = ? AND is_default = 1 LIMIT 1'
    ).get(projectName);
  },

  getAssignments: (projectName) => {
    return db.prepare(`
      SELECT sa.session_id, sa.column_id, sa.position
      FROM kanban_session_assignments sa
      JOIN kanban_columns c ON sa.column_id = c.id
      WHERE c.project_name = ?
      ORDER BY sa.position
    `).all(projectName);
  },

  assignSession: (sessionId, columnId, position) => {
    db.prepare(`
      INSERT INTO kanban_session_assignments (session_id, column_id, position)
      VALUES (?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET column_id = excluded.column_id, position = excluded.position
    `).run(sessionId, columnId, position);
  },

  getNotes: (projectName) => {
    return db.prepare(
      'SELECT session_id, note_text, updated_at FROM session_notes WHERE project_name = ?'
    ).all(projectName);
  },

  setNote: (sessionId, projectName, noteText) => {
    db.prepare(`
      INSERT INTO session_notes (session_id, project_name, note_text, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(session_id, project_name) DO UPDATE SET note_text = excluded.note_text, updated_at = CURRENT_TIMESTAMP
    `).run(sessionId, projectName, noteText);
  },

  getLabels: (projectName) => {
    return db.prepare(
      'SELECT id, label_name, color FROM session_labels WHERE project_name = ? ORDER BY label_name'
    ).all(projectName);
  },

  createLabel: (projectName, labelName, color) => {
    const result = db.prepare(
      'INSERT INTO session_labels (project_name, label_name, color) VALUES (?, ?, ?)'
    ).run(projectName, labelName, color);
    return { id: result.lastInsertRowid, labelName, color };
  },

  updateLabel: (labelId, labelName, color) => {
    db.prepare('UPDATE session_labels SET label_name = ?, color = ? WHERE id = ?').run(labelName, color, labelId);
  },

  deleteLabel: (labelId) => {
    db.prepare('DELETE FROM session_labels WHERE id = ?').run(labelId);
  },

  getLabelAssignments: (projectName) => {
    return db.prepare(`
      SELECT sla.session_id, sla.label_id
      FROM session_label_assignments sla
      JOIN session_labels sl ON sla.label_id = sl.id
      WHERE sl.project_name = ?
    `).all(projectName);
  },

  assignLabel: (sessionId, labelId) => {
    db.prepare(
      'INSERT OR IGNORE INTO session_label_assignments (session_id, label_id) VALUES (?, ?)'
    ).run(sessionId, labelId);
  },

  removeLabel: (sessionId, labelId) => {
    db.prepare(
      'DELETE FROM session_label_assignments WHERE session_id = ? AND label_id = ?'
    ).run(sessionId, labelId);
  },

  getFullBoard: (projectName) => {
    const columns = kanbanDb.getColumns(projectName);

    if (columns.length === 0) {
      const defaultCol = kanbanDb.createColumn(projectName, 'Tutte le sessioni', true);
      columns.push({ id: defaultCol.id, project_name: projectName, column_name: 'Tutte le sessioni', position: 0, is_default: 1 });
    }

    const assignments = kanbanDb.getAssignments(projectName);
    const notes = kanbanDb.getNotes(projectName);
    const labels = kanbanDb.getLabels(projectName);
    const labelAssignments = kanbanDb.getLabelAssignments(projectName);

    return { columns, assignments, notes, labels, labelAssignments };
  },

  getArchivedSessions: (projectName) => {
    return db.prepare(
      'SELECT session_id, archived_at FROM session_archives WHERE project_name = ? ORDER BY archived_at DESC'
    ).all(projectName);
  },

  archiveSession: (projectName, sessionId) => {
    db.prepare(
      'INSERT OR IGNORE INTO session_archives (session_id, project_name) VALUES (?, ?)'
    ).run(sessionId, projectName);
  },

  unarchiveSession: (projectName, sessionId) => {
    db.prepare(
      'DELETE FROM session_archives WHERE session_id = ? AND project_name = ?'
    ).run(sessionId, projectName);
  },

  isSessionArchived: (projectName, sessionId) => {
    const row = db.prepare(
      'SELECT 1 FROM session_archives WHERE session_id = ? AND project_name = ?'
    ).get(sessionId, projectName);
    return !!row;
  },
};

const dashboardDb = {
  // --- Dashboard CRUD ---
  getDashboards: (userId) => {
    return db.prepare(
      'SELECT id, user_id, name, position, is_default, sort_mode, view_mode FROM dashboards WHERE user_id = ? ORDER BY position'
    ).all(userId);
  },

  createDashboard: (userId, name) => {
    const maxPos = db.prepare(
      'SELECT COALESCE(MAX(position), -1) as maxPos FROM dashboards WHERE user_id = ?'
    ).get(userId);
    const position = (maxPos?.maxPos ?? -1) + 1;
    const result = db.prepare(
      'INSERT INTO dashboards (user_id, name, position) VALUES (?, ?, ?)'
    ).run(userId, name, position);
    return { id: result.lastInsertRowid, user_id: userId, name, position, is_default: 0, sort_mode: 'alpha', view_mode: 'kanban' };
  },

  updateDashboard: (id, userId, updates) => {
    const fields = [];
    const values = [];
    for (const key of ['name', 'sort_mode', 'view_mode']) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }
    if (fields.length === 0) return;
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id, userId);
    db.prepare(`UPDATE dashboards SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
  },

  deleteDashboard: (id, userId) => {
    db.prepare('DELETE FROM dashboards WHERE id = ? AND user_id = ?').run(id, userId);
  },

  reorderDashboards: (userId, dashboardIds) => {
    const stmt = db.prepare('UPDATE dashboards SET position = ? WHERE id = ? AND user_id = ?');
    const transaction = db.transaction((ids) => {
      ids.forEach((id, index) => stmt.run(index, id, userId));
    });
    transaction(dashboardIds);
  },

  setDefaultDashboard: (userId, dashboardId) => {
    const transaction = db.transaction(() => {
      db.prepare('UPDATE dashboards SET is_default = 0 WHERE user_id = ?').run(userId);
      if (dashboardId) {
        db.prepare('UPDATE dashboards SET is_default = 1 WHERE id = ? AND user_id = ?').run(dashboardId, userId);
      }
    });
    transaction();
  },

  getDefaultDashboard: (userId) => {
    return db.prepare(
      'SELECT id FROM dashboards WHERE user_id = ? AND is_default = 1 LIMIT 1'
    ).get(userId);
  },

  // --- Raccoglitori CRUD ---

  getRaccoglitori: (dashboardId) => {
    return db.prepare(
      'SELECT id, dashboard_id, parent_id, depth, name, color, icon, notes, position FROM dashboard_raccoglitori WHERE dashboard_id = ? ORDER BY position'
    ).all(dashboardId);
  },

  getRaccoglitore: (id) => {
    return db.prepare(
      'SELECT id, dashboard_id, parent_id, depth, name, color, icon, notes, position FROM dashboard_raccoglitori WHERE id = ?'
    ).get(id);
  },

  getSubtreeDepth: (id) => {
    const row = db.prepare(`
      WITH RECURSIVE subtree(id, d) AS (
        SELECT id, 0 FROM dashboard_raccoglitori WHERE id = ?
        UNION ALL
        SELECT r.id, s.d + 1
        FROM dashboard_raccoglitori r
        JOIN subtree s ON r.parent_id = s.id
      )
      SELECT COALESCE(MAX(d), 0) AS maxDepth FROM subtree
    `).get(id);
    return row?.maxDepth ?? 0;
  },

  isDescendant: (candidateAncestorId, nodeId) => {
    if (candidateAncestorId === nodeId) return true;
    const row = db.prepare(`
      WITH RECURSIVE ancestors(id) AS (
        SELECT parent_id FROM dashboard_raccoglitori WHERE id = ?
        UNION ALL
        SELECT r.parent_id FROM dashboard_raccoglitori r
        JOIN ancestors a ON r.id = a.id
        WHERE r.parent_id IS NOT NULL
      )
      SELECT 1 AS hit FROM ancestors WHERE id = ? LIMIT 1
    `).get(nodeId, candidateAncestorId);
    return !!row;
  },

  createRaccoglitore: (dashboardId, { name, color = '#3b82f6', icon = 'Folder', notes = '', parent_id = null }) => {
    let depth = 0;
    let normalizedParentId = parent_id ?? null;
    if (normalizedParentId !== null) {
      const parent = dashboardDb.getRaccoglitore(normalizedParentId);
      if (!parent) throw new Error('Parent raccoglitore not found');
      if (parent.dashboard_id !== dashboardId) throw new Error('Parent belongs to a different dashboard');
      depth = parent.depth + 1;
    }
    const maxPos = db.prepare(
      'SELECT COALESCE(MAX(position), -1) as maxPos FROM dashboard_raccoglitori WHERE dashboard_id = ? AND ((parent_id IS NULL AND ? IS NULL) OR parent_id = ?)'
    ).get(dashboardId, normalizedParentId, normalizedParentId);
    const position = (maxPos?.maxPos ?? -1) + 1;
    const result = db.prepare(
      'INSERT INTO dashboard_raccoglitori (dashboard_id, parent_id, depth, name, color, icon, notes, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(dashboardId, normalizedParentId, depth, name, color, icon, notes, position);
    return { id: result.lastInsertRowid, dashboard_id: dashboardId, parent_id: normalizedParentId, depth, name, color, icon, notes, position };
  },

  updateRaccoglitore: (id, updates) => {
    const fields = [];
    const values = [];
    for (const key of ['name', 'color', 'icon', 'notes']) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }
    if (fields.length === 0) return;
    values.push(id);
    db.prepare(`UPDATE dashboard_raccoglitori SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  },

  moveRaccoglitore: (id, { parent_id = null, position = null } = {}) => {
    const node = dashboardDb.getRaccoglitore(id);
    if (!node) throw new Error('Raccoglitore not found');
    const newParentId = parent_id ?? null;
    let newParentDepth = -1;
    if (newParentId !== null) {
      const parent = dashboardDb.getRaccoglitore(newParentId);
      if (!parent) throw new Error('Target parent not found');
      if (parent.dashboard_id !== node.dashboard_id) throw new Error('Cannot move across dashboards');
      if (dashboardDb.isDescendant(newParentId, id)) throw new Error('Cannot move a raccoglitore under its own descendant');
      newParentDepth = parent.depth;
    }
    const newNodeDepth = newParentDepth + 1;
    const depthDelta = newNodeDepth - node.depth;
    const transaction = db.transaction(() => {
      let finalPosition = position;
      if (finalPosition === null || finalPosition === undefined) {
        const maxPos = db.prepare(
          'SELECT COALESCE(MAX(position), -1) AS maxPos FROM dashboard_raccoglitori WHERE dashboard_id = ? AND ((parent_id IS NULL AND ? IS NULL) OR parent_id = ?) AND id != ?'
        ).get(node.dashboard_id, newParentId, newParentId, id);
        finalPosition = (maxPos?.maxPos ?? -1) + 1;
      }
      db.prepare('UPDATE dashboard_raccoglitori SET parent_id = ?, depth = ?, position = ? WHERE id = ?')
        .run(newParentId, newNodeDepth, finalPosition, id);
      if (depthDelta !== 0) {
        db.prepare(`
          WITH RECURSIVE descendants(id) AS (
            SELECT id FROM dashboard_raccoglitori WHERE parent_id = ?
            UNION ALL
            SELECT r.id FROM dashboard_raccoglitori r JOIN descendants d ON r.parent_id = d.id
          )
          UPDATE dashboard_raccoglitori SET depth = depth + ? WHERE id IN (SELECT id FROM descendants)
        `).run(id, depthDelta);
      }
    });
    transaction();
    return dashboardDb.getRaccoglitore(id);
  },

  deleteRaccoglitore: (id, { reparent = false } = {}) => {
    const node = dashboardDb.getRaccoglitore(id);
    if (!node) return;
    if (reparent) {
      const children = db.prepare('SELECT id FROM dashboard_raccoglitori WHERE parent_id = ?').all(id);
      for (const child of children) {
        dashboardDb.moveRaccoglitore(child.id, { parent_id: node.parent_id, position: null });
      }
    }
    db.prepare('DELETE FROM dashboard_raccoglitori WHERE id = ?').run(id);
  },

  reorderRaccoglitori: (dashboardId, raccoglitoreIds) => {
    const stmt = db.prepare('UPDATE dashboard_raccoglitori SET position = ? WHERE id = ? AND dashboard_id = ?');
    const transaction = db.transaction((ids) => {
      ids.forEach((id, index) => stmt.run(index, id, dashboardId));
    });
    transaction(raccoglitoreIds);
  },

  // --- Project assignments ---
  getAssignments: (dashboardId) => {
    return db.prepare(`
      SELECT dpa.id, dpa.raccoglitore_id, dpa.project_name, dpa.position, dpa.is_favorite
      FROM dashboard_project_assignments dpa
      JOIN dashboard_raccoglitori dr ON dpa.raccoglitore_id = dr.id
      WHERE dr.dashboard_id = ?
      ORDER BY dpa.position
    `).all(dashboardId);
  },

  getAllAssignmentsForUser: (userId) => {
    return db.prepare(`
      SELECT dpa.id, dpa.raccoglitore_id, dpa.project_name, dpa.position, dpa.is_favorite, dr.dashboard_id
      FROM dashboard_project_assignments dpa
      JOIN dashboard_raccoglitori dr ON dpa.raccoglitore_id = dr.id
      JOIN dashboards d ON dr.dashboard_id = d.id
      WHERE d.user_id = ?
      ORDER BY dpa.position
    `).all(userId);
  },

  setAssignmentFavorite: (raccoglitoreId, projectName, isFavorite) => {
    const result = db.prepare(
      'UPDATE dashboard_project_assignments SET is_favorite = ? WHERE raccoglitore_id = ? AND project_name = ?'
    ).run(isFavorite ? 1 : 0, raccoglitoreId, projectName);
    return result.changes > 0;
  },

  assignProject: (raccoglitoreId, projectName, position = 0) => {
    db.prepare(`
      INSERT INTO dashboard_project_assignments (raccoglitore_id, project_name, position)
      VALUES (?, ?, ?)
      ON CONFLICT(raccoglitore_id, project_name) DO UPDATE SET position = excluded.position
    `).run(raccoglitoreId, projectName, position);
  },

  removeProject: (raccoglitoreId, projectName) => {
    db.prepare(
      'DELETE FROM dashboard_project_assignments WHERE raccoglitore_id = ? AND project_name = ?'
    ).run(raccoglitoreId, projectName);
  },

  reorderProjects: (raccoglitoreId, projectNames) => {
    const stmt = db.prepare('UPDATE dashboard_project_assignments SET position = ? WHERE raccoglitore_id = ? AND project_name = ?');
    const transaction = db.transaction((names) => {
      names.forEach((name, index) => stmt.run(index, raccoglitoreId, name));
    });
    transaction(projectNames);
  },

  // --- Ownership checks ---
  dashboardBelongsToUser: (dashboardId, userId) => {
    const row = db.prepare('SELECT 1 FROM dashboards WHERE id = ? AND user_id = ?').get(dashboardId, userId);
    return !!row;
  },

  raccoglitoreBelongsToUser: (raccoglitoreId, userId) => {
    const row = db.prepare(`
      SELECT dr.dashboard_id FROM dashboard_raccoglitori dr
      JOIN dashboards d ON dr.dashboard_id = d.id
      WHERE dr.id = ? AND d.user_id = ?
    `).get(raccoglitoreId, userId);
    return row ? row.dashboard_id : null;
  },

  // --- Full dashboard load ---
  getFullDashboard: (dashboardId, userId) => {
    const dashboard = db.prepare(
      'SELECT id, user_id, name, position, is_default, sort_mode, view_mode FROM dashboards WHERE id = ? AND user_id = ?'
    ).get(dashboardId, userId);
    if (!dashboard) return null;

    const raccoglitori = dashboardDb.getRaccoglitori(dashboardId);
    const assignments = dashboardDb.getAssignments(dashboardId);
    return { dashboard, raccoglitori, assignments };
  },

  // --- Workspace (all dashboards + folders + assignments + orphan favorites) ---
  getAllRaccoglitoriForUser: (userId) => {
    return db.prepare(`
      SELECT dr.id, dr.dashboard_id, dr.parent_id, dr.depth, dr.name, dr.color, dr.icon, dr.notes, dr.position
      FROM dashboard_raccoglitori dr
      JOIN dashboards d ON dr.dashboard_id = d.id
      WHERE d.user_id = ?
      ORDER BY dr.dashboard_id, dr.position
    `).all(userId);
  },

  getWorkspace: (userId) => {
    const dashboards = dashboardDb.getDashboards(userId);
    const raccoglitori = dashboardDb.getAllRaccoglitoriForUser(userId);
    const assignments = dashboardDb.getAllAssignmentsForUser(userId);
    const favoriteProjectNames = dashboardDb.getFavoriteProjectNames(userId);
    return { dashboards, raccoglitori, assignments, favoriteProjectNames };
  },

  // --- Orphan project favorites ---
  setProjectFavorite: (userId, projectName, isFavorite) => {
    if (isFavorite) {
      db.prepare(
        'INSERT OR IGNORE INTO user_favorite_projects (user_id, project_name) VALUES (?, ?)'
      ).run(userId, projectName);
    } else {
      db.prepare(
        'DELETE FROM user_favorite_projects WHERE user_id = ? AND project_name = ?'
      ).run(userId, projectName);
    }
  },

  getFavoriteProjectNames: (userId) => {
    return db.prepare(
      'SELECT project_name FROM user_favorite_projects WHERE user_id = ?'
    ).all(userId).map(r => r.project_name);
  },

  isProjectFavorite: (userId, projectName) => {
    const row = db.prepare(
      'SELECT 1 FROM user_favorite_projects WHERE user_id = ? AND project_name = ?'
    ).get(userId, projectName);
    return !!row;
  },
};

// Backward compatibility - keep old names pointing to new system
const githubTokensDb = {
  createGithubToken: (userId, tokenName, githubToken, description = null) => {
    return credentialsDb.createCredential(userId, tokenName, 'github_token', githubToken, description);
  },
  getGithubTokens: (userId) => {
    return credentialsDb.getCredentials(userId, 'github_token');
  },
  getActiveGithubToken: (userId) => {
    return credentialsDb.getActiveCredential(userId, 'github_token');
  },
  deleteGithubToken: (userId, tokenId) => {
    return credentialsDb.deleteCredential(userId, tokenId);
  },
  toggleGithubToken: (userId, tokenId, isActive) => {
    return credentialsDb.toggleCredential(userId, tokenId, isActive);
  }
};

export {
  db,
  initializeDatabase,
  userDb,
  apiKeysDb,
  credentialsDb,
  notificationPreferencesDb,
  pushSubscriptionsDb,
  sessionNamesDb,
  applyCustomSessionNames,
  appConfigDb,
  kanbanDb,
  dashboardDb,
  githubTokensDb // Backward compatibility
};
