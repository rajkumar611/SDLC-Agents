import './env';
import express from 'express';
import cors from 'cors';
import agentRouter from './routes/agent';

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json({ limit: '4mb' }));

app.use('/testcases', agentRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'qa-agent', port: PORT });
});

const server = app.listen(PORT, () => {
  console.log(`[qa-agent] Backend running on http://localhost:${PORT}`);
  console.log(`[qa-agent] Governance: CLAUDE.md active | Model: claude-sonnet-4-6 (pinned)`);
});

// Disable Node.js 18 default 5-minute request timeout.
// QA generation can take longer than 5 minutes for large design inputs.
server.requestTimeout = 0;
server.headersTimeout = 0;
