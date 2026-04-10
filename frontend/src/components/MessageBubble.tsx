import { useState } from 'react';
import { Message } from '../App';

type AcceptanceCriteria = {
  given: string;
  when: string;
  then: string;
};

type Requirement = {
  id: string;
  description: string;
  acceptance_criteria?: AcceptanceCriteria;
  status: 'CLEAR' | 'AMBIGUOUS' | 'INCOMPLETE' | 'SECURITY_FLAG';
  finding?: string | null;
  clarifying_questions?: string[];
};

type AgentOutput = {
  requirements?: Requirement[];
  summary?: {
    total: number;
    clear: number;
    ambiguous: number;
    incomplete: number;
    security_flags: number;
  };
  overall_clarifying_questions?: string[];
  error?: string;
};

function tryParseJson(str: string): AgentOutput | null {
  try {
    return JSON.parse(str) as AgentOutput;
  } catch {
    // Try extracting JSON from markdown code block if model wraps it
    const match = str.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try { return JSON.parse(match[1]) as AgentOutput; } catch { /* fall through */ }
    }
    return null;
  }
}

const STATUS_CONFIG: Record<string, { label: string; icon: string; className: string }> = {
  CLEAR:         { label: 'Clear',          icon: '✓', className: 'status-clear' },
  AMBIGUOUS:     { label: 'Ambiguous',      icon: '~', className: 'status-ambiguous' },
  INCOMPLETE:    { label: 'Incomplete',     icon: '!', className: 'status-incomplete' },
  SECURITY_FLAG: { label: 'Security Flag',  icon: '⚠', className: 'status-security' },
};

function RequirementCard({ req, index }: { req: Requirement; index: number }) {
  const [open, setOpen] = useState(true);
  const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.AMBIGUOUS;

  return (
    <div className={`req-card ${cfg.className}`}>
      {/* Card header */}
      <button className="req-card-header" onClick={() => setOpen((v) => !v)}>
        <div className="req-card-left">
          <span className="req-number">{String(index + 1).padStart(2, '0')}</span>
          <span className="req-id-tag">{req.id}</span>
          <span className={`status-pill ${cfg.className}`}>
            <span className="status-icon">{cfg.icon}</span>
            {cfg.label}
          </span>
        </div>
        <span className="req-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="req-card-body">
          {/* Description */}
          <p className="req-description">{req.description}</p>

          {/* Acceptance Criteria */}
          {req.acceptance_criteria && (
            <div className="ac-block">
              <div className="ac-title">Acceptance Criteria</div>
              <div className="ac-row">
                <div className="ac-step given">
                  <span className="ac-label">Given</span>
                  <span className="ac-text">{req.acceptance_criteria.given}</span>
                </div>
                <div className="ac-arrow">→</div>
                <div className="ac-step when">
                  <span className="ac-label">When</span>
                  <span className="ac-text">{req.acceptance_criteria.when}</span>
                </div>
                <div className="ac-arrow">→</div>
                <div className="ac-step then">
                  <span className="ac-label">Then</span>
                  <span className="ac-text">{req.acceptance_criteria.then}</span>
                </div>
              </div>
            </div>
          )}

          {/* Finding */}
          {req.finding && (
            <div className="finding-block">
              <span className="finding-icon">🔍</span>
              <div>
                <div className="finding-title">Agent Finding</div>
                <div className="finding-text">{req.finding}</div>
              </div>
            </div>
          )}

          {/* Clarifying questions */}
          {req.clarifying_questions && req.clarifying_questions.length > 0 && (
            <div className="cq-block">
              <div className="cq-title">💬 Clarifying Questions</div>
              <ol className="cq-list">
                {req.clarifying_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ role, content, injectionWarning, timestamp, fileName }: Message) {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  const parsed = role === 'agent' ? tryParseJson(content) : null;

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`message ${role}`}>
      {/* Injection warning banner */}
      {injectionWarning && (
        <div className="injection-warning">
          ⚠ Security Alert: {injectionWarning}
        </div>
      )}

      {/* User bubble */}
      {role === 'user' && (
        <div className="bubble user-bubble">
          {fileName && <div className="file-tag">📄 {fileName}</div>}
          <p>{content}</p>
        </div>
      )}

      {/* Agent output */}
      {role === 'agent' && (
        <div className="agent-output">
          {parsed ? (
            <>
              {/* ── Document header ── */}
              <div className="doc-header">
                <div className="doc-header-left">
                  <span className="doc-icon">📋</span>
                  <div>
                    <div className="doc-title">Requirements Analysis Report</div>
                    <div className="doc-meta">FinServe Order Management · Phase 1 · {formatTime(timestamp)}</div>
                  </div>
                </div>
                <div className="doc-actions">
                  <button className="action-btn" onClick={() => setShowRaw((v) => !v)}>
                    {showRaw ? 'Hide JSON' : 'Raw JSON'}
                  </button>
                  <button className="action-btn" onClick={handleCopy}>
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* ── Summary strip ── */}
              {parsed.summary && (
                <div className="summary-strip">
                  <div className="summary-stat">
                    <span className="stat-number">{parsed.summary.total}</span>
                    <span className="stat-label">Total</span>
                  </div>
                  <div className="summary-divider" />
                  <div className="summary-stat clear">
                    <span className="stat-number">{parsed.summary.clear}</span>
                    <span className="stat-label">Clear</span>
                  </div>
                  <div className="summary-divider" />
                  <div className="summary-stat ambiguous">
                    <span className="stat-number">{parsed.summary.ambiguous}</span>
                    <span className="stat-label">Ambiguous</span>
                  </div>
                  <div className="summary-divider" />
                  <div className="summary-stat incomplete">
                    <span className="stat-number">{parsed.summary.incomplete}</span>
                    <span className="stat-label">Incomplete</span>
                  </div>
                  {parsed.summary.security_flags > 0 && (
                    <>
                      <div className="summary-divider" />
                      <div className="summary-stat security">
                        <span className="stat-number">{parsed.summary.security_flags}</span>
                        <span className="stat-label">⚠ Security</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Error case ── */}
              {parsed.error && (
                <div className="finding-block" style={{ margin: '1rem' }}>
                  <span className="finding-icon">⚠</span>
                  <div className="finding-text">{parsed.error}</div>
                </div>
              )}

              {/* ── Requirements list ── */}
              {parsed.requirements && parsed.requirements.length > 0 && (
                <div className="req-list-section">
                  <div className="section-label">Requirements</div>
                  {parsed.requirements.map((req, i) => (
                    <RequirementCard key={req.id ?? i} req={req} index={i} />
                  ))}
                </div>
              )}

              {/* ── Overall clarifying questions ── */}
              {parsed.overall_clarifying_questions && parsed.overall_clarifying_questions.length > 0 && (
                <div className="overall-cq-section">
                  <div className="section-label">Overall Clarifying Questions for Client</div>
                  <ol className="overall-cq-list">
                    {parsed.overall_clarifying_questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* ── Raw JSON toggle ── */}
              {showRaw && (
                <pre className="raw-json">{JSON.stringify(parsed, null, 2)}</pre>
              )}
            </>
          ) : (
            /* Fallback: model didn't return valid JSON */
            <div className="fallback-output">
              <div className="doc-header">
                <div className="doc-header-left">
                  <span className="doc-icon">📋</span>
                  <div>
                    <div className="doc-title">Agent Response</div>
                    <div className="doc-meta">{formatTime(timestamp)}</div>
                  </div>
                </div>
              </div>
              <pre className="raw-response">{content}</pre>
            </div>
          )}
        </div>
      )}

      <span className={`timestamp ${role}`}>{formatTime(timestamp)}</span>
    </div>
  );
}
