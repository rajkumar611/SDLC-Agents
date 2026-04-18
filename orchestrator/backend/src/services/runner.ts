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
/**
 * Strip verbose fields from the design JSON before sending to QA.
 * QA only needs names/identifiers to write test cases — not full Mermaid
 * strings or ASCII wireframes, which can account for 60%+ of input tokens.
 */
function slimDesignForQa(design: Record<string, unknown>): Record<string, unknown> {
  const d = (design.design ?? design) as Record<string, unknown>;
  const slim: Record<string, unknown> = { ...design };

  const slimmedDesign: Record<string, unknown> = {};

  if (d.backend) {
    const b = d.backend as Record<string, unknown>;
    slimmedDesign.backend = {
      architecture_style: b.architecture_style,
      tech_stack: b.tech_stack,
      api_endpoints: b.api_endpoints,       // keep full — needed for functional tests
      services: (b.services as { name: string; responsibility: string }[] | undefined)
        ?.map(s => ({ name: s.name, responsibility: s.responsibility })),
    };
  }

  if (d.database) {
    const db = d.database as Record<string, unknown>;
    slimmedDesign.database = {
      engine: db.engine,
      tables: db.tables,                    // keep full — needed for DB tests
      relationships: db.relationships,
      // erd_mermaid omitted — large string, not needed by QA agent
    };
  }

  if (d.frontend) {
    const f = d.frontend as Record<string, unknown>;
    slimmedDesign.frontend = {
      tech_stack: f.tech_stack,
      // Keep only screen names + descriptions from wireframes, not ASCII art
      wireframes: (f.wireframes as { screen: string; description: string }[] | undefined)
        ?.map(w => ({ screen: w.screen, description: w.description })),
      // Keep user flow names only — not full Mermaid strings
      user_flows: (f.user_flows as { name: string; steps: string[] }[] | undefined)
        ?.map(u => ({ name: u.name, steps: u.steps })),
      components: f.components,
    };
  }

  // diagrams omitted entirely — Mermaid strings, not needed by QA agent
  slim.design = slimmedDesign;
  return slim;
}

async function callQaAgent(designJson: string, feedback?: string): Promise<string> {
  const url = `${AGENT_URLS.qa}/testcases`;

  const fullDesign = JSON.parse(designJson);
  const slimmedDesign = slimDesignForQa(fullDesign);
  console.log(`[runner] QA input: full=${designJson.length} chars, slimmed=${JSON.stringify(slimmedDesign).length} chars`);

  const body: Record<string, unknown> = { ...slimmedDesign };
  if (feedback) body.feedback = feedback;

  // QA generation can take 5-15 minutes for large designs — use a 20-minute timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20 * 60 * 1000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

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
