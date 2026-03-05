import { Router, Request, Response } from 'express';
import { db, PrimaryGoal, SubGoal, ActionItem } from '../db/database';
import { ok, fail, serverError } from '../utils/response';

const router = Router();

// Get summary of all goals for AI consumption
// Query params:
//   level: minimal | standard | detailed | full (default: standard)
//   include_logs: true/false (default: false) - include actual log entries
//   include_guestbook: true/false (default: false) - include guestbook comments
router.get('/summary', (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const level = (req.query.level as string) || 'standard';
    const includeLogs = req.query.include_logs === 'true';
    const includeGuestbook = req.query.include_guestbook === 'true';

    const goals = db.prepare('SELECT * FROM primary_goals WHERE user_id = ? ORDER BY created_at DESC').all(userId) as PrimaryGoal[];

    const summary = goals.map(goal => {
      // MINIMAL: Just goal titles and IDs
      if (level === 'minimal') {
        return {
          id: goal.id,
          title: goal.title,
          status: goal.status,
          subGoalCount: db.prepare('SELECT COUNT(*) as count FROM sub_goals WHERE primary_goal_id = ?').get(goal.id) as any
        };
      }

      const subGoals = db.prepare('SELECT * FROM sub_goals WHERE primary_goal_id = ? ORDER BY position').all(goal.id) as SubGoal[];

      // STANDARD: Goals + sub-goals + actions with activity counts
      const processedSubGoals = subGoals.map(subGoal => {
        const actions = db.prepare('SELECT * FROM action_items WHERE sub_goal_id = ? ORDER BY position').all(subGoal.id) as ActionItem[];

        // Get activity metrics for each action
        const actionsWithActivity = actions.map(action => {
          const activityLogs = db.prepare(`
            SELECT COUNT(*) as log_count, MAX(log_date) as last_log_date
            FROM activity_logs
            WHERE action_item_id = ?
          `).get(action.id) as { log_count: number; last_log_date: string | null };

          const actionData: any = {
            id: action.id,
            position: action.position,
            title: action.title,
            totalLogs: activityLogs.log_count,
            lastLoggedAt: activityLogs.last_log_date
          };

          // DETAILED/FULL: Include descriptions and metadata
          if (level === 'detailed' || level === 'full') {
            actionData.description = action.description;
            actionData.due_date = action.due_date;
            actionData.created_at = action.created_at;
            actionData.updated_at = action.updated_at;
          }

          // FULL: Include actual log entries
          if (level === 'full' && includeLogs) {
            const logs = db.prepare(`
              SELECT id, log_type, content, log_date, metric_value, metric_unit, mood, created_at
              FROM activity_logs
              WHERE action_item_id = ?
              ORDER BY log_date DESC
              LIMIT 10
            `).all(action.id);
            actionData.recentLogs = logs;
          }

          return actionData;
        });

        // Calculate sub-goal level activity metrics
        const totalLogs = actionsWithActivity.reduce((sum, a) => sum + a.totalLogs, 0);
        const lastActivityDates = actionsWithActivity
          .map(a => a.lastLoggedAt)
          .filter(d => d !== null)
          .sort()
          .reverse();

        const subGoalData: any = {
          id: subGoal.id,
          position: subGoal.position,
          title: subGoal.title,
          actions: actionsWithActivity,
          totalActivityLogs: totalLogs,
          lastActivityAt: lastActivityDates.length > 0 ? lastActivityDates[0] : null,
          totalActions: actions.length
        };

        // DETAILED/FULL: Include descriptions
        if (level === 'detailed' || level === 'full') {
          subGoalData.description = subGoal.description;
          subGoalData.created_at = subGoal.created_at;
          subGoalData.updated_at = subGoal.updated_at;
        }

        // Include guestbook if requested
        if (includeGuestbook) {
          const guestbookEntries = db.prepare(`
            SELECT id, agent_name, comment, created_at
            FROM guestbook
            WHERE user_id = ? AND target_type = 'subgoal' AND target_id = ?
            ORDER BY created_at DESC
          `).all(userId, subGoal.id);
          subGoalData.guestbook = guestbookEntries;
        }

        return subGoalData;
      });

      const goalData: any = {
        id: goal.id,
        title: goal.title,
        status: goal.status,
        subGoals: processedSubGoals
      };

      // DETAILED/FULL: Include goal metadata
      if (level === 'detailed' || level === 'full') {
        goalData.description = goal.description;
        goalData.target_date = goal.target_date;
        goalData.created_at = goal.created_at;
        goalData.updated_at = goal.updated_at;
      }

      // Include guestbook if requested
      if (includeGuestbook) {
        const guestbookEntries = db.prepare(`
          SELECT id, agent_name, comment, created_at
          FROM guestbook
          WHERE user_id = ? AND target_type = 'goal' AND target_id = ?
          ORDER BY created_at DESC
        `).all(userId, goal.id);
        goalData.guestbook = guestbookEntries;
      }

      return goalData;
    });

    // Add user-level guestbook if requested
    if (includeGuestbook) {
      const userGuestbook = db.prepare(`
        SELECT id, agent_name, comment, created_at
        FROM guestbook
        WHERE user_id = ? AND target_type = 'user'
        ORDER BY created_at DESC
      `).all(userId);
      return res.json({ success: true, data: summary, error: null, guestbook: userGuestbook });
    }

    ok(res, summary);
  } catch (error) {
    serverError(res, error);
  }
});

export default router;
