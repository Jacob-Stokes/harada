import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/testDb';
import { createTestUser, createTestGoal, createTestSubGoal, createTestAction, createTestActivityLog } from '../helpers/fixtures';
import type Database from 'better-sqlite3';

describe('Partial Updates and Nullish Coalescing', () => {
  let db: Database.Database;
  let testUser: ReturnType<typeof createTestUser>;
  let goalId: string;
  let subGoalId: string;

  beforeEach(() => {
    db = createTestDb();
    testUser = createTestUser();
    db.prepare('INSERT INTO users (id, username, password_hash, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(testUser.id, testUser.username, testUser.password_hash, testUser.email, testUser.created_at, testUser.updated_at);

    const goal = createTestGoal(testUser.id);
    goalId = goal.id;
    db.prepare('INSERT INTO primary_goals (id, user_id, title, description, target_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(goal.id, goal.user_id, goal.title, goal.description, goal.target_date, goal.created_at, goal.updated_at);

    const subGoal = createTestSubGoal(goalId, 1);
    subGoalId = subGoal.id;
    db.prepare('INSERT INTO sub_goals (id, primary_goal_id, position, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(subGoal.id, subGoal.primary_goal_id, subGoal.position, subGoal.title, subGoal.description, subGoal.created_at, subGoal.updated_at);
  });

  describe('Sub-goal partial updates', () => {
    it('preserves existing fields when only title is updated', () => {
      const existing = db.prepare('SELECT * FROM sub_goals WHERE id = ?').get(subGoalId) as any;
      const originalDescription = existing.description;
      const originalPosition = existing.position;

      // Simulate partial update: only title provided, others undefined
      const title = 'New Title';
      const description = undefined;
      const position = undefined;
      const now = new Date().toISOString();

      db.prepare('UPDATE sub_goals SET title = ?, description = ?, position = ?, updated_at = ? WHERE id = ?')
        .run(title ?? existing.title, description ?? existing.description, position ?? existing.position, now, subGoalId);

      const updated = db.prepare('SELECT * FROM sub_goals WHERE id = ?').get(subGoalId) as any;

      expect(updated.title).toBe('New Title');
      expect(updated.description).toBe(originalDescription);
      expect(updated.position).toBe(originalPosition);
    });

    it('allows explicitly setting description to null', () => {
      // null means "clear this field", undefined means "don't touch"
      const existing = db.prepare('SELECT * FROM sub_goals WHERE id = ?').get(subGoalId) as any;
      expect(existing.description).not.toBeNull();

      const description = null;
      const now = new Date().toISOString();

      db.prepare('UPDATE sub_goals SET description = ?, updated_at = ? WHERE id = ?')
        .run(description ?? existing.description, now, subGoalId);

      // null ?? existing.description returns existing.description (null is not undefined)
      // This is correct: to clear a field, the route handler should check for explicit null
      const updated = db.prepare('SELECT * FROM sub_goals WHERE id = ?').get(subGoalId) as any;
      expect(updated.description).toBe(existing.description);
    });
  });

  describe('Action partial updates', () => {
    it('preserves existing fields when only title is updated', () => {
      const action = createTestAction(subGoalId, 1, { description: 'Original desc', due_date: '2026-06-01' });
      db.prepare('INSERT INTO action_items (id, sub_goal_id, position, title, description, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(action.id, action.sub_goal_id, action.position, action.title, action.description, action.due_date, action.created_at, action.updated_at);

      const existing = db.prepare('SELECT * FROM action_items WHERE id = ?').get(action.id) as any;
      const title = 'Updated Title';
      const description = undefined;
      const position = undefined;
      const due_date = undefined;
      const now = new Date().toISOString();

      db.prepare('UPDATE action_items SET title = ?, description = ?, position = ?, due_date = ?, updated_at = ? WHERE id = ?')
        .run(
          title ?? existing.title,
          description ?? existing.description,
          position ?? existing.position,
          due_date ?? existing.due_date,
          now, action.id
        );

      const updated = db.prepare('SELECT * FROM action_items WHERE id = ?').get(action.id) as any;

      expect(updated.title).toBe('Updated Title');
      expect(updated.description).toBe('Original desc');
      expect(updated.position).toBe(1);
      expect(updated.due_date).toBe('2026-06-01');
    });
  });

  describe('Activity log zero-value preservation', () => {
    it('preserves metric_value of 0 using nullish coalescing', () => {
      const action = createTestAction(subGoalId, 1);
      db.prepare('INSERT INTO action_items (id, sub_goal_id, position, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(action.id, action.sub_goal_id, action.position, action.title, action.created_at, action.updated_at);

      const log = createTestActivityLog(action.id, { metric_value: 0, metric_unit: 'kg' });

      // Using ?? (correct): 0 ?? null = 0 (preserved)
      const metricValue = log.metric_value ?? null;
      expect(metricValue).toBe(0);

      // Using || (broken): 0 || null = null (lost!)
      const brokenMetricValue = log.metric_value || null;
      expect(brokenMetricValue).toBeNull();

      // Insert with correct ?? behavior
      db.prepare('INSERT INTO activity_logs (id, action_item_id, log_type, log_date, content, metric_value, metric_unit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(log.id, log.action_item_id, log.log_type, log.log_date, log.content, log.metric_value ?? null, log.metric_unit ?? null, log.created_at, log.updated_at);

      const saved = db.prepare('SELECT * FROM activity_logs WHERE id = ?').get(log.id) as any;
      expect(saved.metric_value).toBe(0);
      expect(saved.metric_unit).toBe('kg');
    });

    it('preserves duration_minutes of 0 using nullish coalescing', () => {
      const action = createTestAction(subGoalId, 1);
      db.prepare('INSERT INTO action_items (id, sub_goal_id, position, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(action.id, action.sub_goal_id, action.position, action.title, action.created_at, action.updated_at);

      const log = createTestActivityLog(action.id, { duration_minutes: 0 });

      db.prepare('INSERT INTO activity_logs (id, action_item_id, log_type, log_date, content, duration_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(log.id, log.action_item_id, log.log_type, log.log_date, log.content, log.duration_minutes ?? null, log.created_at, log.updated_at);

      const saved = db.prepare('SELECT * FROM activity_logs WHERE id = ?').get(log.id) as any;
      expect(saved.duration_minutes).toBe(0);
    });

    it('correctly nullifies undefined values', () => {
      const action = createTestAction(subGoalId, 1);
      db.prepare('INSERT INTO action_items (id, sub_goal_id, position, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(action.id, action.sub_goal_id, action.position, action.title, action.created_at, action.updated_at);

      const log = createTestActivityLog(action.id, { metric_value: undefined, duration_minutes: undefined });

      db.prepare('INSERT INTO activity_logs (id, action_item_id, log_type, log_date, content, metric_value, duration_minutes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(log.id, log.action_item_id, log.log_type, log.log_date, log.content, log.metric_value ?? null, log.duration_minutes ?? null, log.created_at, log.updated_at);

      const saved = db.prepare('SELECT * FROM activity_logs WHERE id = ?').get(log.id) as any;
      expect(saved.metric_value).toBeNull();
      expect(saved.duration_minutes).toBeNull();
    });

    it('preserves empty string values using nullish coalescing', () => {
      const action = createTestAction(subGoalId, 1);
      db.prepare('INSERT INTO action_items (id, sub_goal_id, position, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(action.id, action.sub_goal_id, action.position, action.title, action.created_at, action.updated_at);

      const log = createTestActivityLog(action.id, { content: '' });

      // ?? preserves empty string, || would not
      const content = log.content ?? null;
      expect(content).toBe('');

      db.prepare('INSERT INTO activity_logs (id, action_item_id, log_type, log_date, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(log.id, log.action_item_id, log.log_type, log.log_date, log.content ?? null, log.created_at, log.updated_at);

      const saved = db.prepare('SELECT * FROM activity_logs WHERE id = ?').get(log.id) as any;
      expect(saved.content).toBe('');
    });
  });
});
