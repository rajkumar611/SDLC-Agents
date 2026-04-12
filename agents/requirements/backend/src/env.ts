// This module MUST be imported first in server.ts.
// It loads .env before any other module runs their top-level code.
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend/.env'),
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../backend/.env'),
];

let loaded = false;
for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    console.log(`[env] Loaded .env from: ${candidate}`);
    loaded = true;
    break;
  }
}

if (!loaded) {
  console.warn('[env] No .env file found. Searched:');
  envCandidates.forEach((p) => console.warn('      ', p));
}
