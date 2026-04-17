import React, { useState, useRef } from 'react';

interface Props {
  onStarted: (runId: string) => void;
}

export function UploadForm({ onStarted }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);

    const form = new FormData();
    form.append('document', file);

    try {
      const res = await fetch('/pipeline/start', { method: 'POST', body: form });
      const data = await res.json() as { run_id?: string; error?: string };

      if (!res.ok || !data.run_id) {
        throw new Error(data.error ?? 'Failed to start pipeline');
      }

      onStarted(data.run_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>SDLC Agent Pipeline</div>
          <div style={styles.subtitle}>FinServe Order Management System</div>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.uploadArea} onClick={() => inputRef.current?.click()}>
            <div style={styles.uploadIcon}>📄</div>
            <div style={styles.uploadText}>
              {file ? file.name : 'Click to upload a requirements document'}
            </div>
            <div style={styles.uploadHint}>PDF or DOCX · Max 10MB</div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx"
              style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button
            type="submit"
            disabled={!file || loading}
            style={{
              ...styles.button,
              opacity: !file || loading ? 0.5 : 1,
              cursor: !file || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Starting pipeline...' : 'Start Pipeline'}
          </button>
        </form>

        <div style={styles.pipelineInfo}>
          <span style={styles.badge}>Requirements</span>
          <span style={styles.arrow}>→</span>
          <span style={styles.badge}>Design</span>
          <span style={styles.arrow}>→</span>
          <span style={styles.badge}>QA Test Cases</span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
    padding: '48px 40px',
    width: '100%',
    maxWidth: 540,
  },
  header: {
    textAlign: 'center',
    marginBottom: 36,
  },
  logo: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1565c0',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#757575',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  uploadArea: {
    border: '2px dashed #90caf9',
    borderRadius: 8,
    padding: '40px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    background: '#f8fbff',
    transition: 'border-color 0.2s',
  },
  uploadIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 15,
    color: '#424242',
    marginBottom: 6,
    wordBreak: 'break-all',
  },
  uploadHint: {
    fontSize: 12,
    color: '#9e9e9e',
  },
  error: {
    background: '#ffebee',
    color: '#c62828',
    padding: '10px 14px',
    borderRadius: 6,
    fontSize: 13,
  },
  button: {
    background: '#1565c0',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '14px 24px',
    fontSize: 15,
    fontWeight: 600,
    width: '100%',
  },
  pipelineInfo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
  },
  badge: {
    background: '#e3f2fd',
    color: '#1565c0',
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 500,
  },
  arrow: {
    color: '#9e9e9e',
    fontSize: 14,
  },
};
