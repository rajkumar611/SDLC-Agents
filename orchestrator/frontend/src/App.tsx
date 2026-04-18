import React, { useState, useCallback } from 'react';
import { UploadForm } from './components/UploadForm';
import { PhaseStepper } from './components/PhaseStepper';
import { RequirementsView } from './components/RequirementsView';
import { DesignView } from './components/DesignView';
import { QAView } from './components/QAView';
import { DevView } from './components/DevView';
import { ReviewGate } from './components/ReviewGate';
import { UploadsPanel } from './components/UploadsPanel';
import { AuditView } from './components/AuditView';
import { GovernanceView } from './components/GovernanceView';
import { GuardrailsView } from './components/GuardrailsView';
import { useSSE } from './hooks/useSSE';
import { useElapsedTimer } from './hooks/useElapsedTimer';
import { PipelineRun, RequirementsOutput, DesignOutput, QAOutput, DevOutput, SSEUpdate, Phase, RunStatus } from './types/pipeline';
import { generateRequirementsPDF } from './utils/generateRequirementsPDF';
import { generateDesignPDF } from './utils/generateDesignPDF';
import { generateQAPDF } from './utils/generateQAPDF';
import { generatePipelineRunReport } from './utils/generatePipelineRunReport';

type AppTab = 'pipeline' | 'uploads' | 'audit' | 'governance' | 'guardrails';
const PHASE_ORDER = ['requirements', 'design', 'qa', 'dev'];

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('pipeline');
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<PipelineRun | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  // Tracks explicit user expand/collapse overrides; undefined = use auto-collapse logic
  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean | undefined>>({});

  // On mount — auto-reconnect to any active run so a page refresh doesn't lose state
  React.useEffect(() => {
    fetch('/pipeline/active')
      .then(r => r.json())
      .then((data: { run: PipelineRun | null }) => {
        if (data.run && !runId) {
          setRunId(data.run.id);
          setRun(data.run);
          setActiveTab('pipeline');
        }
      })
      .catch(() => { /* no active run or network error — start fresh */ });
  }, []);

  React.useEffect(() => {
    if (!uploadNotice) return;
    const t = setTimeout(() => setUploadNotice(null), 8000);
    return () => clearTimeout(t);
  }, [uploadNotice]);

  const handleSSE = useCallback((update: SSEUpdate) => {
    if (update.snapshot && update.run) {
      setRun(update.run);
      const savedName = update.run.file_path
        ? update.run.file_path.replace(/\\/g, '/').split('/').pop() ?? null
        : null;
      if (savedName) { setUploadedFileName(savedName); setUploadNotice(savedName); }
      return;
    }
    setRun((prev) => {
      if (!prev) return prev;
      const next: PipelineRun = { ...prev };
      if (update.status === 'running' || update.status === 'rerunning') next.status = 'running';
      if (update.status === 'awaiting_review') {
        next.status = 'awaiting_review';
        if (update.phase === 'requirements' && update.output) next.requirements_output = JSON.stringify(update.output);
        if (update.phase === 'design' && update.output) next.design_output = JSON.stringify(update.output);
        if (update.phase === 'qa' && update.output) next.qa_output = JSON.stringify(update.output);
        if (update.phase === 'dev' && update.output) next.dev_output = JSON.stringify(update.output);
      }
      if (update.status === 'pipeline_complete') next.status = 'completed';
      if (update.status === 'rejected') next.status = 'rejected';
      if (update.status === 'failed') { next.status = 'failed'; if (update.error) setPipelineError(update.error); }
      if (update.phase && update.status === 'running') {
        next.current_phase = update.phase as Phase;
        // Stamp the started_at in local state so the elapsed timer has a reference point
        const key = `${update.phase}_started_at` as keyof PipelineRun;
        if (!next[key]) (next as unknown as Record<string, unknown>)[key] = new Date().toISOString();
      }
      return next;
    });
  }, []);

  useSSE(runId, handleSSE);

  function handleStarted(id: string) {
    setPipelineError(null);
    setUploadedFileName(null);
    setUploadNotice(null);
    setCollapsedPhases({});
    setRunId(id);
    setRun({
      id, created_at: new Date().toISOString(), status: 'running' as RunStatus,
      current_phase: 'requirements' as Phase, file_name: null, file_path: null,
      requirements_output: null, design_output: null, qa_output: null, dev_output: null,
      requirements_started_at: new Date().toISOString(), requirements_completed_at: null,
      design_started_at: null, design_completed_at: null,
      qa_started_at: null, qa_completed_at: null,
      dev_started_at: null, dev_completed_at: null, completed_at: null,
    });
    setActiveTab('pipeline');
  }

  async function handleRetry() {
    if (!runId) return;
    setPipelineError(null);
    await fetch(`/pipeline/${runId}/retry`, { method: 'POST' });
  }

  function isPhaseCollapsed(phase: string): boolean {
    if (!run) return false;
    if (collapsedPhases[phase] !== undefined) return collapsedPhases[phase]!;
    const currentIdx = PHASE_ORDER.indexOf(run.current_phase);
    const phaseIdx = PHASE_ORDER.indexOf(phase);
    return phaseIdx < currentIdx;
  }

  function togglePhase(phase: string) {
    setCollapsedPhases(prev => ({ ...prev, [phase]: !isPhaseCollapsed(phase) }));
  }

  // Live elapsed timer — updates every 5 seconds while a phase is running.
  // Use a client-side ref so the timer always starts from the moment the
  // phase began in this browser session, not a DB timestamp that may be stale.
  const [phaseStartRef, setPhaseStartRef] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (run?.status === 'running') {
      setPhaseStartRef(new Date().toISOString());
    } else {
      setPhaseStartRef(null);
    }
  }, [run?.status === 'running' ? run?.current_phase : null, run?.status]);
  const elapsed = useElapsedTimer(phaseStartRef, 5000);

  const reqOutput = parseOutput<RequirementsOutput>(run?.requirements_output ?? null);
  const designOutput = parseOutput<DesignOutput>(run?.design_output ?? null);
  const qaOutput = parseOutput<QAOutput>(run?.qa_output ?? null);
  const devOutput = parseOutput<DevOutput>(run?.dev_output ?? null);

  return (
    <div style={styles.page}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <div style={styles.topBarTitle}>SDLC Agent Pipeline — FinServe OMS</div>
        {run && (
          <div style={styles.topBarMeta}>
            <span style={styles.runLabel}>Run: <code style={styles.code}>{run.id.slice(0, 8)}…</code></span>
            <button
              style={run.status === 'failed' ? styles.retryBtnActive : styles.retryBtnDisabled}
              onClick={run.status === 'failed' ? handleRetry : undefined}
              disabled={run.status !== 'failed'}
              title={run.status === 'failed' ? `Retry ${phaseLabel(run.current_phase)} phase` : 'No failure — retry not needed'}
            >
              ↺ Retry {phaseLabel(run.current_phase)}
            </button>
            {(() => {
              const canStart = run.status === 'completed' || run.status === 'rejected' || run.status === 'failed';
              const tip = canStart ? 'Start a new pipeline run' : 'Cannot start a new run — current run must be completed, rejected, or failed first';
              return (
                <button
                  style={canStart ? styles.newRunBtn : styles.newRunBtnDisabled}
                  disabled={!canStart}
                  title={tip}
                  onClick={canStart ? () => { setRunId(null); setRun(null); setUploadedFileName(null); setUploadNotice(null); setCollapsedPhases({}); } : undefined}
                >
                  + New Run
                </button>
              );
            })()}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar}>
        {(['pipeline', 'uploads', 'audit', 'governance', 'guardrails'] as AppTab[]).map(tab => (
          <button key={tab} style={activeTab === tab ? styles.tabActive : styles.tab} onClick={() => setActiveTab(tab)}>
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div style={styles.content}>

        {/* ── PIPELINE TAB ── */}
        {activeTab === 'pipeline' && (
          <>
            {!runId || !run ? (
              <UploadForm onStarted={handleStarted} />
            ) : (
              <>
                {uploadNotice && (
                  <div style={styles.uploadNoticeBanner}>
                    <span><strong>File saved:</strong>&nbsp;<code style={styles.uploadNoticeCode}>{uploadNotice}</code></span>
                    <button style={styles.uploadNoticeDismiss} onClick={() => setUploadNotice(null)}>✕</button>
                  </div>
                )}

                <PhaseStepper currentPhase={run.current_phase} status={run.status} />

                {run.status === 'running' && (
                  <div style={styles.processingBanner}>
                    <div style={styles.processingRow}>
                      <span style={styles.processingLabel}>{phaseLabel(run.current_phase)} Agent is processing</span>
                      {elapsed && <span style={styles.elapsedBadge}>⏱ {elapsed}</span>}
                      <span style={styles.dotsWrapper}>
                        {[0, 0.2, 0.4].map((delay, i) => (
                          <span key={i} style={{ ...styles.dot, animationDelay: `${delay}s` }}>•</span>
                        ))}
                      </span>
                    </div>
                    <div style={styles.progressTrack}><div style={styles.progressBar} /></div>
                  </div>
                )}

                {run.status === 'rejected' && run.current_phase === 'requirements' && (
                  <div style={styles.rejectedBanner}>
                    <strong>Requirements Rejected.</strong>
                    <span style={{ marginLeft: 8 }}>Reason recorded in Audit Trail. Upload a corrected document to start a new run.</span>
                  </div>
                )}

                {run.status === 'failed' && (
                  <div style={styles.failedBanner}>
                    <strong>Pipeline failed.</strong>
                    <span style={{ marginLeft: 8 }}>{pipelineError ?? 'Check the orchestrator backend logs for details.'}</span>
                    <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.8 }}>— Use the ↺ Retry button above to re-run this phase.</span>
                  </div>
                )}

                {run.status === 'completed' && (
                  <div style={styles.completedBanner}>
                    <span>✓ Pipeline complete. All phases approved.</span>
                    {reqOutput && designOutput && qaOutput && (
                      <button style={styles.runReportBtn} onClick={() => generatePipelineRunReport(run, reqOutput, designOutput, qaOutput)}>
                        Export Full Pipeline Report
                      </button>
                    )}
                  </div>
                )}

                {/* Requirements phase */}
                {reqOutput && (
                  <PhaseSection
                    title="Requirements Analysis"
                    phase="requirements"
                    collapsed={isPhaseCollapsed('requirements')}
                    onToggle={() => togglePhase('requirements')}
                    completedAt={run.requirements_completed_at}
                    summary={`${reqOutput.requirements?.length ?? 0} requirements extracted`}
                    onExport={() => generateRequirementsPDF(run, reqOutput)}
                    showReviewGate={run.status === 'awaiting_review' && run.current_phase === 'requirements'}
                    reviewGate={
                      <ReviewGate
                        runId={run.id} phase="requirements"
                        readyForHandoff={reqOutput.pipeline_metadata.ready_for_handoff}
                        handoffBlockedReason={reqOutput.pipeline_metadata.handoff_blocked_reason}
                        onAction={() => {}}
                      />
                    }
                  >
                    <RequirementsView output={reqOutput} />
                  </PhaseSection>
                )}

                {/* Design phase */}
                {designOutput && (
                  <PhaseSection
                    title="Solution Design"
                    phase="design"
                    collapsed={isPhaseCollapsed('design')}
                    onToggle={() => togglePhase('design')}
                    completedAt={run.design_completed_at}
                    summary={`${designOutput.design?.backend?.api_endpoints?.length ?? 0} endpoints · ${designOutput.design?.database?.tables?.length ?? 0} tables`}
                    onExport={() => generateDesignPDF(run, designOutput)}
                    showReviewGate={run.status === 'awaiting_review' && run.current_phase === 'design'}
                    reviewGate={
                      <ReviewGate
                        runId={run.id} phase="design"
                        readyForHandoff={designOutput.pipeline_metadata.ready_for_handoff}
                        handoffBlockedReason={designOutput.pipeline_metadata.handoff_blocked_reason}
                        onAction={() => {}}
                      />
                    }
                  >
                    <DesignView output={designOutput} />
                  </PhaseSection>
                )}

                {/* QA phase */}
                {qaOutput && (
                  <PhaseSection
                    title="QA Test Cases"
                    phase="qa"
                    collapsed={isPhaseCollapsed('qa')}
                    onToggle={() => togglePhase('qa')}
                    completedAt={run.qa_completed_at}
                    summary={`${qaOutput.summary?.total ?? 0} test cases`}
                    onExport={() => generateQAPDF(run, qaOutput)}
                    showReviewGate={run.status === 'awaiting_review' && run.current_phase === 'qa'}
                    reviewGate={
                      <ReviewGate
                        runId={run.id} phase="qa"
                        readyForHandoff={qaOutput.pipeline_metadata.ready_for_handoff}
                        handoffBlockedReason={qaOutput.pipeline_metadata.handoff_blocked_reason}
                        onAction={() => {}}
                      />
                    }
                  >
                    <QAView output={qaOutput} />
                  </PhaseSection>
                )}

                {/* Development phase */}
                {devOutput && (
                  <PhaseSection
                    title="Development — Code Scaffold"
                    phase="dev"
                    collapsed={isPhaseCollapsed('dev')}
                    onToggle={() => togglePhase('dev')}
                    completedAt={run.dev_completed_at}
                    summary={`${devOutput.files?.length ?? 0} files · ${(devOutput.summary?.languages_used ?? []).join(', ')}`}
                    onExport={() => window.location.href = `/pipeline/${run.id}/download`}
                    exportLabel="Download ZIP"
                    showReviewGate={run.status === 'awaiting_review' && run.current_phase === 'dev'}
                    reviewGate={
                      <ReviewGate
                        runId={run.id} phase="dev"
                        readyForHandoff={devOutput.pipeline_metadata.ready_for_handoff}
                        handoffBlockedReason={devOutput.pipeline_metadata.handoff_blocked_reason}
                        onAction={() => {}}
                      />
                    }
                  >
                    <DevView output={devOutput} runId={run.id} />
                  </PhaseSection>
                )}
              </>
            )}
          </>
        )}

        {/* ── UPLOADS TAB ── */}
        {activeTab === 'uploads' && <UploadsPanel highlightName={uploadedFileName} />}

        {/* ── AUDIT TAB ── */}
        {activeTab === 'audit' && <AuditView />}

        {/* ── GOVERNANCE TAB ── */}
        {activeTab === 'governance' && <GovernanceView />}

        {/* ── GUARDRAILS TAB ── */}
        {activeTab === 'guardrails' && <GuardrailsView />}

      </div>
    </div>
  );
}

// ── Phase Section wrapper ──────────────────────────────────────────────────

interface PhaseSectionProps {
  title: string;
  phase: string;
  collapsed: boolean;
  onToggle: () => void;
  completedAt: string | null;
  summary: string;
  onExport: () => void;
  exportLabel?: string;
  showReviewGate: boolean;
  reviewGate: React.ReactNode;
  children: React.ReactNode;
}

function PhaseSection({ title, collapsed, onToggle, completedAt, summary, onExport, exportLabel, showReviewGate, reviewGate, children }: PhaseSectionProps) {
  return (
    <div style={phaseSectionStyles.wrapper}>
      {/* Header — always visible, click to collapse/expand */}
      <div style={phaseSectionStyles.header} onClick={onToggle} role="button">
        <div style={phaseSectionStyles.headerLeft}>
          <span style={phaseSectionStyles.toggle}>{collapsed ? '▶' : '▼'}</span>
          <span style={phaseSectionStyles.title}>{title}</span>
          {completedAt && <span style={phaseSectionStyles.checkmark}>✓</span>}
          {collapsed && <span style={phaseSectionStyles.summary}>{summary}</span>}
        </div>
        <button
          style={phaseSectionStyles.exportBtn}
          onClick={(e) => { e.stopPropagation(); onExport(); }}
        >
          {exportLabel ?? 'Export PDF'}
        </button>
      </div>

      {/* Body — hidden when collapsed */}
      {!collapsed && (
        <div style={phaseSectionStyles.outputScroll}>
          {children}
        </div>
      )}

      {/* Review gate — always visible when awaiting review, even if section is collapsed */}
      {showReviewGate && reviewGate}
    </div>
  );
}

const phaseSectionStyles: Record<string, React.CSSProperties> = {
  wrapper: { marginBottom: 16, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', cursor: 'pointer', userSelect: 'none',
    borderBottom: '1px solid #f0f0f0', background: '#fafafa',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  toggle: { fontSize: 10, color: '#9e9e9e', flexShrink: 0 },
  title: { fontSize: 15, fontWeight: 700, color: '#1a1a2e' },
  checkmark: { fontSize: 13, color: '#2e7d32', fontWeight: 700 },
  summary: { fontSize: 12, color: '#757575', marginLeft: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  exportBtn: {
    background: '#1565c0', color: '#fff', border: 'none', borderRadius: 6,
    padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
  },
  outputScroll: { maxHeight: 520, overflowY: 'auto', padding: '4px 0' },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function parseOutput<T>(raw: string | null): T | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function phaseLabel(phase: string): string {
  return ({ requirements: 'Requirements', design: 'Design', qa: 'QA', dev: 'Development' } as Record<string, string>)[phase] ?? phase;
}

const TAB_LABELS: Record<AppTab, string> = {
  pipeline:    'Pipeline',
  uploads:     'Uploads',
  audit:       'Audit Trail',
  governance:  'Governance',
  guardrails:  'Guardrails',
};

// ── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f4f6f8' },

  topBar: {
    background: '#1565c0', color: '#fff', padding: '12px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  topBarTitle: { fontWeight: 700, fontSize: 15 },
  topBarMeta: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 },
  runLabel: { opacity: 0.85 },
  code: { fontFamily: 'monospace', background: 'rgba(255,255,255,0.15)', padding: '1px 5px', borderRadius: 3 },
  retryBtnActive: {
    background: '#c62828', color: '#fff', border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: 4, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  retryBtnDisabled: {
    background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)',
    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '4px 10px',
    fontSize: 12, fontWeight: 600, cursor: 'not-allowed',
  },
  newRunBtn: {
    background: 'rgba(255,255,255,0.15)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4,
    padding: '4px 10px', fontSize: 12, cursor: 'pointer',
  },
  newRunBtnDisabled: {
    background: 'transparent', color: 'rgba(255,255,255,0.25)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4,
    padding: '4px 10px', fontSize: 12, cursor: 'not-allowed',
  },

  tabBar: {
    background: '#fff', borderBottom: '2px solid #e0e0e0',
    display: 'flex', padding: '0 24px', gap: 0,
  },
  tab: {
    background: 'none', border: 'none', borderBottom: '2px solid transparent',
    padding: '12px 18px', fontSize: 13, fontWeight: 500, color: '#616161',
    cursor: 'pointer', marginBottom: -2,
  },
  tabActive: {
    background: 'none', border: 'none', borderBottom: '2px solid #1565c0',
    padding: '12px 18px', fontSize: 13, fontWeight: 700, color: '#1565c0',
    cursor: 'pointer', marginBottom: -2,
  },

  content: { flex: 1, padding: '24px', maxWidth: 980, margin: '0 auto', width: '100%' },

  uploadNoticeBanner: {
    background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9', borderRadius: 8,
    padding: '10px 14px', fontSize: 13, fontWeight: 500, marginBottom: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  uploadNoticeCode: { fontFamily: 'monospace', fontSize: 12, background: 'rgba(46,125,50,0.1)', padding: '1px 5px', borderRadius: 3 },
  uploadNoticeDismiss: { background: 'none', border: 'none', color: '#2e7d32', fontSize: 14, cursor: 'pointer', padding: '0 4px' },

  processingBanner: {
    background: '#e3f2fd', color: '#1565c0', padding: '14px 16px',
    borderRadius: 8, fontSize: 14, fontWeight: 500, marginBottom: 16,
  },
  processingRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 },
  processingLabel: { fontWeight: 600 },
  elapsedBadge: {
    background: 'rgba(21,101,192,0.12)', color: '#1565c0',
    borderRadius: 10, padding: '1px 8px', fontSize: 12, fontWeight: 600,
    fontFamily: 'monospace', marginLeft: 4,
  },
  dotsWrapper: { display: 'inline-flex', gap: 2, alignItems: 'center' },
  dot: { display: 'inline-block', fontSize: 16, animation: 'pulse-dot 1.4s ease-in-out infinite', lineHeight: 1 },
  progressTrack: { position: 'relative', height: 4, background: 'rgba(21,101,192,0.2)', borderRadius: 2, overflow: 'hidden' },
  progressBar: { position: 'absolute', top: 0, height: '100%', width: '45%', background: '#1565c0', borderRadius: 2, animation: 'progress-slide 1.6s ease-in-out infinite' },

  rejectedBanner: {
    background: '#fff3e0', color: '#e65100', padding: '12px 16px',
    borderRadius: 8, fontSize: 14, fontWeight: 500, marginBottom: 16,
    borderLeft: '4px solid #e65100',
  },
  failedBanner: {
    background: '#ffebee', color: '#c62828', padding: '12px 16px',
    borderRadius: 8, fontSize: 14, fontWeight: 500, marginBottom: 16,
  },
  completedBanner: {
    background: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: 8,
    fontSize: 14, fontWeight: 600, marginBottom: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
  },
  runReportBtn: {
    background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 6,
    padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
};
