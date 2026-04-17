import { Router, Request, Response } from 'express';
import { getDb } from '../db/schema';

const router = Router();

// GET /audit/runs — all pipeline runs, no large JSON output fields, newest first
router.get('/runs', (_req: Request, res: Response) => {
  const db = getDb();
  const runs = db.prepare(`
    SELECT id, created_at, status, current_phase, file_name,
           requirements_started_at, requirements_completed_at,
           design_started_at, design_completed_at,
           qa_started_at, qa_completed_at, completed_at
    FROM pipeline_runs
    ORDER BY created_at DESC
  `).all();
  res.json({ runs });
});

// GET /audit/reviews — all review actions with linked file name, newest first
router.get('/reviews', (_req: Request, res: Response) => {
  const db = getDb();
  const reviews = db.prepare(`
    SELECT r.id, r.run_id, r.phase, r.action, r.feedback, r.reviewed_at, p.file_name
    FROM pipeline_reviews r
    LEFT JOIN pipeline_runs p ON r.run_id = p.id
    ORDER BY r.reviewed_at DESC
  `).all();
  res.json({ reviews });
});

export default router;
