import express from 'express';
import { kanbanDb } from '../database/db.js';

const router = express.Router();

// GET full board
router.get('/:projectName/board', (req, res) => {
  try {
    const board = kanbanDb.getFullBoard(req.params.projectName);
    res.json({ success: true, ...board });
  } catch (error) {
    console.error('Error getting kanban board:', error);
    res.status(500).json({ error: 'Failed to get kanban board' });
  }
});

// POST create column
router.post('/:projectName/columns', (req, res) => {
  try {
    const { columnName } = req.body;
    if (!columnName?.trim()) {
      return res.status(400).json({ error: 'Column name is required' });
    }
    const column = kanbanDb.createColumn(req.params.projectName, columnName.trim());
    res.json({ success: true, column });
  } catch (error) {
    console.error('Error creating column:', error);
    res.status(500).json({ error: 'Failed to create column' });
  }
});

// PUT update column
router.put('/:projectName/columns/:id', (req, res) => {
  try {
    const { columnName, position } = req.body;
    kanbanDb.updateColumn(Number(req.params.id), columnName, position);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating column:', error);
    res.status(500).json({ error: 'Failed to update column' });
  }
});

// PUT reorder all columns
router.put('/:projectName/columns-order', (req, res) => {
  try {
    const { columnIds } = req.body;
    if (!Array.isArray(columnIds)) {
      return res.status(400).json({ error: 'columnIds array is required' });
    }
    kanbanDb.reorderColumns(req.params.projectName, columnIds);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering columns:', error);
    res.status(500).json({ error: 'Failed to reorder columns' });
  }
});

// DELETE column
router.delete('/:projectName/columns/:id', (req, res) => {
  try {
    kanbanDb.deleteColumn(Number(req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting column:', error);
    res.status(500).json({ error: 'Failed to delete column' });
  }
});

// PUT assign session to column
router.put('/sessions/:sessionId/assign', (req, res) => {
  try {
    const { columnId, position } = req.body;
    if (columnId === undefined) {
      return res.status(400).json({ error: 'columnId is required' });
    }
    kanbanDb.assignSession(req.params.sessionId, columnId, position ?? 0);
    res.json({ success: true });
  } catch (error) {
    console.error('Error assigning session:', error);
    res.status(500).json({ error: 'Failed to assign session' });
  }
});

// PUT update session note
router.put('/sessions/:sessionId/note', (req, res) => {
  try {
    const { projectName, noteText } = req.body;
    if (!projectName) {
      return res.status(400).json({ error: 'projectName is required' });
    }
    kanbanDb.setNote(req.params.sessionId, projectName, noteText ?? '');
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// POST create label
router.post('/:projectName/labels', (req, res) => {
  try {
    const { labelName, color } = req.body;
    if (!labelName?.trim()) {
      return res.status(400).json({ error: 'Label name is required' });
    }
    const label = kanbanDb.createLabel(req.params.projectName, labelName.trim(), color || '#3b82f6');
    res.json({ success: true, label });
  } catch (error) {
    console.error('Error creating label:', error);
    res.status(500).json({ error: 'Failed to create label' });
  }
});

// PUT update label
router.put('/:projectName/labels/:id', (req, res) => {
  try {
    const { labelName, color } = req.body;
    kanbanDb.updateLabel(Number(req.params.id), labelName, color);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating label:', error);
    res.status(500).json({ error: 'Failed to update label' });
  }
});

// DELETE label
router.delete('/:projectName/labels/:id', (req, res) => {
  try {
    kanbanDb.deleteLabel(Number(req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting label:', error);
    res.status(500).json({ error: 'Failed to delete label' });
  }
});

// POST assign label to session
router.post('/sessions/:sessionId/labels', (req, res) => {
  try {
    const { labelId } = req.body;
    if (labelId === undefined) {
      return res.status(400).json({ error: 'labelId is required' });
    }
    kanbanDb.assignLabel(req.params.sessionId, labelId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error assigning label:', error);
    res.status(500).json({ error: 'Failed to assign label' });
  }
});

// DELETE remove label from session
router.delete('/sessions/:sessionId/labels/:labelId', (req, res) => {
  try {
    kanbanDb.removeLabel(req.params.sessionId, Number(req.params.labelId));
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing label:', error);
    res.status(500).json({ error: 'Failed to remove label' });
  }
});

// GET archived sessions for a project
router.get('/:projectName/archived-sessions', (req, res) => {
  try {
    const archived = kanbanDb.getArchivedSessions(req.params.projectName);
    res.json({ success: true, archived });
  } catch (error) {
    console.error('Error getting archived sessions:', error);
    res.status(500).json({ error: 'Failed to get archived sessions' });
  }
});

// PUT archive a session
router.put('/:projectName/sessions/:sessionId/archive', (req, res) => {
  try {
    kanbanDb.archiveSession(req.params.projectName, req.params.sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error archiving session:', error);
    res.status(500).json({ error: 'Failed to archive session' });
  }
});

// DELETE unarchive a session
router.delete('/:projectName/sessions/:sessionId/archive', (req, res) => {
  try {
    kanbanDb.unarchiveSession(req.params.projectName, req.params.sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error unarchiving session:', error);
    res.status(500).json({ error: 'Failed to unarchive session' });
  }
});

export default router;
