import React, { useState } from 'react';
import { DeployOutput, DevFile } from '../types/pipeline';

interface Props {
  output: DeployOutput;
  runId: string;
}

export function DeployView({ output, runId }: Props) {
  const [selectedFile, setSelectedFile] = useState<DevFile | null>(output.files?.[0] ?? null);
  const [copying, setCopying] = useState(false);

  const files = output.files ?? [];
  const setup = output.setup_instructions ?? [];
  const summary = output.summary;

  function handleDownload() {
    window.location.href = `/pipeline/${runId}/deploy-download`;
  }

  async function handleCopy(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopying(true);
      setTimeout(() => setCopying(false), 1500);
    } catch { /* ignore */ }
  }

  const langColor: Record<string, string> = {
    dockerfile: '#384d54', yaml: '#cb171e', shell: '#89e051', markdown: '#083fa1',
  };

  function langBadge(lang: string) {
    const bg = langColor[lang.toLowerCase()] ?? '#616161';
    return (
      <span style={{ background: bg, color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
        {lang}
      </span>
    );
  }

  return (
    <div style={styles.root}>

      {/* Summary bar */}
      <div style={styles.summaryBar}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryNum}>{files.length}</span>
          <span style={styles.summaryLabel}>Files</span>
        </div>
        <div style={styles.divider} />
        <div style={styles.summaryItem}>
          <span style={styles.summaryNum}>{(summary?.services ?? []).join(', ') || '—'}</span>
          <span style={styles.summaryLabel}>Services</span>
        </div>
        <div style={styles.divider} />
        <div style={styles.summaryItem}>
          <span style={styles.summaryNum}>{(summary?.base_images ?? []).join(', ') || '—'}</span>
          <span style={styles.summaryLabel}>Docker Images</span>
        </div>
        <div style={{ flex: 1 }} />
        <button style={styles.downloadBtn} onClick={handleDownload}>
          ⬇ Download Deploy ZIP
        </button>
      </div>

      {summary?.notes && (
        <div style={styles.notes}><strong>Notes:</strong> {summary.notes}</div>
      )}

      {/* File viewer */}
      <div style={styles.mainPanel}>
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
              <div style={{ marginTop: 3 }}>{langBadge(f.language)}</div>
            </div>
          ))}
        </div>

        <div style={styles.codePanel}>
          {selectedFile ? (
            <>
              <div style={styles.codePanelHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {langBadge(selectedFile.language)}
                  <span style={styles.codePanelPathText}>{selectedFile.path}</span>
                </div>
                <button style={styles.copyBtn} onClick={() => handleCopy(selectedFile.content)}>
                  {copying ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              {selectedFile.description && (
                <div style={styles.fileDesc}>{selectedFile.description}</div>
              )}
              <pre style={styles.codeBlock}><code>{selectedFile.content}</code></pre>
            </>
          ) : (
            <div style={styles.emptyCode}>Select a file to view its content.</div>
          )}
        </div>
      </div>

      {/* Setup instructions */}
      {setup.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>How to Run</div>
          <ol style={styles.setupList}>
            {setup.map((step, i) => (
              <li key={i} style={styles.setupItem}>
                <code style={styles.setupCode}>{step}</code>
              </li>
            ))}
          </ol>
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
  summaryItem: { display: 'flex', flexDirection: 'column', padding: '0 16px' },
  summaryNum: { fontSize: 13, fontWeight: 700, color: '#1a1a2e' },
  summaryLabel: { fontSize: 11, color: '#757575', marginTop: 1 },
  divider: { width: 1, height: 32, background: '#e0e0e0' },
  downloadBtn: {
    background: '#1565c0', color: '#fff', border: 'none', borderRadius: 6,
    padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  notes: {
    background: '#e8f5e9', color: '#1b5e20', border: '1px solid #c8e6c9',
    borderRadius: 6, padding: '8px 14px', fontSize: 12, marginBottom: 12,
  },
  mainPanel: {
    display: 'flex', border: '1px solid #e0e0e0', borderRadius: 8,
    overflow: 'hidden', marginBottom: 16, minHeight: 360,
  },
  fileList: {
    width: 200, flexShrink: 0, borderRight: '1px solid #e0e0e0',
    background: '#fafafa', overflowY: 'auto',
  },
  fileListHeader: {
    padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#757575',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid #e0e0e0', background: '#f0f0f0',
  },
  fileItem: {
    padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0',
  },
  filePath: { fontSize: 12, fontFamily: 'monospace', color: '#212121', wordBreak: 'break-all' },
  codePanel: { flex: 1, display: 'flex', flexDirection: 'column', background: '#1e1e1e' },
  codePanelHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 14px', background: '#252526', borderBottom: '1px solid #333', flexShrink: 0,
  },
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
    background: '#1e1e1e', maxHeight: 420, whiteSpace: 'pre',
  },
  emptyCode: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#757575', fontSize: 13 },
  section: { background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '14px 16px' },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 },
  setupList: { margin: 0, paddingLeft: 20 },
  setupItem: { marginBottom: 6 },
  setupCode: { background: '#f5f5f5', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace' },
};
