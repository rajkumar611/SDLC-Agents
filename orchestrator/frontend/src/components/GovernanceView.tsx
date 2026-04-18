import React, { useEffect, useState } from 'react';

interface GovFile {
  id: string;
  title: string;
  category: string;
  content: string;
}

// ── Static governance definitions ──────────────────────────────────────────

interface ImplLocation {
  label: string;
  path: string;
}

interface StaticSection {
  summary: string;
  description: string;
  points: { heading: string; body: string }[];
  implementedIn: ImplLocation[];
}

const MAS_TRM: StaticSection = {
  summary: 'This pipeline is designed to meet the Monetary Authority of Singapore (MAS) Technology Risk Management Guidelines — the regulatory framework for AI and technology used in financial services.',
  description: 'MAS TRM requires financial institutions to govern their technology systems with clear accountability, risk controls, and audit trails. Every design decision in this pipeline traces back to a specific MAS TRM requirement.',
  points: [
    {
      heading: 'Technology Risk Governance (TRM §3)',
      body: 'All CLAUDE.md files define clear ownership, approval authority, and escalation paths. Build Lead (@rajkumar611) is accountable for all governance changes. CODEOWNERS enforces this on every Pull Request.',
    },
    {
      heading: 'Human Oversight of AI Decisions (TRM §9)',
      body: 'No AI agent can advance the pipeline autonomously. Every phase transition requires an explicit human approval action recorded in the audit trail. The pipeline architecture makes autonomous advancement impossible — the orchestrator enforces it at code level.',
    },
    {
      heading: 'Audit Trail & Accountability (TRM §3.3)',
      body: 'All pipeline runs, AI outputs, human approvals, and rejections are stored permanently in SQLite. Records cannot be deleted. Every action is timestamped and linked to the run ID, providing a full chain of custody from document upload to final output.',
    },
    {
      heading: 'AI/ML Model Governance (TRM §9.4)',
      body: 'The AI model is pinned to claude-sonnet-4-6 across all agents. Model changes require Build Lead approval and regression validation before adoption. This prevents silent capability changes that could alter pipeline behaviour.',
    },
    {
      heading: 'Data Protection & PII Controls (TRM §6)',
      body: 'The Requirements Agent automatically flags any input containing [CLIENT-DATA] or [PII] markers as SECURITY_FLAG and blocks handoff. Sensitive data is never included in agent outputs. .env files (API keys, secrets) are git-ignored and never committed.',
    },
    {
      heading: 'Change Management (TRM §7)',
      body: 'All AI-assisted commits are tagged [AI-assisted] for audit trail. CODEOWNERS requires Build Lead approval for changes to governance documents. The commit convention is defined in root CLAUDE.md and enforced by team process.',
    },
  ],
  implementedIn: [
    { label: 'CLAUDE.md (root) — governance rules', path: 'CLAUDE.md' },
    { label: 'orchestrator/backend — audit trail (SQLite)', path: 'orchestrator/backend/src/db/schema.ts' },
    { label: 'orchestrator/backend — human gate enforcement', path: 'orchestrator/backend/src/routes/pipeline.ts' },
    { label: 'All agent backends — PII detection', path: 'agents/*/backend/src/routes/agent.ts' },
    { label: '.github/CODEOWNERS — change approval', path: '.github/CODEOWNERS' },
  ],
};

const CODEOWNERS_DEF: StaticSection = {
  summary: 'CODEOWNERS is a GitHub feature that automatically requires specific people to review and approve Pull Requests that touch certain files. It is the technical enforcement layer for governance rule changes.',
  description: 'Without CODEOWNERS, any developer could modify the CLAUDE.md governance files or the CODEOWNERS file itself — removing oversight without anyone noticing. CODEOWNERS makes it impossible to merge such changes without Build Lead approval.',
  points: [
    {
      heading: 'What it protects',
      body: 'All CLAUDE.md files (root + all agents + orchestrator) and the CODEOWNERS file itself are protected. Any Pull Request that modifies these files cannot be merged without an explicit approval from @rajkumar611 (Build Lead).',
    },
    {
      heading: 'Why CODEOWNERS itself is protected',
      body: 'If CODEOWNERS were not self-protecting, a developer could submit a PR that removes all CODEOWNERS rules, then freely modify governance files in a follow-up PR. Protecting CODEOWNERS closes this loophole.',
    },
    {
      heading: 'How it works technically',
      body: 'GitHub reads .github/CODEOWNERS and, when Branch Protection Rules are enabled on master, automatically requests a review from the listed owner when a matching file is changed in a PR. The PR cannot be merged until the owner approves.',
    },
    {
      heading: 'Scope of protection',
      body: 'Currently protects: CLAUDE.md, agents/requirements/CLAUDE.md, agents/design/CLAUDE.md, agents/qa/CLAUDE.md, agents/dev/CLAUDE.md, agents/deploy/CLAUDE.md, orchestrator/CLAUDE.md, and .github/CODEOWNERS itself.',
    },
  ],
  implementedIn: [
    { label: '.github/CODEOWNERS — rule definitions', path: '.github/CODEOWNERS' },
    { label: 'GitHub Branch Protection Rules — enforcement', path: 'GitHub repository settings' },
    { label: 'CLAUDE.md — governance ownership declaration', path: 'CLAUDE.md' },
  ],
};

const RBAC_DEF: StaticSection = {
  summary: 'Role-Based Access Control (RBAC) defines who is allowed to do what in the pipeline. Different roles have different permissions — and the system enforces those permissions, not just policy.',
  description: 'In a regulated AI pipeline, it is not enough to say "only BAs should approve phases" in a document. The system itself must make it impossible for other roles to bypass the controls. This pipeline enforces RBAC at multiple layers.',
  points: [
    {
      heading: 'Role: Business Analyst (BA)',
      body: 'Permitted actions: upload requirements documents, view AI agent outputs, approve or reject phases with written feedback. The BA is the human-in-the-loop decision maker. They cannot modify governance rules, change agent behaviour, or skip phases.',
    },
    {
      heading: 'Role: Build Lead (@rajkumar611)',
      body: 'Permitted actions: all BA actions, plus approving changes to CLAUDE.md governance files, approving model changes, and approving changes to the CODEOWNERS file. Enforced by CODEOWNERS on GitHub — PRs touching governance files are blocked without Build Lead approval.',
    },
    {
      heading: 'Role: AI Agent (Requirements / Design / QA / Development / Deployment)',
      body: 'Permitted actions: process input within its own ./src/ folder, return structured JSON output. Agents cannot call each other directly, cannot advance the pipeline, cannot access files outside their scope, cannot expose system prompt contents, and cannot generate hardcoded secrets or credentials. Enforced by architecture and system prompt guardrails.',
    },
    {
      heading: 'Role: Orchestrator',
      body: 'Permitted actions: call the five agent backends in sequence, store outputs in SQLite, enforce human review gates, broadcast SSE updates. The orchestrator cannot call external APIs other than the five agent backends. Enforced by code — no other HTTP calls exist in runner.ts.',
    },
    {
      heading: 'Enforcement layers',
      body: 'RBAC is enforced at three layers: (1) Architecture — agents cannot call each other; (2) Code — orchestrator gate logic prevents phase advancement without human approval; (3) GitHub — CODEOWNERS prevents governance changes without Build Lead approval.',
    },
  ],
  implementedIn: [
    { label: 'orchestrator/backend/src/routes/pipeline.ts — review gate logic', path: 'orchestrator/backend/src/routes/pipeline.ts' },
    { label: 'orchestrator/backend/src/services/runner.ts — agent call isolation', path: 'orchestrator/backend/src/services/runner.ts' },
    { label: '.github/CODEOWNERS — Build Lead change approval', path: '.github/CODEOWNERS' },
    { label: 'All agent system prompts — agent role boundaries', path: 'agents/*/backend/src/prompts/*.txt' },
    { label: 'CLAUDE.md — role and scope declarations', path: 'CLAUDE.md' },
  ],
};

// ── Section definitions ─────────────────────────────────────────────────────

type SectionId = 'root' | 'agent-rules' | 'system-prompts' | 'mas-trm' | 'codeowners' | 'rbac';

const SECTIONS: { id: SectionId; icon: string; label: string }[] = [
  { id: 'root',           icon: '📋', label: 'Root Governance'  },
  { id: 'agent-rules',    icon: '🤖', label: 'Agent Rules'      },
  { id: 'system-prompts', icon: '💬', label: 'System Prompts'   },
  { id: 'mas-trm',        icon: '🏛', label: 'MAS TRM'          },
  { id: 'codeowners',     icon: '🔑', label: 'CODEOWNERS'       },
  { id: 'rbac',           icon: '👥', label: 'RBAC & Roles'     },
];

// ── Component ───────────────────────────────────────────────────────────────

export function GovernanceView() {
  const [active, setActive] = useState<SectionId>('root');
  const [files, setFiles] = useState<GovFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/governance')
      .then(r => r.json() as Promise<{ files: GovFile[] }>)
      .then(data => setFiles(data.files ?? []))
      .catch(() => setError('Could not load governance files.'))
      .finally(() => setLoading(false));
  }, []);

  const rootFile      = files.find(f => f.id === 'root-claude');
  const agentFiles    = files.filter(f => ['requirements-claude', 'design-claude', 'qa-claude', 'orchestrator-claude', 'dev-claude', 'deploy-claude'].includes(f.id));
  const promptFiles   = files.filter(f => f.category === 'system_prompt');
  const codeownersFile = files.find(f => f.id === 'codeowners');

  return (
    <div style={styles.wrapper}>
      {/* Intro */}
      <div style={styles.introBox}>
        <div style={styles.introTitle}>What is Governance?</div>
        <p style={styles.introText}>
          Governance is the set of <strong>written rules and policies</strong> that define who can change what,
          what each AI agent is allowed to do, how decisions are made, and who is accountable.
          Think of it as <em>the rulebook</em> — unlike guardrails (which the system enforces automatically),
          governance rules are read and followed by people.
        </p>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {/* Navigation buttons */}
      <div style={styles.navBar}>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            style={active === s.id ? styles.navBtnActive : styles.navBtn}
            onClick={() => setActive(s.id)}
          >
            <span style={styles.navIcon}>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={styles.content}>

        {active === 'root' && (
          <FileSection
            title="Root CLAUDE.md — Universal Governance"
            subtitle="Applies to every agent, every developer, and every task in the monorepo. All other CLAUDE.md files are additive to this one."
            file={rootFile ?? null}
            loading={loading}
            expandedFile={expandedFile}
            onToggle={id => setExpandedFile(prev => prev === id ? null : id)}
            implementedIn={[
              { label: 'CLAUDE.md (repo root)', path: 'CLAUDE.md' },
              { label: 'Applies to all 3 agents + orchestrator', path: 'agents/*/CLAUDE.md' },
            ]}
          />
        )}

        {active === 'agent-rules' && (
          <MultiFileSection
            title="Per-Agent Governance Rules"
            subtitle="Each agent has its own CLAUDE.md that adds phase-specific rules on top of the root governance. These define what the agent is allowed to do, what it must never do, and what output it must produce."
            files={agentFiles}
            loading={loading}
            expandedFile={expandedFile}
            onToggle={id => setExpandedFile(prev => prev === id ? null : id)}
            implementedIn={[
              { label: 'agents/requirements/CLAUDE.md', path: 'agents/requirements/CLAUDE.md' },
              { label: 'agents/design/CLAUDE.md', path: 'agents/design/CLAUDE.md' },
              { label: 'agents/qa/CLAUDE.md', path: 'agents/qa/CLAUDE.md' },
              { label: 'agents/dev/CLAUDE.md', path: 'agents/dev/CLAUDE.md' },
              { label: 'agents/deploy/CLAUDE.md', path: 'agents/deploy/CLAUDE.md' },
              { label: 'orchestrator/CLAUDE.md', path: 'orchestrator/CLAUDE.md' },
            ]}
          />
        )}

        {active === 'system-prompts' && (
          <MultiFileSection
            title="Agent System Prompts"
            subtitle="The actual runtime instructions given to each AI agent. These define the agent's role, output format, input handling rules, and hard boundaries. Server-side only — never exposed to the BA or dashboard during normal operation."
            files={promptFiles}
            loading={loading}
            expandedFile={expandedFile}
            onToggle={id => setExpandedFile(prev => prev === id ? null : id)}
            implementedIn={[
              { label: 'agents/requirements/backend/src/prompts/requirements-agent.txt', path: 'agents/requirements/backend/src/prompts/requirements-agent.txt' },
              { label: 'agents/design/backend/src/prompts/design-agent.txt', path: 'agents/design/backend/src/prompts/design-agent.txt' },
              { label: 'agents/qa/backend/src/prompts/qa-agent.txt', path: 'agents/qa/backend/src/prompts/qa-agent.txt' },
              { label: 'agents/dev/backend/src/prompts/dev-agent.txt', path: 'agents/dev/backend/src/prompts/dev-agent.txt' },
              { label: 'agents/deploy/backend/src/prompts/deploy-agent.txt', path: 'agents/deploy/backend/src/prompts/deploy-agent.txt' },
            ]}
          />
        )}

        {active === 'mas-trm' && (
          <StaticSection title="MAS TRM Compliance" def={MAS_TRM} accentColor="#1a237e" />
        )}

        {active === 'codeowners' && (
          <div>
            <StaticSection title="CODEOWNERS — Change Approval Enforcement" def={CODEOWNERS_DEF} accentColor="#1b5e20" />
            {codeownersFile && (
              <div style={styles.filePreviewBox}>
                <div style={styles.filePreviewLabel}>Actual .github/CODEOWNERS file</div>
                <pre style={styles.filePreviewContent}>{codeownersFile.content}</pre>
              </div>
            )}
          </div>
        )}

        {active === 'rbac' && (
          <StaticSection title="RBAC — Role-Based Access Control" def={RBAC_DEF} accentColor="#4a148c" />
        )}

      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StaticSection({ title, def, accentColor }: { title: string; def: StaticSection; accentColor: string }) {
  return (
    <div>
      <div style={styles.sectionTitle}>{title}</div>
      <p style={styles.sectionSummary}>{def.summary}</p>
      <p style={styles.sectionDesc}>{def.description}</p>

      <div style={styles.pointsGrid}>
        {def.points.map(p => (
          <div key={p.heading} style={{ ...styles.pointCard, borderLeftColor: accentColor }}>
            <div style={{ ...styles.pointHeading, color: accentColor }}>{p.heading}</div>
            <div style={styles.pointBody}>{p.body}</div>
          </div>
        ))}
      </div>

      <div style={styles.implSection}>
        <div style={styles.implTitle}>Where This Is Implemented</div>
        <div style={styles.implList}>
          {def.implementedIn.map(loc => (
            <div key={loc.path} style={styles.implRow}>
              <span style={styles.implPath}>{loc.path}</span>
              <span style={styles.implLabel}>{loc.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FileSection({ title, subtitle, file, loading, expandedFile, onToggle, implementedIn }: {
  title: string; subtitle: string; file: GovFile | null; loading: boolean;
  expandedFile: string | null; onToggle: (id: string) => void;
  implementedIn: ImplLocation[];
}) {
  if (loading) return <div style={styles.hint}>Loading…</div>;
  if (!file) return <div style={styles.hint}>File not available.</div>;
  return (
    <div>
      <div style={styles.sectionTitle}>{title}</div>
      <p style={styles.sectionSummary}>{subtitle}</p>
      <FileAccordion file={file} open={expandedFile === file.id} onToggle={() => onToggle(file.id)} />
      <ImplBox locations={implementedIn} />
    </div>
  );
}

function MultiFileSection({ title, subtitle, files, loading, expandedFile, onToggle, implementedIn }: {
  title: string; subtitle: string; files: GovFile[]; loading: boolean;
  expandedFile: string | null; onToggle: (id: string) => void;
  implementedIn: ImplLocation[];
}) {
  if (loading) return <div style={styles.hint}>Loading…</div>;
  return (
    <div>
      <div style={styles.sectionTitle}>{title}</div>
      <p style={styles.sectionSummary}>{subtitle}</p>
      {files.map(f => (
        <FileAccordion key={f.id} file={f} open={expandedFile === f.id} onToggle={() => onToggle(f.id)} />
      ))}
      <ImplBox locations={implementedIn} />
    </div>
  );
}

function FileAccordion({ file, open, onToggle }: { file: GovFile; open: boolean; onToggle: () => void }) {
  const lineCount = file.content.split('\n').length;
  return (
    <div style={styles.accordion}>
      <button style={styles.accordionHeader} onClick={onToggle}>
        <span style={styles.accordionToggle}>{open ? '▼' : '▶'}</span>
        <span style={styles.accordionTitle}>{file.title}</span>
        <span style={styles.lineCount}>{lineCount} lines</span>
      </button>
      {open && <pre style={styles.accordionContent}>{file.content}</pre>}
    </div>
  );
}

function ImplBox({ locations }: { locations: ImplLocation[] }) {
  return (
    <div style={styles.implSection}>
      <div style={styles.implTitle}>Where This Is Implemented</div>
      <div style={styles.implList}>
        {locations.map(loc => (
          <div key={loc.path} style={styles.implRow}>
            <span style={styles.implPath}>{loc.path}</span>
            <span style={styles.implLabel}>{loc.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  wrapper: { padding: '4px 0' },

  introBox: { background: '#f0f4ff', border: '1px solid #c5cae9', borderRadius: 10, padding: '20px 24px', marginBottom: 24 },
  introTitle: { fontSize: 15, fontWeight: 700, color: '#1a237e', marginBottom: 10 },
  introText: { fontSize: 13, color: '#424242', lineHeight: 1.7 },

  errorBanner: { background: '#ffebee', color: '#c62828', borderRadius: 4, padding: '8px 12px', fontSize: 13, marginBottom: 12 },
  hint: { fontSize: 13, color: '#9e9e9e', padding: '16px 0' },

  navBar: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  navBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#fff', border: '1px solid #e0e0e0', borderRadius: 20,
    padding: '7px 16px', fontSize: 13, fontWeight: 500, color: '#424242', cursor: 'pointer',
  },
  navBtnActive: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#1565c0', border: '1px solid #1565c0', borderRadius: 20,
    padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
  },
  navIcon: { fontSize: 15 },

  content: {},

  sectionTitle: { fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 },
  sectionSummary: { fontSize: 14, color: '#212121', lineHeight: 1.7, marginBottom: 6, fontWeight: 500 },
  sectionDesc: { fontSize: 13, color: '#616161', lineHeight: 1.7, marginBottom: 20 },

  pointsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 },
  pointCard: { background: '#fff', border: '1px solid #e8e8e8', borderLeft: '3px solid #1565c0', borderRadius: 6, padding: '14px 16px' },
  pointHeading: { fontSize: 13, fontWeight: 700, marginBottom: 6 },
  pointBody: { fontSize: 12, color: '#424242', lineHeight: 1.65 },

  implSection: { background: '#f8f9fa', border: '1px solid #e8e8e8', borderRadius: 8, padding: '16px', marginTop: 8 },
  implTitle: { fontSize: 11, fontWeight: 700, color: '#757575', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 },
  implList: { display: 'flex', flexDirection: 'column', gap: 6 },
  implRow: { display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' },
  implPath: { fontFamily: 'monospace', fontSize: 12, color: '#1565c0', fontWeight: 600, background: '#e8eaf6', padding: '2px 7px', borderRadius: 4, flexShrink: 0 },
  implLabel: { fontSize: 12, color: '#616161' },

  accordion: { background: '#fff', border: '1px solid #e8e8e8', borderRadius: 6, marginBottom: 8, overflow: 'hidden' },
  accordionHeader: {
    width: '100%', background: 'none', border: 'none', padding: '12px 16px',
    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left',
  },
  accordionToggle: { fontSize: 10, color: '#bdbdbd', flexShrink: 0 },
  accordionTitle: { fontSize: 13, fontWeight: 600, color: '#1565c0', flex: 1 },
  lineCount: { fontSize: 11, color: '#bdbdbd', flexShrink: 0 },
  accordionContent: {
    margin: 0, padding: '2px 16px 16px', fontSize: 12, fontFamily: 'monospace',
    lineHeight: 1.65, color: '#212121', background: '#fafafa',
    overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    borderTop: '1px solid #f0f0f0',
  },

  filePreviewBox: { marginTop: 20, border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' },
  filePreviewLabel: { background: '#f5f5f5', padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#757575', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e0e0e0' },
  filePreviewContent: { margin: 0, padding: '14px', fontSize: 12, fontFamily: 'monospace', lineHeight: 1.65, color: '#212121', background: '#fafafa', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
};
