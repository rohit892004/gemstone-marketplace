import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/require-role";
import { MESSAGING_ROLES } from "@/lib/messaging/access";
import { formatMoney, QUOTATION_STATUS_LABELS } from "@/lib/quotations/validate";
import { buildQuotationPdf } from "@/lib/quotations/pdf";
import { loadQuotationForPdf } from "@/lib/quotations/service";

/**
 * Quotation PDF. Participants of the conversation only. Anyone else, and any quotation that is not in
 * the conversation named in the URL, gets 404 with the same body as a missing record.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; quotationId: string }> }) {
  const guard = await requireApiRole(MESSAGING_ROLES, { sellerApproved: true });
  if (!guard.ok) return guard.response;

  const { id, quotationId } = await ctx.params;
  const quotation = await loadQuotationForPdf(quotationId, guard.user.id);
  if (!quotation || quotation.conversationId !== id) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const pdf = buildQuotationPdf({
    quotationId: quotation.id,
    businessName: quotation.businessName,
    itemTitle: quotation.itemTitle,
    quantity: quotation.quantity,
    amountLabel: formatMoney(quotation.amountMinor, quotation.currency),
    validUntilLabel: quotation.validUntil
      ? quotation.validUntil.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
      : "No validity date set",
    statusLabel: QUOTATION_STATUS_LABELS[quotation.status] ?? quotation.status,
    terms: quotation.terms,
    issuedLabel: quotation.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }),
    isDemo: quotation.isDemo,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="quotation-${quotation.id}.pdf"`,
      "Content-Length": String(pdf.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
