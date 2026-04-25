# claudecodeui — context for Claude

## Stack
- React + TS + Vite + Tailwind + lucide-react. Backend: Express + better-sqlite3.
- Package manager: **bun** (mai npm/npx/node).

## Commands
- `bun run dev` — server (3080) + vite HMR (5173) via concurrently.
- `bun run typecheck` — tsc --noEmit.
- `bun run build` — vite build. Precedere sempre commit.
- Server in uso: `kill $(pgrep -f "node server/index.js")` prima di riavviare (altrimenti EADDRINUSE su 3080).

## Git
- `origin` = upstream `siteboon/claudecodeui` (read-only). Push sempre su `bwlab` (`git push bwlab <branch>`).
- Husky pre-commit usa `npx` → commit richiede `PATH="/home/lmassa/.nvm/versions/node/v20.19.0/bin:$PATH" git commit ...`
- Pre-commit esegue eslint: errors bloccano commit, warnings passano.

## Design System bwlab v2
- Token reali in `src/styles/design-tokens.css`: `--heritage-a` (giallo #F5D000), `--heritage-b` (rosso #E30613). NON esistono `--heritage-yellow`/`--heritage-red`.
- Fallback inline in CSS: `var(--heritage-a, #F5D000)`.

## Sessioni per-provider
- Claude: file JSONL in `~/.claude/projects/:projectName/`. DELETE via `/api/projects/:name/sessions/:id`.
- Codex: DELETE `/api/codex/sessions/:id`.
- Gemini: DELETE `/api/gemini/sessions/:id`.
- Cursor: **nessun** endpoint delete server-side.

## DB migrations
- SQLite in `server/database/db.js` via `runMigrations()`. Pattern idempotente: `PRAGMA table_info(...)` → check manuale prima dell'ALTER.
- Default DB: `~/.claude-code-ui/auth.db` (override con `DATABASE_PATH`).

## State unificato UI
- `src/components/unified-sidebar/state/useUnifiedLocation.ts` — Location (preset|folder|project|session) derivata da URL. Unica sorgente di verità per sidebar/breadcrumb/content.
- `src/components/unified-sidebar/state/useWorkspace.ts` — fetch aggregato `/api/dashboards/workspace` (dashboards + raccoglitori + assignments + favoriteProjectNames).
- `useProjectsState` espone setters diretti (setSelectedProject/Session/IsNewSession); evitare handleProjectSelect legacy che naviga a `/session/:id`.

## Multi-tab (browser-like)
- Singleton `src/stores/tabsStore.ts` (useSyncExternalStore + sessionStorage `bwlab.tabs.v1`). Cap 8 tab.
- Dedup: shell = 1 per `(projectName,sessionId,provider)`; chat con sessionId = 1 per `(projectName,sessionId,provider)`; chat senza sessionId = sempre nuovo tab.
- Tab attivo ↔ URL in lockstep: `activateTab` → `navigate(tabToUrl(tab))`. Non aggiungere stato selezione altrove.
- Quando una "nuova sessione" riceve sessionId reale: `updateTabSession(id, {sessionId, provider})` per dedup futuri.

## Routing & navigation
- Routes React Router in `src/App.tsx` `<Routes>`. Aggiungendo una nuova URL la *Route va registrata qui*, altrimenti `<Routes>` rende null → pagina bianca senza errori.
- URL non-`/api/` servono `index.html` (catch-all Express in `server/index.js`).
- `parsePath` in `unified-sidebar/state/useUnifiedLocation.ts`, `toPath` in `unified-sidebar/types/location.ts`. Per nuove URL: estendere entrambi + Route in `App.tsx` insieme.

## Auth & API
- Tutte le `/api/*` dietro `authenticateToken` (eccetto `/api/auth` e `/api/agent` su API-key). Curl senza token → 401.
- Pattern asset `.md` per-progetto: `extractProjectDirectory(projectName)` (in `server/projects.js`) → cwd reale; file in `<cwd>/.claude/<sub>/`. Esempi: `project-skills.js`, `project-agents.js`, `project-commands.js`, `project-mcp.js`.

## Commit conventions
- Husky + commitlint: subject **lowercase** obbligatorio (`feat:`, `fix:`, ...), body max 100 char/linea.
- HEREDOC pattern: `git commit -m "$(cat <<'EOF' ... EOF )"`.

## Service Worker
- `public/sw.js` registrato in prod e dev. Network-first; mai intercetta `/api/` o `/ws`. Hashed assets (`/assets/`) cache-first.

## Gotchas
- `MainContent` è multi-mount per-tab in `AppContent.tsx`: `key={tab.id}` + `display:none/flex` mantiene PTY shell, scroll chat e `viewTab` vivi al cambio tab. Non rimettere logica unmount-on-change.
- Lucide icons colorate via `text-[color:...]` (stroke) + `fill-[color:...]/20` per fill soft. Senza fill, icone outline-only.
- DnD nativo HTML5 MIME: `application/x-bwlab-node`. Payload: `{kind:'project',projectName}` o `{kind:'folder',folderId,dashboardId}`.
