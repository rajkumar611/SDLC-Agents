// This module MUST be imported first in server.ts.
// It loads .env before any other module runs their top-level code.
// Run the backend from orchestrator/backend/ — that's where .env lives.
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn(`[env] No .env file found at ${envPath}. Copy backend/.env.example to backend/.env and fill in your values.`);
} else {
  console.log(`[env] Loaded .env from: ${envPath}`);
}
