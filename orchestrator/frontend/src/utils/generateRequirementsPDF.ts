import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RequirementsOutput, PipelineRun } from '../types/pipeline';

type RGB = [number, number, number];
const PRIMARY: RGB = [21, 101, 192];   // #1565c0
const SUCCESS: RGB = [46, 125, 50];    // #2e7d32
const WARNING: RGB = [230, 81, 0];     // #e65100
const DANGER:  RGB = [183, 28, 28];    // #b71c1c
const GREY:    RGB = [97, 97, 97];     // #616161

export function generateRequirementsPDF(run: PipelineRun, output: RequirementsOutput): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = margin;

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('SDLC Agent Pipeline — Requirements Report', margin, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('FinServe Order Management System', margin, 20);
  doc.text(`Run ID: ${run.id}`, pageWidth - margin, 20, { align: 'right' });

  y = 34;
  doc.setTextColor(0, 0, 0);

  // ── Run metadata ──────────────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(`Document: ${run.file_name ?? 'N/A'}`, margin, y);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, y, { align: 'right' });
  y += 6;
  doc.text(
    `Requirements Started: ${fmt(run.requirements_started_at)}   Completed: ${fmt(run.requirements_completed_at)}`,
    margin, y
  );
  y += 10;

  // ── Summary ───────────────────────────────────────────────────────────────
  sectionHeader(doc, 'Summary', y, margin, pageWidth);
  y += 8;

  const { summary } = output;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Total', 'Clear', 'Ambiguous', 'Incomplete', 'Security Flags']],
    body: [[
      summary.total,
      summary.clear,
      summary.ambiguous,
      summary.incomplete,
      summary.security_flags,
    ]],
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 11, halign: 'center', fontStyle: 'bold' },
    theme: 'grid',
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Handoff status
  const { pipeline_metadata } = output;
  const handoffColor = pipeline_metadata.ready_for_handoff ? SUCCESS : WARNING;
  doc.setFontSize(9);
  doc.setTextColor(handoffColor[0], handoffColor[1], handoffColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(
    pipeline_metadata.ready_for_handoff
      ? '✓ Ready for handoff to Design phase'
      : `⚠ Handoff blocked: ${pipeline_metadata.handoff_blocked_reason}`,
    margin, y
  );
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  // ── Requirements ──────────────────────────────────────────────────────────
  sectionHeader(doc, 'Requirements', y, margin, pageWidth);
  y += 8;

  for (const req of output.requirements) {
    if (y > 250) { doc.addPage(); y = margin; }

    const statusColor = statusToColor(req.status);
    const statusLabel = statusToLabel(req.status);

    // Requirement header row
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [[`${req.id}`, req.description, statusLabel]],
      headStyles: {
        fillColor: [240, 244, 248],
        textColor: [33, 33, 33],
        fontSize: 9,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 28, textColor: statusColor, halign: 'center', fontStyle: 'bold' },
      },
      theme: 'grid',
    });
    y = (doc as any).lastAutoTable.finalY;

    // Acceptance criteria
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      body: [
        ['Given', req.acceptance_criteria.given],
        ['When', req.acceptance_criteria.when],
        ['Then', req.acceptance_criteria.then],
      ],
      columnStyles: {
        0: { cellWidth: 22, fontStyle: 'bold', textColor: PRIMARY, halign: 'center', fontSize: 8 },
        1: { fontSize: 9 },
      },
      bodyStyles: { fontSize: 9 },
      theme: 'striped',
      alternateRowStyles: { fillColor: [248, 249, 250] },
    });
    y = (doc as any).lastAutoTable.finalY;

    // Finding
    if (req.finding) {
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        body: [['Finding', req.finding]],
        columnStyles: {
          0: { cellWidth: 22, fontStyle: 'bold', textColor: WARNING, halign: 'center', fontSize: 8 },
          1: { fontSize: 9 },
        },
        bodyStyles: { fillColor: [255, 248, 225] },
        theme: 'grid',
      });
      y = (doc as any).lastAutoTable.finalY;
    }

    // Clarifying questions
    if (req.clarifying_questions.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        body: req.clarifying_questions.map((q, i) => [`Q${i + 1}`, q]),
        columnStyles: {
          0: { cellWidth: 22, fontStyle: 'bold', textColor: GREY, halign: 'center', fontSize: 8 },
          1: { fontSize: 9 },
        },
        bodyStyles: { fillColor: [250, 250, 250] },
        theme: 'grid',
      });
      y = (doc as any).lastAutoTable.finalY;
    }

    y += 6;
  }

  // ── Overall clarifying questions ──────────────────────────────────────────
  if (output.overall_clarifying_questions.length > 0) {
    if (y > 240) { doc.addPage(); y = margin; }
    sectionHeader(doc, 'Overall Clarifying Questions', y, margin, pageWidth);
    y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      body: output.overall_clarifying_questions.map((q, i) => [`${i + 1}.`, q]),
      columnStyles: {
        0: { cellWidth: 10, fontStyle: 'bold', halign: 'center', fontSize: 9 },
        1: { fontSize: 9 },
      },
      theme: 'striped',
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Governance & Guardrails ───────────────────────────────────────────────
  doc.addPage();
  y = margin;
  sectionHeader(doc, 'Governance & Guardrails', y, margin, pageWidth);
  y += 8;

  const guardrails = [
    ['Model', 'claude-sonnet-4-6 — pinned. No switches without Build Lead approval.'],
    ['System Prompt Isolation', 'Agent system prompts are server-side only. Never exposed to frontend or users.'],
    ['Injection Detection', 'Backend scans all input for prompt injection patterns before passing to the agent.'],
    ['Human-in-the-Loop', 'No phase advances without explicit BA approval. Every decision is permanently logged.'],
    ['Audit Trail', 'All runs, outputs, approvals, and rejections stored in SQLite. Permanent record.'],
    ['PII & Security Flags', 'Input marked [CLIENT-DATA] or [PII] is flagged SECURITY_FLAG. Handoff blocked.'],
    ['Output Contract', 'Agent returns structured JSON only. Schema validated before storage.'],
    ['MAS Compliance', 'Designed for MAS Technology Risk Management Guidelines. Human oversight at every gate.'],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Control', 'Implementation']],
    body: guardrails,
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 52, fontStyle: 'bold', fontSize: 9 },
      1: { fontSize: 9 },
    },
    theme: 'striped',
    alternateRowStyles: { fillColor: [248, 249, 250] },
  });

  // ── Footer on all pages ───────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text(
      `SDLC Agent Pipeline — FinServe OMS | Confidential | Page ${i} of ${pageCount}`,
      pageWidth / 2, doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  doc.save(`requirements-report-${run.id.slice(0, 8)}.pdf`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sectionHeader(doc: jsPDF, title: string, y: number, margin: number, pageWidth: number) {
  doc.setFillColor(...PRIMARY);
  doc.rect(margin, y, pageWidth - margin * 2, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin + 3, y + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
}

function statusToLabel(status: string): string {
  const map: Record<string, string> = {
    CLEAR: 'Clear',
    AMBIGUOUS: 'Ambiguous',
    INCOMPLETE: 'Incomplete',
    SECURITY_FLAG: 'Security Flag',
  };
  return map[status] ?? status;
}

function statusToColor(status: string): [number, number, number] {
  const map: Record<string, [number, number, number]> = {
    CLEAR: SUCCESS,
    AMBIGUOUS: WARNING,
    INCOMPLETE: WARNING,
    SECURITY_FLAG: DANGER,
  };
  return map[status] ?? GREY;
}

function fmt(ts: string | null): string {
  if (!ts) return 'N/A';
  return new Date(ts).toLocaleString();
}
