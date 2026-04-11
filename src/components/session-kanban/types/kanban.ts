export interface KanbanColumn {
  id: number;
  project_name: string;
  column_name: string;
  position: number;
  is_default: number; // SQLite boolean: 0 | 1
}

export interface KanbanSessionAssignment {
  session_id: string;
  column_id: number;
  position: number;
}

export interface SessionNote {
  session_id: string;
  note_text: string;
  updated_at: string;
}

export interface SessionLabel {
  id: number;
  label_name: string;
  color: string;
}

export interface SessionLabelAssignment {
  session_id: string;
  label_id: number;
}

export interface KanbanBoard {
  columns: KanbanColumn[];
  assignments: KanbanSessionAssignment[];
  notes: SessionNote[];
  labels: SessionLabel[];
  labelAssignments: SessionLabelAssignment[];
}
