import { Router, Request, Response } from 'express';
import { db, ActivityLog } from '../db/database';
import { v4 as uuidv4 } from 'uuid';
import { actionOwnerCheck, ownedLog } from '../middleware/ownership';
import { ok, fail, serverError } from '../utils/response';

const router = Router();

// Get all logs for an action item
router.get('/action/:actionId', (req: Request, res: Response) => {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const type = req.query.type as string | undefined;

    if (!actionOwnerCheck(actionId, userId)) {
      return fail(res, 404, 'Action not found');
    }

    let query = 'SELECT * FROM activity_logs WHERE action_item_id = ?';
    const params: any[] = [actionId];

    if (startDate) {
      query += ' AND log_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND log_date <= ?';
      params.push(endDate);
    }

    if (type) {
      query += ' AND log_type = ?';
      params.push(type);
    }

    query += ' ORDER BY log_date DESC, created_at DESC';

    const logs = db.prepare(query).all(...params);

    ok(res, logs);
  } catch (error) {
    serverError(res, error);
  }
});

// Get specific log
router.get('/:logId', (req: Request, res: Response) => {
  try {
    const logId = req.params.logId as string;
    const userId = req.user!.id;

    const log = ownedLog(logId, userId) as ActivityLog | null;

    if (!log) {
      return fail(res, 404, 'Log not found');
    }

    ok(res, log);
  } catch (error) {
    serverError(res, error);
  }
});

// Create activity log
router.post('/action/:actionId', (req: Request, res: Response) => {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;
    const {
      log_type,
      content,
      log_date,
      duration_minutes,
      metric_value,
      metric_unit,
      media_url,
      media_type,
      external_link,
      mood,
      tags
    } = req.body;

    if (!actionOwnerCheck(actionId, userId)) {
      return fail(res, 404, 'Action not found');
    }

    if (!log_type || !log_date) {
      return fail(res, 400, 'log_type and log_date are required');
    }

    const validTypes = ['note', 'progress', 'completion', 'media', 'link'];
    if (!validTypes.includes(log_type)) {
      return fail(res, 400, 'Invalid log_type');
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO activity_logs (
        id, action_item_id, log_type, content, log_date,
        duration_minutes, metric_value, metric_unit,
        media_url, media_type, external_link, mood, tags,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id, actionId, log_type, content ?? null, log_date,
      duration_minutes ?? null, metric_value ?? null, metric_unit ?? null,
      media_url ?? null, media_type ?? null, external_link ?? null,
      mood ?? null, tags ?? null, now, now
    );

    const log = db.prepare('SELECT * FROM activity_logs WHERE id = ?').get(id);

    ok(res, log, 201);
  } catch (error) {
    serverError(res, error);
  }
});

// Update activity log
router.put('/:logId', (req: Request, res: Response) => {
  try {
    const logId = req.params.logId as string;
    const userId = req.user!.id;
    const {
      log_type,
      content,
      log_date,
      duration_minutes,
      metric_value,
      metric_unit,
      media_url,
      media_type,
      external_link,
      mood,
      tags
    } = req.body;

    if (!ownedLog(logId, userId)) {
      return fail(res, 404, 'Log not found');
    }

    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE activity_logs
      SET log_type = ?, content = ?, log_date = ?,
          duration_minutes = ?, metric_value = ?, metric_unit = ?,
          media_url = ?, media_type = ?, external_link = ?,
          mood = ?, tags = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      log_type, content ?? null, log_date,
      duration_minutes ?? null, metric_value ?? null, metric_unit ?? null,
      media_url ?? null, media_type ?? null, external_link ?? null,
      mood ?? null, tags ?? null, now, logId
    );

    const updated = db.prepare('SELECT * FROM activity_logs WHERE id = ?').get(logId);

    ok(res, updated);
  } catch (error) {
    serverError(res, error);
  }
});

// Delete activity log
router.delete('/:logId', (req: Request, res: Response) => {
  try {
    const logId = req.params.logId as string;
    const userId = req.user!.id;

    if (!ownedLog(logId, userId)) {
      return fail(res, 404, 'Log not found');
    }

    const result = db.prepare('DELETE FROM activity_logs WHERE id = ?').run(logId);

    if (result.changes === 0) {
      return fail(res, 404, 'Log not found');
    }

    ok(res, { deleted: true });
  } catch (error) {
    serverError(res, error);
  }
});

// Get stats for an action
router.get('/action/:actionId/stats', (req: Request, res: Response) => {
  try {
    const actionId = req.params.actionId as string;
    const userId = req.user!.id;

    if (!actionOwnerCheck(actionId, userId)) {
      return fail(res, 404, 'Action not found');
    }

    const totalLogs = db.prepare('SELECT COUNT(*) as count FROM activity_logs WHERE action_item_id = ?')
      .get(actionId) as { count: number };

    const logsByType = db.prepare(`
      SELECT log_type, COUNT(*) as count
      FROM activity_logs
      WHERE action_item_id = ?
      GROUP BY log_type
    `).all(actionId);

    const avgMetric = db.prepare(`
      SELECT AVG(metric_value) as avg, metric_unit
      FROM activity_logs
      WHERE action_item_id = ? AND metric_value IS NOT NULL
      GROUP BY metric_unit
    `).all(actionId);

    const recentLogs = db.prepare(`
      SELECT * FROM activity_logs
      WHERE action_item_id = ?
      ORDER BY log_date DESC, created_at DESC
      LIMIT 5
    `).all(actionId);

    ok(res, {
      total_logs: totalLogs.count,
      logs_by_type: logsByType,
      average_metrics: avgMetric,
      recent_logs: recentLogs
    });
  } catch (error) {
    serverError(res, error);
  }
});

export default router;
