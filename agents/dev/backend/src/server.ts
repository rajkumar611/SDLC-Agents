import './env';
import express from 'express';
import cors from 'cors';
import agentRouter from './routes/agent';

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json({ limit: '8mb' }));

app.use('/dev/generate', agentRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'dev-agent', port: PORT });
});

const server = app.listen(PORT, () => {
  console.log(`[dev-agent] Backend running on http://localhost:${PORT}`);
  console.log(`[dev-agent] Governance: CLAUDE.md active | Model: claude-sonnet-4-6 (pinned)`);
});

// Code generation can take several minutes for large designs
server.requestTimeout = 0;
server.headersTimeout = 0;
