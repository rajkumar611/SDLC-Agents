import React, { useState } from 'react';
import { QAOutput, QATestCase, TestPriority } from '../types/pipeline';

interface Props {
  output: QAOutput;
}

const CATEGORIES: { key: keyof QAOutput['test_suite']; label: string; color: string }[] = [
  { key: 'functional', label: 'Functional',  color: '#1565c0' },
  { key: 'database',   label: 'Database',    color: '#6a1b9a' },
  { key: 'ui',         label: 'UI',          color: '#00695c' },
  { key: 'security',   label: 'Security',    color: '#b71c1c' },
  { key: 'edge_cases', label: 'Edge Cases',  color: '#e65100' },
];

const PRIORITY_STYLE: Record<TestPriority, { bg: string; color: string }> = {
  HIGH:   { bg: '#fce4ec', color: '#b71c1c' },
  MEDIUM: { bg: '#fff3e0', color: '#e65100' },
  LOW:    { bg: '#f1f8e9', color: '#33691e' },
};

export function QAView({ output }: Props) {
  const { test_suite, summary, traceability_matrix, coverage_gaps, pipeline_metadata } = output;
  const [activeTab, setActiveTab] = useState<keyof QAOutput['test_suite']>('functional');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeCases = test_suite[activeTab];

  return (
    <div style={styles.wrapper}>

      {/* Summary bar */}
      <div style={styles.summaryBar}>
        <SummaryChip label="Total" value={summary.total} color="#1a1a2e" />
        <SummaryChip label="Functional" value={summary.functional} color="#1565c0" />
        <SummaryChip label="Database" value={summary.database} color="#6a1b9a" />
        <SummaryChip label="UI" value={summary.ui} color="#00695c" />
        <SummaryChip label="Security" value={summary.security} color="#b71c1c" />
        <SummaryChip label="Edge Cases" value={summary.edge_cases} color="#e65100" />
      </div>

      {/* Handoff status */}
      <div style={{
        ...styles.handoffBanner,
        background: pipeline_metadata.ready_for_handoff ? '#e8f5e9' : '#fff3e0',
        borderColor: pipeline_metadata.ready_for_handoff ? '#a5d6a7' : '#ffcc80',
      }}>
        <span style={{ color: pipeline_metadata.ready_for_handoff ? '#2e7d32' : '#e65100', fontWeight: 600 }}>
          {pipeline_metadata.ready_for_handoff
            ? '✓ Stage 1 pipeline complete — test cases ready for review'
            : `⚠ Handoff blocked: ${pipeline_metadata.handoff_blocked_reason}`}
        </span>
      </div>

      {/* Category tabs */}
      <div style={styles.tabs}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveTab(cat.key)}
            style={{
              ...styles.tab,
              background: activeTab === cat.key ? cat.color : '#fff',
              color: activeTab === cat.key ? '#fff' : cat.color,
              borderColor: cat.color,
            }}
          >
            {cat.label}
            <span style={{
              ...styles.tabCount,
              background: activeTab === cat.key ? 'rgba(255,255,255,0.25)' : cat.color,
              color: activeTab === cat.key ? '#fff' : '#fff',
            }}>
              {summary[cat.key === 'edge_cases' ? 'edge_cases' : cat.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Test cases */}
      <div style={styles.caseList}>
        {activeCases.length === 0 ? (
          <div style={styles.empty}>No test cases in this category.</div>
        ) : (
          activeCases.map((tc) => (
            <TestCaseCard
              key={tc.id}
              tc={tc}
              expanded={expandedId === tc.id}
              onToggle={() => setExpandedId(expandedId === tc.id ? null : tc.id)}
            />
          ))
        )}
      </div>

      {/* Traceability matrix */}
      {traceability_matrix.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Traceability Matrix</div>
          <table style={styles.table}>
            <thead>
              <tr>
                <Th>Component</Th>
                <Th>Type</Th>
                <Th>Test Cases</Th>
              </tr>
            </thead>
            <tbody>
              {traceability_matrix.map((row, i) => (
                <tr key={i} style={i % 2 === 0 ? {} : { background: '#fafafa' }}>
                  <Td><code style={styles.component}>{row.component}</code></Td>
                  <Td><span style={styles.compType}>{row.component_type}</span></Td>
                  <Td>{row.test_case_ids.join(', ')}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Coverage gaps */}
      {coverage_gaps.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Coverage Gaps</div>
          {coverage_gaps.map((gap, i) => (
            <div key={i} style={styles.gapCard}>
              <div style={styles.gapArea}>{gap.area}</div>
              <div style={styles.gapReason}><strong>Reason:</strong> {gap.reason}</div>
              <div style={styles.gapRec}><strong>Recommendation:</strong> {gap.recommendation}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TestCaseCard({ tc, expanded, onToggle }: { tc: QATestCase; expanded: boolean; onToggle: () => void }) {
  const p = PRIORITY_STYLE[tc.priority] ?? PRIORITY_STYLE.MEDIUM;

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader} onClick={onToggle}>
        <div style={styles.cardLeft}>
          <span style={styles.tcId}>{tc.id}</span>
          <span style={{ ...styles.priorityBadge, background: p.bg, color: p.color }}>
            {tc.priority}
          </span>
          <span style={styles.tcTitle}>{tc.title}</span>
        </div>
        <span style={styles.toggle}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={styles.cardBody}>
          {tc.preconditions && (
            <FieldRow label="Preconditions" value={tc.preconditions} />
          )}

          <div style={styles.fieldLabel}>Steps</div>
          <ol style={styles.stepList}>
            {tc.steps.map((step, i) => (
              <li key={i} style={styles.stepItem}>{step}</li>
            ))}
          </ol>

          <FieldRow label="Expected Result" value={tc.expected_result} highlight />

          {tc.linked_api_endpoint && <FieldRow label="API Endpoint" value={tc.linked_api_endpoint} mono />}
          {tc.linked_requirement && <FieldRow label="Requirement" value={tc.linked_requirement} mono />}
          {tc.linked_table && <FieldRow label="DB Table" value={tc.linked_table} mono />}
          {tc.linked_constraint && <FieldRow label="Constraint" value={tc.linked_constraint} mono />}
          {tc.linked_screen && <FieldRow label="Screen" value={tc.linked_screen} />}
          {tc.linked_user_flow && <FieldRow label="User Flow" value={tc.linked_user_flow} />}
          {tc.attack_vector && <FieldRow label="Attack Vector" value={tc.attack_vector} danger />}
          {tc.edge_type && <FieldRow label="Edge Type" value={tc.edge_type} />}
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value, highlight, mono, danger }: {
  label: string; value: string; highlight?: boolean; mono?: boolean; danger?: boolean;
}) {
  return (
    <div style={styles.fieldRow}>
      <span style={styles.fieldLabel}>{label}</span>
      <span style={{
        ...styles.fieldValue,
        background: highlight ? '#e8f5e9' : danger ? '#fce4ec' : 'transparent',
        color: highlight ? '#2e7d32' : danger ? '#b71c1c' : '#212121',
        fontFamily: mono ? 'monospace' : 'inherit',
        fontSize: mono ? 12 : 13,
        padding: highlight || danger ? '4px 8px' : 0,
        borderRadius: highlight || danger ? 4 : 0,
      }}>
        {value}
      </span>
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

function Th({ children }: { children: React.ReactNode }) {
  return <th style={styles.th}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={styles.td}>{children}</td>;
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: 16 },
  summaryBar: {
    display: 'flex', gap: 12, flexWrap: 'wrap',
    background: '#fff', padding: '16px 20px', borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  chip: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 68 },
  chipValue: { fontSize: 22, fontWeight: 700, lineHeight: 1 },
  chipLabel: { fontSize: 11, color: '#757575', marginTop: 4 },
  handoffBanner: { padding: '12px 16px', borderRadius: 8, border: '1px solid', fontSize: 13 },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tab: {
    border: '1px solid', borderRadius: 6, padding: '7px 14px',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
  },
  tabCount: {
    borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
  },
  caseList: { display: 'flex', flexDirection: 'column', gap: 6 },
  empty: { textAlign: 'center', color: '#9e9e9e', padding: 32, background: '#fff', borderRadius: 8 },
  card: {
    background: '#fff', borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', cursor: 'pointer',
    userSelect: 'none',
  },
  cardLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  tcId: { fontFamily: 'monospace', fontSize: 12, color: '#757575', fontWeight: 600 },
  priorityBadge: { padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 },
  tcTitle: { fontSize: 14, color: '#212121', fontWeight: 500 },
  toggle: { fontSize: 11, color: '#9e9e9e' },
  cardBody: {
    padding: '0 16px 16px', borderTop: '1px solid #f5f5f5',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  fieldRow: { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 },
  fieldLabel: { fontWeight: 700, color: '#424242', minWidth: 110, flexShrink: 0, fontSize: 12, paddingTop: 1 },
  fieldValue: { flex: 1, lineHeight: 1.5 },
  stepList: { paddingLeft: 20, margin: 0 },
  stepItem: { fontSize: 13, color: '#424242', lineHeight: 1.8 },
  section: {
    background: '#fff', borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '20px',
  },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#1565c0', marginBottom: 14 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    background: '#f5f5f5', padding: '8px 12px', textAlign: 'left',
    fontSize: 12, fontWeight: 700, color: '#424242', borderBottom: '1px solid #e0e0e0',
  },
  td: { padding: '8px 12px', color: '#212121', borderBottom: '1px solid #f5f5f5', verticalAlign: 'top' },
  component: { fontFamily: 'monospace', fontSize: 12, color: '#1565c0' },
  compType: { background: '#e8eaf6', color: '#283593', padding: '2px 7px', borderRadius: 10, fontSize: 11 },
  gapCard: {
    background: '#fff8e1', borderRadius: 6, padding: '12px 14px',
    borderLeft: '3px solid #f57f17', marginBottom: 8,
  },
  gapArea: { fontWeight: 700, fontSize: 13, color: '#212121', marginBottom: 4 },
  gapReason: { fontSize: 13, color: '#424242', marginBottom: 4 },
  gapRec: { fontSize: 13, color: '#424242' },
};
