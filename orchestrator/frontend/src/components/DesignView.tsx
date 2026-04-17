import React from 'react';
import { DesignOutput } from '../types/pipeline';
import { MermaidDiagram } from './MermaidDiagram';

interface Props {
  output: DesignOutput;
}

export function DesignView({ output }: Props) {
  const { design, summary, design_decisions, open_questions, pipeline_metadata } = output;

  return (
    <div style={styles.wrapper}>

      {/* Summary bar */}
      <div style={styles.summaryBar}>
        <SummaryChip label="API Endpoints" value={summary.total_api_endpoints} />
        <SummaryChip label="DB Tables" value={summary.total_tables} />
        <SummaryChip label="Components" value={summary.total_components} />
        <SummaryChip label="Wireframes" value={summary.total_wireframes} />
        <SummaryChip label="User Flows" value={summary.total_user_flows} />
      </div>

      {/* Handoff status */}
      <div style={{
        ...styles.handoffBanner,
        background: pipeline_metadata.ready_for_handoff ? '#e8f5e9' : '#fff3e0',
        borderColor: pipeline_metadata.ready_for_handoff ? '#a5d6a7' : '#ffcc80',
      }}>
        <span style={{ color: pipeline_metadata.ready_for_handoff ? '#2e7d32' : '#e65100', fontWeight: 600 }}>
          {pipeline_metadata.ready_for_handoff
            ? '✓ Ready for handoff to QA phase'
            : `⚠ Handoff blocked: ${pipeline_metadata.handoff_blocked_reason}`}
        </span>
      </div>

      {/* System Overview Diagram */}
      {design.diagrams.system_overview_mermaid && (
        <Section title="System Overview">
          <MermaidDiagram chart={design.diagrams.system_overview_mermaid} title="System Architecture" />
        </Section>
      )}

      {/* Backend */}
      <Section title="Backend Design">
        <InfoRow label="Architecture" value={design.backend.architecture_style} />
        <InfoRow label="Tech Stack" value={design.backend.tech_stack.join(' · ')} />

        {design.backend.services.length > 0 && (
          <div style={styles.subSection}>
            <div style={styles.subTitle}>Services</div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <Th>Service</Th><Th>Responsibility</Th><Th>Dependencies</Th>
                </tr>
              </thead>
              <tbody>
                {design.backend.services.map((s, i) => (
                  <tr key={i} style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                    <Td bold>{s.name}</Td>
                    <Td>{s.responsibility}</Td>
                    <Td>{s.dependencies.join(', ') || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {design.backend.api_endpoints.length > 0 && (
          <div style={styles.subSection}>
            <div style={styles.subTitle}>API Endpoints</div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <Th>Method</Th><Th>Path</Th><Th>Description</Th><Th>Auth</Th>
                </tr>
              </thead>
              <tbody>
                {design.backend.api_endpoints.map((ep, i) => (
                  <tr key={i} style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                    <Td><MethodBadge method={ep.method} /></Td>
                    <Td><code style={styles.codePath}>{ep.path}</code></Td>
                    <Td>{ep.description}</Td>
                    <Td>{ep.auth_required ? '🔒 Yes' : 'No'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Database */}
      <Section title="Database Design">
        <InfoRow label="Type" value={design.database.type} />
        <InfoRow label="Engine" value={design.database.engine} />

        {design.database.relationships.length > 0 && (
          <div style={styles.subSection}>
            <div style={styles.subTitle}>Relationships</div>
            <table style={styles.table}>
              <thead>
                <tr><Th>From</Th><Th>Relationship</Th><Th>To</Th><Th>Description</Th></tr>
              </thead>
              <tbody>
                {design.database.relationships.map((r, i) => (
                  <tr key={i} style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                    <Td bold>{r.from}</Td>
                    <Td><span style={styles.relType}>{r.type}</span></Td>
                    <Td bold>{r.to}</Td>
                    <Td>{r.description}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {design.database.tables.map((table) => (
          <div key={table.name} style={styles.subSection}>
            <div style={styles.tableHeader}>
              <span style={styles.tableName}>{table.name}</span>
              <span style={styles.tablePurpose}>{table.purpose}</span>
            </div>
            <table style={styles.table}>
              <thead>
                <tr><Th>Column</Th><Th>Type</Th><Th>Constraints</Th><Th>Description</Th></tr>
              </thead>
              <tbody>
                {table.columns.map((col, i) => (
                  <tr key={i} style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                    <Td><code style={styles.colName}>{col.name}</code></Td>
                    <Td><code style={styles.colType}>{col.type}</code></Td>
                    <Td><span style={styles.constraint}>{col.constraints}</span></Td>
                    <Td>{col.description}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {design.database.erd_mermaid && (
          <div style={styles.subSection}>
            <MermaidDiagram chart={design.database.erd_mermaid} title="Entity Relationship Diagram" />
          </div>
        )}
      </Section>

      {/* Frontend */}
      <Section title="Frontend Design">
        <InfoRow label="Architecture" value={design.frontend.architecture_style} />
        <InfoRow label="Tech Stack" value={design.frontend.tech_stack.join(' · ')} />

        {design.frontend.components.length > 0 && (
          <div style={styles.subSection}>
            <div style={styles.subTitle}>Components</div>
            <table style={styles.table}>
              <thead>
                <tr><Th>Component</Th><Th>Purpose</Th><Th>Parent</Th></tr>
              </thead>
              <tbody>
                {design.frontend.components.map((c, i) => (
                  <tr key={i} style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                    <Td bold>{c.name}</Td>
                    <Td>{c.purpose}</Td>
                    <Td>{c.parent ?? '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {design.frontend.user_flows.map((flow, i) => (
          <div key={i} style={styles.subSection}>
            <div style={styles.subTitle}>User Flow: {flow.name}</div>
            <ol style={styles.stepList}>
              {flow.steps.map((step, j) => (
                <li key={j} style={styles.stepItem}>{step}</li>
              ))}
            </ol>
            {flow.flow_mermaid && (
              <div style={{ marginTop: 12 }}>
                <MermaidDiagram chart={flow.flow_mermaid} />
              </div>
            )}
          </div>
        ))}

        {design.frontend.wireframes.map((wf, i) => (
          <div key={i} style={styles.subSection}>
            <div style={styles.subTitle}>Wireframe: {wf.screen}</div>
            <div style={styles.wireframeDesc}>{wf.description}</div>
            <pre style={styles.ascii}>{wf.ascii_layout}</pre>
          </div>
        ))}

        {design.diagrams.component_hierarchy_mermaid && (
          <div style={styles.subSection}>
            <MermaidDiagram chart={design.diagrams.component_hierarchy_mermaid} title="Component Hierarchy" />
          </div>
        )}
      </Section>

      {/* Design Decisions */}
      {design_decisions.length > 0 && (
        <Section title="Design Decisions">
          {design_decisions.map((d, i) => (
            <div key={i} style={styles.decisionCard}>
              <div style={styles.decisionTitle}>{d.decision}</div>
              <div style={styles.decisionRationale}>{d.rationale}</div>
              {d.alternatives_considered.length > 0 && (
                <div style={styles.alternatives}>
                  Alternatives considered: {d.alternatives_considered.join(' · ')}
                </div>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* Open Questions */}
      {open_questions.length > 0 && (
        <Section title="Open Questions">
          {open_questions.map((q, i) => (
            <div key={i} style={styles.questionCard}>
              <div style={styles.questionText}>Q{i + 1}: {q.question}</div>
              <div style={styles.questionImpact}><strong>Impact:</strong> {q.impact}</div>
              <div style={styles.questionRaisedBy}>Raised by: {q.raised_by}</div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={sectionStyles.wrapper}>
      <div style={sectionStyles.header}>{title}</div>
      <div style={sectionStyles.body}>{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={styles.th}>{children}</th>;
}

function Td({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return <td style={{ ...styles.td, fontWeight: bold ? 600 : 400 }}>{children}</td>;
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    GET:    { bg: '#e8f5e9', color: '#2e7d32' },
    POST:   { bg: '#e3f2fd', color: '#1565c0' },
    PUT:    { bg: '#fff8e1', color: '#f57f17' },
    PATCH:  { bg: '#fff3e0', color: '#e65100' },
    DELETE: { bg: '#fce4ec', color: '#b71c1c' },
  };
  const c = colors[method.toUpperCase()] ?? { bg: '#f5f5f5', color: '#616161' };
  return (
    <span style={{ background: c.bg, color: c.color, padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
      {method}
    </span>
  );
}

function SummaryChip({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.chip}>
      <span style={styles.chipValue}>{value}</span>
      <span style={styles.chipLabel}>{label}</span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const sectionStyles: Record<string, React.CSSProperties> = {
  wrapper: { background: '#fff', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: 16 },
  header: { background: '#1565c0', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 20px' },
  body: { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 },
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: 16 },
  summaryBar: {
    display: 'flex', gap: 12, flexWrap: 'wrap',
    background: '#fff', padding: '16px 20px', borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  chip: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 72 },
  chipValue: { fontSize: 22, fontWeight: 700, color: '#1565c0', lineHeight: 1 },
  chipLabel: { fontSize: 11, color: '#757575', marginTop: 4 },
  handoffBanner: { padding: '12px 16px', borderRadius: 8, border: '1px solid', fontSize: 13 },
  infoRow: { display: 'flex', gap: 12, alignItems: 'baseline', fontSize: 13 },
  infoLabel: { fontWeight: 700, color: '#424242', minWidth: 100, flexShrink: 0 },
  infoValue: { color: '#212121' },
  subSection: { marginTop: 8 },
  subTitle: { fontSize: 12, fontWeight: 700, color: '#1565c0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { background: '#f5f5f5', padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#424242', borderBottom: '1px solid #e0e0e0' },
  td: { padding: '8px 12px', color: '#212121', borderBottom: '1px solid #f5f5f5', verticalAlign: 'top' },
  rowEven: {},
  rowOdd: { background: '#fafafa' },
  codePath: { fontFamily: 'monospace', fontSize: 12, background: '#f5f5f5', padding: '1px 5px', borderRadius: 3 },
  colName: { fontFamily: 'monospace', fontSize: 12, color: '#1565c0' },
  colType: { fontFamily: 'monospace', fontSize: 12, color: '#6a1b9a' },
  constraint: { fontSize: 11, color: '#e65100' },
  relType: { background: '#e3f2fd', color: '#1565c0', padding: '2px 7px', borderRadius: 10, fontSize: 11, fontWeight: 600 },
  tableHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  tableName: { fontWeight: 700, fontSize: 13, fontFamily: 'monospace', color: '#1a1a2e' },
  tablePurpose: { fontSize: 12, color: '#757575' },
  stepList: { paddingLeft: 20, margin: 0 },
  stepItem: { fontSize: 13, color: '#424242', lineHeight: 1.8 },
  wireframeDesc: { fontSize: 12, color: '#757575', marginBottom: 8 },
  ascii: {
    fontFamily: 'monospace', fontSize: 12, background: '#f8f9fa',
    border: '1px solid #e0e0e0', borderRadius: 6, padding: '12px 16px',
    whiteSpace: 'pre', overflowX: 'auto', margin: 0, lineHeight: 1.5,
  },
  decisionCard: {
    background: '#f8f9fa', borderRadius: 6, padding: '12px 14px',
    borderLeft: '3px solid #1565c0',
  },
  decisionTitle: { fontWeight: 700, fontSize: 13, color: '#212121', marginBottom: 4 },
  decisionRationale: { fontSize: 13, color: '#424242', lineHeight: 1.5, marginBottom: 4 },
  alternatives: { fontSize: 12, color: '#757575' },
  questionCard: {
    background: '#fff8e1', borderRadius: 6, padding: '12px 14px',
    borderLeft: '3px solid #f57f17',
  },
  questionText: { fontWeight: 600, fontSize: 13, color: '#212121', marginBottom: 6 },
  questionImpact: { fontSize: 13, color: '#424242', marginBottom: 4 },
  questionRaisedBy: { fontSize: 11, color: '#9e9e9e' },
};
