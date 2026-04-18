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

const SYSTEM_PROMPT_PATH = path.resolve(process.cwd(), 'src/prompts/design-agent.txt');
const SYSTEM_PROMPT = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8');
console.log(`[design-agent] System prompt loaded from: ${SYSTEM_PROMPT_PATH}`);

// Backend injection detection — same pattern as Requirements Agent
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

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
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

// POST /design
// Body: { requirements: RequirementsOutput, feedback?: string }
router.post('/', async (req: Request, res: Response) => {
  const { requirements, feedback } = req.body as {
    requirements: unknown;
    feedback?: string;
  };

  if (!requirements) {
    res.status(400).json({ error: 'Missing "requirements" field in request body.' });
    return;
  }

  const requirementsStr = JSON.stringify(requirements, null, 2);
  let injectionDetected = false;

  if (detectInjection(requirementsStr)) {
    injectionDetected = true;
    console.warn('[SECURITY AUDIT] Design Agent: injection pattern detected in requirements input.');
  }

  if (feedback && detectInjection(feedback)) {
    injectionDetected = true;
    console.warn('[SECURITY AUDIT] Design Agent: injection pattern detected in feedback input.');
  }

  // Build user message for the agent
  let userContent = `Requirements JSON:\n${requirementsStr}`;
  if (feedback) {
    userContent += `\n\nBA Feedback (from rejected design — revise accordingly):\n${feedback}`;
  }

  try {
    const response = await getClient().messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    }).finalMessage();

    const agentText = sanitizeJson(stripCodeFences(response.content[0].type === 'text' ? response.content[0].text : ''));

    // Validate the response is parseable JSON before returning
    try {
      JSON.parse(agentText);
    } catch {
      console.error('[design-agent] Agent returned non-JSON output:', agentText.slice(0, 200));
      res.status(500).json({ error: 'Design Agent returned malformed output. Not valid JSON.' });
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
        phase: 'Design',
        model: response.model,
        flagRaised: injectionDetected ? 'SECURITY — injection detected' : null,
        disposition: 'Processed. Awaiting human review.',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[design-agent] Error:', msg);
    res.status(500).json({ error: `Design Agent processing failed: ${msg}` });
  }
});

export default router;
