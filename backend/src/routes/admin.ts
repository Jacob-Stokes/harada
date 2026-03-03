import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';

const router = Router();

// List all users
router.get('/users', (req: Request, res: Response) => {
  try {
    const users = db.prepare(`
      SELECT id, username, email, is_admin, created_at, updated_at
      FROM users
      ORDER BY created_at ASC
    `).all();

    res.json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new user (admin only)
router.post('/users', (req: Request, res: Response) => {
  try {
    const { username, password, email, is_admin } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ success: false, error: 'Username must be at least 3 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }

    const userId = uuidv4();
    const passwordHash = bcrypt.hashSync(password, 10);

    db.prepare(`
      INSERT INTO users (id, username, password_hash, email, is_admin)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, username, passwordHash, email || null, is_admin ? 1 : 0);

    // Seed default etiquette for new user
    const defaults = [
      'Keep the Harada structure (goal → sub-goal → 8 actions) intact.',
      'Use positive, coaching language when writing updates.',
      'Ask before deleting goals or sub-goals.',
      'Surface blockers or ambiguities in the guestbook.',
    ];
    const insertEtiquette = db.prepare('INSERT INTO agent_etiquette (id, user_id, content, position, is_default) VALUES (?, ?, ?, ?, 1)');
    defaults.forEach((content, i) => {
      insertEtiquette.run(uuidv4(), userId, content, i);
    });

    const user = db.prepare('SELECT id, username, email, is_admin, created_at FROM users WHERE id = ?').get(userId);

    res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user (toggle admin, change email)
router.put('/users/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_admin, email } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (typeof is_admin === 'boolean') {
      // Prevent removing own admin
      if (id === req.user!.id && !is_admin) {
        return res.status(400).json({ success: false, error: 'Cannot remove your own admin privileges' });
      }
      db.prepare("UPDATE users SET is_admin = ?, updated_at = datetime('now') WHERE id = ?").run(is_admin ? 1 : 0, id);
    }

    if (typeof email === 'string') {
      db.prepare("UPDATE users SET email = ?, updated_at = datetime('now') WHERE id = ?").run(email || null, id);
    }

    const updated = db.prepare('SELECT id, username, email, is_admin, created_at, updated_at FROM users WHERE id = ?').get(id);

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset user password
router.put('/users/:id/password', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(passwordHash, id);

    res.json({ success: true, data: { message: 'Password updated successfully' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete user
router.delete('/users/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (id === req.user!.id) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // CASCADE will handle related data (goals, api_keys, guestbook, etiquette)
    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    res.json({ success: true, data: { message: 'User deleted successfully' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
