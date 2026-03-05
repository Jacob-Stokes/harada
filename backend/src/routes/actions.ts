import { Router, Request, Response } from 'express';
import { db, ActionItem } from '../db/database';
import { ownedAction } from '../middleware/ownership';
import { ok, fail, serverError } from '../utils/response';

const router = Router();

// Get specific action item
router.get('/:actionId', (req: Request, res: Response) => {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;

    const action = ownedAction(actionId, userId) as ActionItem | null;

    if (!action) {
      return fail(res, 404, 'Action item not found');
    }

    ok(res, action);
  } catch (error) {
    serverError(res, error);
  }
});

// Update action item
router.put('/:actionId', (req: Request, res: Response) => {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;
    const { title, description, position, due_date } = req.body;

    const existing = ownedAction(actionId, userId) as any;

    if (!existing) {
      return fail(res, 404, 'Action item not found');
    }

    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE action_items
      SET title = ?, description = ?, position = ?, due_date = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      title ?? existing.title,
      description ?? existing.description,
      position ?? existing.position,
      due_date ?? existing.due_date,
      now, actionId
    );

    const updated = db.prepare('SELECT * FROM action_items WHERE id = ?').get(actionId);

    ok(res, updated);
  } catch (error) {
    serverError(res, error);
  }
});

// Reorder an action within its sub-goal atomically
router.post('/:actionId/reorder', (req: Request, res: Response) => {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;
    const { targetPosition } = req.body as { targetPosition?: number };

    if (!targetPosition || targetPosition < 1 || targetPosition > 8) {
      return fail(res, 400, 'targetPosition must be 1-8');
    }

    const action = ownedAction(actionId, userId) as ActionItem | null;

    if (!action) {
      return fail(res, 404, 'Action item not found');
    }

    if (action.position === targetPosition) {
      return ok(res, action);
    }

    const conflicting = db
      .prepare('SELECT * FROM action_items WHERE sub_goal_id = ? AND position = ?')
      .get(action.sub_goal_id, targetPosition) as ActionItem | undefined;

    const now = new Date().toISOString();

    const runReorder = db.transaction(() => {
      const sourcePos = action.position;
      const targetPos = targetPosition;

      if (sourcePos === targetPos) {
        return; // No-op
      }

      // Simple swap strategy using position -1 as temporary
      // Step 1: Move source to -1 (temporary position)
      db.prepare('UPDATE action_items SET position = -1, updated_at = ? WHERE id = ?').run(
        now,
        action.id
      );

      // Step 2: Move target to source's old position (if there's something there)
      if (conflicting) {
        db.prepare('UPDATE action_items SET position = ?, updated_at = ? WHERE id = ?').run(
          sourcePos,
          now,
          conflicting.id
        );
      }

      // Step 3: Move source to target position
      db.prepare('UPDATE action_items SET position = ?, updated_at = ? WHERE id = ?').run(
        targetPos,
        now,
        action.id
      );
    });

    runReorder();

    const updated = db.prepare('SELECT * FROM action_items WHERE id = ?').get(actionId);

    ok(res, updated);
  } catch (error) {
    serverError(res, error);
  }
});

// Toggle completion status
router.patch('/:actionId/complete', (req: Request, res: Response) => {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;

    const action = ownedAction(actionId, userId) as ActionItem | null;

    if (!action) {
      return fail(res, 404, 'Action item not found');
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

    ok(res, updated);
  } catch (error) {
    serverError(res, error);
  }
});

// Delete action item
router.delete('/:actionId', (req: Request, res: Response) => {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;

    if (!ownedAction(actionId, userId)) {
      return fail(res, 404, 'Action item not found');
    }

    const result = db.prepare('DELETE FROM action_items WHERE id = ?').run(actionId);

    if (result.changes === 0) {
      return fail(res, 404, 'Action item not found');
    }

    ok(res, { deleted: true });
  } catch (error) {
    serverError(res, error);
  }
});

export default router;
