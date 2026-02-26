import { Router, Request, Response } from 'express';
import { db, PrimaryGoal, SubGoal, ActionItem } from '../db/database';

const router = Router();

const fetchSummary = (userId?: string | null) => {
  const goals = db
    .prepare('SELECT * FROM primary_goals WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as PrimaryGoal[];

  return goals.map((goal) => {
    const subGoals = db
      .prepare('SELECT * FROM sub_goals WHERE primary_goal_id = ? ORDER BY position')
      .all(goal.id) as SubGoal[];

    return {
      id: goal.id,
      title: goal.title,
      status: goal.status,
      description: goal.description,
      created_at: goal.created_at,
      subGoals: subGoals.map((sg) => {
        const actions = db
          .prepare('SELECT * FROM action_items WHERE sub_goal_id = ? ORDER BY position')
          .all(sg.id) as ActionItem[];
        return {
          id: sg.id,
          title: sg.title,
          position: sg.position,
          actions: actions.map((a) => ({
            id: a.id,
            title: a.title,
            position: a.position,
            lastUpdated: a.updated_at,
          })),
        };
      }),
    };
  });
};

router.get('/brief', (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const goals = fetchSummary(userId);
    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        guidance: {
          workflow: [
            'Call GET /api/user/summary?level=detailed for the full grid.',
            'Identify sub-goals with low activity and suggest next actions.',
            'Log progress via POST /api/logs/action/:actionId with metrics.',
            'Encourage via POST /api/guestbook.',
          ],
          etiquette: [
            'Keep the Harada structure (goal → sub-goal → 8 actions) intact.',
            'Use positive, coaching language when writing updates.',
            'Ask before deleting goals or sub-goals.',
            'Surface blockers or ambiguities in the guestbook.',
          ],
        },
        api: {
          baseUrl: process.env.FRONTEND_URL || req.protocol + '://' + req.get('host'),
          summaryEndpoint: '/api/user/summary?level=detailed',
        },
        goals,
      },
      error: null,
    });
  } catch (error) {
    res.status(500).json({ success: false, data: null, error: (error as Error).message });
  }
});

export default router;
