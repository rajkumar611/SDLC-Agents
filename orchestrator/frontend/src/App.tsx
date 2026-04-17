import React, { useState, useCallback } from 'react';
import { UploadForm } from './components/UploadForm';
import { PhaseStepper } from './components/PhaseStepper';
import { RequirementsView } from './components/RequirementsView';
import { DesignView } from './components/DesignView';
import { QAView } from './components/QAView';
import { ReviewGate } from './components/ReviewGate';
import { GovernanceSection } from './components/GovernanceSection';
import { useSSE } from './hooks/useSSE';
import { UploadsPanel } from './components/UploadsPanel';
import { PipelineRun, RequirementsOutput, DesignOutput, QAOutput, SSEUpdate, Phase, RunStatus } from './types/pipeline';
import { generateRequirementsPDF } from './utils/generateRequirementsPDF';
import { generateDesignPDF } from './utils/generateDesignPDF';
import { generateQAPDF } from './utils/generateQAPDF';
import { generatePipelineRunReport } from './utils/generatePipelineRunReport';

export default function App() {
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<PipelineRun | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  // Auto-dismiss the upload notice after 8 seconds
  React.useEffect(() => {
    if (!uploadNotice) return;
    const t = setTimeout(() => setUploadNotice(null), 8000);
    return () => clearTimeout(t);
  }, [uploadNotice]);

  const handleSSE = useCallback((update: SSEUpdate) => {
    if (update.snapshot && update.run) {
      setRun(update.run);
      // Extract the saved filename from the file_path stored in the run
      const savedName = update.run.file_path
        ? update.run.file_path.replace(/\\/g, '/').split('/').pop() ?? null
        : null;
      if (savedName) {
        setUploadedFileName(savedName);
        setUploadNotice(savedName);
      }
      return;
    }
    // Merge incremental updates into run state
    setRun((prev) => {
      if (!prev) return prev;
      const next: PipelineRun = { ...prev };

      if (update.status === 'running' || update.status === 'rerunning') {
        next.status = 'running';
      }
      if (update.status === 'awaiting_review') {
        next.status = 'awaiting_review';
        if (update.phase === 'requirements' && update.output) {
          next.requirements_output = JSON.stringify(update.output);
        }
        if (update.phase === 'design' && update.output) {
          next.design_output = JSON.stringify(update.output);
        }
        if (update.phase === 'qa' && update.output) {
          next.qa_output = JSON.stringify(update.output);
        }
      }
      if (update.status === 'pipeline_complete') {
        next.status = 'completed';
      }
      if (update.status === 'failed') {
        next.status = 'failed';
        if (update.error) setPipelineError(update.error);
      }
      if (update.phase && update.status === 'running') {
        next.current_phase = update.phase as Phase;
      }
      return next;
    });
  }, []);

  useSSE(runId, handleSSE);

  function handleStarted(id: string) {
    setPipelineError(null);
    setUploadedFileName(null);
    setUploadNotice(null);
    setRunId(id);
    setRun({
      id,
      created_at: new Date().toISOString(),
      status: 'running' as RunStatus,
      current_phase: 'requirements' as Phase,
      file_name: null,
      file_path: null,
      requirements_output: null,
      design_output: null,
      qa_output: null,
      requirements_started_at: new Date().toISOString(),
      requirements_completed_at: null,
      design_started_at: null,
      design_completed_at: null,
      qa_started_at: null,
      qa_completed_at: null,
      completed_at: null,
    });
  }

  function handleReviewAction() {
    // SSE will push the updated state — no manual fetch needed
  }

  if (!runId || !run) {
    return <UploadForm onStarted={handleStarted} />;
  }

  const reqOutput = parseOutput<RequirementsOutput>(run.requirements_output);
  const designOutput = parseOutput<DesignOutput>(run.design_output);
  const qaOutput = parseOutput<QAOutput>(run.qa_output);

  return (
    <div style={styles.page}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={styles.topBarTitle}>SDLC Agent Pipeline — FinServe OMS</div>
        <div style={styles.topBarMeta}>
          Run: <code style={styles.code}>{run.id.slice(0, 8)}…</code>
          &nbsp;|&nbsp;
          <button style={styles.newRunBtn} onClick={() => { setRunId(null); setRun(null); setUploadedFileName(null); setUploadNotice(null); }}>
            + New Run
          </button>
        </div>
      </div>

      <div style={styles.content}>
        {/* Upload notice — shown for 8 s after a new file is saved */}
        {uploadNotice && (
          <div style={styles.uploadNoticeBanner}>
            <span>
              <strong>File saved to project uploads:</strong>&nbsp;
              <code style={styles.uploadNoticeCode}>{uploadNotice}</code>
            </span>
            <button style={styles.uploadNoticeDismiss} onClick={() => setUploadNotice(null)}>✕</button>
          </div>
        )}

        {/* Phase stepper */}
        <PhaseStepper currentPhase={run.current_phase} status={run.status} />

        {/* Status banner */}
        {run.status === 'running' && (
          <div style={styles.processingBanner}>
            <div style={styles.processingRow}>
              <span style={styles.processingLabel}>
                {phaseLabel(run.current_phase)} Agent is processing
              </span>
              <span style={styles.dotsWrapper}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <span key={i} style={{ ...styles.dot, animationDelay: `${delay}s` }}>•</span>
                ))}
              </span>
            </div>
            <div style={styles.progressTrack}>
              <div style={styles.progressBar} />
            </div>
          </div>
        )}

        {run.status === 'failed' && (
          <div style={styles.failedBanner}>
            <strong>Pipeline failed.</strong>
            {pipelineError
              ? <span style={{ marginLeft: 8 }}>{pipelineError}</span>
              : <span style={{ marginLeft: 8 }}>Check the orchestrator backend logs for details.</span>
            }
          </div>
        )}

        {run.status === 'completed' && (
          <div style={styles.completedBanner}>
            <span>✓ Pipeline complete. All phases approved.</span>
            {reqOutput && designOutput && qaOutput && (
              <button
                style={styles.runReportBtn}
                onClick={() => generatePipelineRunReport(run, reqOutput, designOutput, qaOutput)}
              >
                Export Full Pipeline Report
              </button>
            )}
          </div>
        )}

        {/* Requirements phase output */}
        {(run.current_phase === 'requirements' || reqOutput) && reqOutput && (
          <div style={styles.phaseSection}>
            <div style={styles.phaseSectionHeader}>
              <span>Requirements Analysis</span>
              <button
                style={styles.pdfBtn}
                onClick={() => generateRequirementsPDF(run, reqOutput)}
              >
                Export PDF
              </button>
            </div>
            <RequirementsView output={reqOutput} />

            {run.status === 'awaiting_review' && run.current_phase === 'requirements' && (
              <ReviewGate
                runId={run.id}
                phase="requirements"
                readyForHandoff={reqOutput.pipeline_metadata.ready_for_handoff}
                handoffBlockedReason={reqOutput.pipeline_metadata.handoff_blocked_reason}
                onAction={handleReviewAction}
              />
            )}
          </div>
        )}

        {/* Design phase */}
        {(run.current_phase === 'design' || designOutput) && designOutput && (
          <div style={styles.phaseSection}>
            <div style={styles.phaseSectionHeader}>
              <span>Solution Design</span>
              <button
                style={styles.pdfBtn}
                onClick={() => generateDesignPDF(run, designOutput)}
              >
                Export PDF
              </button>
            </div>
            <DesignView output={designOutput} />

            {run.status === 'awaiting_review' && run.current_phase === 'design' && (
              <ReviewGate
                runId={run.id}
                phase="design"
                readyForHandoff={designOutput.pipeline_metadata.ready_for_handoff}
                handoffBlockedReason={designOutput.pipeline_metadata.handoff_blocked_reason}
                onAction={handleReviewAction}
              />
            )}
          </div>
        )}

        {/* QA phase */}
        {(run.current_phase === 'qa' || qaOutput) && qaOutput && (
          <div style={styles.phaseSection}>
            <div style={styles.phaseSectionHeader}>
              <span>QA Test Cases</span>
              <button
                style={styles.pdfBtn}
                onClick={() => generateQAPDF(run, qaOutput)}
              >
                Export PDF
              </button>
            </div>
            <QAView output={qaOutput} />

            {run.status === 'awaiting_review' && run.current_phase === 'qa' && (
              <ReviewGate
                runId={run.id}
                phase="qa"
                readyForHandoff={qaOutput.pipeline_metadata.ready_for_handoff}
                handoffBlockedReason={qaOutput.pipeline_metadata.handoff_blocked_reason}
                onAction={handleReviewAction}
              />
            )}
          </div>
        )}

        {/* Governance section — always visible */}
        <GovernanceSection />

        {/* Uploads panel — always visible; highlights the file just saved */}
        <UploadsPanel highlightName={uploadedFileName} />
      </div>
    </div>
  );
}

function parseOutput<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    requirements: 'Requirements',
    design: 'Design',
    qa: 'QA',
  };
  return map[phase] ?? phase;
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  topBar: {
    background: '#1565c0',
    color: '#fff',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarTitle: { fontWeight: 700, fontSize: 15 },
  topBarMeta: { fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 },
  code: { fontFamily: 'monospace', background: 'rgba(255,255,255,0.15)', padding: '1px 5px', borderRadius: 3 },
  newRunBtn: {
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 12,
    cursor: 'pointer',
  },
  content: { flex: 1, padding: '24px', maxWidth: 960, margin: '0 auto', width: '100%' },
  processingBanner: {
    background: '#e3f2fd',
    color: '#1565c0',
    padding: '14px 16px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 24,
  },
  processingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  processingLabel: {
    fontWeight: 600,
  },
  dotsWrapper: {
    display: 'inline-flex',
    gap: 2,
    alignItems: 'center',
  },
  dot: {
    display: 'inline-block',
    fontSize: 16,
    animation: 'pulse-dot 1.4s ease-in-out infinite',
    lineHeight: 1,
  },
  progressTrack: {
    position: 'relative' as const,
    height: 4,
    background: 'rgba(21,101,192,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    position: 'absolute' as const,
    top: 0,
    height: '100%',
    width: '45%',
    background: '#1565c0',
    borderRadius: 2,
    animation: 'progress-slide 1.6s ease-in-out infinite',
  },
  failedBanner: {
    background: '#ffebee',
    color: '#c62828',
    padding: '12px 16px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 24,
  },
  completedBanner: {
    background: '#e8f5e9',
    color: '#2e7d32',
    padding: '12px 16px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  runReportBtn: {
    background: '#2e7d32',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  phaseSection: { marginBottom: 32 },
  phaseSectionHeader: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1a1a2e',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pdfBtn: {
    background: '#1565c0',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  placeholder: {
    background: '#fff',
    borderRadius: 8,
    padding: '32px',
    textAlign: 'center',
    color: '#9e9e9e',
    fontSize: 14,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  uploadNoticeBanner: {
    background: '#e8f5e9',
    color: '#2e7d32',
    border: '1px solid #c8e6c9',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  uploadNoticeCode: {
    fontFamily: 'monospace',
    fontSize: 12,
    background: 'rgba(46,125,50,0.1)',
    padding: '1px 5px',
    borderRadius: 3,
  },
  uploadNoticeDismiss: {
    background: 'none',
    border: 'none',
    color: '#2e7d32',
    fontSize: 14,
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
    flexShrink: 0,
  },
};
