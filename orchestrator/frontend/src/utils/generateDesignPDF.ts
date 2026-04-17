import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DesignOutput, PipelineRun } from '../types/pipeline';

type RGB = [number, number, number];
const PRIMARY: RGB = [21, 101, 192];
const SUCCESS: RGB = [46, 125, 50];
const WARNING: RGB = [230, 81, 0];
const PURPLE:  RGB = [106, 27, 154];
const GREY:    RGB = [97, 97, 97];

export function generateDesignPDF(run: PipelineRun, output: DesignOutput): void {
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
  doc.text('SDLC Agent Pipeline — Solution Design Report', margin, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('FinServe Order Management System', margin, 20);
  doc.text(`Run ID: ${run.id}`, pageWidth - margin, 20, { align: 'right' });

  y = 34;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(`Document: ${run.file_name ?? 'N/A'}`, margin, y);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, y, { align: 'right' });
  y += 10;
  doc.setTextColor(0, 0, 0);

  // ── Summary ───────────────────────────────────────────────────────────────
  sectionHeader(doc, 'Summary', y, margin, pageWidth);
  y += 8;

  const { summary } = output;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['API Endpoints', 'DB Tables', 'Components', 'Wireframes', 'User Flows']],
    body: [[
      summary.total_api_endpoints,
      summary.total_tables,
      summary.total_components,
      summary.total_wireframes,
      summary.total_user_flows,
    ]],
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 11, halign: 'center', fontStyle: 'bold' },
    theme: 'grid',
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  const { pipeline_metadata } = output;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(pipeline_metadata.ready_for_handoff ? SUCCESS : WARNING));
  doc.text(
    pipeline_metadata.ready_for_handoff
      ? '✓ Ready for handoff to QA phase'
      : `⚠ Handoff blocked: ${pipeline_metadata.handoff_blocked_reason}`,
    margin, y
  );
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  // ── Backend ───────────────────────────────────────────────────────────────
  checkPage(doc, y, margin);
  y = (doc as any).currentPage === 1 ? y : margin;

  sectionHeader(doc, 'Backend Design', y, margin, pageWidth);
  y += 8;

  infoRow(doc, 'Architecture', output.design.backend.architecture_style, y, margin);
  y += 6;
  infoRow(doc, 'Tech Stack', output.design.backend.tech_stack.join(' · '), y, margin);
  y += 10;

  if (output.design.backend.services.length > 0) {
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY);
    doc.text('SERVICES', margin, y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Service', 'Responsibility', 'Dependencies']],
      body: output.design.backend.services.map((s) => [
        s.name, s.responsibility, s.dependencies.join(', ') || '—',
      ]),
      headStyles: { fillColor: [240, 244, 248], textColor: [33, 33, 33], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
      theme: 'striped',
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  if (output.design.backend.api_endpoints.length > 0) {
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY);
    doc.text('API ENDPOINTS', margin, y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Method', 'Path', 'Description', 'Auth']],
      body: output.design.backend.api_endpoints.map((ep) => [
        ep.method, ep.path, ep.description, ep.auth_required ? 'Yes' : 'No',
      ]),
      headStyles: { fillColor: [240, 244, 248], textColor: [33, 33, 33], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 18, fontStyle: 'bold', textColor: PRIMARY }, 1: { cellWidth: 45 }, 3: { cellWidth: 12, halign: 'center' } },
      theme: 'striped',
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Database ──────────────────────────────────────────────────────────────
  doc.addPage(); y = margin;
  sectionHeader(doc, 'Database Design', y, margin, pageWidth);
  y += 8;

  infoRow(doc, 'Type', output.design.database.type, y, margin); y += 6;
  infoRow(doc, 'Engine', output.design.database.engine, y, margin); y += 10;

  if (output.design.database.relationships.length > 0) {
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY);
    doc.text('RELATIONSHIPS', margin, y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['From', 'Type', 'To', 'Description']],
      body: output.design.database.relationships.map((r) => [r.from, r.type, r.to, r.description]),
      headStyles: { fillColor: [240, 244, 248], textColor: [33, 33, 33], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold' }, 2: { fontStyle: 'bold' } },
      theme: 'striped',
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  for (const table of output.design.database.tables) {
    if (y > 240) { doc.addPage(); y = margin; }

    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...PRIMARY);
    doc.text(table.name, margin, y);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GREY);
    doc.text(table.purpose, margin + doc.getTextWidth(table.name) + 4, y);
    y += 5;
    doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Column', 'Type', 'Constraints', 'Description']],
      body: table.columns.map((c) => [c.name, c.type, c.constraints, c.description]),
      headStyles: { fillColor: [240, 244, 248], textColor: [33, 33, 33], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: PRIMARY, cellWidth: 35 },
        1: { textColor: PURPLE, cellWidth: 30 },
        2: { textColor: WARNING, cellWidth: 35 },
      },
      theme: 'striped',
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ERD as Mermaid text block
  if (output.design.database.erd_mermaid) {
    if (y > 220) { doc.addPage(); y = margin; }
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY);
    doc.text('ERD (Mermaid source — render at mermaid.live)', margin, y); y += 4;
    doc.setFont('courier', 'normal'); doc.setFontSize(8); doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(output.design.database.erd_mermaid, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 8;
    doc.setFont('helvetica', 'normal');
  }

  // ── Frontend ──────────────────────────────────────────────────────────────
  doc.addPage(); y = margin;
  sectionHeader(doc, 'Frontend Design', y, margin, pageWidth);
  y += 8;

  infoRow(doc, 'Architecture', output.design.frontend.architecture_style, y, margin); y += 6;
  infoRow(doc, 'Tech Stack', output.design.frontend.tech_stack.join(' · '), y, margin); y += 10;

  if (output.design.frontend.components.length > 0) {
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY);
    doc.text('COMPONENTS', margin, y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Component', 'Purpose', 'Parent']],
      body: output.design.frontend.components.map((c) => [c.name, c.purpose, c.parent ?? '—']),
      headStyles: { fillColor: [240, 244, 248], textColor: [33, 33, 33], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
      theme: 'striped',
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  for (const wf of output.design.frontend.wireframes) {
    if (y > 200) { doc.addPage(); y = margin; }
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...PRIMARY);
    doc.text(`Wireframe: ${wf.screen}`, margin, y); y += 5;
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GREY);
    doc.text(wf.description, margin, y); y += 5;
    doc.setFont('courier', 'normal'); doc.setFontSize(7.5); doc.setTextColor(0, 0, 0);
    const wfLines = doc.splitTextToSize(wf.ascii_layout, pageWidth - margin * 2);
    doc.text(wfLines, margin, y);
    y += wfLines.length * 3.5 + 8;
    doc.setFont('helvetica', 'normal');
  }

  // ── Design Decisions ─────────────────────────────────────────────────────
  if (output.design_decisions.length > 0) {
    if (y > 220) { doc.addPage(); y = margin; }
    sectionHeader(doc, 'Design Decisions', y, margin, pageWidth); y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Decision', 'Rationale', 'Alternatives']],
      body: output.design_decisions.map((d) => [
        d.decision, d.rationale, d.alternatives_considered.join(', ') || '—',
      ]),
      headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
      theme: 'striped',
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Open Questions ────────────────────────────────────────────────────────
  if (output.open_questions.length > 0) {
    if (y > 220) { doc.addPage(); y = margin; }
    sectionHeader(doc, 'Open Questions', y, margin, pageWidth); y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['#', 'Question', 'Impact', 'Raised By']],
      body: output.open_questions.map((q, i) => [i + 1, q.question, q.impact, q.raised_by]),
      headStyles: { fillColor: [255, 243, 224], textColor: [230, 81, 0], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9, fillColor: [255, 253, 248] },
      columnStyles: { 0: { cellWidth: 8, halign: 'center' } },
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
      ['Output Contract', 'Structured JSON only. Schema validated before storage. No freeform text.'],
      ['Design Scope', 'Design Agent covers backend, database, frontend, wireframes, and diagrams.'],
      ['MAS Compliance', 'Designed for MAS Technology Risk Management Guidelines.'],
    ],
    headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold', fontSize: 9 }, 1: { fontSize: 9 } },
    theme: 'striped',
    alternateRowStyles: { fillColor: [248, 249, 250] },
  });

  // ── Footer on all pages ───────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(...GREY);
    doc.text(
      `SDLC Agent Pipeline — FinServe OMS | Confidential | Page ${i} of ${pageCount}`,
      pageWidth / 2, doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  doc.save(`design-report-${run.id.slice(0, 8)}.pdf`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sectionHeader(doc: jsPDF, title: string, y: number, margin: number, pageWidth: number) {
  doc.setFillColor(...PRIMARY);
  doc.rect(margin, y, pageWidth - margin * 2, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text(title, margin + 3, y + 4.5);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
}

function infoRow(doc: jsPDF, label: string, value: string, y: number, margin: number) {
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(66, 66, 66);
  doc.text(`${label}:`, margin, y);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
  doc.text(value, margin + 28, y);
}

function checkPage(doc: jsPDF, y: number, _margin: number) {
  if (y > 250) doc.addPage();
}
