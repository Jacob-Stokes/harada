import { Router, Request, Response } from 'express';
import { db, PrimaryGoal, AgentEtiquette } from '../db/database';
import { ok, fail, serverError } from '../utils/response';
import { DEFAULT_ETIQUETTE, seedDefaultEtiquette } from '../utils/etiquette';
import { buildGoalTree } from '../utils/goalTree';

const router = Router();

const fetchSummary = (userId?: string | null) => {
  const goals = db
    .prepare('SELECT * FROM primary_goals WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as PrimaryGoal[];

  return goals.map((goal) => {
    const tree = buildGoalTree(goal.id, { userId });
    if (!tree) return null;

    return {
      id: tree.id,
      title: tree.title,
      status: tree.status,
      description: tree.description,
      created_at: tree.created_at,
      subGoals: tree.subGoals.map((sg) => ({
        id: sg.id,
        title: sg.title,
        position: sg.position,
        actions: sg.actions.map((a) => ({
          id: a.id,
          title: a.title,
          position: a.position,
          lastUpdated: a.updated_at,
        })),
      })),
    };
  }).filter(Boolean);
};

router.get('/brief', (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const username = req.user?.username || 'User';
    const goals = fetchSummary(userId);
    ok(res, {
      generatedAt: new Date().toISOString(),
      overview: {
        title: `${username}'s Harada Method Tracker`,
        description: `This is ${username}'s single source of truth for life goals using the Harada Method framework. Review the overview below, then use the API section to authenticate and interact with the grid programmatically.`,
        framework: "Harada Method: 1 primary goal → 8 sub-goals → 8 actions each (64 total actions)",
      },
      guidance: {
        workflow: [
          'Call GET /api/user/summary?level=detailed for the full grid.',
          'Identify sub-goals with low activity and suggest next actions.',
          'Log progress via POST /api/logs/action/:actionId with metrics.',
          'Encourage via POST /api/guestbook.',
        ],
        etiquette: (() => {
          if (!userId) return DEFAULT_ETIQUETTE;
          seedDefaultEtiquette(userId);
          const rules = db
            .prepare('SELECT * FROM agent_etiquette WHERE user_id = ? ORDER BY position')
            .all(userId) as AgentEtiquette[];
          return rules.map(r => r.content);
        })(),
      },
      api: {
        baseUrl: process.env.FRONTEND_URL || req.protocol + '://' + req.get('host'),
        summaryEndpoint: '/api/user/summary?level=detailed',
      },
      goals,
    });
  } catch (error) {
    serverError(res, error);
  }
});

export default router;
