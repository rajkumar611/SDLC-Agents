import { useState, useEffect } from 'react';

/**
 * SQLite datetime('now') returns 'YYYY-MM-DD HH:MM:SS' — UTC but with no
 * timezone marker. JavaScript's Date constructor treats strings without a
 * timezone as LOCAL time, which adds a 12-hour offset in NZ (UTC+12).
 * This function appends 'Z' when there is no timezone marker so the
 * timestamp is always parsed as UTC regardless of the local timezone.
 */
function parseTs(ts: string): number {
  if (ts.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(ts)) {
    return new Date(ts).getTime();            // already has timezone info
  }
  return new Date(ts.replace(' ', 'T') + 'Z').getTime(); // SQLite format → UTC
}

function fmtSeconds(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Returns a formatted elapsed-time string (e.g. "2m 15s") that updates
 * every `intervalMs` milliseconds while `startedAt` is non-null.
 * Returns null when startedAt is null (phase not running).
 */
export function useElapsedTimer(
  startedAt: string | null,
  intervalMs = 5000,
): string | null {
  const [elapsed, setElapsed] = useState<string | null>(null);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(null);
      return;
    }

    function compute() {
      const diff = Math.floor((Date.now() - parseTs(startedAt!)) / 1000);
      if (diff < 0) { setElapsed('0s'); return; }
      setElapsed(fmtSeconds(diff));
    }

    compute();
    const id = setInterval(compute, intervalMs);
    return () => clearInterval(id);
  }, [startedAt, intervalMs]);

  return elapsed;
}

/** Compute a static duration string between two timestamps. */
export function formatDuration(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return '—';
  const diff = Math.floor((parseTs(endIso) - parseTs(startIso)) / 1000);
  if (diff <= 0) return '—';
  return fmtSeconds(diff);
}

/**
 * Sum of agent processing time across completed phases only.
 * Excludes time spent waiting for human review.
 */
export function agentProcessingTime(run: {
  requirements_started_at: string | null;
  requirements_completed_at: string | null;
  design_started_at: string | null;
  design_completed_at: string | null;
  qa_started_at: string | null;
  qa_completed_at: string | null;
  dev_started_at?: string | null;
  dev_completed_at?: string | null;
  deploy_started_at?: string | null;
  deploy_completed_at?: string | null;
}): string {
  const phases: [string | null, string | null][] = [
    [run.requirements_started_at,      run.requirements_completed_at],
    [run.design_started_at,            run.design_completed_at],
    [run.qa_started_at,                run.qa_completed_at],
    [run.dev_started_at ?? null,       run.dev_completed_at ?? null],
    [run.deploy_started_at ?? null,    run.deploy_completed_at ?? null],
  ];
  let total = 0;
  let anyPhase = false;
  for (const [start, end] of phases) {
    if (!start || !end) continue;
    const diff = Math.floor((parseTs(end) - parseTs(start)) / 1000);
    if (diff > 0) { total += diff; anyPhase = true; }
  }
  if (!anyPhase) return '—';
  return fmtSeconds(total);
}
