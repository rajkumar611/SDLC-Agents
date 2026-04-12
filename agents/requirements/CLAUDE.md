# CLAUDE.md — FinServe Order Management
# Owner: Build Lead | Last reviewed: 2026-04-05

## Project Scope
Order management system for FinServe Bank internal ops.
MAS compliance applies. NDA active.

## Model Selection
Use claude-sonnet-4-6 for all tasks.
Do NOT switch models without Build Lead approval.
Pin reason: Consistent behavior across team; model upgrades
require regression validation before adoption.

## What You Are Allowed To Do
- Read and write files in ./src/
- Run: npm test, npm run lint, npm run build
- Suggest parameterized SQL queries only

## What You Are Prohibited From Doing
- Do not read, log, or suggest changes to .env files
- Do not access files outside ./src/ and ./tests/
- Do not suggest installing packages not in approved-packages.md
- Do not generate code that stores plaintext passwords
- Do not execute git push under any circumstance

## Context Rules
- Schema files: SAFE to include in context
- Test fixtures: SAFE if anonymized
- Anything labeled [CLIENT-DATA] or [PII]: NEVER include

## Commit Convention
All AI-assisted commits must include tag: [AI-assisted]
Reason: Audit trail for client delivery accountability.

## Escalation
If a task requires actions outside this scope,
stop and ask the Build Lead. Do not improvise.
