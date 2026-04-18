/**
 * DEV / DEMO ONLY — DO NOT ENABLE IN PRODUCTION
 *
 * This route provides a full reset of all pipeline state for demo and
 * development purposes. It truncates both audit tables and deletes all
 * uploaded files.
 *
 * Governance note: root CLAUDE.md and orchestrator CLAUDE.md prohibit
 * DELETE/TRUNCATE on pipeline tables in production. This route exists
 * solely for demo resets and must never be deployed to a production
 * environment.
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getDb } from '../db/schema';

const router = Router();

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

// POST /dev/reset — wipe all pipeline state and uploaded files
router.post('/reset', (_req: Request, res: Response) => {
  const db = getDb();

  // Delete reviews first (foreign key references pipeline_runs)
  const reviewCount = (db.prepare('SELECT COUNT(*) as n FROM pipeline_reviews').get() as { n: number }).n;
  const runCount    = (db.prepare('SELECT COUNT(*) as n FROM pipeline_runs').get() as { n: number }).n;

  db.prepare('DELETE FROM pipeline_reviews').run();
  db.prepare('DELETE FROM pipeline_runs').run();

  // Delete all uploaded files
  let fileCount = 0;
  if (fs.existsSync(UPLOAD_DIR)) {
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => !f.startsWith('.'));
    files.forEach(f => {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, f)); fileCount++; } catch { /* skip locked files */ }
    });
  }

  console.warn(`[DEV RESET] Deleted ${runCount} runs, ${reviewCount} reviews, ${fileCount} uploaded files.`);

  res.json({
    message: 'Demo reset complete.',
    deleted: { runs: runCount, reviews: reviewCount, files: fileCount },
  });
});

export default router;
