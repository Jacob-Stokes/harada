import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db, SharedGoal } from '../db/database';
import { ok, fail, serverError } from '../utils/response';
import { buildGoalTree } from '../utils/goalTree';

// Authenticated routes for managing share links
export const shareManagementRouter = Router();

// Create a share link
shareManagementRouter.post('/', (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { goal_id, show_logs, show_guestbook } = req.body;

    if (!goal_id) {
      return fail(res, 400, 'goal_id is required');
    }

    // Verify goal belongs to user
    const goal = db.prepare('SELECT id FROM primary_goals WHERE id = ? AND user_id = ?').get(goal_id, userId);
    if (!goal) {
      return fail(res, 404, 'Goal not found');
    }

    const id = uuidv4();
    const token = randomBytes(16).toString('base64url');

    db.prepare(`
      INSERT INTO shared_goals (id, goal_id, user_id, token, show_logs, show_guestbook)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, goal_id, userId, token, show_logs ? 1 : 0, show_guestbook ? 1 : 0);

    const share = db.prepare('SELECT * FROM shared_goals WHERE id = ?').get(id);

    ok(res, share);
  } catch (error: any) {
    serverError(res, error);
  }
});

// List share links (optionally filter by goal_id)
shareManagementRouter.get('/', (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const goalId = req.query.goal_id as string;

    let shares;
    if (goalId) {
      shares = db.prepare(
        'SELECT * FROM shared_goals WHERE user_id = ? AND goal_id = ? AND is_active = 1 ORDER BY created_at DESC'
      ).all(userId, goalId);
    } else {
      shares = db.prepare(
        'SELECT * FROM shared_goals WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC'
      ).all(userId);
    }

    ok(res, shares);
  } catch (error: any) {
    serverError(res, error);
  }
});

// Revoke a share link
shareManagementRouter.delete('/:shareId', (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { shareId } = req.params;

    const result = db.prepare(
      'DELETE FROM shared_goals WHERE id = ? AND user_id = ?'
    ).run(shareId, userId);

    if (result.changes === 0) {
      return fail(res, 404, 'Share link not found');
    }

    ok(res, { message: 'Share link revoked' });
  } catch (error: any) {
    serverError(res, error);
  }
});

// Public routes for viewing shared goals (no auth)
export const sharePublicRouter = Router();

sharePublicRouter.get('/:token/goal', (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const share = db.prepare(
      'SELECT * FROM shared_goals WHERE token = ? AND is_active = 1'
    ).get(token) as SharedGoal | undefined;

    if (!share) {
      return fail(res, 404, 'Share link not found or has been revoked');
    }

    // Build goal tree (no userId check -- this is a public share view)
    const goalTree = buildGoalTree(share.goal_id, {
      includeLogs: !!share.show_logs,
    });

    if (!goalTree) {
      return fail(res, 404, 'Goal no longer exists');
    }

    // Strip logs arrays when show_logs is off (buildGoalTree omits the logs
    // key entirely when includeLogs is false, so normalise to empty arrays)
    if (!share.show_logs) {
      goalTree.subGoals.forEach((sg) => {
        sg.actions.forEach((a: any) => {
          if (!('logs' in a)) a.logs = [];
        });
      });
    }

    // Conditionally include guestbook
    let guestbook: any[] = [];
    if (share.show_guestbook) {
      guestbook = db.prepare(
        'SELECT * FROM guestbook WHERE user_id = ? AND ((target_type = ? AND target_id = ?) OR target_type IN (?, ?, ?)) ORDER BY created_at DESC'
      ).all(share.user_id, 'goal', share.goal_id, 'subgoal', 'action', 'user');

      // Filter subgoal/action entries to only those belonging to this goal
      const subGoalIds = new Set(goalTree.subGoals.map((sg) => sg.id));
      const actionIds = new Set(
        goalTree.subGoals.flatMap((sg) => sg.actions.map((a: any) => a.id))
      );

      guestbook = guestbook.filter((entry: any) => {
        if (entry.target_type === 'goal') return entry.target_id === share.goal_id;
        if (entry.target_type === 'subgoal') return subGoalIds.has(entry.target_id);
        if (entry.target_type === 'action') return actionIds.has(entry.target_id);
        if (entry.target_type === 'user') return true;
        return false;
      });
    }

    ok(res, {
      goal: goalTree,
      guestbook,
      shareSettings: {
        show_logs: share.show_logs === 1,
        show_guestbook: share.show_guestbook === 1,
      },
    });
  } catch (error: any) {
    serverError(res, error);
  }
});
