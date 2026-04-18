import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

const router = Router();

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set. Add it to backend/.env');
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const SYSTEM_PROMPT_PATH = path.resolve(process.cwd(), 'src/prompts/deploy-agent.txt');
const SYSTEM_PROMPT = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8');
console.log(`[deploy-agent] System prompt loaded from: ${SYSTEM_PROMPT_PATH}`);

const INJECTION_PATTERNS = [
  /ignore\s+(previous|prior|above)\s+instructions/i,
  /you\s+are\s+now\s+a/i,
  /forget\s+(everything|all|your)\s+(above|previous|prior)/i,
  /disregard\s+(previous|prior|above|all)/i,
  /new\s+persona/i,
  /system\s*prompt/i,
  /jailbreak/i,
];

function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return text.trim();
  return text.slice(start, end + 1);
}

function sanitizeJson(text: string): string {
  let result = '';
  let inString = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (!inString && ch === '"') {
      inString = true; result += ch; i++;
    } else if (inString && ch === '\\') {
      result += ch; i++;
      if (i < text.length) { result += text[i]; i++; }
    } else if (inString && ch === '"') {
      inString = false; result += ch; i++;
    } else if (inString && ch === '\n') {
      result += '\\n'; i++;
    } else if (inString && ch === '\r') {
      result += '\\r'; i++;
    } else if (inString && ch === '\t') {
      result += '\\t'; i++;
    } else {
      result += ch; i++;
    }
  }
  return result;
}

// POST /deploy/generate
// Body: { design, devSummary, feedback? }
router.post('/', async (req: Request, res: Response) => {
  const { design, devSummary, feedback } = req.body as {
    design: unknown;
    devSummary: unknown;
    feedback?: string;
  };

  if (!design || !devSummary) {
    res.status(400).json({ error: 'Missing "design" or "devSummary" field in request body.' });
    return;
  }

  const designStr = JSON.stringify(design, null, 2);
  const devStr = JSON.stringify(devSummary, null, 2);
  let injectionDetected = false;

  if (detectInjection(designStr) || detectInjection(devStr)) {
    injectionDetected = true;
    console.warn('[SECURITY AUDIT] Deploy Agent: injection pattern detected in input.');
  }
  if (feedback && detectInjection(feedback)) {
    injectionDetected = true;
    console.warn('[SECURITY AUDIT] Deploy Agent: injection pattern detected in feedback.');
  }

  let userContent = `Design JSON:\n${designStr}\n\nDev Summary:\n${devStr}`;
  if (feedback) {
    userContent += `\n\nReviewer Feedback (revise deployment config accordingly):\n${feedback}`;
  }

  try {
    console.log('[deploy-agent] Starting streaming request...');
    const stream = getClient().messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const response = await stream.finalMessage();
    console.log('[deploy-agent] Stream complete. stop_reason:', response.stop_reason);

    if (response.stop_reason === 'max_tokens') {
      console.error('[deploy-agent] Response truncated — max_tokens limit reached');
      res.status(500).json({ error: 'Deploy Agent output was truncated.' });
      return;
    }

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    const agentText = sanitizeJson(extractJson(rawText));

    try {
      JSON.parse(agentText);
    } catch {
      console.error('[deploy-agent] Parse failed. Raw preview:\n', rawText.slice(0, 500));
      res.status(500).json({ error: 'Deploy Agent returned malformed output. Not valid JSON.' });
      return;
    }

    res.json({
      response: agentText,
      injectionWarning: injectionDetected
        ? 'Potential prompt injection detected in input. Flagged per governance protocol.'
        : null,
      model: response.model,
      auditEntry: {
        timestamp: new Date().toISOString(),
        phase: 'Deployment',
        model: response.model,
        flagRaised: injectionDetected ? 'SECURITY — injection detected' : null,
        disposition: 'Processed. Awaiting human review.',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[deploy-agent] Error:', msg);
    res.status(500).json({ error: `Deploy Agent processing failed: ${msg}` });
  }
});

export default router;
