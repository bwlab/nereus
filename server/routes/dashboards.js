import express from 'express';
import { dashboardDb } from '../database/db.js';

const router = express.Router();

// GET list dashboards for current user
router.get('/', (req, res) => {
  try {
    const dashboards = dashboardDb.getDashboards(req.user.id);
    res.json({ success: true, dashboards });
  } catch (error) {
    console.error('Error getting dashboards:', error);
    res.status(500).json({ error: 'Failed to get dashboards' });
  }
});

// GET default dashboard id
router.get('/default', (req, res) => {
  try {
    const row = dashboardDb.getDefaultDashboard(req.user.id);
    res.json({ success: true, dashboardId: row?.id ?? null });
  } catch (error) {
    console.error('Error getting default dashboard:', error);
    res.status(500).json({ error: 'Failed to get default dashboard' });
  }
});

// GET workspace — all dashboards + all raccoglitori + all assignments + orphan favorites
router.get('/workspace', (req, res) => {
  try {
    const workspace = dashboardDb.getWorkspace(req.user.id);
    res.json({ success: true, ...workspace });
  } catch (error) {
    console.error('Error getting workspace:', error);
    res.status(500).json({ error: 'Failed to get workspace' });
  }
});

// GET full dashboard (raccoglitori + assignments)
router.get('/:id/full', (req, res) => {
  try {
    const data = dashboardDb.getFullDashboard(Number(req.params.id), req.user.id);
    if (!data) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('Error getting full dashboard:', error);
    res.status(500).json({ error: 'Failed to get full dashboard' });
  }
});

// POST create dashboard
router.post('/', (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Dashboard name is required' });
    }
    const dashboard = dashboardDb.createDashboard(req.user.id, name.trim());
    res.json({ success: true, dashboard });
  } catch (error) {
    console.error('Error creating dashboard:', error);
    res.status(500).json({ error: 'Failed to create dashboard' });
  }
});

// PUT update dashboard
router.put('/:id', (req, res) => {
  try {
    const { name, sort_mode, view_mode } = req.body;
    dashboardDb.updateDashboard(Number(req.params.id), req.user.id, { name, sort_mode, view_mode });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating dashboard:', error);
    res.status(500).json({ error: 'Failed to update dashboard' });
  }
});

// DELETE dashboard
router.delete('/:id', (req, res) => {
  try {
    dashboardDb.deleteDashboard(Number(req.params.id), req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting dashboard:', error);
    res.status(500).json({ error: 'Failed to delete dashboard' });
  }
});

// PUT reorder dashboards
router.put('/reorder', (req, res) => {
  try {
    const { dashboardIds } = req.body;
    if (!Array.isArray(dashboardIds)) {
      return res.status(400).json({ error: 'dashboardIds array is required' });
    }
    dashboardDb.reorderDashboards(req.user.id, dashboardIds);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering dashboards:', error);
    res.status(500).json({ error: 'Failed to reorder dashboards' });
  }
});

// PUT set default dashboard
router.put('/:id/default', (req, res) => {
  try {
    dashboardDb.setDefaultDashboard(req.user.id, Number(req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting default dashboard:', error);
    res.status(500).json({ error: 'Failed to set default dashboard' });
  }
});

// --- Raccoglitori ---

// Ownership guards
function requireDashboardOwnership(req, res, next) {
  const dashboardId = Number(req.params.id);
  if (!Number.isFinite(dashboardId) || !dashboardDb.dashboardBelongsToUser(dashboardId, req.user.id)) {
    return res.status(404).json({ error: 'Dashboard not found' });
  }
  req.dashboardId = dashboardId;
  next();
}

function requireRaccoglitoreOwnership(req, res, next) {
  const rid = Number(req.params.rid);
  const dashboardId = Number(req.params.id);
  const ownerDashboardId = Number.isFinite(rid) ? dashboardDb.raccoglitoreBelongsToUser(rid, req.user.id) : null;
  if (ownerDashboardId === null || (Number.isFinite(dashboardId) && ownerDashboardId !== dashboardId)) {
    return res.status(404).json({ error: 'Raccoglitore not found' });
  }
  req.raccoglitoreId = rid;
  req.dashboardId = ownerDashboardId;
  next();
}

// POST create raccoglitore
router.post('/:id/raccoglitori', requireDashboardOwnership, (req, res) => {
  try {
    const { name, color, icon, notes, parent_id } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Raccoglitore name is required' });
    }
    if (parent_id != null) {
      const parentDashboardId = dashboardDb.raccoglitoreBelongsToUser(Number(parent_id), req.user.id);
      if (parentDashboardId !== req.dashboardId) {
        return res.status(400).json({ error: 'Parent raccoglitore not found' });
      }
    }
    const raccoglitore = dashboardDb.createRaccoglitore(req.dashboardId, {
      name: name.trim(), color, icon, notes,
      parent_id: parent_id ?? null,
    });
    res.json({ success: true, raccoglitore });
  } catch (error) {
    console.error('Error creating raccoglitore:', error);
    const msg = error?.message || 'Failed to create raccoglitore';
    const code = /not found|different dashboard/i.test(msg) ? 400 : 500;
    res.status(code).json({ error: msg });
  }
});

// PATCH move raccoglitore (change parent and/or position)
router.patch('/:id/raccoglitori/:rid/move', requireRaccoglitoreOwnership, (req, res) => {
  try {
    const { parent_id, position } = req.body;
    if (parent_id != null) {
      const parentDashboardId = dashboardDb.raccoglitoreBelongsToUser(Number(parent_id), req.user.id);
      if (parentDashboardId !== req.dashboardId) {
        return res.status(400).json({ error: 'Target parent not found' });
      }
    }
    const raccoglitore = dashboardDb.moveRaccoglitore(req.raccoglitoreId, {
      parent_id: parent_id ?? null,
      position: position ?? null,
    });
    res.json({ success: true, raccoglitore });
  } catch (error) {
    console.error('Error moving raccoglitore:', error);
    const msg = error?.message || 'Failed to move raccoglitore';
    const code = /not found|descendant|dashboards/i.test(msg) ? 400 : 500;
    res.status(code).json({ error: msg });
  }
});

// PUT update raccoglitore
router.put('/:id/raccoglitori/:rid', requireRaccoglitoreOwnership, (req, res) => {
  try {
    const { name, color, icon, notes } = req.body;
    dashboardDb.updateRaccoglitore(req.raccoglitoreId, { name, color, icon, notes });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating raccoglitore:', error);
    res.status(500).json({ error: 'Failed to update raccoglitore' });
  }
});

// DELETE raccoglitore (optional ?reparent=true moves children up one level)
router.delete('/:id/raccoglitori/:rid', requireRaccoglitoreOwnership, (req, res) => {
  try {
    const reparent = req.query.reparent === 'true' || req.query.reparent === '1';
    dashboardDb.deleteRaccoglitore(req.raccoglitoreId, { reparent });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting raccoglitore:', error);
    res.status(500).json({ error: 'Failed to delete raccoglitore' });
  }
});

// PUT reorder raccoglitori
router.put('/:id/raccoglitori/reorder', requireDashboardOwnership, (req, res) => {
  try {
    const { raccoglitoreIds } = req.body;
    if (!Array.isArray(raccoglitoreIds)) {
      return res.status(400).json({ error: 'raccoglitoreIds array is required' });
    }
    for (const rid of raccoglitoreIds) {
      const ownerDashboardId = dashboardDb.raccoglitoreBelongsToUser(Number(rid), req.user.id);
      if (ownerDashboardId !== req.dashboardId) {
        return res.status(400).json({ error: 'Invalid raccoglitore id' });
      }
    }
    dashboardDb.reorderRaccoglitori(req.dashboardId, raccoglitoreIds);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering raccoglitori:', error);
    res.status(500).json({ error: 'Failed to reorder raccoglitori' });
  }
});

// --- Project assignments ---

// POST assign project to raccoglitore
router.post('/:id/raccoglitori/:rid/projects', requireRaccoglitoreOwnership, (req, res) => {
  try {
    const { projectName, position } = req.body;
    if (!projectName?.trim()) {
      return res.status(400).json({ error: 'projectName is required' });
    }
    dashboardDb.assignProject(req.raccoglitoreId, projectName.trim(), position ?? 0);
    res.json({ success: true });
  } catch (error) {
    console.error('Error assigning project:', error);
    res.status(500).json({ error: 'Failed to assign project' });
  }
});

// DELETE remove project from raccoglitore
router.delete('/:id/raccoglitori/:rid/projects/:projectName', requireRaccoglitoreOwnership, (req, res) => {
  try {
    dashboardDb.removeProject(req.raccoglitoreId, req.params.projectName);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing project:', error);
    res.status(500).json({ error: 'Failed to remove project' });
  }
});

// PUT reorder projects in raccoglitore
router.put('/:id/raccoglitori/:rid/projects/reorder', requireRaccoglitoreOwnership, (req, res) => {
  try {
    const { projectNames } = req.body;
    if (!Array.isArray(projectNames)) {
      return res.status(400).json({ error: 'projectNames array is required' });
    }
    dashboardDb.reorderProjects(req.raccoglitoreId, projectNames);
    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering projects:', error);
    res.status(500).json({ error: 'Failed to reorder projects' });
  }
});

// PATCH toggle favorite on a single assignment
router.patch('/:id/raccoglitori/:rid/projects/:projectName/favorite', requireRaccoglitoreOwnership, (req, res) => {
  try {
    const { is_favorite } = req.body ?? {};
    const flag = is_favorite === true || is_favorite === 1;
    const changed = dashboardDb.setAssignmentFavorite(
      req.raccoglitoreId,
      req.params.projectName,
      flag,
    );
    if (!changed) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    res.json({ success: true, is_favorite: flag ? 1 : 0 });
  } catch (error) {
    console.error('Error toggling assignment favorite:', error);
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

export default router;
