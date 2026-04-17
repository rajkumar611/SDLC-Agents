import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn(`[env] No .env file found at ${envPath}. Copy backend/.env.example to backend/.env and fill in your values.`);
} else {
  console.log(`[env] Loaded .env from: ${envPath}`);
}
