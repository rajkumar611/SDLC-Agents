import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import agentRouter from './routes/agent';

// Explicitly load .env from backend/ directory regardless of where the process is started
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api', agentRouter);

app.listen(PORT, () => {
  console.log(`FinServe Requirements Agent backend running on port ${PORT}`);
  console.log(`Governance: CLAUDE.md active | Model: claude-sonnet-4-6 (pinned)`);
});
