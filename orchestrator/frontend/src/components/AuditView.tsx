import React, { useEffect, useState } from 'react';

interface PipelineRunRow {
  id: string;
  created_at: string;
  status: string;
  current_phase: string;
  file_name: string | null;
  requirements_started_at: string | null;
  requirements_completed_at: string | null;
  design_started_at: string | null;
  design_completed_at: string | null;
  qa_started_at: string | null;
  qa_completed_at: string | null;
  completed_at: string | null;
}

interface ReviewRow {
  id: number;
  run_id: string;
  phase: string;
  action: string;
  feedback: string | null;
  reviewed_at: string;
  file_name: string | null;
}

type SubTab = 'runs' | 'reviews';

export function AuditView() {
  const [subTab, setSubTab] = useState<SubTab>('runs');
  const [runs, setRuns] = useState<PipelineRunRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [r1, r2] = await Promise.all([
          fetch('/audit/runs').then(r => r.json()) as Promise<{ runs: PipelineRunRow[] }>,
          fetch('/audit/reviews').then(r => r.json()) as Promise<{ reviews: ReviewRow[] }>,
        ]);
        setRuns(r1.runs ?? []);
        setReviews(r2.reviews ?? []);
      } catch {
        setError('Could not load audit data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function refresh() {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch('/audit/runs').then(r => r.json()) as Promise<{ runs: PipelineRunRow[] }>,
      fetch('/audit/reviews').then(r => r.json()) as Promise<{ reviews: ReviewRow[] }>,
    ]).then(([r1, r2]) => {
      setRuns(r1.runs ?? []);
      setReviews(r2.reviews ?? []);
    }).catch(() => setError('Refresh failed.')).finally(() => setLoading(false));
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.title}>Audit Trail</span>
        <button style={styles.refreshBtn} onClick={refresh} disabled={loading}>{loading ? '…' : '↻ Refresh'}</button>
      </div>
      <p style={styles.hint}>Permanent, tamper-evident log of all pipeline runs and human review decisions. No deletes permitted (MAS compliance).</p>

      {/* Sub-tabs */}
      <div style={styles.subTabBar}>
        <button style={subTab === 'runs' ? styles.subTabActive : styles.subTab} onClick={() => setSubTab('runs')}>
          Pipeline Runs ({runs.length})
        </button>
        <button style={subTab === 'reviews' ? styles.subTabActive : styles.subTab} onClick={() => setSubTab('reviews')}>
          Review Log ({reviews.length})
        </button>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {subTab === 'runs' && (
        <div style={styles.tableWrapper}>
          {runs.length === 0 && !loading ? (
            <div style={styles.empty}>No pipeline runs yet.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Run ID', 'File', 'Status', 'Phase', 'Started', 'Completed'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id} style={styles.tr}>
                    <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 11 }}>{r.id.slice(0, 8)}…</td>
                    <td style={styles.td}>{r.file_name ?? '—'}</td>
                    <td style={styles.td}><StatusBadge status={r.status} /></td>
                    <td style={styles.td}>{r.current_phase}</td>
                    <td style={{ ...styles.td, whiteSpace: 'nowrap', color: '#616161' }}>{fmt(r.created_at)}</td>
                    <td style={{ ...styles.td, whiteSpace: 'nowrap', color: '#616161' }}>{r.completed_at ? fmt(r.completed_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {subTab === 'reviews' && (
        <div style={styles.tableWrapper}>
          {reviews.length === 0 && !loading ? (
            <div style={styles.empty}>No review actions yet.</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  {['#', 'Run ID', 'File', 'Phase', 'Action', 'Feedback', 'Reviewed At'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reviews.map(r => (
                  <tr key={r.id} style={styles.tr}>
                    <td style={{ ...styles.td, color: '#9e9e9e' }}>{r.id}</td>
                    <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 11 }}>{r.run_id.slice(0, 8)}…</td>
                    <td style={styles.td}>{r.file_name ?? '—'}</td>
                    <td style={styles.td}>{r.phase}</td>
                    <td style={styles.td}><ActionBadge action={r.action} /></td>
                    <td style={{ ...styles.td, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.feedback ?? ''}>
                      {r.feedback ? r.feedback : <span style={{ color: '#9e9e9e' }}>—</span>}
                    </td>
                    <td style={{ ...styles.td, whiteSpace: 'nowrap', color: '#616161' }}>{fmt(r.reviewed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    running:        { bg: '#e3f2fd', color: '#1565c0' },
    awaiting_review:{ bg: '#fff8e1', color: '#f57f17' },
    completed:      { bg: '#e8f5e9', color: '#2e7d32' },
    failed:         { bg: '#ffebee', color: '#c62828' },
  };
  const s = map[status] ?? { bg: '#f5f5f5', color: '#616161' };
  return <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{status}</span>;
}

function ActionBadge({ action }: { action: string }) {
  const approved = action === 'approved';
  return (
    <span style={{
      background: approved ? '#e8f5e9' : '#ffebee',
      color: approved ? '#2e7d32' : '#c62828',
      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
    }}>
      {action}
    </span>
  );
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString();
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { padding: '4px 0' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title: { fontSize: 16, fontWeight: 700, color: '#1a1a2e' },
  refreshBtn: { background: 'none', border: '1px solid #bdbdbd', borderRadius: 4, padding: '3px 10px', fontSize: 12, color: '#424242', cursor: 'pointer' },
  hint: { fontSize: 12, color: '#757575', marginBottom: 16, marginTop: 4, lineHeight: 1.5 },
  subTabBar: { display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #e0e0e0', paddingBottom: 0 },
  subTab: {
    background: 'none', border: 'none', padding: '8px 16px', fontSize: 13, fontWeight: 500,
    color: '#616161', cursor: 'pointer', borderBottom: '2px solid transparent', marginBottom: -2,
  },
  subTabActive: {
    background: 'none', border: 'none', padding: '8px 16px', fontSize: 13, fontWeight: 600,
    color: '#1565c0', cursor: 'pointer', borderBottom: '2px solid #1565c0', marginBottom: -2,
  },
  errorBanner: { background: '#ffebee', color: '#c62828', borderRadius: 4, padding: '8px 12px', fontSize: 13, marginBottom: 12 },
  empty: { fontSize: 13, color: '#9e9e9e', padding: '24px 0', textAlign: 'center' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#757575', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e0e0e0', whiteSpace: 'nowrap' },
  td: { padding: '9px 10px', borderBottom: '1px solid #f5f5f5', verticalAlign: 'middle', fontSize: 13 },
  tr: {},
};
