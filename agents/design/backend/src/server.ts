import './env';
import express from 'express';
import cors from 'cors';
import agentRouter from './routes/agent';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/design', agentRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'design-agent', port: PORT });
});

app.listen(PORT, () => {
  console.log(`[design-agent] Backend running on http://localhost:${PORT}`);
  console.log(`[design-agent] Governance: CLAUDE.md active | Model: claude-sonnet-4-6 (pinned)`);
});
