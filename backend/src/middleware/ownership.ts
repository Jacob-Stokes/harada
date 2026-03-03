import { db } from '../db/database';

/**
 * Ownership verification helpers.
 * Each function returns the resource row if the authenticated user owns it, or null otherwise.
 * Ownership chain: primary_goals.user_id → sub_goals → action_items → activity_logs
 */

export function ownedGoal(goalId: string, userId: string): any | null {
  return db.prepare('SELECT * FROM primary_goals WHERE id = ? AND user_id = ?').get(goalId, userId) ?? null;
}

export function goalOwnerCheck(goalId: string, userId: string): boolean {
  const row = db.prepare('SELECT id FROM primary_goals WHERE id = ? AND user_id = ?').get(goalId, userId);
  return !!row;
}

export function ownedSubGoal(subGoalId: string, userId: string): any | null {
  return db.prepare(`
    SELECT sg.* FROM sub_goals sg
    JOIN primary_goals pg ON sg.primary_goal_id = pg.id
    WHERE sg.id = ? AND pg.user_id = ?
  `).get(subGoalId, userId) ?? null;
}

export function ownedAction(actionId: string, userId: string): any | null {
  return db.prepare(`
    SELECT ai.* FROM action_items ai
    JOIN sub_goals sg ON ai.sub_goal_id = sg.id
    JOIN primary_goals pg ON sg.primary_goal_id = pg.id
    WHERE ai.id = ? AND pg.user_id = ?
  `).get(actionId, userId) ?? null;
}

export function ownedLog(logId: string, userId: string): any | null {
  return db.prepare(`
    SELECT al.* FROM activity_logs al
    JOIN action_items ai ON al.action_item_id = ai.id
    JOIN sub_goals sg ON ai.sub_goal_id = sg.id
    JOIN primary_goals pg ON sg.primary_goal_id = pg.id
    WHERE al.id = ? AND pg.user_id = ?
  `).get(logId, userId) ?? null;
}

export function actionOwnerCheck(actionId: string, userId: string): boolean {
  const row = db.prepare(`
    SELECT ai.id FROM action_items ai
    JOIN sub_goals sg ON ai.sub_goal_id = sg.id
    JOIN primary_goals pg ON sg.primary_goal_id = pg.id
    WHERE ai.id = ? AND pg.user_id = ?
  `).get(actionId, userId);
  return !!row;
}
