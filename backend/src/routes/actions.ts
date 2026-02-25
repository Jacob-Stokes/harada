import { Router, Request, Response } from 'express';
import { db, ActionItem } from '../db/database';

const router = Router();

// Get specific action item
router.get('/:actionId', (req: Request, res: Response) => {
  try {
    const { actionId } = req.params;

    const action = db.prepare('SELECT * FROM action_items WHERE id = ?').get(actionId) as ActionItem | undefined;

    if (!action) {
      return res.status(404).json({ success: false, data: null, error: 'Action item not found' });
    }

    res.json({ success: true, data: action, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: (error as Error).message });
  }
});

// Update action item
router.put('/:actionId', (req: Request, res: Response) => {
  try {
    const { actionId } = req.params;
    const { title, description, position, due_date } = req.body;

    const action = db.prepare('SELECT * FROM action_items WHERE id = ?').get(actionId);

    if (!action) {
      return res.status(404).json({ success: false, data: null, error: 'Action item not found' });
    }

    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE action_items
      SET title = ?, description = ?, position = ?, due_date = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(title, description || null, position, due_date || null, now, actionId);

    const updated = db.prepare('SELECT * FROM action_items WHERE id = ?').get(actionId);

    res.json({ success: true, data: updated, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: (error as Error).message });
  }
});

// Reorder an action within its sub-goal atomically
router.post('/:actionId/reorder', (req: Request, res: Response) => {
  try {
    const { actionId } = req.params;
    const { targetPosition } = req.body as { targetPosition?: number };

    if (!targetPosition || targetPosition < 1 || targetPosition > 8) {
      return res.status(400).json({ success: false, data: null, error: 'targetPosition must be 1-8' });
    }

    const action = db.prepare('SELECT * FROM action_items WHERE id = ?').get(actionId) as ActionItem | undefined;

    if (!action) {
      return res.status(404).json({ success: false, data: null, error: 'Action item not found' });
    }

    if (action.position === targetPosition) {
      return res.json({ success: true, data: action, error: null });
    }

    const conflicting = db
      .prepare('SELECT * FROM action_items WHERE sub_goal_id = ? AND position = ?')
      .get(action.sub_goal_id, targetPosition) as ActionItem | undefined;

    const now = new Date().toISOString();

    const runReorder = db.transaction(() => {
      if (conflicting) {
        // Strategy: Move source to position 0 (temp), shift others, then move source to target
        // This avoids all constraint violations
        const sourcePos = action.position;
        const targetPos = targetPosition;

        // Step 1: Move source to position 0 (temporary, won't conflict)
        db.prepare('UPDATE action_items SET position = 0, updated_at = ? WHERE id = ?').run(
          now,
          action.id
        );

        // Step 2: Shift items in the affected range
        if (sourcePos < targetPos) {
          // Moving down: shift items between source and target up by 1
          db.prepare(`
            UPDATE action_items
            SET position = position - 1, updated_at = ?
            WHERE sub_goal_id = ? AND position > ? AND position <= ?
          `).run(now, action.sub_goal_id, sourcePos, targetPos);
        } else {
          // Moving up: shift items between target and source down by 1
          db.prepare(`
            UPDATE action_items
            SET position = position + 1, updated_at = ?
            WHERE sub_goal_id = ? AND position >= ? AND position < ?
          `).run(now, action.sub_goal_id, targetPos, sourcePos);
        }

        // Step 3: Move source to final target position
        db.prepare('UPDATE action_items SET position = ?, updated_at = ? WHERE id = ?').run(
          targetPos,
          now,
          action.id
        );
      } else {
        db.prepare('UPDATE action_items SET position = ?, updated_at = ? WHERE id = ?').run(
          targetPosition,
          now,
          action.id
        );
      }
    });

    runReorder();

    const updated = db.prepare('SELECT * FROM action_items WHERE id = ?').get(actionId);

    res.json({ success: true, data: updated, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: (error as Error).message });
  }
});

// Reorder an action within its sub-goal
// Toggle completion status
router.patch('/:actionId/complete', (req: Request, res: Response) => {
  try {
    const { actionId } = req.params;

    const action = db.prepare('SELECT * FROM action_items WHERE id = ?').get(actionId) as ActionItem | undefined;

    if (!action) {
      return res.status(404).json({ success: false, data: null, error: 'Action item not found' });
    }

    const newCompleted = action.completed ? 0 : 1;
    const completedAt = newCompleted ? new Date().toISOString() : null;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE action_items
      SET completed = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(newCompleted, completedAt, now, actionId);

    const updated = db.prepare('SELECT * FROM action_items WHERE id = ?').get(actionId);

    res.json({ success: true, data: updated, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: (error as Error).message });
  }
});

// Delete action item
router.delete('/:actionId', (req: Request, res: Response) => {
  try {
    const { actionId } = req.params;

    const result = db.prepare('DELETE FROM action_items WHERE id = ?').run(actionId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, data: null, error: 'Action item not found' });
    }

    res.json({ success: true, data: { deleted: true }, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: (error as Error).message });
  }
});

export default router;
