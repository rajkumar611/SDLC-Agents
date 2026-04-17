import fs from 'fs';
import path from 'path';
import { getDb } from '../db/schema';
import { broadcastStatus } from '../routes/pipeline';

// Node 18+ has native fetch and FormData — no external packages needed

// Agent API base URLs — set in orchestrator/backend/.env
const AGENT_URLS: Record<string, string> = {
  requirements: process.env.REQUIREMENTS_AGENT_URL ?? 'http://localhost:3001',
  design: process.env.DESIGN_AGENT_URL ?? 'http://localhost:3002',
  qa: process.env.QA_AGENT_URL ?? 'http://localhost:3003',
};

/**
 * runPhase — calls the appropriate agent API for the given phase,
 * stores the output in SQLite, and broadcasts SSE updates.
 */
export async function runPhase(
  runId: string,
  phase: string,
  input: string,
  feedback?: string
): Promise<void> {
  const db = getDb();

  broadcastStatus(runId, { phase, status: 'running' });

  let output: string;

  if (phase === 'requirements') {
    output = await callRequirementsAgent(input, feedback);
  } else if (phase === 'design') {
    output = await callDesignAgent(input, feedback);
  } else if (phase === 'qa') {
    output = await callQaAgent(input, feedback);
  } else {
    throw new Error(`Unknown phase: ${phase}`);
  }

  // Store output and mark phase as completed, run as awaiting_review
  db.prepare(`
    UPDATE pipeline_runs
    SET ${phase}_output = ?,
        ${phase}_completed_at = datetime('now'),
        status = 'awaiting_review'
    WHERE id = ?
  `).run(output, runId);

  broadcastStatus(runId, {
    phase,
    status: 'awaiting_review',
    output: JSON.parse(output),
  });
}

// --------------------------------------------------------------------------
// Requirements Agent — accepts a file upload (PDF or DOCX)
// Endpoint: POST /api/analyze
// Returns:  { response: "<agent JSON string>", injectionWarning, model, auditEntry }
// --------------------------------------------------------------------------
async function callRequirementsAgent(filePath: string, feedback?: string): Promise<string> {
  const url = `${AGENT_URLS.requirements}/api/analyze`;

  const fileBuffer = fs.readFileSync(filePath);
  const mimeType = getMimeType(filePath);
  const blob = new Blob([fileBuffer], { type: mimeType });

  const form = new FormData();
  form.append('file', blob, path.basename(filePath));

  if (feedback) {
    form.append('message', `BA Review Feedback — please re-analyse with the following corrections: ${feedback}`);
  }

  const response = await fetch(url, { method: 'POST', body: form });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Requirements Agent returned ${response.status}: ${body}`);
  }

  const json = await response.json() as { response: string; injectionWarning?: string | null };

  if (json.injectionWarning) {
    console.warn(`[runner] Requirements Agent injection warning: ${json.injectionWarning}`);
  }

  JSON.parse(json.response);
  return json.response;
}

// --------------------------------------------------------------------------
// Design Agent — accepts Requirements JSON as body
// Endpoint: POST /design
// Returns:  { response: "<agent JSON string>", injectionWarning, model, auditEntry }
// --------------------------------------------------------------------------
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.pdf':  'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt':  'text/plain',
  };
  return map[ext] ?? 'application/octet-stream';
}

async function callDesignAgent(requirementsJson: string, feedback?: string): Promise<string> {
  const url = `${AGENT_URLS.design}/design`;

  const body: Record<string, unknown> = {
    requirements: JSON.parse(requirementsJson),
  };
  if (feedback) body.feedback = feedback;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Design Agent returned ${response.status}: ${text}`);
  }

  const json = await response.json() as { response: string; injectionWarning?: string | null };

  if (json.injectionWarning) {
    console.warn(`[runner] Design Agent injection warning: ${json.injectionWarning}`);
  }

  JSON.parse(json.response);
  return json.response;
}

// --------------------------------------------------------------------------
// QA Agent — accepts Design JSON as body
// Endpoint: POST /testcases
// Returns:  { response: "<agent JSON string>", injectionWarning, model, auditEntry }
// --------------------------------------------------------------------------
async function callQaAgent(designJson: string, feedback?: string): Promise<string> {
  const url = `${AGENT_URLS.qa}/testcases`;

  const body: Record<string, unknown> = {
    design: JSON.parse(designJson),
  };
  if (feedback) body.feedback = feedback;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`QA Agent returned ${response.status}: ${text}`);
  }

  const json = await response.json() as { response: string; injectionWarning?: string | null };

  if (json.injectionWarning) {
    console.warn(`[runner] QA Agent injection warning: ${json.injectionWarning}`);
  }

  JSON.parse(json.response);
  return json.response;
}
