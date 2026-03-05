import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db, AgentEtiquette } from '../db/database';
import { ok, fail, serverError } from '../utils/response';
import { seedDefaultEtiquette } from '../utils/etiquette';

const router = Router();

// GET /api/etiquette - List all etiquette rules for the authenticated user
router.get('/', (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    // Seed defaults if none exist
    seedDefaultEtiquette(userId);

    const rules = db
      .prepare('SELECT * FROM agent_etiquette WHERE user_id = ? ORDER BY position')
      .all(userId) as AgentEtiquette[];

    ok(res, rules);
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/etiquette - Add a new etiquette rule
router.post('/', (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return fail(res, 400, 'Content is required');
    }

    // Get next position
    const last = db
      .prepare('SELECT MAX(position) as maxPos FROM agent_etiquette WHERE user_id = ?')
      .get(userId) as any;
    const position = (last?.maxPos ?? -1) + 1;

    const id = crypto.randomUUID();
    db.prepare(
      'INSERT INTO agent_etiquette (id, user_id, content, position, is_default) VALUES (?, ?, ?, ?, 0)'
    ).run(id, userId, content.trim(), position);

    const rule = db.prepare('SELECT * FROM agent_etiquette WHERE id = ?').get(id) as AgentEtiquette;
    ok(res, rule);
  } catch (error) {
    serverError(res, error);
  }
});

// PUT /api/etiquette/:id - Update a rule's content
router.put('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return fail(res, 400, 'Content is required');
    }

    const existing = db
      .prepare('SELECT * FROM agent_etiquette WHERE id = ? AND user_id = ?')
      .get(id, userId) as AgentEtiquette | undefined;

    if (!existing) {
      return fail(res, 404, 'Rule not found');
    }

    db.prepare('UPDATE agent_etiquette SET content = ? WHERE id = ?').run(content.trim(), id);
    const updated = db.prepare('SELECT * FROM agent_etiquette WHERE id = ?').get(id) as AgentEtiquette;
    ok(res, updated);
  } catch (error) {
    serverError(res, error);
  }
});

// DELETE /api/etiquette/:id - Remove a rule
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const existing = db
      .prepare('SELECT * FROM agent_etiquette WHERE id = ? AND user_id = ?')
      .get(id, userId) as AgentEtiquette | undefined;

    if (!existing) {
      return fail(res, 404, 'Rule not found');
    }

    db.prepare('DELETE FROM agent_etiquette WHERE id = ?').run(id);

    // Re-number positions
    const remaining = db
      .prepare('SELECT id FROM agent_etiquette WHERE user_id = ? ORDER BY position')
      .all(userId) as any[];
    const updatePos = db.prepare('UPDATE agent_etiquette SET position = ? WHERE id = ?');
    remaining.forEach((r: any, i: number) => updatePos.run(i, r.id));

    ok(res, { deleted: id });
  } catch (error) {
    serverError(res, error);
  }
});

// POST /api/etiquette/reset - Reset to defaults
router.post('/reset', (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    db.prepare('DELETE FROM agent_etiquette WHERE user_id = ?').run(userId);
    seedDefaultEtiquette(userId);

    const rules = db
      .prepare('SELECT * FROM agent_etiquette WHERE user_id = ? ORDER BY position')
      .all(userId) as AgentEtiquette[];

    ok(res, rules);
  } catch (error) {
    serverError(res, error);
  }
});

export default router;
