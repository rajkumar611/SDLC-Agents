import './env';
import express from 'express';
import cors from 'cors';
import { initDb } from './db/schema';
import pipelineRoutes from './routes/pipeline';

const app = express();
const PORT = process.env.PORT || 3010;

app.use(cors());
app.use(express.json());

// Initialise SQLite database and create tables if they don't exist
initDb();

// Pipeline routes
app.use('/pipeline', pipelineRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'sdlc-orchestrator', port: PORT });
});

app.listen(PORT, () => {
  console.log(`[orchestrator] Backend running on http://localhost:${PORT}`);
});
