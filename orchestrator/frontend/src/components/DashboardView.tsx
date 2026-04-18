import React, { useEffect, useState } from 'react';
import { PipelineRun } from '../types/pipeline';
import { formatDuration } from '../hooks/useElapsedTimer';

interface Props {
  activeRun: PipelineRun | null;
  onNavigateToPipeline: () => void;
}

interface RunRow {
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
  reviewed_at: string;
  file_name: string | null;
}

export function DashboardView({ activeRun, onNavigateToPipeline }: Props) {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/audit/runs').then(r => r.json()) as Promise<{ runs: RunRow[] }>,
      fetch('/audit/reviews').then(r => r.json()) as Promise<{ reviews: ReviewRow[] }>,
    ]).then(([r1, r2]) => {
      setRuns(r1.runs ?? []);
      setReviews(r2.reviews ?? []);
    }).finally(() => setLoading(false));
  }, [activeRun?.status]); // re-fetch when active run status changes

  const completedRuns = runs.filter(r => r.status === 'completed').length;
  const pendingReview = runs.filter(r => r.status === 'awaiting_review').length;
  const lastReview = reviews[0] ?? null;
  const recentRuns = runs.slice(0, 6);

  return (
    <div style={s.wrapper}>
      {/* Summary cards */}
      <div style={s.cardRow}>
        <SummaryCard
          label="Active Run"
          value={
            activeRun
              ? <StatusBadge status={activeRun.status} />
              : <span style={s.noRun}>None</span>
          }
          sub={
            activeRun
              ? `Phase: ${phaseLabel(activeRun.current_phase)}${activeRun.file_name ? ` · ${activeRun.file_name}` : ''}`
              : 'No pipeline running'
          }
          action={activeRun ? { label: 'View Pipeline →', onClick: onNavigateToPipeline } : undefined}
          accent="#1565c0"
        />
        <SummaryCard
          label="Completed Runs"
          value={<span style={s.bigNum}>{loading ? '…' : completedRuns}</span>}
          sub="Full Requirements → Design → QA cycles approved"
          accent="#2e7d32"
        />
        <SummaryCard
          label="Pending Review"
          value={<span style={{ ...s.bigNum, color: pendingReview > 0 ? '#f57f17' : '#9e9e9e' }}>{loading ? '…' : pendingReview}</span>}
          sub={pendingReview > 0 ? 'Awaiting BA / Lead decision' : 'No runs awaiting review'}
          accent="#f57f17"
        />
        <SummaryCard
          label="Last Decision"
          value={
            lastReview
              ? <ActionBadge action={lastReview.action} />
              : <span style={s.noRun}>—</span>
          }
          sub={
            lastReview
              ? `${lastReview.phase} · ${lastReview.file_name ?? lastReview.run_id.slice(0, 8)} · ${timeAgo(lastReview.reviewed_at)}`
              : 'No reviews yet'
          }
          accent={lastReview?.action === 'approved' ? '#2e7d32' : '#c62828'}
        />
      </div>

      {/* Recent runs table */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Recent Pipeline Runs</span>
          <span style={s.sectionHint}>Showing last {recentRuns.length} of {runs.length} runs</span>
        </div>

        {runs.length === 0 && !loading ? (
          <div style={s.empty}>No pipeline runs yet. Upload a requirements document to get started.</div>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Run ID', 'File', 'Status', 'Phase', 'Started', 'Req', 'Design', 'QA', 'Total'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentRuns.map(r => (
                  <tr key={r.id} style={s.tr}>
                    <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 11, color: '#9e9e9e' }}>{r.id.slice(0, 8)}…</td>
                    <td style={{ ...s.td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.file_name ?? ''}>
                      {r.file_name ?? '—'}
                    </td>
                    <td style={s.td}><StatusBadge status={r.status} /></td>
                    <td style={{ ...s.td, textTransform: 'capitalize' }}>{r.current_phase}</td>
                    <td style={{ ...s.td, whiteSpace: 'nowrap', color: '#757575', fontSize: 12 }}>{fmt(r.created_at)}</td>
                    <td style={{ ...s.td, whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>
                      {formatDuration(r.requirements_started_at, r.requirements_completed_at)}
                    </td>
                    <td style={{ ...s.td, whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>
                      {formatDuration(r.design_started_at, r.design_completed_at)}
                    </td>
                    <td style={{ ...s.td, whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>
                      {formatDuration(r.qa_started_at, r.qa_completed_at)}
                    </td>
                    <td style={{ ...s.td, whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>
                      {r.completed_at ? formatDuration(r.created_at, r.completed_at) : <span style={{ color: '#9e9e9e' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, action, accent }: {
  label: string;
  value: React.ReactNode;
  sub: string;
  action?: { label: string; onClick: () => void };
  accent: string;
}) {
  return (
    <div style={{ ...s.card, borderTop: `3px solid ${accent}` }}>
      <div style={s.cardLabel}>{label}</div>
      <div style={s.cardValue}>{value}</div>
      <div style={s.cardSub}>{sub}</div>
      {action && (
        <button style={{ ...s.cardAction, color: accent }} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    running:         { bg: '#e3f2fd', color: '#1565c0' },
    awaiting_review: { bg: '#fff8e1', color: '#f57f17' },
    completed:       { bg: '#e8f5e9', color: '#2e7d32' },
    failed:          { bg: '#ffebee', color: '#c62828' },
  };
  const c = map[status] ?? { bg: '#f5f5f5', color: '#616161' };
  const label = status === 'awaiting_review' ? 'Awaiting Review' : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span style={{ background: c.bg, color: c.color, padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
      {label}
    </span>
  );
}

function ActionBadge({ action }: { action: string }) {
  const approved = action === 'approved';
  return (
    <span style={{
      background: approved ? '#e8f5e9' : '#ffebee',
      color: approved ? '#2e7d32' : '#c62828',
      padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
    }}>
      {approved ? 'Approved' : 'Rejected'}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function phaseLabel(phase: string): string {
  return ({ requirements: 'Requirements', design: 'Design', qa: 'QA' } as Record<string, string>)[phase] ?? phase;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  wrapper: { padding: '4px 0' },

  cardRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 },
  card: {
    background: '#fff', borderRadius: 8, border: '1px solid #e0e0e0',
    padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6,
  },
  cardLabel: { fontSize: 11, fontWeight: 600, color: '#757575', textTransform: 'uppercase', letterSpacing: '0.05em' },
  cardValue: { fontSize: 20, fontWeight: 700, color: '#1a1a2e', minHeight: 28, display: 'flex', alignItems: 'center' },
  cardSub: { fontSize: 12, color: '#9e9e9e', lineHeight: 1.4 },
  cardAction: { background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left', marginTop: 4 },
  bigNum: { fontSize: 28, fontWeight: 700 },
  noRun: { fontSize: 16, color: '#9e9e9e', fontWeight: 500 },

  section: { background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f0f0f0' },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#1a1a2e' },
  sectionHint: { fontSize: 12, color: '#9e9e9e' },

  empty: { padding: '32px 16px', textAlign: 'center', fontSize: 13, color: '#9e9e9e' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#757575', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #f0f0f0', whiteSpace: 'nowrap', background: '#fafafa' },
  td: { padding: '9px 12px', borderBottom: '1px solid #f5f5f5', verticalAlign: 'middle' },
  tr: {},
};
