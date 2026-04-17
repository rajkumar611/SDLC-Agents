import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PipelineRun, RequirementsOutput, DesignOutput, QAOutput } from '../types/pipeline';

type RGB = [number, number, number];
const PRIMARY: RGB = [21, 101, 192];
const SUCCESS: RGB = [46, 125, 50];
const WARNING: RGB = [230, 81, 0];

const GREY:    RGB = [97, 97, 97];
const DARK:    RGB = [26, 26, 46];

export function generatePipelineRunReport(
  run: PipelineRun,
  requirements: RequirementsOutput,
  design: DesignOutput,
  qa: QAOutput
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = margin;

  // ── Cover page ────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageWidth, 297, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28); doc.setFont('helvetica', 'bold');
  doc.text('SDLC Agent Pipeline', pageWidth / 2, 80, { align: 'center' });

  doc.setFontSize(18); doc.setFont('helvetica', 'normal');
  doc.text('Pipeline Run Report', pageWidth / 2, 95, { align: 'center' });

  doc.setFontSize(11);
  doc.text('FinServe Order Management System', pageWidth / 2, 110, { align: 'center' });

  // Status badge
  const isComplete = run.status === 'completed';
  doc.setFillColor(...(isComplete ? SUCCESS : WARNING));
  doc.roundedRect(pageWidth / 2 - 25, 120, 50, 10, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text(isComplete ? 'COMPLETED' : run.status.toUpperCase(), pageWidth / 2, 126.5, { align: 'center' });

  // Run details
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  const details = [
    [`Run ID`, run.id],
    [`Document`, run.file_name ?? 'N/A'],
    [`Started`, fmt(run.created_at)],
    [`Completed`, fmt(run.completed_at)],
  ];
  details.forEach(([label, value], i) => {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(150, 150, 150);
    doc.text(label, pageWidth / 2 - 30, 145 + i * 8, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setTextColor(220, 220, 220);
    doc.text(value, pageWidth / 2 - 26, 145 + i * 8);
  });

  // Phase timeline
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('PIPELINE PHASES', margin, 200);

  const phases = [
    { label: 'Requirements', start: run.requirements_started_at, end: run.requirements_completed_at },
    { label: 'Design',       start: run.design_started_at,       end: run.design_completed_at },
    { label: 'QA Test Cases',start: run.qa_started_at,           end: run.qa_completed_at },
  ];

  phases.forEach((phase, i) => {
    const phaseY = 210 + i * 14;
    doc.setFillColor(...PRIMARY);
    doc.circle(margin + 3, phaseY, 2, 'F');
    if (i < phases.length - 1) {
      doc.setDrawColor(...GREY);
      doc.line(margin + 3, phaseY + 2, margin + 3, phaseY + 12);
    }
    doc.setTextColor(220, 220, 220);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(phase.label, margin + 8, phaseY + 1);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 150, 150);
    doc.text(`${fmt(phase.start)} → ${fmt(phase.end)}`, margin + 8, phaseY + 6);
  });

  doc.setFontSize(7); doc.setTextColor(80, 80, 80);
  doc.text('CONFIDENTIAL — AI-assisted | MAS Technology Risk Management Guidelines', pageWidth / 2, 285, { align: 'center' });

  // ── Pipeline overview page ─────────────────────────────────────────────────
  doc.addPage(); y = margin;
  sectionHeader(doc, 'Pipeline Overview', y, margin, pageWidth); y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Phase', 'Status', 'Requirements', 'Design', 'QA Test Cases']],
    body: [[
      'Stage 1 — Document Pipeline',
      isComplete ? 'Completed' : 'In Progress',
      `${requirements.summary.total} requirements (${requirements.summary.clear} clear)`,
      `${design.summary.total_api_endpoints} endpoints · ${design.summary.total_tables} tables`,
      `${qa.summary.total} test cases`,
    ]],
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    theme: 'grid',
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Requirements summary ───────────────────────────────────────────────────
  sectionHeader(doc, 'Requirements Summary', y, margin, pageWidth); y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Total', 'Clear', 'Ambiguous', 'Incomplete', 'Security Flags', 'Ready for Handoff']],
    body: [[
      requirements.summary.total,
      requirements.summary.clear,
      requirements.summary.ambiguous,
      requirements.summary.incomplete,
      requirements.summary.security_flags,
      requirements.pipeline_metadata.ready_for_handoff ? 'Yes' : 'No',
    ]],
    headStyles: { fillColor: [240, 244, 248], textColor: [33, 33, 33], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, halign: 'center' },
    theme: 'grid',
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Requirements list (compact)
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['ID', 'Description', 'Status']],
    body: requirements.requirements.map((r) => [r.id, r.description, r.status]),
    headStyles: { fillColor: [240, 244, 248], textColor: [33, 33, 33], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold' }, 2: { cellWidth: 28, halign: 'center' } },
    theme: 'striped',
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Design summary ────────────────────────────────────────────────────────
  doc.addPage(); y = margin;
  sectionHeader(doc, 'Design Summary', y, margin, pageWidth); y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['API Endpoints', 'DB Tables', 'Components', 'Wireframes', 'User Flows', 'Ready for Handoff']],
    body: [[
      design.summary.total_api_endpoints,
      design.summary.total_tables,
      design.summary.total_components,
      design.summary.total_wireframes,
      design.summary.total_user_flows,
      design.pipeline_metadata.ready_for_handoff ? 'Yes' : 'No',
    ]],
    headStyles: { fillColor: [240, 244, 248], textColor: [33, 33, 33], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, halign: 'center' },
    theme: 'grid',
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // API endpoints
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY);
  doc.text('API ENDPOINTS', margin, y); y += 4;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Method', 'Path', 'Description', 'Auth']],
    body: design.design.backend.api_endpoints.map((ep) => [
      ep.method, ep.path, ep.description, ep.auth_required ? 'Yes' : 'No',
    ]),
    headStyles: { fillColor: [240, 244, 248], textColor: [33, 33, 33], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { cellWidth: 18, fontStyle: 'bold', textColor: PRIMARY }, 1: { cellWidth: 42 }, 3: { cellWidth: 10, halign: 'center' } },
    theme: 'striped',
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // DB tables (names + purpose only)
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY);
  doc.text('DATABASE TABLES', margin, y); y += 4;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Table', 'Purpose', 'Columns']],
    body: design.design.database.tables.map((t) => [t.name, t.purpose, t.columns.length]),
    headStyles: { fillColor: [240, 244, 248], textColor: [33, 33, 33], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 }, 2: { cellWidth: 18, halign: 'center' } },
    theme: 'striped',
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // ── QA summary ────────────────────────────────────────────────────────────
  doc.addPage(); y = margin;
  sectionHeader(doc, 'QA Test Cases Summary', y, margin, pageWidth); y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Total', 'Functional', 'Database', 'UI', 'Security', 'Edge Cases', 'Coverage Gaps']],
    body: [[
      qa.summary.total,
      qa.summary.functional,
      qa.summary.database,
      qa.summary.ui,
      qa.summary.security,
      qa.summary.edge_cases,
      qa.coverage_gaps.length,
    ]],
    headStyles: { fillColor: [240, 244, 248], textColor: [33, 33, 33], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, halign: 'center' },
    theme: 'grid',
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Test case ID listing by category
  const cats: { key: keyof QAOutput['test_suite']; label: string }[] = [
    { key: 'functional',  label: 'Functional' },
    { key: 'database',    label: 'Database' },
    { key: 'ui',          label: 'UI' },
    { key: 'security',    label: 'Security' },
    { key: 'edge_cases',  label: 'Edge Cases' },
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Category', 'ID', 'Title', 'Priority']],
    body: cats.flatMap((cat) =>
      qa.test_suite[cat.key].map((tc) => [cat.label, tc.id, tc.title, tc.priority])
    ),
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: 'bold' },
      1: { cellWidth: 20, font: 'courier' },
      3: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
    },
    theme: 'striped',
  });

  // ── Governance & Guardrails ───────────────────────────────────────────────
  doc.addPage(); y = margin;
  sectionHeader(doc, 'Governance & Guardrails', y, margin, pageWidth); y += 8;

  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GREY);
  doc.text('This pipeline is governed by MAS Technology Risk Management Guidelines.', margin, y);
  doc.text('Every phase output was reviewed and approved by a human before advancing.', margin, y + 5);
  y += 14;
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Control', 'Implementation', 'Evidence']],
    body: [
      ['Model Pin', 'claude-sonnet-4-6', 'Hardcoded in each agent server.ts'],
      ['System Prompt Isolation', 'Server-side only', 'Never sent to frontend or dashboard'],
      ['Injection Detection', 'Regex patterns on all input', 'Backend layer in each agent route'],
      ['Human-in-the-Loop', 'BA approval at every phase', `${run.id.slice(0, 8)} — all phases reviewed`],
      ['Audit Trail', 'SQLite pipeline_runs + pipeline_reviews', 'Permanent, non-deletable records'],
      ['Output Contract', 'JSON schema validated', 'JSON.parse validation before storage'],
      ['PII Handling', 'SECURITY_FLAG status', 'Handoff blocked on any PII detection'],
      ['MAS Compliance', 'Human oversight at every gate', 'Review gate enforced by orchestrator'],
    ],
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: 'bold', fontSize: 9 },
      1: { cellWidth: 48, fontSize: 9 },
      2: { fontSize: 8 },
    },
    theme: 'striped',
    alternateRowStyles: { fillColor: [248, 249, 250] },
  });

  // ── Footers ───────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    if (i === 1) continue; // no footer on cover
    doc.setFontSize(8); doc.setTextColor(...GREY);
    doc.text(
      `SDLC Agent Pipeline — FinServe OMS | Confidential | Page ${i - 1} of ${pageCount - 1}`,
      pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' }
    );
  }

  doc.save(`pipeline-run-report-${run.id.slice(0, 8)}.pdf`);
}

function sectionHeader(doc: jsPDF, title: string, y: number, margin: number, pageWidth: number) {
  doc.setFillColor(...PRIMARY);
  doc.rect(margin, y, pageWidth - margin * 2, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text(title, margin + 3, y + 4.5);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
}

function fmt(ts: string | null): string {
  if (!ts) return 'N/A';
  return new Date(ts).toLocaleString();
}
