import { Router, Request, Response } from 'express';
import { db, SubGoal } from '../db/database';

const router = Router();

// Get specific sub-goal with actions
router.get('/:subgoalId', (req: Request, res: Response) => {
  try {
    const { subgoalId } = req.params;

    const subGoal = db.prepare('SELECT * FROM sub_goals WHERE id = ?').get(subgoalId) as SubGoal | undefined;

    if (!subGoal) {
      return res.status(404).json({ success: false, data: null, error: 'Sub-goal not found' });
    }

    const actions = db.prepare('SELECT * FROM action_items WHERE sub_goal_id = ? ORDER BY position').all(subgoalId);

    res.json({ success: true, data: { ...subGoal, actions }, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: (error as Error).message });
  }
});

// Update sub-goal
router.put('/:subgoalId', (req: Request, res: Response) => {
  try {
    const { subgoalId } = req.params;
    const { title, description, position } = req.body;

    const subGoal = db.prepare('SELECT * FROM sub_goals WHERE id = ?').get(subgoalId);

    if (!subGoal) {
      return res.status(404).json({ success: false, data: null, error: 'Sub-goal not found' });
    }

    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE sub_goals
      SET title = ?, description = ?, position = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(title, description || null, position, now, subgoalId);

    const updated = db.prepare('SELECT * FROM sub_goals WHERE id = ?').get(subgoalId);

    res.json({ success: true, data: updated, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: (error as Error).message });
  }
});

// Reorder sub-goal positions within a goal using a single statement to avoid uniqueness conflicts
router.post('/:subgoalId/reorder', (req: Request, res: Response) => {
  try {
    const { subgoalId } = req.params;
    const { targetPosition } = req.body as { targetPosition?: number };

    if (!targetPosition || targetPosition < 1 || targetPosition > 8) {
      return res.status(400).json({ success: false, data: null, error: 'targetPosition must be 1-8' });
    }

    const subGoal = db.prepare('SELECT * FROM sub_goals WHERE id = ?').get(subgoalId) as SubGoal | undefined;

    if (!subGoal) {
      return res.status(404).json({ success: false, data: null, error: 'Sub-goal not found' });
    }

    if (subGoal.position === targetPosition) {
      return res.json({ success: true, data: subGoal, error: null });
    }

    const conflicting = db.prepare(
      'SELECT * FROM sub_goals WHERE primary_goal_id = ? AND position = ?'
    ).get(subGoal.primary_goal_id, targetPosition) as SubGoal | undefined;

    const now = new Date().toISOString();

    const runReorder = db.transaction(() => {
      if (conflicting) {
        // Strategy: Move source to position 0 (temp), shift others, then move source to target
        // This avoids all constraint violations
        const sourcePos = subGoal.position;
        const targetPos = targetPosition;

        // Step 1: Move source to position 0 (temporary, won't conflict)
        db.prepare('UPDATE sub_goals SET position = 0, updated_at = ? WHERE id = ?').run(
          now,
          subGoal.id
        );

        // Step 2: Shift items in the affected range
        if (sourcePos < targetPos) {
          // Moving down: shift items between source and target up by 1
          db.prepare(`
            UPDATE sub_goals
            SET position = position - 1, updated_at = ?
            WHERE primary_goal_id = ? AND position > ? AND position <= ?
          `).run(now, subGoal.primary_goal_id, sourcePos, targetPos);
        } else {
          // Moving up: shift items between target and source down by 1
          db.prepare(`
            UPDATE sub_goals
            SET position = position + 1, updated_at = ?
            WHERE primary_goal_id = ? AND position >= ? AND position < ?
          `).run(now, subGoal.primary_goal_id, targetPos, sourcePos);
        }

        // Step 3: Move source to final target position
        db.prepare('UPDATE sub_goals SET position = ?, updated_at = ? WHERE id = ?').run(
          targetPos,
          now,
          subGoal.id
        );
      } else {
        db.prepare('UPDATE sub_goals SET position = ?, updated_at = ? WHERE id = ?').run(
          targetPosition,
          now,
          subGoal.id
        );
      }
    });

    runReorder();

    const updated = db.prepare('SELECT * FROM sub_goals WHERE id = ?').get(subgoalId);

    res.json({ success: true, data: updated, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: (error as Error).message });
  }
});

// Reorder sub-goal positions within a goal
// Delete sub-goal
router.delete('/:subgoalId', (req: Request, res: Response) => {
  try {
    const { subgoalId } = req.params;

    const result = db.prepare('DELETE FROM sub_goals WHERE id = ?').run(subgoalId);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, data: null, error: 'Sub-goal not found' });
    }

    res.json({ success: true, data: { deleted: true }, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: (error as Error).message });
  }
});

// Get actions for sub-goal
router.get('/:subgoalId/actions', (req: Request, res: Response) => {
  try {
    const { subgoalId } = req.params;

    const actions = db.prepare('SELECT * FROM action_items WHERE sub_goal_id = ? ORDER BY position').all(subgoalId);

    res.json({ success: true, data: actions, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: (error as Error).message });
  }
});

// Create action item
router.post('/:subgoalId/actions', (req: Request, res: Response) => {
  try {
    const { subgoalId } = req.params;
    const { position, title, description, due_date } = req.body;

    if (!title || !position) {
      return res.status(400).json({ success: false, data: null, error: 'Title and position are required' });
    }

    if (position < 1 || position > 8) {
      return res.status(400).json({ success: false, data: null, error: 'Position must be between 1 and 8' });
    }

    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO action_items (id, sub_goal_id, position, title, description, due_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, subgoalId, position, title, description || null, due_date || null, now, now);

    const action = db.prepare('SELECT * FROM action_items WHERE id = ?').get(id);

    res.status(201).json({ success: true, data: action, error: null });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: (error as Error).message });
  }
});

export default router;
