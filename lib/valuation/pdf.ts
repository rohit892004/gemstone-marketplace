import QRCode from "qrcode";
import { escapePdfText, wrapText } from "@/lib/quotations/pdf";
import { VALUATION_DISCLAIMER } from "./disclaimer";

/**
 * Valuation report PDF. A4, Helvetica, text and vector shapes only. No images are embedded.
 *
 * The QR code is drawn as filled squares from the qrcode library's module matrix, so no encoder is written
 * here. The QR points to the public verification page.
 *
 * Privacy: the input has no requester field. The page shows the stone, the result (when there is one), the
 * reference, the date, the verification address and the disclaimer. It never shows the requester.
 *
 * Every page carries the disclaimer and the reference, so a page printed alone still identifies itself.
 */

export interface ValuationPdfRow {
  label: string;
  value: string;
}

export interface ValuationPdfInput {
  reference: string;
  verifyUrl: string;
  issuedLabel: string;
  statusLabel: string;
  valuedByLabel: string | null;
  rows: ValuationPdfRow[];
  estimateLabel: string | null;
  rangeLabel: string | null;
  confidenceLabel: string | null;
  factors: string[];
  isDemo: boolean;
  withdrawn: boolean;
}

export { VALUATION_DISCLAIMER } from "./disclaimer";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 56;
const TOP = PAGE_HEIGHT - 56;
const BOTTOM = 110;
const QR_BOX = 116;
const BODY_CHARS = 84;

/** Maps the typographic characters used in labels to ASCII. Anything else non-ASCII becomes "?" in escapePdfText. */
export function toPdfAscii(input: string): string {
  // The rupee sign is not in the standard PDF font, so it is written as "Rs" instead of a "?".
  return input.replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/₹\s?/g, "Rs ");
}

/** The module matrix of the QR code for a text. Modules are dark when true. */
export function qrModules(text: string): { size: number; isDark: (row: number, col: number) => boolean } {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" }).modules;
  // BitMatrix.get returns 1 for a dark module and 0 for a light one.
  return { size: qr.size, isDark: (row, col) => qr.get(row, col) === 1 };
}

interface Page {
  ops: string[];
  y: number;
}

function text(page: Page, x: number, y: number, size: number, font: "F1" | "F2", value: string): void {
  page.ops.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(toPdfAscii(value))}) Tj ET`);
}

function drawQr(page: Page, x0: number, y0: number, box: number, text_: string): void {
  const qr = qrModules(text_);
  const cell = box / (qr.size + 8); // four modules of quiet zone on each side
  const rects: string[] = [];
  for (let row = 0; row < qr.size; row += 1) {
    for (let col = 0; col < qr.size; col += 1) {
      if (!qr.isDark(row, col)) continue;
      const x = x0 + (col + 4) * cell;
      const y = y0 + (qr.size - 1 - row + 4) * cell;
      rects.push(`${x.toFixed(2)} ${y.toFixed(2)} ${cell.toFixed(2)} ${cell.toFixed(2)} re f`);
    }
  }
  page.ops.push("0 g", ...rects);
}

/** Builds the report. Returns the PDF bytes. */
export function buildValuationPdf(input: ValuationPdfInput): Buffer {
  const pages: Page[] = [];
  const newPage = (): Page => {
    const page: Page = { ops: [], y: TOP };
    pages.push(page);
    return page;
  };
  let page = newPage();

  const ensure = (height: number) => {
    if (page.y - height < BOTTOM) {
      page = newPage();
    }
  };
  const line = (value: string, size: number, font: "F1" | "F2", lead: number, x = MARGIN_X, chars = BODY_CHARS) => {
    for (const piece of wrapText(toPdfAscii(value), chars)) {
      ensure(lead);
      text(page, x, page.y, size, font, piece);
      page.y -= lead;
    }
  };

  // First page header: title, demo label, reference, and the QR code at the top right.
  line("Gemstone Selections", 10, "F2", 14);
  line("Valuation report", 20, "F2", 26);
  if (input.isDemo) line("Demo - indicative", 10, "F2", 14);
  line(`Reference ${input.reference}`, 13, "F2", 18);
  line(`Issued ${input.issuedLabel}`, 10, "F1", 14);
  line(`Status: ${input.statusLabel}`, 10, "F1", 14);
  if (input.valuedByLabel) line(`Valued by: ${input.valuedByLabel}`, 10, "F1", 14);
  const qrX = PAGE_WIDTH - MARGIN_X - QR_BOX;
  const qrY = TOP - QR_BOX;
  drawQr(page, qrX, qrY, QR_BOX, input.verifyUrl);
  text(page, qrX, qrY - 12, 8, "F1", "Scan to verify");
  page.y = Math.min(page.y, qrY - 30);

  if (input.withdrawn) {
    line("WITHDRAWN. This report is no longer valid.", 12, "F2", 18);
  }
  line(`Verify at: ${input.verifyUrl}`, 9, "F1", 13, MARGIN_X, 96);
  page.y -= 10;

  line("Stone", 12, "F2", 18);
  for (const row of input.rows) {
    ensure(15);
    text(page, MARGIN_X, page.y, 10, "F2", row.label);
    const wrapped = wrapText(toPdfAscii(row.value), 60);
    wrapped.forEach((piece, index) => {
      if (index > 0) ensure(14);
      text(page, MARGIN_X + 150, page.y, 10, "F1", piece);
      page.y -= 14;
    });
  }
  page.y -= 8;

  line("Result", 12, "F2", 18);
  if (input.estimateLabel) {
    line(`Estimated value: ${input.estimateLabel}`, 11, "F2", 16);
    if (input.rangeLabel) line(`Range: ${input.rangeLabel}`, 10, "F1", 14);
    if (input.confidenceLabel) line(`Confidence: ${input.confidenceLabel}`, 10, "F1", 14);
  } else {
    line("No result yet. The report is not complete.", 10, "F1", 14);
  }
  page.y -= 8;

  if (input.factors.length > 0) {
    line("Factors used", 12, "F2", 18);
    for (const factor of input.factors) line(`- ${factor}`, 9, "F1", 13, MARGIN_X + 8, 92);
  }

  // Footer on every page: disclaimer, reference and page number. Added after all pages exist.
  const total = pages.length;
  pages.forEach((p, index) => {
    const footer: Page = { ops: [], y: 0 };
    text(footer, MARGIN_X, 74, 8, "F2", "Indicative only. Not a certified appraisal.");
    wrapText(toPdfAscii(VALUATION_DISCLAIMER), 130).forEach((piece, i) => text(footer, MARGIN_X, 62 - i * 10, 8, "F1", piece));
    text(footer, MARGIN_X, 36, 8, "F1", `Reference ${input.reference}   Page ${index + 1} of ${total}`);
    p.ops.push(...footer.ops);
  });

  return assemble(pages);
}

function contentStream(page: Page): string {
  return page.ops.join("\n");
}

/** Writes the PDF object structure and cross-reference table. */
function assemble(pages: Page[]): Buffer {
  const count = pages.length;
  // Object numbers: 1 catalog, 2 pages tree, 3 F1, 4 F2, then page and content pairs.
  const objects: Buffer[] = [];
  const kids: string[] = [];
  for (let i = 0; i < count; i += 1) kids.push(`${5 + i * 2} 0 R`);

  objects.push(Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"));
  objects.push(Buffer.from(`<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${count} >>`, "latin1"));
  objects.push(Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "latin1"));
  objects.push(Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>", "latin1"));
  pages.forEach((p, i) => {
    const contentNumber = 6 + i * 2;
    objects.push(
      Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNumber} 0 R >>`,
        "latin1",
      ),
    );
    const stream = Buffer.from(contentStream(p), "latin1");
    objects.push(
      Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "latin1"), stream, Buffer.from("\nendstream", "latin1")]),
    );
  });

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
