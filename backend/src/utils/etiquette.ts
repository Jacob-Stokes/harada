import crypto from 'crypto';
import { db } from '../db/database';

export const DEFAULT_ETIQUETTE: string[] = [
  'Keep the Harada structure (goal \u2192 sub-goal \u2192 8 actions) intact.',
  'Use positive, coaching language when writing updates.',
  'Ask before deleting goals or sub-goals.',
  'Surface blockers or ambiguities in the guestbook.',
];

/**
 * Seeds default etiquette rules for a user if they have none.
 * Returns true if defaults were inserted, false if user already had rules.
 */
export function seedDefaultEtiquette(userId: string): boolean {
  const existing = db
    .prepare('SELECT COUNT(*) as count FROM agent_etiquette WHERE user_id = ?')
    .get(userId) as any;

  if (existing.count > 0) {
    return false;
  }

  const insert = db.prepare(
    'INSERT INTO agent_etiquette (id, user_id, content, position, is_default) VALUES (?, ?, ?, ?, 1)'
  );
  DEFAULT_ETIQUETTE.forEach((content, i) => {
    insert.run(crypto.randomUUID(), userId, content, i);
  });

  return true;
}
