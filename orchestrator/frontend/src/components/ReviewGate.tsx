import React, { useState } from 'react';

interface Props {
  runId: string;
  phase: string;
  readyForHandoff: boolean;
  handoffBlockedReason: string | null;
  onAction: () => void;
}

export function ReviewGate({ runId, phase, readyForHandoff, handoffBlockedReason, onAction }: Props) {
  const [feedback, setFeedback] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/pipeline/${runId}/approve`, { method: 'POST' });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Approve failed');
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function reject() {
    if (!feedback.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/pipeline/${runId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedback.trim() }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Reject failed');
      setFeedback('');
      setShowReject(false);
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.title}>Human Review Gate — {phase.charAt(0).toUpperCase() + phase.slice(1)}</span>
        {!readyForHandoff && handoffBlockedReason && (
          <span style={styles.blockedBadge}>Handoff Blocked</span>
        )}
      </div>

      {!readyForHandoff && handoffBlockedReason && (
        <div style={styles.blockedReason}>
          ⚠ {handoffBlockedReason}
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      {!showReject ? (
        <div style={styles.actions}>
          <button
            onClick={approve}
            disabled={loading}
            style={{ ...styles.approveBtn, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Processing...' : '✓ Approve — advance to next phase'}
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={loading}
            style={{ ...styles.rejectBtn, opacity: loading ? 0.6 : 1 }}
          >
            ✕ Reject — re-run with feedback
          </button>
        </div>
      ) : (
        <div style={styles.rejectForm}>
          <label style={styles.feedbackLabel}>
            Provide feedback for the agent to correct this output:
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. REQ-003 is missing the error handling scenario. REQ-007 acceptance criteria are too vague..."
            style={styles.textarea}
            rows={4}
          />
          <div style={styles.rejectActions}>
            <button
              onClick={reject}
              disabled={loading || !feedback.trim()}
              style={{
                ...styles.confirmRejectBtn,
                opacity: loading || !feedback.trim() ? 0.5 : 1,
                cursor: loading || !feedback.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Submitting...' : 'Submit Rejection'}
            </button>
            <button
              onClick={() => { setShowReject(false); setFeedback(''); }}
              disabled={loading}
              style={styles.cancelBtn}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    padding: '24px',
    marginTop: 24,
    border: '1px solid #e3f2fd',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  title: {
    fontWeight: 700,
    fontSize: 15,
    color: '#1565c0',
  },
  blockedBadge: {
    background: '#fff3e0',
    color: '#e65100',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
  },
  blockedReason: {
    background: '#fff3e0',
    color: '#bf360c',
    padding: '10px 14px',
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 16,
  },
  error: {
    background: '#ffebee',
    color: '#c62828',
    padding: '10px 14px',
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 16,
  },
  actions: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
  },
  approveBtn: {
    background: '#2e7d32',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '12px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  rejectBtn: {
    background: '#fff',
    color: '#c62828',
    border: '1px solid #ef9a9a',
    borderRadius: 6,
    padding: '12px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  rejectForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  feedbackLabel: {
    fontSize: 13,
    color: '#424242',
    fontWeight: 500,
  },
  textarea: {
    border: '1px solid #e0e0e0',
    borderRadius: 6,
    padding: '10px 12px',
    fontSize: 13,
    resize: 'vertical',
    outline: 'none',
    lineHeight: 1.5,
  },
  rejectActions: {
    display: 'flex',
    gap: 10,
  },
  confirmRejectBtn: {
    background: '#c62828',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: 600,
  },
  cancelBtn: {
    background: '#fff',
    color: '#424242',
    border: '1px solid #e0e0e0',
    borderRadius: 6,
    padding: '10px 18px',
    fontSize: 13,
    cursor: 'pointer',
  },
};
