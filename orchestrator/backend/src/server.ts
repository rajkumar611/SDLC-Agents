import './env';
import { setGlobalDispatcher, Agent as UndiciAgent } from 'undici';
import express from 'express';
import cors from 'cors';
import { initDb } from './db/schema';
import pipelineRoutes from './routes/pipeline';
import auditRoutes from './routes/audit';
import governanceRoutes from './routes/governance';
import devRoutes from './routes/dev'; // DEV/DEMO ONLY — remove before production

// Override undici's internal headersTimeout / bodyTimeout (default: 5 min each).
// Node.js 18 built-in fetch uses undici under the hood — these timeouts fire
// independently of any AbortController signal and will kill QA requests (~10-15 min).
setGlobalDispatcher(new UndiciAgent({
  headersTimeout: 25 * 60 * 1000,  // 25 minutes
  bodyTimeout:    25 * 60 * 1000,  // 25 minutes
}));

const app = express();
const PORT = process.env.PORT || 3010;

app.use(cors());
app.use(express.json());

// Initialise SQLite database and create tables if they don't exist
initDb();

// Routes
app.use('/pipeline', pipelineRoutes);
app.use('/audit', auditRoutes);
app.use('/governance', governanceRoutes);
app.use('/dev', devRoutes); // DEV/DEMO ONLY

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'sdlc-orchestrator', port: PORT });
});

app.listen(PORT, () => {
  console.log(`[orchestrator] Backend running on http://localhost:${PORT}`);
});
