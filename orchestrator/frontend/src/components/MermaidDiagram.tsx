import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });

let idCounter = 0;

interface Props {
  chart: string;
  title?: string;
}

export function MermaidDiagram({ chart, title }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useRef(`mermaid-${++idCounter}`);

  useEffect(() => {
    if (!ref.current || !chart.trim()) return;

    mermaid.render(id.current, chart)
      .then(({ svg }) => {
        if (ref.current) {
          ref.current.innerHTML = svg;
          setError(null);
        }
      })
      .catch((err: unknown) => {
        setError(`Diagram render error: ${String(err)}`);
      });
  }, [chart]);

  if (error) {
    return (
      <div style={styles.errorBox}>
        <div style={styles.errorTitle}>Could not render diagram</div>
        <pre style={styles.code}>{chart}</pre>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      {title && <div style={styles.title}>{title}</div>}
      <div ref={ref} style={styles.diagram} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: '#fafafa',
    border: '1px solid #e0e0e0',
    borderRadius: 8,
    padding: '16px',
    overflowX: 'auto',
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    color: '#757575',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  diagram: { minHeight: 60 },
  errorBox: {
    background: '#fff3e0',
    border: '1px solid #ffcc80',
    borderRadius: 8,
    padding: 16,
  },
  errorTitle: { fontSize: 12, color: '#e65100', fontWeight: 600, marginBottom: 8 },
  code: {
    fontSize: 11,
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    color: '#424242',
    margin: 0,
  },
};
