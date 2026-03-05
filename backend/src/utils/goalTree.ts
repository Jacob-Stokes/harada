import { db, PrimaryGoal, SubGoal, ActionItem, ActivityLog } from '../db/database';

export interface BuildGoalTreeOptions {
  includeLogs?: boolean;
}

/**
 * Build a full goal tree: goal -> sub-goals -> actions (-> optional logs).
 *
 * When `userId` is provided the goal must belong to that user.
 * When `userId` is omitted or null the goal is fetched without an ownership check
 * (useful for public/shared views).
 */
export function buildGoalTree(
  goalId: string,
  options: BuildGoalTreeOptions & { userId?: string | null } = {},
) {
  const { includeLogs = false, userId } = options;

  const goal = userId
    ? (db.prepare('SELECT * FROM primary_goals WHERE id = ? AND user_id = ?').get(goalId, userId) as PrimaryGoal | undefined)
    : (db.prepare('SELECT * FROM primary_goals WHERE id = ?').get(goalId) as PrimaryGoal | undefined);

  if (!goal) {
    return null;
  }

  const subGoals = db
    .prepare('SELECT * FROM sub_goals WHERE primary_goal_id = ? ORDER BY position')
    .all(goalId) as SubGoal[];

  const subGoalsWithActions = subGoals.map((subGoal) => {
    const actions = db
      .prepare('SELECT * FROM action_items WHERE sub_goal_id = ? ORDER BY position')
      .all(subGoal.id) as ActionItem[];

    return {
      ...subGoal,
      actions: actions.map((action) => {
        if (includeLogs) {
          const logs = db
            .prepare('SELECT * FROM activity_logs WHERE action_item_id = ? ORDER BY log_date DESC, created_at DESC')
            .all(action.id) as ActivityLog[];
          return { ...action, logs };
        }
        return { ...action };
      }),
    };
  });

  return {
    ...goal,
    subGoals: subGoalsWithActions,
  };
}
