import { useCallback, useMemo } from 'react';
import { authenticatedFetch } from '../../../utils/api';

export type ProjectCommand = {
  name: string;
  path: string;
  description: string;
  namespace: string | null;
  body: string;
  updatedAt?: string;
};

export type ProjectSkill = {
  name: string;
  masterPath: string;
  description: string | null;
  enabled: boolean;
  linkInfo: string | null;
};

export type GlobalSkill = {
  name: string;
  rawDirName: string;
  fullPath: string;
  description: string | null;
  enabled: boolean;
};

export type CatalogSkill = {
  name: string;
  fullPath: string;
  description: string | null;
};

export type SkillsCatalog = {
  global: { dir: string; exists: boolean; skills: CatalogSkill[] };
  project: { dir: string; exists: boolean; skills: CatalogSkill[] };
};

export type ProjectMcpServer = {
  name: string;
  scope: 'user' | 'project';
  type: string;
  command: string | null;
  args: string[];
  enabled: boolean;
};

export function useProjectSettingsApi() {
  // --- Commands ---
  const listCommands = useCallback(async (projectName: string): Promise<ProjectCommand[]> => {
    const res = await authenticatedFetch(`/api/project-commands/${encodeURIComponent(projectName)}`);
    const data = await res.json();
    return data.commands ?? [];
  }, []);

  const createCommand = useCallback(async (projectName: string, data: { name: string; description?: string; namespace?: string | null; body?: string }) => {
    const res = await authenticatedFetch(`/api/project-commands/${encodeURIComponent(projectName)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create command');
    return result.command as ProjectCommand;
  }, []);

  const updateCommand = useCallback(async (projectName: string, name: string, data: { description?: string; namespace?: string | null; body?: string }) => {
    const res = await authenticatedFetch(`/api/project-commands/${encodeURIComponent(projectName)}/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Update failed' }));
      throw new Error(err.error || 'Failed to update command');
    }
  }, []);

  const deleteCommand = useCallback(async (projectName: string, name: string) => {
    await authenticatedFetch(`/api/project-commands/${encodeURIComponent(projectName)}/${encodeURIComponent(name)}`, { method: 'DELETE' });
  }, []);

  const generateClaudeMd = useCallback(async (projectName: string): Promise<{ alreadyExists: boolean; path: string }> => {
    const res = await authenticatedFetch(`/api/project-commands/${encodeURIComponent(projectName)}/init`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to init');
    return { alreadyExists: Boolean(data.alreadyExists), path: data.path };
  }, []);

  // --- Skills ---
  const listSkills = useCallback(async (projectName: string): Promise<{ masterDir: string; masterExists: boolean; skills: ProjectSkill[] }> => {
    const res = await authenticatedFetch(`/api/project-skills/${encodeURIComponent(projectName)}`);
    const data = await res.json();
    return { masterDir: data.masterDir, masterExists: Boolean(data.masterExists), skills: data.skills ?? [] };
  }, []);

  const toggleSkill = useCallback(async (projectName: string, name: string, enabled: boolean) => {
    const res = await authenticatedFetch(`/api/project-skills/${encodeURIComponent(projectName)}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ name, enabled }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Toggle failed' }));
      throw new Error(err.error || 'Failed to toggle skill');
    }
  }, []);

  const getSkillsMasterDir = useCallback(async (): Promise<{ path: string; defaultPath: string }> => {
    const res = await authenticatedFetch('/api/project-skills/config/skills-master-dir');
    const data = await res.json();
    return { path: data.path, defaultPath: data.defaultPath };
  }, []);

  const setSkillsMasterDir = useCallback(async (path: string) => {
    await authenticatedFetch('/api/project-skills/config/skills-master-dir', {
      method: 'PUT',
      body: JSON.stringify({ path }),
    });
  }, []);

  const getSkillsGlobalMasterDir = useCallback(async (): Promise<{ path: string; defaultPath: string }> => {
    const res = await authenticatedFetch('/api/project-skills/config/skills-global-master-dir');
    const data = await res.json();
    return { path: data.path, defaultPath: data.defaultPath };
  }, []);

  const setSkillsGlobalMasterDir = useCallback(async (path: string) => {
    await authenticatedFetch('/api/project-skills/config/skills-global-master-dir', {
      method: 'PUT',
      body: JSON.stringify({ path }),
    });
  }, []);

  const getSkillsCatalog = useCallback(async (): Promise<SkillsCatalog> => {
    const res = await authenticatedFetch('/api/project-skills/catalog');
    const data = await res.json();
    return {
      global: data.global ?? { dir: '', exists: false, skills: [] },
      project: data.project ?? { dir: '', exists: false, skills: [] },
    };
  }, []);

  // --- Global skills (user scope, ~/.claude/skills) ---
  const listGlobalSkills = useCallback(async (): Promise<{ dir: string; skills: GlobalSkill[] }> => {
    const res = await authenticatedFetch('/api/project-skills/global/list');
    const data = await res.json();
    return { dir: data.dir, skills: data.skills ?? [] };
  }, []);

  const toggleGlobalSkill = useCallback(async (name: string, enabled: boolean) => {
    const res = await authenticatedFetch('/api/project-skills/global/toggle', {
      method: 'POST',
      body: JSON.stringify({ name, enabled }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Toggle failed' }));
      throw new Error(err.error || 'Failed to toggle global skill');
    }
  }, []);

  // --- MCP ---
  const listMcpServers = useCallback(async (projectName: string): Promise<ProjectMcpServer[]> => {
    const res = await authenticatedFetch(`/api/project-mcp/${encodeURIComponent(projectName)}`);
    const data = await res.json();
    return data.servers ?? [];
  }, []);

  const toggleMcpServer = useCallback(async (projectName: string, name: string, enabled: boolean) => {
    const res = await authenticatedFetch(`/api/project-mcp/${encodeURIComponent(projectName)}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ name, enabled }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Toggle failed' }));
      throw new Error(err.error || 'Failed to toggle MCP server');
    }
  }, []);

  return useMemo(() => ({
    listCommands, createCommand, updateCommand, deleteCommand, generateClaudeMd,
    listSkills, toggleSkill, getSkillsMasterDir, setSkillsMasterDir,
    getSkillsGlobalMasterDir, setSkillsGlobalMasterDir, getSkillsCatalog,
    listGlobalSkills, toggleGlobalSkill,
    listMcpServers, toggleMcpServer,
  }), [
    listCommands, createCommand, updateCommand, deleteCommand, generateClaudeMd,
    listSkills, toggleSkill, getSkillsMasterDir, setSkillsMasterDir,
    getSkillsGlobalMasterDir, setSkillsGlobalMasterDir, getSkillsCatalog,
    listGlobalSkills, toggleGlobalSkill,
    listMcpServers, toggleMcpServer,
  ]);
}
