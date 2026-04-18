import React from 'react';
import { Phase, RunStatus } from '../types/pipeline';

const PHASES: { key: Phase; label: string }[] = [
  { key: 'requirements', label: 'Requirements' },
  { key: 'design', label: 'Design' },
  { key: 'qa', label: 'QA Test Cases' },
  { key: 'dev', label: 'Development' },
];

interface Props {
  currentPhase: Phase;
  status: RunStatus;
}

export function PhaseStepper({ currentPhase, status }: Props) {
  const currentIdx = PHASES.findIndex((p) => p.key === currentPhase);

  return (
    <div style={styles.wrapper}>
      {PHASES.map((phase, idx) => {
        const isDone = idx < currentIdx || (idx === currentIdx && status === 'completed');
        const isActive = idx === currentIdx && status !== 'completed';
        const isPending = idx > currentIdx;

        return (
          <React.Fragment key={phase.key}>
            <div style={styles.step}>
              <div
                style={{
                  ...styles.circle,
                  background: isDone ? '#2e7d32' : isActive ? '#1565c0' : '#9e9e9e',
                  color: '#fff',
                }}
              >
                {isDone ? '✓' : idx + 1}
              </div>
              <div style={styles.label}>
                <div
                  style={{
                    ...styles.phaseName,
                    color: isDone ? '#2e7d32' : isActive ? '#1565c0' : '#9e9e9e',
                    fontWeight: isActive ? 700 : 400,
                  }}
                >
                  {phase.label}
                </div>
                <div style={styles.phaseStatus}>
                  {isDone
                    ? 'Approved'
                    : isActive
                    ? statusLabel(status)
                    : isPending
                    ? 'Waiting'
                    : ''}
                </div>
              </div>
            </div>
            {idx < PHASES.length - 1 && (
              <div
                style={{
                  ...styles.connector,
                  background: idx < currentIdx ? '#2e7d32' : '#e0e0e0',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function statusLabel(status: RunStatus): string {
  switch (status) {
    case 'running': return 'Processing...';
    case 'awaiting_review': return 'Awaiting Review';
    case 'failed': return 'Failed';
    default: return '';
  }
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    padding: '24px 32px',
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: 24,
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
  },
  phaseName: {
    fontSize: 14,
    lineHeight: 1.2,
  },
  phaseStatus: {
    fontSize: 11,
    color: '#757575',
    marginTop: 2,
  },
  connector: {
    flex: 1,
    height: 2,
    margin: '0 16px',
    minWidth: 40,
  },
};
