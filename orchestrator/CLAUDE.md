# CLAUDE.md — Orchestrator
# Owner: Build Lead (@rajkumar611) | Last reviewed: 2026-04-14

## Role
The orchestrator is the pipeline brain. It mediates all handoffs between agents.
Agents do NOT call each other directly — all inter-agent communication goes through
the orchestrator runner service.

## Scope
This file governs development of:
- orchestrator/backend/  — Express API, SQLite state, SSE, runner service
- orchestrator/frontend/ — BA-facing dashboard (to be built)

Root CLAUDE.md universal rules apply in full. This file is additive only.

## What the Orchestrator Does
- Accepts document upload from the BA (PDF or DOCX)
- Calls each agent's backend API in sequence: Requirements → Design → QA
- Stores all phase outputs permanently in SQLite
- Enforces human-in-the-loop review gates between every phase
- Broadcasts real-time pipeline status to the dashboard via SSE
- Re-runs a phase with rejection feedback injected when BA rejects output

## What the Orchestrator Must NOT Do
- Do not implement business logic — that belongs in agent system prompts
- Do not modify agent outputs before storing them
- Do not advance the pipeline without an explicit BA approval action
- Do not expose SQLite file paths or internal run state to the frontend beyond what the API contracts define
- Do not call external APIs other than the three agent backends

## Agent API Contracts
| Agent        | Endpoint                        | Input                        | Port |
|--------------|---------------------------------|------------------------------|------|
| Requirements | POST /analyse (multipart/form)  | PDF or DOCX file + feedback? | 3001 |
| Design       | POST /design (JSON body)        | requirements JSON + feedback? | 3002 |
| QA           | POST /testcases (JSON body)     | design JSON + feedback?       | 3003 |

Agent URLs are configured via environment variables in orchestrator/backend/.env:
- REQUIREMENTS_AGENT_URL (default: http://localhost:3001)
- DESIGN_AGENT_URL       (default: http://localhost:3002)
- QA_AGENT_URL           (default: http://localhost:3003)

## SQLite Tables
- pipeline_runs     — one row per pipeline run, all phase outputs stored as JSON
- pipeline_reviews  — permanent audit log of every approve/reject action with feedback

These tables are the audit trail for MAS compliance. Do not add DELETE or TRUNCATE
operations. Records are permanent.

## Orchestrator Port
- Backend: 3010
- Frontend (dashboard): 5173

## Escalation
Any change to the pipeline phase order, agent API contracts, or SQLite schema
requires Build Lead approval before implementation.
