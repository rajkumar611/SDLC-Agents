import React, { useEffect, useState, useCallback } from 'react';

interface UploadEntry {
  name: string;
  size: number;
  savedAt: string;
}

interface Props {
  /** Filename just saved — used to briefly highlight the new entry */
  highlightName?: string | null;
}

export function UploadsPanel({ highlightName }: Props) {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUploads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/pipeline/uploads');
      const data = await res.json() as { uploads: UploadEntry[] };
      setUploads(data.uploads ?? []);
    } catch {
      setError('Could not load uploads.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUploads(); }, [fetchUploads]);

  // Re-fetch whenever a new file is highlighted (i.e., a new upload just happened)
  useEffect(() => {
    if (highlightName) fetchUploads();
  }, [highlightName, fetchUploads]);

  async function handleDelete(name: string) {
    if (!window.confirm(`Delete "${name}"?\n\nIf a pipeline run is still using this file, re-running the Requirements phase will fail.`)) return;
    setDeletingName(name);
    setError(null);
    try {
      const res = await fetch(`/pipeline/uploads/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Delete failed');
      }
      setUploads((prev) => prev.filter((u) => u.name !== name));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingName(null);
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.title}>Project Uploads</span>
        <button style={styles.refreshBtn} onClick={fetchUploads} disabled={loading} title="Refresh list">
          {loading ? '…' : '↻ Refresh'}
        </button>
      </div>

      <p style={styles.hint}>
        One copy of each uploaded document is saved inside the project for pipeline re-runs.
        Files are git-ignored.
      </p>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {!loading && uploads.length === 0 && (
        <div style={styles.empty}>No uploaded files yet.</div>
      )}

      {uploads.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, textAlign: 'left' }}>File name</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Size</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>Saved at</th>
              <th style={{ ...styles.th, textAlign: 'center' }}></th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((u) => {
              const isNew = u.name === highlightName;
              return (
                <tr key={u.name} style={isNew ? styles.newRow : undefined}>
                  <td style={styles.td}>
                    {isNew && <span style={styles.newBadge}>new</span>}
                    <span style={styles.filename}>{u.name}</span>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right', color: '#757575' }}>
                    {formatSize(u.size)}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right', color: '#757575', whiteSpace: 'nowrap' }}>
                    {new Date(u.savedAt).toLocaleString()}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <button
                      style={styles.deleteBtn}
                      onClick={() => handleDelete(u.name)}
                      disabled={deletingName === u.name}
                      title={`Delete ${u.name}`}
                    >
                      {deletingName === u.name ? '…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    padding: '20px 24px',
    marginTop: 24,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingBottom: 12,
    borderBottom: '1px solid #e0e0e0',
  },
  title: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1a1a2e',
  },
  refreshBtn: {
    background: 'none',
    border: '1px solid #bdbdbd',
    borderRadius: 4,
    padding: '3px 10px',
    fontSize: 12,
    color: '#424242',
    cursor: 'pointer',
  },
  hint: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 14,
    marginTop: 8,
    lineHeight: 1.5,
  },
  errorBanner: {
    background: '#ffebee',
    color: '#c62828',
    borderRadius: 4,
    padding: '8px 12px',
    fontSize: 12,
    marginBottom: 10,
  },
  empty: {
    fontSize: 13,
    color: '#9e9e9e',
    padding: '12px 0',
    textAlign: 'center',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    fontSize: 11,
    fontWeight: 600,
    color: '#757575',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    padding: '4px 8px 8px',
    borderBottom: '1px solid #eeeeee',
  },
  td: {
    padding: '8px 8px',
    borderBottom: '1px solid #f5f5f5',
    verticalAlign: 'middle',
  },
  filename: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#212121',
    wordBreak: 'break-all' as const,
  },
  newRow: {
    background: '#f0f7ff',
  },
  newBadge: {
    background: '#1565c0',
    color: '#fff',
    borderRadius: 3,
    padding: '1px 5px',
    fontSize: 10,
    fontWeight: 700,
    marginRight: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  deleteBtn: {
    background: '#ffebee',
    color: '#c62828',
    border: '1px solid #ffcdd2',
    borderRadius: 4,
    padding: '3px 10px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
