import React, { useState } from 'react';
import { DevOutput, DevFile } from '../types/pipeline';

interface Props {
  output: DevOutput;
  runId: string;
}

export function DevView({ output, runId }: Props) {
  const [selectedFile, setSelectedFile] = useState<DevFile | null>(output.files?.[0] ?? null);
  const [copying, setCopying] = useState(false);

  const files = output.files ?? [];
  const structure = output.project_structure;
  const setup = output.setup_instructions ?? [];
  const envVars = output.environment_variables ?? [];
  const summary = output.summary;

  function handleDownload() {
    window.location.href = `/pipeline/${runId}/download`;
  }

  async function handleCopy(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopying(true);
      setTimeout(() => setCopying(false), 1500);
    } catch { /* ignore */ }
  }

  const langColor: Record<string, string> = {
    typescript: '#3178c6', javascript: '#f7df1e', python: '#3572A5',
    sql: '#e38c00', json: '#292929', yaml: '#cb171e', markdown: '#083fa1',
    html: '#e34c26', css: '#563d7c', shell: '#89e051', sh: '#89e051',
  };

  function langBadge(lang: string) {
    const bg = langColor[lang.toLowerCase()] ?? '#616161';
    return (
      <span style={{ background: bg, color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.03em' }}>
        {lang}
      </span>
    );
  }

  return (
    <div style={styles.root}>

      {/* ── Summary bar ── */}
      <div style={styles.summaryBar}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryNum}>{summary?.total_files ?? files.length}</span>
          <span style={styles.summaryLabel}>Files</span>
        </div>
        <div style={styles.divider} />
        <div style={styles.summaryItem}>
          <span style={styles.summaryNum}>{(summary?.languages_used ?? []).join(', ') || '—'}</span>
          <span style={styles.summaryLabel}>Languages</span>
        </div>
        <div style={styles.divider} />
        <div style={styles.summaryItem}>
          <span style={styles.summaryNum}>{(summary?.frameworks_used ?? []).join(', ') || '—'}</span>
          <span style={styles.summaryLabel}>Frameworks</span>
        </div>
        <div style={{ flex: 1 }} />
        <button style={styles.downloadBtn} onClick={handleDownload}>
          ⬇ Download ZIP
        </button>
      </div>

      {/* ── Test coverage note ── */}
      {summary?.test_coverage_note && (
        <div style={styles.coverageNote}>
          <strong>Test coverage:</strong> {summary.test_coverage_note}
        </div>
      )}

      {/* ── Main panel: file list + code viewer ── */}
      <div style={styles.mainPanel}>

        {/* File list */}
        <div style={styles.fileList}>
          <div style={styles.fileListHeader}>Files ({files.length})</div>
          {files.map((f, i) => (
            <div
              key={i}
              style={{
                ...styles.fileItem,
                background: selectedFile?.path === f.path ? '#e3f2fd' : 'transparent',
                borderLeft: selectedFile?.path === f.path ? '3px solid #1565c0' : '3px solid transparent',
              }}
              onClick={() => setSelectedFile(f)}
            >
              <div style={styles.filePath}>{f.path}</div>
              <div style={styles.fileItemMeta}>
                {langBadge(f.language)}
              </div>
            </div>
          ))}
        </div>

        {/* Code viewer */}
        <div style={styles.codePanel}>
          {selectedFile ? (
            <>
              <div style={styles.codePanelHeader}>
                <div style={styles.codePanelPath}>
                  {langBadge(selectedFile.language)}
                  <span style={styles.codePanelPathText}>{selectedFile.path}</span>
                </div>
                <button
                  style={styles.copyBtn}
                  onClick={() => handleCopy(selectedFile.content)}
                >
                  {copying ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              {selectedFile.description && (
                <div style={styles.fileDesc}>{selectedFile.description}</div>
              )}
              <pre style={styles.codeBlock}>
                <code>{selectedFile.content}</code>
              </pre>
            </>
          ) : (
            <div style={styles.emptyCode}>Select a file to view its content.</div>
          )}
        </div>
      </div>

      {/* ── Project structure ── */}
      {structure && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Project Structure</div>
          {structure.description && <p style={styles.sectionDesc}>{structure.description}</p>}
          <pre style={styles.treeBlock}>{structure.tree?.join('\n') ?? ''}</pre>
        </div>
      )}

      {/* ── Setup instructions ── */}
      {setup.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Setup Instructions</div>
          <ol style={styles.setupList}>
            {setup.map((step, i) => (
              <li key={i} style={styles.setupItem}>
                <code style={styles.setupCode}>{step}</code>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ── Environment variables ── */}
      {envVars.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Environment Variables</div>
          <table style={styles.envTable}>
            <thead>
              <tr>
                {['Name', 'Description', 'Example', 'Required'].map(h => (
                  <th key={h} style={styles.envTh}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {envVars.map((v, i) => (
                <tr key={i} style={styles.envTr}>
                  <td style={styles.envTd}><code style={styles.envName}>{v.name}</code></td>
                  <td style={styles.envTd}>{v.description}</td>
                  <td style={{ ...styles.envTd, fontFamily: 'monospace', fontSize: 12, color: '#616161' }}>{v.example}</td>
                  <td style={styles.envTd}>
                    <span style={{ color: v.required ? '#c62828' : '#616161', fontWeight: v.required ? 600 : 400 }}>
                      {v.required ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { padding: '12px 16px' },

  summaryBar: {
    display: 'flex', alignItems: 'center', gap: 0,
    background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: 8,
    padding: '10px 16px', marginBottom: 12, flexWrap: 'wrap', rowGap: 8,
  },
  summaryItem: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '0 16px' },
  summaryNum: { fontSize: 13, fontWeight: 700, color: '#1a1a2e' },
  summaryLabel: { fontSize: 11, color: '#757575', marginTop: 1 },
  divider: { width: 1, height: 32, background: '#e0e0e0' },
  downloadBtn: {
    background: '#1565c0', color: '#fff', border: 'none', borderRadius: 6,
    padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },

  coverageNote: {
    background: '#f3e5f5', color: '#4a148c', border: '1px solid #ce93d8',
    borderRadius: 6, padding: '8px 14px', fontSize: 12, marginBottom: 12,
  },

  mainPanel: {
    display: 'flex', gap: 0, border: '1px solid #e0e0e0', borderRadius: 8,
    overflow: 'hidden', marginBottom: 16, minHeight: 400,
  },

  fileList: {
    width: 220, flexShrink: 0, borderRight: '1px solid #e0e0e0',
    background: '#fafafa', overflowY: 'auto', maxHeight: 520,
  },
  fileListHeader: {
    padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#757575',
    textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e0e0e0',
    background: '#f0f0f0',
  },
  fileItem: {
    padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0',
    transition: 'background 0.1s',
  },
  filePath: { fontSize: 12, fontFamily: 'monospace', color: '#212121', wordBreak: 'break-all', marginBottom: 3 },
  fileItemMeta: { display: 'flex', gap: 4 },

  codePanel: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#1e1e1e' },
  codePanelHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 14px', background: '#252526', borderBottom: '1px solid #333',
    flexShrink: 0,
  },
  codePanelPath: { display: 'flex', alignItems: 'center', gap: 8 },
  codePanelPathText: { fontSize: 12, fontFamily: 'monospace', color: '#d4d4d4' },
  copyBtn: {
    background: 'rgba(255,255,255,0.1)', color: '#d4d4d4',
    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4,
    padding: '3px 10px', fontSize: 11, cursor: 'pointer',
  },
  fileDesc: {
    padding: '6px 14px', background: '#252526', color: '#9e9e9e',
    fontSize: 11, fontStyle: 'italic', borderBottom: '1px solid #333', flexShrink: 0,
  },
  codeBlock: {
    flex: 1, margin: 0, padding: '14px 16px', overflowY: 'auto', overflowX: 'auto',
    fontSize: 12, lineHeight: 1.6, color: '#d4d4d4', fontFamily: 'monospace',
    background: '#1e1e1e', maxHeight: 460, whiteSpace: 'pre',
  },
  emptyCode: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#757575', fontSize: 13 },

  section: { marginBottom: 16, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '14px 16px' },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 },
  sectionDesc: { fontSize: 12, color: '#616161', margin: '0 0 8px' },
  treeBlock: {
    margin: 0, padding: '10px 14px', background: '#f5f5f5', borderRadius: 6,
    fontSize: 12, fontFamily: 'monospace', color: '#212121', overflowX: 'auto',
    lineHeight: 1.7, whiteSpace: 'pre',
  },

  setupList: { margin: 0, paddingLeft: 20 },
  setupItem: { marginBottom: 6 },
  setupCode: {
    background: '#f5f5f5', padding: '2px 8px', borderRadius: 4,
    fontSize: 12, fontFamily: 'monospace', color: '#212121',
  },

  envTable: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  envTh: {
    padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700,
    color: '#757575', textTransform: 'uppercase', letterSpacing: '0.04em',
    borderBottom: '2px solid #e0e0e0',
  },
  envTr: {},
  envTd: { padding: '7px 10px', borderBottom: '1px solid #f5f5f5', verticalAlign: 'top' },
  envName: { background: '#e8f5e9', color: '#1b5e20', padding: '1px 6px', borderRadius: 3, fontSize: 12 },
};
