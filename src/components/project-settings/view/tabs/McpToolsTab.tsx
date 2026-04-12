import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plug } from 'lucide-react';
import { useProjectSettingsApi, type ProjectMcpServer } from '../../hooks/useProjectSettingsApi';

type McpToolsTabProps = {
  projectName: string;
};

export default function McpToolsTab({ projectName }: McpToolsTabProps) {
  const api = useProjectSettingsApi();
  const [servers, setServers] = useState<ProjectMcpServer[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listMcpServers(projectName);
      setServers(list);
    } finally {
      setLoading(false);
    }
  }, [api, projectName]);

  useEffect(() => { reload(); }, [reload]);

  const handleToggle = async (server: ProjectMcpServer) => {
    try {
      await api.toggleMcpServer(projectName, server.name, !server.enabled);
      await reload();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const userServers = servers.filter((s) => s.scope === 'user');
  const projectServers = servers.filter((s) => s.scope === 'project');

  const renderList = (items: ProjectMcpServer[], title: string) => (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
          Nessun server
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((server) => (
            <div key={`${server.scope}-${server.name}`} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
              <Plug className={`mt-0.5 h-4 w-4 shrink-0 ${server.enabled ? 'text-primary' : 'text-muted-foreground/50'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{server.name}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{server.type}</span>
                </div>
                {server.command && (
                  <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                    {server.command}{server.args.length > 0 ? ' ' + server.args.join(' ') : ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleToggle(server)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${server.enabled ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${server.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {renderList(userServers, 'MCP server globali (user scope)')}
      {renderList(projectServers, 'MCP server del progetto')}
      <p className="text-xs text-muted-foreground">
        Le preferenze sono salvate in <code className="rounded bg-muted px-1 py-0.5">.claude/settings.local.json</code> → <code className="rounded bg-muted px-1 py-0.5">cloudcli.disabledMcpServers</code>.
        Valgono per tutte le nuove sessioni.
      </p>
    </div>
  );
}
