import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QAOutput, QATestCase, PipelineRun } from '../types/pipeline';

type RGB = [number, number, number];
const PRIMARY: RGB = [21, 101, 192];
const SUCCESS: RGB = [46, 125, 50];
const WARNING: RGB = [230, 81, 0];
const DANGER:  RGB = [183, 28, 28];
const PURPLE:  RGB = [106, 27, 154];
const TEAL:    RGB = [0, 105, 92];
const GREY:    RGB = [97, 97, 97];

const CATEGORY_COLORS: Record<string, RGB> = {
  functional: PRIMARY,
  database:   PURPLE,
  ui:         TEAL,
  security:   DANGER,
  edge_cases: WARNING,
};

export function generateQAPDF(run: PipelineRun, output: QAOutput): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = margin;

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text('SDLC Agent Pipeline — QA Test Cases Report', margin, 12);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('FinServe Order Management System', margin, 20);
  doc.text(`Run ID: ${run.id}`, pageWidth - margin, 20, { align: 'right' });

  y = 34;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9); doc.setTextColor(...GREY);
  doc.text(`Document: ${run.file_name ?? 'N/A'}`, margin, y);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, y, { align: 'right' });
  y += 10;
  doc.setTextColor(0, 0, 0);

  // ── Summary ───────────────────────────────────────────────────────────────
  sectionHeader(doc, 'Summary', y, margin, pageWidth); y += 8;

  const { summary } = output;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Total', 'Functional', 'Database', 'UI', 'Security', 'Edge Cases']],
    body: [[summary.total, summary.functional, summary.database, summary.ui, summary.security, summary.edge_cases]],
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 11, halign: 'center', fontStyle: 'bold' },
    theme: 'grid',
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  const { pipeline_metadata } = output;
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(pipeline_metadata.ready_for_handoff ? SUCCESS : WARNING));
  doc.text(
    pipeline_metadata.ready_for_handoff
      ? '✓ Stage 1 pipeline complete — test cases ready for review'
      : `⚠ Handoff blocked: ${pipeline_metadata.handoff_blocked_reason}`,
    margin, y
  );
  y += 12;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);

  // ── Test cases by category ────────────────────────────────────────────────
  const categories: { key: keyof QAOutput['test_suite']; label: string }[] = [
    { key: 'functional',  label: 'Functional Test Cases' },
    { key: 'database',    label: 'Database Test Cases' },
    { key: 'ui',          label: 'UI Test Cases' },
    { key: 'security',    label: 'Security Test Cases' },
    { key: 'edge_cases',  label: 'Edge Case Test Cases' },
  ];

  for (const cat of categories) {
    const cases = output.test_suite[cat.key];
    if (cases.length === 0) continue;

    doc.addPage(); y = margin;
    sectionHeader(doc, cat.label, y, margin, pageWidth,
      CATEGORY_COLORS[cat.key] ?? PRIMARY); y += 8;

    for (const tc of cases) {
      if (y > 240) { doc.addPage(); y = margin; }
      y = renderTestCase(doc, tc, y, margin, pageWidth);
    }
  }

  // ── Traceability matrix ───────────────────────────────────────────────────
  if (output.traceability_matrix.length > 0) {
    doc.addPage(); y = margin;
    sectionHeader(doc, 'Traceability Matrix', y, margin, pageWidth); y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Component', 'Type', 'Test Case IDs']],
      body: output.traceability_matrix.map((r) => [
        r.component, r.component_type, r.test_case_ids.join(', '),
      ]),
      headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 }, 1: { cellWidth: 30 } },
      theme: 'striped',
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Coverage gaps ─────────────────────────────────────────────────────────
  if (output.coverage_gaps.length > 0) {
    if (y > 220) { doc.addPage(); y = margin; }
    sectionHeader(doc, 'Coverage Gaps', y, margin, pageWidth); y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Area', 'Reason', 'Recommendation']],
      body: output.coverage_gaps.map((g) => [g.area, g.reason, g.recommendation]),
      headStyles: { fillColor: [255, 243, 224], textColor: [230, 81, 0], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, fillColor: [255, 253, 248] },
      theme: 'grid',
    });
  }

  // ── Governance page ───────────────────────────────────────────────────────
  doc.addPage(); y = margin;
  sectionHeader(doc, 'Governance & Guardrails', y, margin, pageWidth); y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Control', 'Implementation']],
    body: [
      ['Model', 'claude-sonnet-4-6 — pinned. No switches without Build Lead approval.'],
      ['System Prompt Isolation', 'Agent system prompts are server-side only. Never exposed to users.'],
      ['Injection Detection', 'Backend scans all input for injection patterns before passing to agent.'],
      ['Human-in-the-Loop', 'No phase advances without explicit BA approval. Every decision logged.'],
      ['Audit Trail', 'All runs, outputs, approvals, rejections stored in SQLite. Permanent.'],
      ['Output Contract', 'Structured JSON only. Schema validated before storage.'],
      ['Test Coverage', 'QA Agent mandated to cover all API endpoints, DB tables, and wireframe screens.'],
      ['MAS Compliance', 'Designed for MAS Technology Risk Management Guidelines.'],
    ],
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold', fontSize: 9 }, 1: { fontSize: 9 } },
    theme: 'striped',
    alternateRowStyles: { fillColor: [248, 249, 250] },
  });

  // ── Footers ───────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(...GREY);
    doc.text(
      `SDLC Agent Pipeline — FinServe OMS | Confidential | Page ${i} of ${pageCount}`,
      pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' }
    );
  }

  doc.save(`qa-report-${run.id.slice(0, 8)}.pdf`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderTestCase(doc: jsPDF, tc: QATestCase, y: number, margin: number, pageWidth: number): number {
  const priorityColor: Record<string, RGB> = {
    HIGH: DANGER, MEDIUM: WARNING, LOW: SUCCESS,
  };
  const pColor = priorityColor[tc.priority] ?? GREY;

  // ID + priority + title row
  doc.setFontSize(9);
  doc.setFont('courier', 'bold'); doc.setTextColor(...GREY);
  doc.text(tc.id, margin, y);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...pColor);
  doc.text(`[${tc.priority}]`, margin + 22, y);
  doc.setTextColor(0, 0, 0);
  doc.text(tc.title, margin + 40, y);
  y += 5;

  // Steps + expected result as table
  const rows: string[][] = [
    ['Preconditions', tc.preconditions],
    ...tc.steps.map((s, i) => [`Step ${i + 1}`, s]),
    ['Expected Result', tc.expected_result],
  ];

  if (tc.linked_api_endpoint) rows.push(['API Endpoint', tc.linked_api_endpoint]);
  if (tc.linked_table) rows.push(['DB Table', tc.linked_table]);
  if (tc.linked_screen) rows.push(['Screen', tc.linked_screen]);
  if (tc.attack_vector) rows.push(['Attack Vector', tc.attack_vector]);
  if (tc.edge_type) rows.push(['Edge Type', tc.edge_type]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: rows,
    columnStyles: {
      0: { cellWidth: 32, fontStyle: 'bold', fontSize: 8, textColor: [66, 66, 66] },
      1: { fontSize: 8 },
    },
    bodyStyles: { minCellHeight: 6 },
    theme: 'plain',
    tableLineColor: [224, 224, 224],
    tableLineWidth: 0.1,
  });

  return (doc as any).lastAutoTable.finalY + 5;
}

function sectionHeader(doc: jsPDF, title: string, y: number, margin: number, pageWidth: number, color: RGB = PRIMARY) {
  doc.setFillColor(...color);
  doc.rect(margin, y, pageWidth - margin * 2, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text(title, margin + 3, y + 4.5);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
}
