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
  dev: process.env.DEV_AGENT_URL ?? 'http://localhost:3004',
  deploy: process.env.DEPLOY_AGENT_URL ?? 'http://localhost:3005',
};

/**
 * runPhase — calls the appropriate agent API for the given phase,
 * stores the output in SQLite, and broadcasts SSE updates.
 */
export async function runPhase(
  runId: string,
  phase: string,
  input: string,
  feedback?: string,
  previousOutput?: string
): Promise<void> {
  const db = getDb();

  broadcastStatus(runId, { phase, status: 'running' });

  let output: string;

  if (phase === 'requirements') {
    output = await callRequirementsAgent(input, feedback);
  } else if (phase === 'design') {
    output = await callDesignAgent(input, feedback, previousOutput);
  } else if (phase === 'qa') {
    output = await callQaAgent(input, feedback, previousOutput);
  } else if (phase === 'dev') {
    output = await callDevAgent(input, feedback, previousOutput);
  } else if (phase === 'deploy') {
    // input is a combined JSON string: { design, devSummary }
    output = await callDeployAgent(input, feedback, previousOutput);
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

async function callDesignAgent(requirementsJson: string, feedback?: string, previousOutput?: string): Promise<string> {
  const url = `${AGENT_URLS.design}/design`;

  const body: Record<string, unknown> = {
    requirements: JSON.parse(requirementsJson),
  };
  if (feedback) body.feedback = feedback;
  if (previousOutput) body.previousDesign = JSON.parse(previousOutput);

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

async function callQaAgent(designJson: string, feedback?: string, previousOutput?: string): Promise<string> {
  const url = `${AGENT_URLS.qa}/testcases`;

  const fullDesign = JSON.parse(designJson);
  const slimmedDesign = slimDesignForQa(fullDesign);
  console.log(`[runner] QA input: full=${designJson.length} chars, slimmed=${JSON.stringify(slimmedDesign).length} chars`);

  const body: Record<string, unknown> = { ...slimmedDesign };
  if (feedback) body.feedback = feedback;
  if (previousOutput) body.previousTestSuite = JSON.parse(previousOutput);

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

// --------------------------------------------------------------------------
// Dev Agent — accepts { design, qa, feedback?, previousScaffold? } as body
// Endpoint: POST /dev/generate
// Input:    combined JSON string { design, qa } — bundled by the orchestrator
// Returns:  { response: "<agent JSON string>", injectionWarning, model, auditEntry }
// --------------------------------------------------------------------------
/**
 * Strip bulky non-structural fields from design before sending to Dev Agent.
 * Mermaid strings and ASCII wireframes account for large token usage but
 * add no value for code generation — the agent only needs schemas and contracts.
 */
function slimDesignForDev(design: Record<string, unknown>): Record<string, unknown> {
  const d = (design.design ?? design) as Record<string, unknown>;
  const slimmed: Record<string, unknown> = {};

  if (d.backend) {
    const b = d.backend as Record<string, unknown>;
    slimmed.backend = {
      architecture_style: b.architecture_style,
      tech_stack: b.tech_stack,
      services: b.services,
      api_endpoints: b.api_endpoints,
    };
  }
  if (d.database) {
    const db = d.database as Record<string, unknown>;
    slimmed.database = {
      type: db.type,
      engine: db.engine,
      tables: db.tables,
      relationships: db.relationships,
      // erd_mermaid omitted — not needed for code generation
    };
  }
  if (d.frontend) {
    const f = d.frontend as Record<string, unknown>;
    slimmed.frontend = {
      architecture_style: f.architecture_style,
      tech_stack: f.tech_stack,
      components: f.components,
      // wireframes ascii_layout omitted — only keep screen names
      wireframes: (f.wireframes as { screen: string; description: string }[] | undefined)
        ?.map(w => ({ screen: w.screen, description: w.description })),
      // user flow steps kept, mermaid strings omitted
      user_flows: (f.user_flows as { name: string; steps: string[] }[] | undefined)
        ?.map(u => ({ name: u.name, steps: u.steps })),
    };
  }
  // diagrams omitted entirely

  return { ...design, design: slimmed };
}

/**
 * Strip verbose QA fields — Dev Agent only needs test IDs, titles, and
 * which API endpoints / DB tables each test covers to structure the code.
 */
function slimQaForDev(qa: Record<string, unknown>): Record<string, unknown> {
  type TestCase = {
    id: string; title: string; priority: string;
    linked_api_endpoint?: string | null;
    linked_table?: string | null;
    linked_screen?: string | null;
    attack_vector?: string;
    edge_type?: string;
  };

  function slimTests(tests: TestCase[] | undefined) {
    return (tests ?? []).map(t => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      ...(t.linked_api_endpoint ? { linked_api_endpoint: t.linked_api_endpoint } : {}),
      ...(t.linked_table        ? { linked_table: t.linked_table }               : {}),
      ...(t.linked_screen       ? { linked_screen: t.linked_screen }             : {}),
      ...(t.attack_vector       ? { attack_vector: t.attack_vector }             : {}),
      ...(t.edge_type           ? { edge_type: t.edge_type }                     : {}),
    }));
  }

  const suite = qa.test_suite as Record<string, TestCase[]> | undefined;
  return {
    summary: qa.summary,
    test_suite: suite ? {
      functional:  slimTests(suite.functional),
      database:    slimTests(suite.database),
      ui:          slimTests(suite.ui),
      security:    slimTests(suite.security),
      edge_cases:  slimTests(suite.edge_cases),
    } : {},
    pipeline_metadata: qa.pipeline_metadata,
  };
}

async function callDevAgent(combinedInput: string, feedback?: string, previousOutput?: string): Promise<string> {
  const url = `${AGENT_URLS.dev}/dev/generate`;
  const { design, qa } = JSON.parse(combinedInput) as { design: Record<string, unknown>; qa: Record<string, unknown> };

  const slimDesign = slimDesignForDev(design);
  const slimQa = slimQaForDev(qa);
  console.log(`[runner] Dev input: design=${JSON.stringify(slimDesign).length} chars, qa=${JSON.stringify(slimQa).length} chars`);

  const body: Record<string, unknown> = { design: slimDesign, qa: slimQa };
  if (feedback) body.feedback = feedback;
  if (previousOutput) body.previousScaffold = JSON.parse(previousOutput);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Dev Agent returned ${response.status}: ${text}`);
  }

  const json = await response.json() as { response: string; injectionWarning?: string | null };

  if (json.injectionWarning) {
    console.warn(`[runner] Dev Agent injection warning: ${json.injectionWarning}`);
  }

  JSON.parse(json.response);
  return json.response;
}

// --------------------------------------------------------------------------
// Deploy Agent — accepts { design, devSummary, feedback? } as body
// Endpoint: POST /deploy/generate
// --------------------------------------------------------------------------
async function callDeployAgent(combinedInput: string, feedback?: string, previousOutput?: string): Promise<string> {
  const url = `${AGENT_URLS.deploy}/deploy/generate`;
  const { design, devSummary } = JSON.parse(combinedInput) as { design: Record<string, unknown>; devSummary: Record<string, unknown> };

  const body: Record<string, unknown> = { design, devSummary };
  if (feedback) body.feedback = feedback;
  if (previousOutput) body.previousConfig = JSON.parse(previousOutput);

  console.log(`[runner] Deploy input: ${JSON.stringify(body).length} chars`);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Deploy Agent returned ${response.status}: ${text}`);
  }

  const json = await response.json() as { response: string; injectionWarning?: string | null };

  if (json.injectionWarning) {
    console.warn(`[runner] Deploy Agent injection warning: ${json.injectionWarning}`);
  }

  JSON.parse(json.response);
  return json.response;
}
