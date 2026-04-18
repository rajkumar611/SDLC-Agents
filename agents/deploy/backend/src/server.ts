import './env';
import express from 'express';
import cors from 'cors';
import agentRouter from './routes/agent';

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json({ limit: '8mb' }));

app.use('/deploy/generate', agentRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'deploy-agent', port: PORT });
});

const server = app.listen(PORT, () => {
  console.log(`[deploy-agent] Backend running on http://localhost:${PORT}`);
  console.log(`[deploy-agent] Governance: CLAUDE.md active | Model: claude-sonnet-4-6 (pinned)`);
});

server.requestTimeout = 0;
server.headersTimeout = 0;
