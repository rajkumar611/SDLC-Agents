import { useState } from 'react';
import { Message } from '../App';

type Requirement = {
  id: string;
  description: string;
  acceptance_criteria?: { given: string; when: string; then: string };
  status: 'CLEAR' | 'AMBIGUOUS' | 'INCOMPLETE' | 'SECURITY_FLAG';
  finding?: string | null;
  clarifying_questions?: string[];
};

type AgentOutput = {
  requirements?: Requirement[];
  summary?: { total: number; clear: number; ambiguous: number; incomplete: number; security_flags: number };
  overall_clarifying_questions?: string[];
  error?: string;
};

function tryParseJson(str: string): AgentOutput | null {
  try {
    return JSON.parse(str) as AgentOutput;
  } catch {
    return null;
  }
}

const STATUS_LABEL: Record<string, string> = {
  CLEAR: 'Clear',
  AMBIGUOUS: 'Ambiguous',
  INCOMPLETE: 'Incomplete',
  SECURITY_FLAG: 'Security Flag',
};

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
      {injectionWarning && (
        <div className="injection-warning">
          ⚠ Security Alert: {injectionWarning}
        </div>
      )}

      <div className={`bubble ${role === 'agent' ? 'agent-bubble' : 'user-bubble'}`}>
        {role === 'user' ? (
          <div className="user-content">
            {fileName && <div className="file-tag">📄 {fileName}</div>}
            <p>{content}</p>
          </div>
        ) : parsed ? (
          <div className="agent-json">
            {/* Header */}
            <div className="json-header">
              <span>Requirements Analysis Output</span>
              <div className="json-actions">
                <button className="action-btn" onClick={() => setShowRaw((v) => !v)}>
                  {showRaw ? 'Hide Raw' : 'Raw JSON'}
                </button>
                <button className="action-btn" onClick={handleCopy}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Error case */}
            {parsed.error && (
              <div className="req-item status-security_flag">
                <p>{parsed.error}</p>
              </div>
            )}

            {/* Summary bar */}
            {parsed.summary && (
              <div className="summary-bar">
                <span>Total: <strong>{parsed.summary.total}</strong></span>
                <span className="s-clear">Clear: <strong>{parsed.summary.clear}</strong></span>
                <span className="s-ambiguous">Ambiguous: <strong>{parsed.summary.ambiguous}</strong></span>
                <span className="s-incomplete">Incomplete: <strong>{parsed.summary.incomplete}</strong></span>
                {parsed.summary.security_flags > 0 && (
                  <span className="s-security">⚠ Security Flags: <strong>{parsed.summary.security_flags}</strong></span>
                )}
              </div>
            )}

            {/* Requirements list */}
            {parsed.requirements && parsed.requirements.length > 0 && (
              <div className="req-list">
                {parsed.requirements.map((req, i) => (
                  <div key={i} className={`req-item status-${req.status?.toLowerCase()}`}>
                    <div className="req-header">
                      <span className="req-id">{req.id}</span>
                      <span className={`req-status ${req.status?.toLowerCase()}`}>
                        {STATUS_LABEL[req.status] ?? req.status}
                      </span>
                    </div>
                    <p className="req-desc">{req.description}</p>

                    {req.acceptance_criteria && (
                      <div className="gwt">
                        <div><span className="gwt-label">Given</span> {req.acceptance_criteria.given}</div>
                        <div><span className="gwt-label">When</span> {req.acceptance_criteria.when}</div>
                        <div><span className="gwt-label">Then</span> {req.acceptance_criteria.then}</div>
                      </div>
                    )}

                    {req.finding && (
                      <div className="finding">🔍 {req.finding}</div>
                    )}

                    {req.clarifying_questions && req.clarifying_questions.length > 0 && (
                      <div className="questions">
                        <strong>Clarifying questions:</strong>
                        <ul>
                          {req.clarifying_questions.map((q, j) => <li key={j}>{q}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Overall clarifying questions */}
            {parsed.overall_clarifying_questions && parsed.overall_clarifying_questions.length > 0 && (
              <div className="overall-questions">
                <strong>Overall clarifying questions for client:</strong>
                <ul>
                  {parsed.overall_clarifying_questions.map((q, i) => <li key={i}>{q}</li>)}
                </ul>
              </div>
            )}

            {/* Raw JSON toggle */}
            {showRaw && (
              <pre className="raw-json">{JSON.stringify(parsed, null, 2)}</pre>
            )}
          </div>
        ) : (
          <pre className="raw-response">{content}</pre>
        )}
      </div>

      <span className="timestamp">{formatTime(timestamp)}</span>
    </div>
  );
}
