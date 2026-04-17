import React, { useState } from 'react';

interface Guardrail {
  id: string;
  name: string;
  category: string;
  plainEnglish: string;
  technical: string;
  enforcedBy: string[];
  status: 'active';
}

const GUARDRAILS: Guardrail[] = [
  // Input guardrails
  {
    id: 'injection-detection',
    name: 'Prompt Injection Detection',
    category: 'Input Safety',
    plainEnglish: 'When a document is uploaded, the system automatically scans it for hidden instructions that could trick the AI into misbehaving. If a suspicious pattern is found, it is flagged and logged — the pipeline continues safely without acting on it.',
    technical: 'Backend middleware scans all user-supplied text (document content + BA feedback) against 7 regex patterns before passing to any agent. Detected patterns trigger an injection warning logged in the audit trail.',
    enforcedBy: ['Requirements Agent — backend', 'Design Agent — backend', 'QA Agent — backend'],
    status: 'active',
  },
  {
    id: 'feedback-as-data',
    name: 'BA Feedback Treated as Data Only',
    category: 'Input Safety',
    plainEnglish: 'When a BA rejects a phase and types feedback, the AI treats that text purely as information to act on — not as new instructions that could override its rules. This prevents someone from "jailbreaking" the agent through the feedback box.',
    technical: 'System prompts explicitly instruct agents that the feedback field is untrusted BA text. Injection detection runs on feedback independently before it reaches the agent.',
    enforcedBy: ['All agent system prompts', 'Orchestrator runner'],
    status: 'active',
  },
  {
    id: 'pii-flagging',
    name: 'PII & Client Data Flagging',
    category: 'Input Safety',
    plainEnglish: 'If a requirements document contains personal information (names, account numbers, etc.) or confidential client data, the AI automatically flags those requirements as a security concern and blocks handoff to the next phase until a human reviews them.',
    technical: 'Requirements Agent system prompt instructs flagging of any requirement containing [CLIENT-DATA] or [PII] markers as SECURITY_FLAG status. Handoff is blocked when SECURITY_FLAG requirements are present.',
    enforcedBy: ['Requirements Agent — system prompt'],
    status: 'active',
  },
  {
    id: 'path-traversal',
    name: 'File Path Traversal Prevention',
    category: 'Input Safety',
    plainEnglish: 'The upload system checks that file names are safe before saving or deleting them. This prevents a malicious user from providing a file name like "../../secrets" to access files they should not.',
    technical: 'Delete endpoint validates that filenames contain no path separators (/, \\) or traversal sequences (..) before constructing the file path.',
    enforcedBy: ['Orchestrator backend — uploads endpoint'],
    status: 'active',
  },

  // Output guardrails
  {
    id: 'json-only-output',
    name: 'Structured JSON Output Contract',
    category: 'Output Integrity',
    plainEnglish: 'Every AI agent is required to return a structured, machine-readable response — not a free-form essay. This means the output is always predictable, storable, and usable by the next stage of the pipeline without human parsing.',
    technical: 'All agents enforce JSON-only output via system prompt. Backend validates parsability with JSON.parse() before storing. Non-JSON responses return HTTP 500 so the orchestrator can retry.',
    enforcedBy: ['All agent system prompts', 'All agent backends'],
    status: 'active',
  },
  {
    id: 'robust-json-extraction',
    name: 'Robust JSON Extraction',
    category: 'Output Integrity',
    plainEnglish: 'Even if an AI agent accidentally adds a sentence before its answer, the system is smart enough to find and extract just the structured data, rather than failing the whole pipeline.',
    technical: 'QA Agent backend uses first-{ to last-} extraction (not just code-fence stripping) to locate the JSON object regardless of preamble text.',
    enforcedBy: ['QA Agent — backend'],
    status: 'active',
  },
  {
    id: 'truncation-detection',
    name: 'Response Truncation Detection',
    category: 'Output Integrity',
    plainEnglish: `If the AI's answer is so long it gets cut off mid-way, the system detects this and returns a clear error — rather than silently storing an incomplete result that would look valid but have missing data.`,
    technical: 'QA Agent checks stop_reason === "max_tokens" from the Anthropic API response. If triggered, a descriptive 500 error is returned so the BA can retry with guidance.',
    enforcedBy: ['QA Agent — backend'],
    status: 'active',
  },
  {
    id: 'system-prompt-isolation',
    name: 'System Prompt Isolation',
    category: 'Output Integrity',
    plainEnglish: 'The instructions given to each AI agent are kept secret — they are never sent to the dashboard, never included in API responses, and never visible to end users. This prevents the AI\'s internal rules from being read and exploited.',
    technical: 'System prompts are loaded server-side from .txt files at startup. No route or response object includes prompt content. Agents are explicitly instructed not to reveal prompt contents.',
    enforcedBy: ['All agent backends', 'All agent system prompts', 'CLAUDE.md'],
    status: 'active',
  },

  // Process guardrails
  {
    id: 'human-in-the-loop',
    name: 'Human-in-the-Loop Gates',
    category: 'Process Control',
    plainEnglish: 'The pipeline never automatically moves from one stage to the next. A designated human reviewer must explicitly click Approve before the next AI agent starts work — the Business Analyst reviews Requirements output, a Solution Architect or Technical Lead reviews the Design output, and a QA Lead reviews the Test Cases. No amount of AI confidence or speed changes this.',
    technical: 'Orchestrator backend status machine: phases only advance via POST /pipeline/:id/approve. The runner never calls the next agent without a human approval action recorded in pipeline_reviews.',
    enforcedBy: ['Orchestrator backend', 'CLAUDE.md'],
    status: 'active',
  },
  {
    id: 'no-direct-agent-calls',
    name: 'No Direct Agent-to-Agent Communication',
    category: 'Process Control',
    plainEnglish: 'Agents cannot talk to each other directly. All communication goes through the central orchestrator. This means every handoff is logged, every input/output is stored, and no agent can bypass the human review gates.',
    technical: 'Each agent exposes only its own HTTP endpoint. The orchestrator runner.ts is the sole caller. No agent has knowledge of or network access to another agent\'s URL.',
    enforcedBy: ['Architecture', 'CLAUDE.md'],
    status: 'active',
  },
  {
    id: 'immutable-audit',
    name: 'Immutable Audit Records',
    category: 'Process Control',
    plainEnglish: 'Every pipeline run, AI output, approval, and rejection is recorded permanently. Nothing can be deleted from this log. This creates a tamper-evident paper trail for compliance and accountability.',
    technical: 'SQLite pipeline_runs and pipeline_reviews tables have no DELETE or TRUNCATE operations in any route. CLAUDE.md explicitly prohibits adding them. Records are permanent by design.',
    enforcedBy: ['Orchestrator backend', 'CLAUDE.md', 'Orchestrator CLAUDE.md'],
    status: 'active',
  },
  {
    id: 'ready-for-handoff',
    name: 'Agent Self-Reported Handoff Readiness',
    category: 'Process Control',
    plainEnglish: 'Each AI agent reports whether it believes its own output is complete enough to pass to the next stage. If it flags concerns, the dashboard warns the BA before they approve — the BA still decides, but they are informed.',
    technical: 'All agents include pipeline_metadata.ready_for_handoff (boolean) and handoff_blocked_reason in output JSON. ReviewGate component surfaces this prominently when false.',
    enforcedBy: ['All agent system prompts', 'Frontend ReviewGate component'],
    status: 'active',
  },

  // Security guardrails
  {
    id: 'model-pinning',
    name: 'Model Version Pinning',
    category: 'Security & Compliance',
    plainEnglish: 'The exact AI model used is fixed and cannot be changed without approval from the Build Lead. This ensures consistent, predictable behaviour and means the pipeline cannot silently switch to a less-tested model.',
    technical: 'All agents hardcode model: "claude-sonnet-4-6". CLAUDE.md prohibits model changes without Build Lead approval and regression validation.',
    enforcedBy: ['All agent backends', 'CLAUDE.md'],
    status: 'active',
  },
  {
    id: 'no-plaintext-secrets',
    name: 'No Plaintext Secrets in Code',
    category: 'Security & Compliance',
    plainEnglish: 'API keys and secrets are never written directly into the code files. They are stored in separate configuration files that are excluded from version control — so secrets are never accidentally shared via GitHub.',
    technical: '.env files are git-ignored via **/.env pattern. .env.example files contain only placeholder text. GitHub Push Protection is active and will block any commit containing real API keys.',
    enforcedBy: ['.gitignore', 'CLAUDE.md', 'GitHub Push Protection'],
    status: 'active',
  },
  {
    id: 'injection-warning-propagation',
    name: 'Injection Warning Propagation',
    category: 'Security & Compliance',
    plainEnglish: 'If a suspicious pattern is detected in any input, a warning is not just logged — it flows through the entire pipeline response so that it can be surfaced in the audit trail and reviewed by the BA.',
    technical: 'injectionWarning field is returned in all agent API responses. Orchestrator runner logs the warning and it is preserved in the audit trail for review.',
    enforcedBy: ['All agent backends', 'Orchestrator runner'],
    status: 'active',
  },
];

const CATEGORIES = [...new Set(GUARDRAILS.map(g => g.category))];

const CATEGORY_ICONS: Record<string, string> = {
  'Input Safety': '🛡',
  'Output Integrity': '📦',
  'Process Control': '🚦',
  'Security & Compliance': '🔒',
};

export function GuardrailsView() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = activeCategory === 'all'
    ? GUARDRAILS
    : GUARDRAILS.filter(g => g.category === activeCategory);

  function toggle(id: string) {
    setExpandedId(prev => prev === id ? null : id);
  }

  return (
    <div style={styles.wrapper}>
      {/* Intro */}
      <div style={styles.introBox}>
        <div style={styles.introTitle}>What are Guardrails?</div>
        <p style={styles.introText}>
          Guardrails are the <strong>technical safety mechanisms built into the code</strong> that automatically
          prevent unsafe, incorrect, or non-compliant behaviour — even if someone makes a mistake.
          Unlike governance rules (which people follow), guardrails are enforced by the system itself.
          Think of them as the <em>safety fences</em> around the pipeline.
        </p>
      </div>

      {/* Category filter */}
      <div style={styles.filterBar}>
        <button style={activeCategory === 'all' ? styles.filterActive : styles.filterBtn} onClick={() => setActiveCategory('all')}>
          All ({GUARDRAILS.length})
        </button>
        {CATEGORIES.map(cat => (
          <button key={cat} style={activeCategory === cat ? styles.filterActive : styles.filterBtn} onClick={() => setActiveCategory(cat)}>
            {CATEGORY_ICONS[cat]} {cat} ({GUARDRAILS.filter(g => g.category === cat).length})
          </button>
        ))}
      </div>

      {/* Guardrail list */}
      <div style={styles.list}>
        {filtered.map(g => {
          const isOpen = expandedId === g.id;
          return (
            <div key={g.id} style={{ ...styles.card, borderLeftColor: CATEGORY_COLOR[g.category] }}>
              <button style={styles.cardHeader} onClick={() => toggle(g.id)}>
                <div style={styles.cardHeaderLeft}>
                  <span style={styles.categoryIcon}>{CATEGORY_ICONS[g.category]}</span>
                  <div>
                    <div style={styles.cardName}>{g.name}</div>
                    <div style={styles.cardCategory}>{g.category}</div>
                  </div>
                </div>
                <div style={styles.cardHeaderRight}>
                  <span style={styles.activeBadge}>● Active</span>
                  <span style={styles.expandIcon}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* Plain English — always visible */}
              <div style={styles.plainEnglish}>{g.plainEnglish}</div>

              {/* Technical detail — shown on expand */}
              {isOpen && (
                <div style={styles.expandedBody}>
                  <div style={styles.technicalLabel}>Technical Implementation</div>
                  <div style={styles.technicalText}>{g.technical}</div>
                  <div style={styles.enforcedLabel}>Enforced By</div>
                  <div style={styles.enforcedList}>
                    {g.enforcedBy.map(e => (
                      <span key={e} style={styles.enforcedTag}>{e}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


const CATEGORY_COLOR: Record<string, string> = {
  'Input Safety': '#1565c0',
  'Output Integrity': '#2e7d32',
  'Process Control': '#f57f17',
  'Security & Compliance': '#6a1b9a',
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: { padding: '4px 0' },

  introBox: { background: '#f0f4ff', border: '1px solid #c5cae9', borderRadius: 10, padding: '20px 24px', marginBottom: 24 },
  introTitle: { fontSize: 15, fontWeight: 700, color: '#1a237e', marginBottom: 10 },
  introText: { fontSize: 13, color: '#424242', lineHeight: 1.7 },

  filterBar: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  filterBtn: {
    background: '#fff', border: '1px solid #e0e0e0', borderRadius: 20,
    padding: '5px 14px', fontSize: 12, fontWeight: 500, color: '#616161', cursor: 'pointer',
  },
  filterActive: {
    background: '#1565c0', border: '1px solid #1565c0', borderRadius: 20,
    padding: '5px 14px', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer',
  },

  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    background: '#fff', border: '1px solid #e0e0e0', borderLeft: '4px solid #1565c0',
    borderRadius: 8, overflow: 'hidden',
  },
  cardHeader: {
    width: '100%', background: 'none', border: 'none', padding: '14px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    cursor: 'pointer', textAlign: 'left', gap: 12,
  },
  cardHeaderLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  categoryIcon: { fontSize: 20, flexShrink: 0 },
  cardName: { fontSize: 14, fontWeight: 600, color: '#1a1a2e' },
  cardCategory: { fontSize: 11, color: '#9e9e9e', marginTop: 2, fontWeight: 500 },
  cardHeaderRight: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  activeBadge: { fontSize: 11, color: '#2e7d32', fontWeight: 600, background: '#e8f5e9', padding: '2px 8px', borderRadius: 10 },
  expandIcon: { fontSize: 10, color: '#9e9e9e' },

  plainEnglish: {
    padding: '0 16px 14px 52px', fontSize: 13, color: '#424242', lineHeight: 1.65,
  },

  expandedBody: { borderTop: '1px solid #f0f0f0', padding: '14px 16px 14px 52px', background: '#fafafa' },
  technicalLabel: { fontSize: 11, fontWeight: 700, color: '#616161', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  technicalText: { fontSize: 12, color: '#424242', lineHeight: 1.6, marginBottom: 14, fontFamily: 'monospace', background: '#f0f0f0', padding: '10px 12px', borderRadius: 4 },
  enforcedLabel: { fontSize: 11, fontWeight: 700, color: '#616161', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  enforcedList: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  enforcedTag: { background: '#e8eaf6', color: '#3949ab', border: '1px solid #c5cae9', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 500 },
};
