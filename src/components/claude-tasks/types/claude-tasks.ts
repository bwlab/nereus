export interface ClaudeTask {
  id: string;
  subject: string;
  description?: string;
  activeForm?: string;
  status: 'pending' | 'in_progress' | 'completed';
  blocks?: string[];
  blockedBy?: string[];
  createdAt?: string;
  updatedAt?: string;
  sessionId?: string;
  sessionName?: string;
  project?: string;
}

export interface ClaudeTaskSession {
  id: string;
  name: string | null;
  project: string | null;
  taskCount: number;
  completed: number;
  inProgress: number;
  pending: number;
  modifiedAt: string;
  tasks?: ClaudeTask[];
}

export interface ClaudeTaskSummary {
  pending: number;
  inProgress: number;
  completed: number;
}

export type ClaudeTaskSummaryByProject = Record<string, ClaudeTaskSummary>;
