import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { ok, fail, serverError } from '../utils/response';
import { seedDefaultEtiquette } from '../utils/etiquette';

const router = Router();

// List all users
router.get('/users', (req: Request, res: Response) => {
  try {
    const users = db.prepare(`
      SELECT id, username, email, is_admin, created_at, updated_at
      FROM users
      ORDER BY created_at ASC
    `).all();

    ok(res, users);
  } catch (error: any) {
    serverError(res, error);
  }
});

// Create new user (admin only)
router.post('/users', (req: Request, res: Response) => {
  try {
    const { username, password, email, is_admin } = req.body;

    if (!username || !password) {
      return fail(res, 400, 'Username and password are required');
    }

    if (username.length < 3) {
      return fail(res, 400, 'Username must be at least 3 characters');
    }

    if (password.length < 6) {
      return fail(res, 400, 'Password must be at least 6 characters');
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return fail(res, 400, 'Username already exists');
    }

    const userId = uuidv4();
    const passwordHash = bcrypt.hashSync(password, 10);

    db.prepare(`
      INSERT INTO users (id, username, password_hash, email, is_admin)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, username, passwordHash, email || null, is_admin ? 1 : 0);

    // Seed default etiquette for new user
    seedDefaultEtiquette(userId);

    const user = db.prepare('SELECT id, username, email, is_admin, created_at FROM users WHERE id = ?').get(userId);

    ok(res, user, 201);
  } catch (error: any) {
    serverError(res, error);
  }
});

// Update user (toggle admin, change email)
router.put('/users/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_admin, email } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!user) {
      return fail(res, 404, 'User not found');
    }

    if (typeof is_admin === 'boolean') {
      // Prevent removing own admin
      if (id === req.user!.id && !is_admin) {
        return fail(res, 400, 'Cannot remove your own admin privileges');
      }
      db.prepare("UPDATE users SET is_admin = ?, updated_at = datetime('now') WHERE id = ?").run(is_admin ? 1 : 0, id);
    }

    if (typeof email === 'string') {
      db.prepare("UPDATE users SET email = ?, updated_at = datetime('now') WHERE id = ?").run(email || null, id);
    }

    const updated = db.prepare('SELECT id, username, email, is_admin, created_at, updated_at FROM users WHERE id = ?').get(id);

    ok(res, updated);
  } catch (error: any) {
    serverError(res, error);
  }
});

// Reset user password
router.put('/users/:id/password', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return fail(res, 400, 'Password must be at least 6 characters');
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) {
      return fail(res, 404, 'User not found');
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(passwordHash, id);

    ok(res, { message: 'Password updated successfully' });
  } catch (error: any) {
    serverError(res, error);
  }
});

// Delete user
router.delete('/users/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (id === req.user!.id) {
      return fail(res, 400, 'Cannot delete your own account');
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) {
      return fail(res, 404, 'User not found');
    }

    // CASCADE will handle related data (goals, api_keys, guestbook, etiquette)
    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    ok(res, { message: 'User deleted successfully' });
  } catch (error: any) {
    serverError(res, error);
  }
});

export default router;
