import { jsPDF } from 'jspdf';

type AcceptanceCriteria = {
  given: string;
  when: string;
  then: string;
};

type Requirement = {
  id: string;
  description: string;
  acceptance_criteria?: AcceptanceCriteria;
  status: 'CLEAR' | 'AMBIGUOUS' | 'INCOMPLETE' | 'SECURITY_FLAG';
  finding?: string | null;
  clarifying_questions?: string[];
};

type AgentOutput = {
  requirements?: Requirement[];
  summary?: {
    total: number;
    clear: number;
    ambiguous: number;
    incomplete: number;
    security_flags: number;
  };
  overall_clarifying_questions?: string[];
};

// Colours
const PURPLE     = [107, 33, 168] as [number, number, number];
const PURPLE_LT  = [243, 232, 255] as [number, number, number];
const GREEN      = [22, 163, 74]   as [number, number, number];
const GREEN_BG   = [240, 253, 244] as [number, number, number];
const YELLOW     = [217, 119, 6]   as [number, number, number];
const YELLOW_BG  = [255, 251, 235] as [number, number, number];
const BLUE       = [37, 99, 235]   as [number, number, number];
const BLUE_BG    = [239, 246, 255] as [number, number, number];
const RED        = [220, 38, 38]   as [number, number, number];
const RED_BG     = [254, 242, 242] as [number, number, number];
const GREY_TEXT  = [107, 114, 128] as [number, number, number];
const DARK_TEXT  = [17, 24, 39]    as [number, number, number];
const WHITE      = [255, 255, 255] as [number, number, number];
const BORDER     = [229, 231, 235] as [number, number, number];

const STATUS_COLOR: Record<string, [number, number, number]> = {
  CLEAR:         GREEN,
  AMBIGUOUS:     YELLOW,
  INCOMPLETE:    BLUE,
  SECURITY_FLAG: RED,
};

const STATUS_BG: Record<string, [number, number, number]> = {
  CLEAR:         GREEN_BG,
  AMBIGUOUS:     YELLOW_BG,
  INCOMPLETE:    BLUE_BG,
  SECURITY_FLAG: RED_BG,
};

const STATUS_LABEL: Record<string, string> = {
  CLEAR:         '✓ Clear',
  AMBIGUOUS:     '~ Ambiguous',
  INCOMPLETE:    '! Incomplete',
  SECURITY_FLAG: '⚠ Security Flag',
};

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number, margin: number): number {
  if (y + needed > doc.internal.pageSize.height - margin) {
    doc.addPage();
    return margin + 10;
  }
  return y;
}

export function generatePDF(data: AgentOutput, timestamp: string): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Cover / header banner ──────────────────────────────────────
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, pageW, 38, 'F');

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Requirements Analysis Report', margin, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('FinServe Order Management  ·  Phase 1 — Requirements  ·  MAS Compliant  ·  NDA Active', margin, 24);
  doc.text(`Generated: ${new Date(timestamp).toLocaleString()}  ·  Model: claude-sonnet-4-6`, margin, 30);

  y = 46;

  // ── Summary strip ──────────────────────────────────────────────
  if (data.summary) {
    const s = data.summary;
    const stats = [
      { label: 'Total',      value: String(s.total),          color: PURPLE },
      { label: 'Clear',      value: String(s.clear),          color: GREEN },
      { label: 'Ambiguous',  value: String(s.ambiguous),      color: YELLOW },
      { label: 'Incomplete', value: String(s.incomplete),     color: BLUE },
      ...(s.security_flags > 0 ? [{ label: '⚠ Security', value: String(s.security_flags), color: RED }] : []),
    ];

    const boxW = contentW / stats.length;
    doc.setDrawColor(...BORDER);
    stats.forEach((stat, i) => {
      const bx = margin + i * boxW;
      doc.setFillColor(...PURPLE_LT);
      doc.roundedRect(bx, y, boxW - 2, 18, 2, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...stat.color);
      doc.text(stat.value, bx + boxW / 2 - 1, y + 9, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...GREY_TEXT);
      doc.text(stat.label.toUpperCase(), bx + boxW / 2 - 1, y + 14.5, { align: 'center' });
    });
    y += 24;
  }

  // ── Requirements ───────────────────────────────────────────────
  if (data.requirements && data.requirements.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...GREY_TEXT);
    doc.text('REQUIREMENTS', margin, y);
    y += 5;

    doc.setDrawColor(...BORDER);
    doc.line(margin, y, pageW - margin, y);
    y += 5;

    data.requirements.forEach((req, idx) => {
      const color    = STATUS_COLOR[req.status] ?? GREY_TEXT;
      const bgColor  = STATUS_BG[req.status]    ?? ([249, 250, 251] as [number, number, number]);
      const label    = STATUS_LABEL[req.status] ?? req.status;

      // Estimate height needed
      y = checkPageBreak(doc, y, 40, margin);

      // Left accent bar
      doc.setFillColor(...color);
      doc.rect(margin, y, 3, 8, 'F');

      // Requirement ID + index
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...PURPLE);
      doc.text(`${String(idx + 1).padStart(2, '0')}  ${req.id}`, margin + 6, y + 5.5);

      // Status pill
      const pillText = label;
      doc.setFontSize(7.5);
      const pillW = doc.getTextWidth(pillText) + 6;
      doc.setFillColor(...bgColor);
      doc.roundedRect(pageW - margin - pillW - 2, y + 1, pillW + 2, 6, 1.5, 1.5, 'F');
      doc.setTextColor(...color);
      doc.text(pillText, pageW - margin - pillW / 2 - 1, y + 5.5, { align: 'center' });

      y += 10;

      // Description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...DARK_TEXT);
      const descLines = doc.splitTextToSize(req.description, contentW - 6);
      y = checkPageBreak(doc, y, descLines.length * 5 + 4, margin);
      doc.text(descLines, margin + 3, y);
      y += descLines.length * 5 + 4;

      // Acceptance Criteria
      if (req.acceptance_criteria) {
        y = checkPageBreak(doc, y, 32, margin);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...GREY_TEXT);
        doc.text('ACCEPTANCE CRITERIA', margin + 3, y);
        y += 4;

        const ac = req.acceptance_criteria;
        const colW = (contentW - 6) / 3 - 2;
        const acItems = [
          { label: 'GIVEN', text: ac.given,  color: BLUE,   bg: BLUE_BG },
          { label: 'WHEN',  text: ac.when,   color: YELLOW, bg: YELLOW_BG },
          { label: 'THEN',  text: ac.then,   color: GREEN,  bg: GREEN_BG },
        ];

        // Determine tallest column
        const lineH = 4.5;
        const maxLines = Math.max(...acItems.map(a => doc.splitTextToSize(a.text, colW - 4).length));
        const boxH = maxLines * lineH + 12;

        y = checkPageBreak(doc, y, boxH + 4, margin);

        acItems.forEach((item, ci) => {
          const bx = margin + 3 + ci * (colW + 3);
          doc.setFillColor(...item.bg);
          doc.roundedRect(bx, y, colW, boxH, 2, 2, 'F');
          doc.setDrawColor(...item.color);
          doc.roundedRect(bx, y, colW, boxH, 2, 2, 'S');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(...item.color);
          doc.text(item.label, bx + colW / 2, y + 5.5, { align: 'center' });

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...DARK_TEXT);
          const lines = doc.splitTextToSize(item.text, colW - 4);
          doc.text(lines, bx + colW / 2, y + 10, { align: 'center' });
        });

        y += boxH + 5;
      }

      // Finding
      if (req.finding) {
        y = checkPageBreak(doc, y, 16, margin);
        doc.setFillColor(...RED_BG);
        const findingLines = doc.splitTextToSize(`🔍 Finding: ${req.finding}`, contentW - 10);
        doc.roundedRect(margin + 3, y, contentW - 3, findingLines.length * 4.5 + 7, 2, 2, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...RED);
        doc.text(findingLines, margin + 6, y + 5);
        y += findingLines.length * 4.5 + 10;
      }

      // Clarifying questions
      if (req.clarifying_questions && req.clarifying_questions.length > 0) {
        y = checkPageBreak(doc, y, 14, margin);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor([2, 132, 199] as unknown as number);
        doc.text('Clarifying Questions:', margin + 3, y);
        y += 4.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...DARK_TEXT);
        req.clarifying_questions.forEach((q, qi) => {
          y = checkPageBreak(doc, y, 8, margin);
          const qLines = doc.splitTextToSize(`${qi + 1}. ${q}`, contentW - 10);
          doc.text(qLines, margin + 5, y);
          y += qLines.length * 4.5;
        });
        y += 2;
      }

      // Divider between requirements
      y += 3;
      if (idx < (data.requirements?.length ?? 0) - 1) {
        doc.setDrawColor(...BORDER);
        doc.line(margin, y, pageW - margin, y);
        y += 5;
      }
    });
  }

  // ── Overall clarifying questions ───────────────────────────────
  if (data.overall_clarifying_questions && data.overall_clarifying_questions.length > 0) {
    y = checkPageBreak(doc, y, 20, margin);
    y += 4;

    doc.setFillColor(...BLUE_BG);
    const sectionH = data.overall_clarifying_questions.length * 8 + 16;
    doc.roundedRect(margin, y, contentW, sectionH, 3, 3, 'F');
    doc.setDrawColor(...BLUE);
    doc.roundedRect(margin, y, contentW, sectionH, 3, 3, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BLUE);
    doc.text('Overall Clarifying Questions for Client', margin + 5, y + 8);
    y += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK_TEXT);
    data.overall_clarifying_questions.forEach((q, i) => {
      y = checkPageBreak(doc, y, 8, margin);
      const qLines = doc.splitTextToSize(`${i + 1}. ${q}`, contentW - 12);
      doc.text(qLines, margin + 6, y);
      y += qLines.length * 5;
    });
    y += 6;
  }

  // ── Footer on every page ───────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(...PURPLE);
    doc.rect(0, pageH - 10, pageW, 10, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text(
      `FinServe Order Management · Requirements Analysis Agent · Governed by CLAUDE.md · Page ${p} of ${totalPages}`,
      pageW / 2,
      pageH - 3.5,
      { align: 'center' }
    );
  }

  // ── Save ───────────────────────────────────────────────────────
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`FinServe-Requirements-Analysis-${dateStr}.pdf`);
}
