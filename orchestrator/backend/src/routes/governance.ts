import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

// Two levels up from orchestrator/backend/ = repo root
const REPO_ROOT = path.resolve(process.cwd(), '../../');

const FILES = [
  {
    id: 'root-claude',
    title: 'Root CLAUDE.md — Universal Governance',
    category: 'governance',
    file: 'CLAUDE.md',
  },
  {
    id: 'requirements-claude',
    title: 'Requirements Agent CLAUDE.md',
    category: 'governance',
    file: 'agents/requirements/CLAUDE.md',
  },
  {
    id: 'design-claude',
    title: 'Design Agent CLAUDE.md',
    category: 'governance',
    file: 'agents/design/CLAUDE.md',
  },
  {
    id: 'qa-claude',
    title: 'QA Agent CLAUDE.md',
    category: 'governance',
    file: 'agents/qa/CLAUDE.md',
  },
  {
    id: 'orchestrator-claude',
    title: 'Orchestrator CLAUDE.md',
    category: 'governance',
    file: 'orchestrator/CLAUDE.md',
  },
  {
    id: 'req-prompt',
    title: 'Requirements Agent — System Prompt',
    category: 'system_prompt',
    file: 'agents/requirements/backend/src/prompts/requirements-agent.txt',
  },
  {
    id: 'design-prompt',
    title: 'Design Agent — System Prompt',
    category: 'system_prompt',
    file: 'agents/design/backend/src/prompts/design-agent.txt',
  },
  {
    id: 'qa-prompt',
    title: 'QA Agent — System Prompt',
    category: 'system_prompt',
    file: 'agents/qa/backend/src/prompts/qa-agent.txt',
  },
  {
    id: 'codeowners',
    title: 'CODEOWNERS',
    category: 'codeowners',
    file: '.github/CODEOWNERS',
  },
];

router.get('/', (_req: Request, res: Response) => {
  const result = FILES.map(({ id, title, category, file }) => {
    const fullPath = path.resolve(REPO_ROOT, file);
    let content: string;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      content = `[File not found: ${file}]`;
    }
    return { id, title, category, content };
  });
  res.json({ files: result });
});

export default router;
