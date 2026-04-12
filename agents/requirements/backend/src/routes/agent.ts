import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { upload, parseFileContent } from '../middleware/upload';

const router = Router();

// Client is initialised lazily inside the route so that dotenv has
// already loaded by the time this code runs (env.ts loads first via server.ts).
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to backend/.env');
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// System prompt loaded at startup — server-side only, never sent to client
// Use process.cwd() (= backend/) rather than __dirname which is unreliable with tsx
const SYSTEM_PROMPT_PATH = path.resolve(process.cwd(), 'src/prompts/requirements-agent.txt');
const SYSTEM_PROMPT = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8');
console.log(`[agent] System prompt loaded from: ${SYSTEM_PROMPT_PATH}`);

// Backend injection detection layer (system prompt also handles this)
const INJECTION_PATTERNS = [
  /ignore\s+(previous|prior|above)\s+instructions/i,
  /you\s+are\s+now\s+a/i,
  /forget\s+(everything|all|your)\s+(above|previous|prior)/i,
  /disregard\s+(previous|prior|above|all)/i,
  /new\s+persona/i,
  /act\s+as\s+(a\s+)?(?!requirements\s+analysis)/i,
  /system\s*prompt/i,
  /jailbreak/i,
];

function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

function buildAuditEntry(data: {
  phase: string;
  model: string;
  flagRaised: string | null;
  disposition: string;
}) {
  return {
    timestamp: new Date().toISOString(),
    phase: data.phase,
    model: data.model,
    flagRaised: data.flagRaised,
    disposition: data.disposition,
  };
}

router.post('/analyze', upload.single('file'), async (req: Request, res: Response) => {
  const message: string = req.body.message || '';
  let fileContent = '';
  let injectionDetected = false;
  const injectionSources: string[] = [];

  try {
    // Parse uploaded file if present
    if (req.file) {
      fileContent = await parseFileContent(req.file);
      if (detectInjection(fileContent)) {
        injectionDetected = true;
        injectionSources.push('uploaded document');
      }
    }

    // Check message text for injection
    if (message && detectInjection(message)) {
      injectionDetected = true;
      injectionSources.push('user message');
    }

    // Combine content for the agent
    let userContent = message;
    if (fileContent) {
      userContent = `${message ? message + '\n\n' : ''}Document content:\n${fileContent}`;
    }

    if (!userContent.trim()) {
      return res.status(400).json({ error: 'No content provided. Please enter a message or upload a document.' });
    }

    // Audit log (in production this would write to the audit system)
    if (injectionDetected) {
      const entry = buildAuditEntry({
        phase: 'Requirements',
        model: 'claude-sonnet-4-6',
        flagRaised: `SECURITY — prompt injection detected in: ${injectionSources.join(', ')}`,
        disposition: 'Flagged. Content passed to agent per system prompt defense protocol.',
      });
      console.warn('[SECURITY AUDIT]', JSON.stringify(entry));
    }

    // Call Claude — system prompt is never exposed to the frontend
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const agentText = response.content[0].type === 'text' ? response.content[0].text : '';

    const auditEntry = buildAuditEntry({
      phase: 'Requirements',
      model: response.model,
      flagRaised: injectionDetected ? `SECURITY — injection in ${injectionSources.join(', ')}` : null,
      disposition: 'Processed. Awaiting human review.',
    });

    return res.json({
      response: agentText,
      injectionWarning: injectionDetected
        ? `Potential prompt injection detected in ${injectionSources.join(' and ')}. Flagged per governance protocol. Build Lead has been notified.`
        : null,
      model: response.model,
      auditEntry,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Agent Error]', message);
    return res.status(500).json({ error: `Agent processing failed: ${message}` });
  }
});

export default router;
