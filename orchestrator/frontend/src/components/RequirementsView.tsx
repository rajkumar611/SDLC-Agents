import React from 'react';
import { RequirementsOutput, Requirement } from '../types/pipeline';

interface Props {
  output: RequirementsOutput;
}

const STATUS_STYLES: Record<string, { background: string; color: string; label: string }> = {
  CLEAR:         { background: '#e8f5e9', color: '#2e7d32', label: 'Clear' },
  AMBIGUOUS:     { background: '#fff8e1', color: '#f57f17', label: 'Ambiguous' },
  INCOMPLETE:    { background: '#fff3e0', color: '#e65100', label: 'Incomplete' },
  SECURITY_FLAG: { background: '#fce4ec', color: '#b71c1c', label: 'Security Flag' },
};

export function RequirementsView({ output }: Props) {
  const { requirements, summary, overall_clarifying_questions, pipeline_metadata } = output;

  return (
    <div style={styles.wrapper}>
      {/* Summary bar */}
      <div style={styles.summaryBar}>
        <SummaryChip label="Total" value={summary.total} color="#1565c0" />
        <SummaryChip label="Clear" value={summary.clear} color="#2e7d32" />
        <SummaryChip label="Ambiguous" value={summary.ambiguous} color="#f57f17" />
        <SummaryChip label="Incomplete" value={summary.incomplete} color="#e65100" />
        <SummaryChip label="Security Flags" value={summary.security_flags} color="#b71c1c" />
      </div>

      {/* Handoff status */}
      <div
        style={{
          ...styles.handoffBanner,
          background: pipeline_metadata.ready_for_handoff ? '#e8f5e9' : '#fff3e0',
          borderColor: pipeline_metadata.ready_for_handoff ? '#a5d6a7' : '#ffcc80',
        }}
      >
        <span style={{ color: pipeline_metadata.ready_for_handoff ? '#2e7d32' : '#e65100', fontWeight: 600 }}>
          {pipeline_metadata.ready_for_handoff
            ? '✓ Ready for handoff to Design phase'
            : `⚠ Handoff blocked: ${pipeline_metadata.handoff_blocked_reason}`}
        </span>
      </div>

      {/* Requirements list */}
      <div style={styles.list}>
        {requirements.map((req) => (
          <RequirementCard key={req.id} req={req} />
        ))}
      </div>

      {/* Overall clarifying questions */}
      {overall_clarifying_questions.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Overall Clarifying Questions</div>
          <ol style={styles.questionList}>
            {overall_clarifying_questions.map((q, i) => (
              <li key={i} style={styles.questionItem}>{q}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function RequirementCard({ req }: { req: Requirement }) {
  const statusStyle = STATUS_STYLES[req.status] ?? STATUS_STYLES.CLEAR;

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <span style={styles.reqId}>{req.id}</span>
        <span style={{ ...styles.statusBadge, background: statusStyle.background, color: statusStyle.color }}>
          {statusStyle.label}
        </span>
      </div>

      <p style={styles.description}>{req.description}</p>

      <div style={styles.criteria}>
        <CriteriaRow label="Given" text={req.acceptance_criteria.given} />
        <CriteriaRow label="When" text={req.acceptance_criteria.when} />
        <CriteriaRow label="Then" text={req.acceptance_criteria.then} />
      </div>

      {req.finding && (
        <div style={styles.finding}>
          <span style={styles.findingLabel}>Finding:</span> {req.finding}
        </div>
      )}

      {req.clarifying_questions.length > 0 && (
        <div style={styles.questions}>
          <div style={styles.questionsLabel}>Clarifying Questions</div>
          <ul style={styles.questionList}>
            {req.clarifying_questions.map((q, i) => (
              <li key={i} style={styles.questionItem}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CriteriaRow({ label, text }: { label: string; text: string }) {
  return (
    <div style={styles.criteriaRow}>
      <span style={styles.criteriaLabel}>{label}</span>
      <span style={styles.criteriaText}>{text}</span>
    </div>
  );
}

function SummaryChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={styles.chip}>
      <span style={{ ...styles.chipValue, color }}>{value}</span>
      <span style={styles.chipLabel}>{label}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: 16 },
  summaryBar: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    background: '#fff',
    padding: '16px 20px',
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  chip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 64,
  },
  chipValue: { fontSize: 22, fontWeight: 700, lineHeight: 1 },
  chipLabel: { fontSize: 11, color: '#757575', marginTop: 4 },
  handoffBanner: {
    padding: '12px 16px',
    borderRadius: 8,
    border: '1px solid',
    fontSize: 13,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    background: '#fff',
    borderRadius: 8,
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  reqId: { fontWeight: 700, fontSize: 13, color: '#424242', fontFamily: 'monospace' },
  statusBadge: {
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
  },
  description: { fontSize: 14, color: '#212121', marginBottom: 14, lineHeight: 1.5 },
  criteria: {
    background: '#f8f9fa',
    borderRadius: 6,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 12,
  },
  criteriaRow: { display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.5 },
  criteriaLabel: {
    fontWeight: 700,
    color: '#1565c0',
    minWidth: 44,
    flexShrink: 0,
  },
  criteriaText: { color: '#424242' },
  finding: {
    background: '#fff8e1',
    borderRadius: 6,
    padding: '10px 12px',
    fontSize: 13,
    color: '#424242',
    marginBottom: 10,
    lineHeight: 1.5,
  },
  findingLabel: { fontWeight: 600, color: '#f57f17' },
  questions: { marginTop: 4 },
  questionsLabel: { fontSize: 12, fontWeight: 600, color: '#757575', marginBottom: 6 },
  questionList: { paddingLeft: 18 },
  questionItem: { fontSize: 13, color: '#424242', lineHeight: 1.6 },
  section: {
    background: '#fff',
    borderRadius: 8,
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  sectionTitle: { fontWeight: 700, fontSize: 14, color: '#1565c0', marginBottom: 12 },
};
