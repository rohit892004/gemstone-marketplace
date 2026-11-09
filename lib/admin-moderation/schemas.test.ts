import { describe, expect, it } from "vitest";
import {
  checkboxIsOn,
  conversationReasonSchema,
  flagDecisionSchema,
  idSchema,
  reportDecisionSchema,
  requirementCloseSchema,
} from "./schemas";

const ID = "clx9f0abc0001";

describe("admin reason rules", () => {
  it("refuses a missing reason", () => {
    expect(conversationReasonSchema.safeParse({ conversationId: ID, reason: "" }).success).toBe(false);
  });

  it("refuses a reason shorter than ten characters after trimming", () => {
    expect(conversationReasonSchema.safeParse({ conversationId: ID, reason: "  short   " }).success).toBe(false);
  });

  it("accepts a reason of exactly ten characters", () => {
    const result = conversationReasonSchema.safeParse({ conversationId: ID, reason: "0123456789" });
    expect(result.success).toBe(true);
  });

  it("refuses a reason over 500 characters", () => {
    expect(conversationReasonSchema.safeParse({ conversationId: ID, reason: "x".repeat(501) }).success).toBe(false);
    expect(conversationReasonSchema.safeParse({ conversationId: ID, reason: "x".repeat(500) }).success).toBe(true);
  });

  it("applies the same rule to report notes and requirement close reasons", () => {
    expect(reportDecisionSchema.safeParse({ reportId: ID, decision: "RESOLVE", restrict: false, note: "no" }).success).toBe(false);
    expect(requirementCloseSchema.safeParse({ requirementId: ID, reason: "no" }).success).toBe(false);
    expect(requirementCloseSchema.safeParse({ requirementId: ID, reason: "Duplicate of an earlier post" }).success).toBe(true);
  });
});

describe("ids", () => {
  it("refuses ids with path or cookie-breaking characters", () => {
    expect(idSchema.safeParse("../../etc").success).toBe(false);
    expect(idSchema.safeParse("a;b=c").success).toBe(false);
    expect(idSchema.safeParse("").success).toBe(false);
    expect(idSchema.safeParse(ID).success).toBe(true);
  });
});

describe("flagDecisionSchema", () => {
  it("accepts dismiss and mark-actioned decisions only", () => {
    expect(flagDecisionSchema.safeParse({ flagId: ID, decision: "DISMISS", restrict: false, note: "" }).success).toBe(true);
    expect(flagDecisionSchema.safeParse({ flagId: ID, decision: "ACTION", restrict: true, note: "" }).success).toBe(true);
    expect(flagDecisionSchema.safeParse({ flagId: ID, decision: "DELETE", restrict: false, note: "" }).success).toBe(false);
  });

  it("treats a blank note as no note and trims a filled one", () => {
    const blank = flagDecisionSchema.parse({ flagId: ID, decision: "ACTION", restrict: false, note: "   " });
    expect(blank.note).toBeUndefined();
    const filled = flagDecisionSchema.parse({ flagId: ID, decision: "ACTION", restrict: false, note: "  repeat  " });
    expect(filled.note).toBe("repeat");
  });
});

describe("checkboxIsOn", () => {
  it("reads a ticked box and nothing else as true", () => {
    expect(checkboxIsOn("on")).toBe(true);
    expect(checkboxIsOn("true")).toBe(true);
    expect(checkboxIsOn(null)).toBe(false);
    expect(checkboxIsOn("")).toBe(false);
    expect(checkboxIsOn("yes")).toBe(false);
  });
});
