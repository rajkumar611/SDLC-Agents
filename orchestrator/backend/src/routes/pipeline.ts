import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/schema';
import { runPhase } from '../services/runner';

const router = Router();

// Store uploaded files inside the project — never exposed publicly, git-ignored
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dt = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    cb(null, `${base}-${dt}${ext}`);
  },
});
const upload = multer({ storage });

// SSE clients keyed by run_id
const sseClients = new Map<string, Response[]>();

export function broadcastStatus(runId: string, payload: object): void {
  const clients = sseClients.get(runId) ?? [];
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((res) => res.write(data));
}

// POST /pipeline/start
// Body: multipart/form-data with file field "document"
router.post('/start', upload.single('document'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No document uploaded. Send a PDF or DOCX as field "document".' });
    return;
  }

  const runId = uuidv4();
  const db = getDb();

  db.prepare(`
    INSERT INTO pipeline_runs (id, file_name, file_path, current_phase, status, requirements_started_at)
    VALUES (?, ?, ?, 'requirements', 'running', datetime('now'))
  `).run(runId, req.file.originalname, req.file.path);

  res.json({ run_id: runId, message: 'Pipeline started. Requirements Agent is processing.' });

  // Kick off requirements phase asynchronously — do not await in the request handler
  runPhase(runId, 'requirements', req.file.path).catch((err) => {
    console.error(`[runner] requirements phase failed for run ${runId}:`, err);
    db.prepare(`UPDATE pipeline_runs SET status = 'failed' WHERE id = ?`).run(runId);
    broadcastStatus(runId, { phase: 'requirements', status: 'failed', error: String(err) });
  });
});

// POST /pipeline/:id/approve
router.post('/:id/approve', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const run = db.prepare(`SELECT * FROM pipeline_runs WHERE id = ?`).get(id) as any;
  if (!run) {
    res.status(404).json({ error: 'Run not found.' });
    return;
  }
  if (run.status !== 'awaiting_review') {
    res.status(400).json({ error: `Run is not awaiting review. Current status: ${run.status}` });
    return;
  }

  const currentPhase: string = run.current_phase;

  // Record the approval
  db.prepare(`
    INSERT INTO pipeline_reviews (run_id, phase, action) VALUES (?, ?, 'approved')
  `).run(id, currentPhase);

  const nextPhase = getNextPhase(currentPhase);

  if (!nextPhase) {
    // All phases done
    db.prepare(`
      UPDATE pipeline_runs SET status = 'completed', completed_at = datetime('now') WHERE id = ?
    `).run(id);
    broadcastStatus(id, { phase: currentPhase, status: 'pipeline_complete' });
    res.json({ message: 'Pipeline complete. All phases approved.' });
    return;
  }

  // Advance to next phase
  db.prepare(`
    UPDATE pipeline_runs
    SET current_phase = ?, status = 'running', ${nextPhase}_started_at = datetime('now')
    WHERE id = ?
  `).run(nextPhase, id);

  broadcastStatus(id, { phase: nextPhase, status: 'running' });
  res.json({ message: `${currentPhase} approved. ${nextPhase} phase started.` });

  // Determine input for next phase
  const inputOutput = run[`${currentPhase}_output`];

  runPhase(id, nextPhase, inputOutput).catch((err) => {
    console.error(`[runner] ${nextPhase} phase failed for run ${id}:`, err);
    db.prepare(`UPDATE pipeline_runs SET status = 'failed' WHERE id = ?`).run(id);
    broadcastStatus(id, { phase: nextPhase, status: 'failed', error: String(err) });
  });
});

// POST /pipeline/:id/reject
router.post('/:id/reject', (req: Request, res: Response) => {
  const { id } = req.params;
  const { feedback } = req.body as { feedback?: string };
  const db = getDb();

  const run = db.prepare(`SELECT * FROM pipeline_runs WHERE id = ?`).get(id) as any;
  if (!run) {
    res.status(404).json({ error: 'Run not found.' });
    return;
  }
  if (run.status !== 'awaiting_review') {
    res.status(400).json({ error: `Run is not awaiting review. Current status: ${run.status}` });
    return;
  }

  const currentPhase: string = run.current_phase;

  // Record the rejection
  db.prepare(`
    INSERT INTO pipeline_reviews (run_id, phase, action, feedback) VALUES (?, ?, 'rejected', ?)
  `).run(id, currentPhase, feedback ?? null);

  // Re-run the same phase
  db.prepare(`
    UPDATE pipeline_runs
    SET status = 'running', ${currentPhase}_started_at = datetime('now')
    WHERE id = ?
  `).run(id);

  broadcastStatus(id, { phase: currentPhase, status: 'rerunning', feedback });
  res.json({ message: `${currentPhase} rejected. Re-running with feedback.` });

  // For re-runs: requirements uses the file path, others use previous phase output
  const inputForRerun = currentPhase === 'requirements'
    ? run.file_path
    : run[`${getPreviousPhase(currentPhase)}_output`];

  runPhase(id, currentPhase, inputForRerun, feedback ?? undefined).catch((err) => {
    console.error(`[runner] ${currentPhase} re-run failed for run ${id}:`, err);
    db.prepare(`UPDATE pipeline_runs SET status = 'failed' WHERE id = ?`).run(id);
    broadcastStatus(id, { phase: currentPhase, status: 'failed', error: String(err) });
  });
});

// POST /pipeline/:id/retry  — retry the current phase after a failure
router.post('/:id/retry', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const run = db.prepare(`SELECT * FROM pipeline_runs WHERE id = ?`).get(id) as any;
  if (!run) {
    res.status(404).json({ error: 'Run not found.' });
    return;
  }
  if (run.status !== 'failed') {
    res.status(400).json({ error: `Run is not in a failed state. Current status: ${run.status}` });
    return;
  }

  const currentPhase: string = run.current_phase;

  db.prepare(`
    UPDATE pipeline_runs
    SET status = 'running', ${currentPhase}_started_at = datetime('now')
    WHERE id = ?
  `).run(id);

  broadcastStatus(id, { phase: currentPhase, status: 'running' });
  res.json({ message: `Retrying ${currentPhase} phase.` });

  const input = currentPhase === 'requirements'
    ? run.file_path
    : run[`${getPreviousPhase(currentPhase)}_output`];

  runPhase(id, currentPhase, input).catch((err) => {
    console.error(`[runner] ${currentPhase} retry failed for run ${id}:`, err);
    db.prepare(`UPDATE pipeline_runs SET status = 'failed' WHERE id = ?`).run(id);
    broadcastStatus(id, { phase: currentPhase, status: 'failed', error: String(err) });
  });
});

// GET /pipeline/:id/status  — SSE stream
router.get('/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const run = db.prepare(`SELECT * FROM pipeline_runs WHERE id = ?`).get(id) as any;
  if (!run) {
    res.status(404).json({ error: 'Run not found.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send current snapshot immediately on connect
  res.write(`data: ${JSON.stringify({ snapshot: true, run })}\n\n`);

  // Register this client
  if (!sseClients.has(id)) sseClients.set(id, []);
  sseClients.get(id)!.push(res);

  req.on('close', () => {
    const clients = sseClients.get(id) ?? [];
    sseClients.set(id, clients.filter((c) => c !== res));
  });
});

// GET /pipeline/uploads  — list all files in the uploads directory
router.get('/uploads', (_req: Request, res: Response) => {
  try {
    const entries = fs.readdirSync(UPLOAD_DIR)
      .filter((name) => !name.startsWith('.'))
      .map((name) => {
        const stat = fs.statSync(path.join(UPLOAD_DIR, name));
        return { name, size: stat.size, savedAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    res.json({ uploads: entries });
  } catch {
    res.json({ uploads: [] });
  }
});

// DELETE /pipeline/uploads/:filename  — delete a specific upload
router.delete('/uploads/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  // Prevent path traversal
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    res.status(400).json({ error: 'Invalid filename.' });
    return;
  }
  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found.' });
    return;
  }
  fs.unlinkSync(filePath);
  res.json({ message: `Deleted: ${filename}` });
});

// GET /pipeline/:id  — full run details (for dashboard initial load)
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();

  const run = db.prepare(`SELECT * FROM pipeline_runs WHERE id = ?`).get(id) as any;
  if (!run) {
    res.status(404).json({ error: 'Run not found.' });
    return;
  }

  const reviews = db.prepare(`SELECT * FROM pipeline_reviews WHERE run_id = ? ORDER BY reviewed_at ASC`).all(id);

  res.json({ run, reviews });
});

function getNextPhase(phase: string): string | null {
  const order = ['requirements', 'design', 'qa'];
  const idx = order.indexOf(phase);
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
}

function getPreviousPhase(phase: string): string | null {
  const order = ['requirements', 'design', 'qa'];
  const idx = order.indexOf(phase);
  return idx > 0 ? order[idx - 1] : null;
}

export default router;
