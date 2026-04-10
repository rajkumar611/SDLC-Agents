import { jsPDF } from 'jspdf';

type AcceptanceCriteria = { given: string; when: string; then: string };
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
  summary?: { total: number; clear: number; ambiguous: number; incomplete: number; security_flags: number };
  overall_clarifying_questions?: string[];
  error?: string;
};

type RGB = [number, number, number];

// Colours
const C = {
  purple:     [107, 33, 168]  as RGB,
  purpleLt:   [243, 232, 255] as RGB,
  green:      [22, 163, 74]   as RGB,
  greenBg:    [240, 253, 244] as RGB,
  greenBd:    [187, 247, 208] as RGB,
  yellow:     [217, 119, 6]   as RGB,
  yellowBg:   [255, 251, 235] as RGB,
  yellowBd:   [253, 230, 138] as RGB,
  blue:       [37, 99, 235]   as RGB,
  blueBg:     [239, 246, 255] as RGB,
  blueBd:     [191, 219, 254] as RGB,
  red:        [220, 38, 38]   as RGB,
  redBg:      [254, 242, 242] as RGB,
  redBd:      [254, 202, 202] as RGB,
  greyText:   [107, 114, 128] as RGB,
  darkText:   [17, 24, 39]    as RGB,
  white:      [255, 255, 255] as RGB,
  border:     [229, 231, 235] as RGB,
};

const STATUS_COLOR: Record<string, RGB> = {
  CLEAR: C.green, AMBIGUOUS: C.yellow, INCOMPLETE: C.blue, SECURITY_FLAG: C.red,
};
const STATUS_BG: Record<string, RGB> = {
  CLEAR: C.greenBg, AMBIGUOUS: C.yellowBg, INCOMPLETE: C.blueBg, SECURITY_FLAG: C.redBg,
};
const STATUS_LABEL: Record<string, string> = {
  CLEAR: 'Clear', AMBIGUOUS: 'Ambiguous', INCOMPLETE: 'Incomplete', SECURITY_FLAG: 'Security Flag',
};

// Safe color helpers — always pass r, g, b individually
function fill(doc: jsPDF, c: RGB)   { doc.setFillColor(c[0], c[1], c[2]); }
function stroke(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }
function color(doc: jsPDF, c: RGB)  { doc.setTextColor(c[0], c[1], c[2]); }

function pageBreak(doc: jsPDF, y: number, needed: number, margin: number): number {
  if (y + needed > doc.internal.pageSize.height - margin - 12) {
    doc.addPage();
    return margin + 8;
  }
  return y;
}

export function generatePDF(data: AgentOutput, timestamp: string): void {
  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW  = doc.internal.pageSize.width;
  const pageH  = doc.internal.pageSize.height;
  const margin = 18;
  const cW     = pageW - margin * 2; // content width
  let y        = margin;

  // ── Header banner ────────────────────────────────────────────
  fill(doc, C.purple);
  doc.rect(0, 0, pageW, 36, 'F');

  color(doc, C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Requirements Analysis Report', margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('FinServe Order Management  ·  Phase 1 — Requirements  ·  MAS Compliant  ·  NDA Active', margin, 22);
  doc.text(`Generated: ${new Date(timestamp).toLocaleString()}  ·  Model: claude-sonnet-4-6`, margin, 29);

  y = 44;

  // ── Summary strip ────────────────────────────────────────────
  if (data.summary) {
    const s = data.summary;
    const stats: { label: string; value: string; c: RGB }[] = [
      { label: 'Total',      value: String(s.total),      c: C.purple },
      { label: 'Clear',      value: String(s.clear),      c: C.green  },
      { label: 'Ambiguous',  value: String(s.ambiguous),  c: C.yellow },
      { label: 'Incomplete', value: String(s.incomplete), c: C.blue   },
    ];
    if (s.security_flags > 0) stats.push({ label: 'Security', value: String(s.security_flags), c: C.red });

    const boxW = cW / stats.length;
    stats.forEach((stat, i) => {
      const bx = margin + i * boxW;
      fill(doc, C.purpleLt);
      doc.roundedRect(bx, y, boxW - 2, 17, 2, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      color(doc, stat.c);
      doc.text(stat.value, bx + (boxW - 2) / 2, y + 8, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      color(doc, C.greyText);
      doc.text(stat.label.toUpperCase(), bx + (boxW - 2) / 2, y + 13.5, { align: 'center' });
    });
    y += 23;
  }

  // ── Section heading helper ────────────────────────────────────
  const sectionHeading = (label: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    color(doc, C.greyText);
    doc.text(label, margin, y);
    y += 3;
    stroke(doc, C.border);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
  };

  // ── Requirements ─────────────────────────────────────────────
  if (data.requirements && data.requirements.length > 0) {
    sectionHeading('REQUIREMENTS');

    data.requirements.forEach((req, idx) => {
      const sc = STATUS_COLOR[req.status] ?? C.greyText;
      const sb = STATUS_BG[req.status]    ?? ([249, 250, 251] as RGB);
      const sl = STATUS_LABEL[req.status] ?? req.status;

      y = pageBreak(doc, y, 22, margin);

      // Left accent bar
      fill(doc, sc);
      doc.rect(margin, y, 3, 7, 'F');

      // Index + ID
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      color(doc, C.purple);
      doc.text(`${String(idx + 1).padStart(2, '0')}  ${req.id}`, margin + 6, y + 5);

      // Status pill
      doc.setFontSize(7);
      const pillW = doc.getTextWidth(sl) + 6;
      fill(doc, sb);
      doc.roundedRect(pageW - margin - pillW - 2, y + 0.5, pillW + 2, 6, 1.5, 1.5, 'F');
      color(doc, sc);
      doc.text(sl, pageW - margin - pillW / 2 - 1, y + 5, { align: 'center' });

      y += 10;

      // Description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      color(doc, C.darkText);
      const descLines = doc.splitTextToSize(req.description, cW - 6);
      y = pageBreak(doc, y, descLines.length * 5 + 4, margin);
      doc.text(descLines, margin + 4, y);
      y += descLines.length * 5 + 4;

      // Acceptance Criteria
      if (req.acceptance_criteria) {
        const ac = req.acceptance_criteria;
        const colW = (cW - 6) / 3 - 2;
        const acItems = [
          { label: 'GIVEN', text: ac.given,  tc: C.blue,   bg: C.blueBg,   bd: C.blueBd  },
          { label: 'WHEN',  text: ac.when,   tc: C.yellow, bg: C.yellowBg, bd: C.yellowBd },
          { label: 'THEN',  text: ac.then,   tc: C.green,  bg: C.greenBg,  bd: C.greenBd  },
        ];

        const lineH  = 4.5;
        const maxLn  = Math.max(...acItems.map(a => doc.splitTextToSize(a.text, colW - 4).length));
        const boxH   = maxLn * lineH + 13;

        y = pageBreak(doc, y, boxH + 8, margin);

        // Label row
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        color(doc, C.greyText);
        doc.text('ACCEPTANCE CRITERIA', margin + 4, y);
        y += 4;

        acItems.forEach((item, ci) => {
          const bx = margin + 4 + ci * (colW + 3);
          fill(doc, item.bg);
          stroke(doc, item.bd);
          doc.roundedRect(bx, y, colW, boxH, 2, 2, 'FD');

          // Label
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          color(doc, item.tc);
          doc.text(item.label, bx + colW / 2, y + 6, { align: 'center' });

          // Text
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          color(doc, C.darkText);
          const lines = doc.splitTextToSize(item.text, colW - 5);
          doc.text(lines, bx + colW / 2, y + 11, { align: 'center' });
        });

        y += boxH + 5;
      }

      // Finding
      if (req.finding) {
        const findLines = doc.splitTextToSize(`Finding: ${req.finding}`, cW - 12);
        const fh = findLines.length * 4.5 + 8;
        y = pageBreak(doc, y, fh + 2, margin);
        fill(doc, C.redBg);
        stroke(doc, C.redBd);
        doc.roundedRect(margin + 4, y, cW - 4, fh, 2, 2, 'FD');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        color(doc, C.red);
        doc.text(findLines, margin + 7, y + 5.5);
        y += fh + 4;
      }

      // Clarifying questions
      if (req.clarifying_questions && req.clarifying_questions.length > 0) {
        y = pageBreak(doc, y, 12, margin);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        color(doc, C.blue);
        doc.text('Clarifying Questions:', margin + 4, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        color(doc, C.darkText);
        req.clarifying_questions.forEach((q, qi) => {
          const qLines = doc.splitTextToSize(`${qi + 1}. ${q}`, cW - 12);
          y = pageBreak(doc, y, qLines.length * 4.5 + 2, margin);
          doc.text(qLines, margin + 6, y);
          y += qLines.length * 4.5 + 1;
        });
        y += 2;
      }

      // Divider
      y += 3;
      if (idx < (data.requirements?.length ?? 0) - 1) {
        stroke(doc, C.border);
        doc.line(margin, y, pageW - margin, y);
        y += 5;
      }
    });
  }

  // ── Overall clarifying questions ──────────────────────────────
  if (data.overall_clarifying_questions && data.overall_clarifying_questions.length > 0) {
    y += 4;
    const ocq = data.overall_clarifying_questions;
    const totalLines = ocq.reduce((acc, q) => acc + doc.splitTextToSize(q, cW - 14).length, 0);
    const sectionH = totalLines * 5 + ocq.length * 2 + 16;

    y = pageBreak(doc, y, sectionH + 4, margin);

    fill(doc, C.blueBg);
    stroke(doc, C.blueBd);
    doc.roundedRect(margin, y, cW, sectionH, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    color(doc, C.blue);
    doc.text('Overall Clarifying Questions for Client', margin + 5, y + 8);
    y += 13;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    color(doc, C.darkText);
    ocq.forEach((q, i) => {
      const qLines = doc.splitTextToSize(`${i + 1}. ${q}`, cW - 14);
      doc.text(qLines, margin + 6, y);
      y += qLines.length * 5 + 1;
    });
  }

  // ── Footer on every page ──────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    fill(doc, C.purple);
    doc.rect(0, pageH - 10, pageW, 10, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    color(doc, C.white);
    doc.text(
      `FinServe Order Management  ·  Requirements Analysis Agent  ·  Governed by CLAUDE.md  ·  Page ${p} of ${totalPages}`,
      pageW / 2,
      pageH - 3.5,
      { align: 'center' }
    );
  }

  // ── Save ──────────────────────────────────────────────────────
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`FinServe-Requirements-Analysis-${dateStr}.pdf`);
}
