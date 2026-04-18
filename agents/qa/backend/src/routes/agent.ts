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

const SYSTEM_PROMPT_PATH = path.resolve(process.cwd(), 'src/prompts/qa-agent.txt');
const SYSTEM_PROMPT = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8');
console.log(`[qa-agent] System prompt loaded from: ${SYSTEM_PROMPT_PATH}`);

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

// POST /testcases
// Body: { design: DesignOutput, feedback?: string }
router.post('/', async (req: Request, res: Response) => {
  const { design, feedback } = req.body as {
    design: unknown;
    feedback?: string;
  };

  if (!design) {
    res.status(400).json({ error: 'Missing "design" field in request body.' });
    return;
  }

  const designStr = JSON.stringify(design, null, 2);
  let injectionDetected = false;

  if (detectInjection(designStr)) {
    injectionDetected = true;
    console.warn('[SECURITY AUDIT] QA Agent: injection pattern detected in design input.');
  }

  if (feedback && detectInjection(feedback)) {
    injectionDetected = true;
    console.warn('[SECURITY AUDIT] QA Agent: injection pattern detected in feedback input.');
  }

  let userContent = `Design JSON:\n${designStr}`;
  if (feedback) {
    userContent += `\n\nBA Feedback (from rejected test suite — revise accordingly):\n${feedback}`;
  }

  try {
    // Use streaming to avoid SDK timeout on large outputs (design inputs can be 40k+ chars)
    console.log('[qa-agent] Starting streaming request...');
    const stream = getClient().messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const response = await stream.finalMessage(); // max_tokens 16k ≈ 50-80 test cases
    console.log('[qa-agent] Stream complete. stop_reason:', response.stop_reason);

    if (response.stop_reason === 'max_tokens') {
      console.error('[qa-agent] Response was truncated — max_tokens limit reached');
      res.status(500).json({ error: 'QA Agent output was truncated. The design is too large for a single pass.' });
      return;
    }

    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    const agentText = sanitizeJson(extractJson(rawText));

    try {
      JSON.parse(agentText);
    } catch {
      console.error('[qa-agent] Parse failed after streaming. Raw preview:\n', rawText.slice(0, 500));
      res.status(500).json({ error: 'QA Agent returned malformed output. Not valid JSON.' });
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
        phase: 'QA',
        model: response.model,
        flagRaised: injectionDetected ? 'SECURITY — injection detected' : null,
        disposition: 'Processed. Awaiting human review.',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[qa-agent] Error:', msg);
    res.status(500).json({ error: `QA Agent processing failed: ${msg}` });
  }
});

export default router;
