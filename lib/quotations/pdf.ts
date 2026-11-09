/**
 * Minimal, dependency-free PDF writer for one-page quotations (A4, Helvetica, text only).
 *
 * Privacy: the input type has no field for contact details. Only the business name, the item,
 * quantity, amount, validity, status, terms, quotation ID and the Demo label reach the page.
 */

export interface QuotationPdfInput {
  quotationId: string;
  businessName: string;
  itemTitle: string;
  quantity: number;
  amountLabel: string;
  validUntilLabel: string;
  statusLabel: string;
  terms: string | null;
  issuedLabel: string;
  isDemo: boolean;
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 56;
const WRAP_CHARS = 92;
const MAX_TERMS_LINES = 24;

/**
 * Escapes text for a PDF literal string "( ... )". Non-printable and non-ASCII characters become "?"
 * (Helvetica with WinAnsi has no reliable mapping for them here), and "\", "(" and ")" are escaped.
 */
export function escapePdfText(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code > 0x7e) {
      out += "?";
    } else if (ch === "\\" || ch === "(" || ch === ")") {
      out += "\\" + ch;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Splits text into lines of at most `maxChars`, breaking on spaces. Long words are hard-split. */
export function wrapText(input: string, maxChars = WRAP_CHARS): string[] {
  const lines: string[] = [];
  for (const paragraph of input.replace(/\r/g, "").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      let rest = word;
      while (rest.length > maxChars) {
        if (line) {
          lines.push(line);
          line = "";
        }
        lines.push(rest.slice(0, maxChars));
        rest = rest.slice(maxChars);
      }
      const candidate = line ? `${line} ${rest}` : rest;
      if (candidate.length > maxChars) {
        lines.push(line);
        line = rest;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

interface TextOp {
  font: "F1" | "F2";
  size: number;
  x: number;
  y: number;
  text: string;
}

function contentStream(ops: TextOp[]): string {
  return ops
    .map((op) => `BT /${op.font} ${op.size} Tf ${op.x} ${op.y} Td (${escapePdfText(op.text)}) Tj ET`)
    .join("\n");
}

function layout(input: QuotationPdfInput): TextOp[] {
  const ops: TextOp[] = [];
  let y = PAGE_HEIGHT - 64;
  const line = (text: string, size = 11, font: "F1" | "F2" = "F1", gap = 18) => {
    ops.push({ font, size, x: MARGIN_X, y, text });
    y -= gap;
  };

  if (input.isDemo) line("Demo quotation (sample data for demonstration)", 9, "F2", 16);
  line("Gemstone Selections", 10, "F2", 16);
  line("Quotation", 22, "F2", 34);
  line(`Quotation ID: ${input.quotationId}`, 10, "F1", 16);
  line(`Issued: ${input.issuedLabel}`, 10, "F1", 16);
  line(`Business: ${input.businessName}`, 11, "F1", 26);

  const rows: [string, string][] = [
    ["Item", input.itemTitle],
    ["Quantity", String(input.quantity)],
    ["Amount", input.amountLabel],
    ["Valid until", input.validUntilLabel],
    ["Status", input.statusLabel],
  ];
  for (const [label, value] of rows) {
    ops.push({ font: "F2", size: 11, x: MARGIN_X, y, text: label });
    for (const [index, part] of wrapText(value, 70).entries()) {
      ops.push({ font: "F1", size: 11, x: MARGIN_X + 110, y: y - index * 14, text: part });
    }
    y -= Math.max(1, wrapText(value, 70).length) * 14 + 8;
  }

  y -= 14;
  line("Terms", 12, "F2", 18);
  const termLines = input.terms ? wrapText(input.terms).slice(0, MAX_TERMS_LINES) : ["No additional terms."];
  for (const termLine of termLines) line(termLine, 10, "F1", 14);

  ops.push({
    font: "F1",
    size: 8,
    x: MARGIN_X,
    y: 56,
    text: "Payments are not processed on Gemstone Selections. Contact details are shared only inside the platform.",
  });
  return ops;
}

/** Builds a one-page PDF. Returns the bytes as a Buffer. */
export function buildQuotationPdf(input: QuotationPdfInput): Buffer {
  const stream = contentStream(layout(input));
  const streamBytes = Buffer.from(stream, "latin1");

  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "latin1"),
    Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
      "latin1",
    ),
    Buffer.concat([
      Buffer.from(`<< /Length ${streamBytes.length} >>\nstream\n`, "latin1"),
      streamBytes,
      Buffer.from("\nendstream", "latin1"),
    ]),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "latin1"),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>", "latin1"),
  ];

  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  const offsets: number[] = [];
  let position = parts[0].length;
  objects.forEach((body, index) => {
    offsets.push(position);
    const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, "latin1"), body, Buffer.from("\nendobj\n", "latin1")]);
    parts.push(chunk);
    position += chunk.length;
  });

  const xrefStart = position;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  parts.push(Buffer.from(xref, "latin1"));

  return Buffer.concat(parts);
}
