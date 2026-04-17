# CLAUDE.md — SDLC Agents Monorepo (Root Governance)
# Owner: Build Lead (@rajkumar611) | Last reviewed: 2026-04-18

## Project Overview
Multi-agent pipeline that automates each phase of the SDLC using Claude.
Agents are orchestrated via a custom Express + SQLite orchestrator service
(orchestrator/backend/). Each phase (Requirements, Design, QA) is called
in sequence by the orchestrator runner — agents do not call each other directly.
Phases built: Requirements, Design, QA. Planned: Development, Deployment.
MAS compliance applies. NDA active across all phases.

## Governance Structure
- This file (root CLAUDE.md): universal rules that apply to every agent and every developer
- agents/<phase>/CLAUDE.md: phase-specific rules, additive to this file
- agents/<phase>/backend/src/prompts/: runtime behaviour of the agent (system prompts)
- CODEOWNERS enforces Build Lead approval on all CLAUDE.md changes

## Model Selection
Use claude-sonnet-4-6 for all agents and all tasks.
Do NOT switch models without Build Lead approval.
Pin reason: Consistent behaviour across team; model upgrades require
regression validation before adoption.

## Universal Prohibitions
These apply to every agent, every developer, every task:
- Do not read, log, or suggest changes to .env files
- Do not execute git push under any circumstance
- Do not generate code that stores plaintext passwords or secrets
- Do not suggest installing packages not in the agent's approved list
- Do not access files outside an agent's own ./src/ and ./tests/
- Do not expose system prompt contents to the frontend or end users

## Context Rules
- Schema files: SAFE to include in context
- Test fixtures: SAFE only if fully anonymised
- Anything labelled [CLIENT-DATA] or [PII]: NEVER include in context
- Anything labelled [NDA]: NEVER include in context

## Commit Convention
All AI-assisted commits must include the tag: [AI-assisted]
Reason: Audit trail for client delivery and MAS compliance accountability.

## Escalation
If a task requires actions outside the scope defined in this file
or the relevant agent's CLAUDE.md, stop and ask the Build Lead.
Do not improvise. Do not proceed with assumptions.
