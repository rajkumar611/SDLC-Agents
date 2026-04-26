# Interview Preparation — SDLC Agents Project

---

## Project Summary

This project is a **multi-agent AI pipeline** that automates the entire Software Development Life Cycle (SDLC) using Claude (claude-sonnet-4-6). A Business Analyst (BA) uploads a requirements document (PDF or DOCX), and the system automatically processes it through five sequential phases — each handled by a dedicated AI agent — with a human review gate between every phase.

**Five Phases, Five Agents:**

| Phase | Agent | What it does |
|---|---|---|
| 1 | Requirements Agent | Parses the uploaded document, extracts structured requirements with Given/When/Then acceptance criteria, flags AMBIGUOUS / INCOMPLETE / SECURITY_FLAG items |
| 2 | Design Agent | Produces full solution design — backend architecture, database schema (with ERD), frontend wireframes (ASCII), user flows (Mermaid diagrams) |
| 3 | QA Agent | Generates a complete test case suite — functional, database, UI, security, and edge case tests — all traceable back to the design |
| 4 | Dev Agent | Scaffolds the actual codebase — complete, syntactically valid files (not pseudocode) matching the approved tech stack and test coverage |
| 5 | Deploy Agent | Generates deployment configuration — Dockerfile, docker-compose.yml, .env.production.example, deployment README |

**Governance:** Built under MAS compliance with a full audit trail. Every approve/reject action is permanently logged. NDA active across all phases.

**Model:** claude-sonnet-4-6 — pinned across all agents for consistent, regression-validated behaviour.

---

## How the Orchestration Works

We built a **custom orchestration layer** — no framework like LangChain. It follows the **Sequential Agent Pipeline with Human-in-the-Loop (HITL)** pattern. The orchestrator calls each agent (Requirements → Design → QA → Dev → Deploy) one by one via plain HTTP, persists all phase outputs in **SQLite**, and enforces a human review gate between every phase before advancing. Real-time pipeline status is pushed to the dashboard using **SSE (Server-Sent Events)** — a native browser/HTTP standard, not an external library; the server streams events over a persistent HTTP connection using Express's built-in `res.write()`. We deliberately avoided frameworks like LangChain because they introduce abstractions that obscure the inter-agent handoffs — for MAS compliance we needed full visibility and a clean audit trail over every phase transition, which a framework-free approach gives us with zero magic.

---

## Key Buzzwords to Use Confidently

| Term | Why it applies |
|---|---|
| **Multi-agent pipeline** | Five specialised agents, each owns exactly one SDLC phase |
| **Human-in-the-loop (HITL)** | Explicit BA approve/reject gate between every phase |
| **Sequential orchestration** | Agents run in order; output of one feeds the next |
| **SSE (Server-Sent Events)** | Native HTTP streaming — real-time status to dashboard, no external library |
| **Stateful pipeline** | SQLite as the persistent state machine across all phases |
| **Prompt injection defence** | Input treated as data, never as instruction; injection detection at backend layer |
| **Token optimisation** | Design/QA payloads are slimmed before forwarding to Dev/QA agents — Mermaid strings and ASCII art stripped to reduce token usage by ~60% |
| **MAS compliance** | Full audit log of every phase decision; permanent, no deletes |

---

## Why Not LangChain?

> *"LangChain adds abstractions we didn't need and would have made the audit trail harder to control. We needed full visibility into every inter-agent handoff for MAS compliance — a plain HTTP + SQLite approach gives us that with zero magic. Every handoff is a traceable HTTP call, every output is a stored JSON column, every review action is a permanent database row."*

---

## Architecture at a Glance

```
BA uploads document (PDF/DOCX)
         ↓
Orchestrator (Express, port 3010)
         ↓
HTTP POST → Requirements Agent (:3001)
         ↓
SQLite stores output → SSE pushes "awaiting_review" to dashboard
         ↓
BA reviews → Approves
         ↓
HTTP POST → Design Agent (:3002)
         ↓
SQLite stores output → SSE pushes "awaiting_review"
         ↓
BA reviews → Approves
         ↓
HTTP POST → QA Agent (:3003) [slimmed design payload]
         ↓
HTTP POST → Dev Agent (:3004) [slimmed design + slimmed QA]
         ↓
HTTP POST → Deploy Agent (:3005)
         ↓
Pipeline complete — BA downloads scaffold ZIP + deploy config ZIP
```

**Reject flow:** BA rejects with feedback → orchestrator re-runs that phase only with feedback injected → prior approved phases are preserved.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Agent backends | Node.js + Express + TypeScript |
| AI model | Claude claude-sonnet-4-6 (Anthropic) |
| Orchestrator state | SQLite (better-sqlite3) |
| Real-time updates | SSE — Server-Sent Events (native, no library) |
| File uploads | Multer (multipart/form-data) |
| Dashboard | React + Vite (port 5173) |
| File downloads | Archiver (ZIP streams) |

---

## One-liner for the Interview

> *"We built a five-agent SDLC pipeline using Claude, orchestrated with a custom Express + SQLite service — no frameworks, deliberate choice — with human review gates between every phase and real-time streaming via SSE."*
