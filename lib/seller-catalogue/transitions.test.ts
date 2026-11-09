import { describe, expect, it } from "vitest";
import { resolveSaveStatus } from "./transitions";

describe("resolveSaveStatus", () => {
  it("creates a draft on Save and sets no timestamps", () => {
    expect(resolveSaveStatus({ current: null, intent: "draft", sellerApproved: true, autoPublish: true })).toEqual({
      ok: true,
      status: "DRAFT",
      setSubmittedAt: false,
      setPublishedAt: false,
    });
  });

  it("submits a new listing for review when auto-publish is off", () => {
    expect(resolveSaveStatus({ current: null, intent: "submit", sellerApproved: true, autoPublish: false })).toEqual({
      ok: true,
      status: "PENDING_REVIEW",
      setSubmittedAt: true,
      setPublishedAt: false,
    });
  });

  it("publishes straight away on submit when auto-publish is on for an approved seller", () => {
    expect(resolveSaveStatus({ current: null, intent: "submit", sellerApproved: true, autoPublish: true })).toEqual({
      ok: true,
      status: "PUBLISHED",
      setSubmittedAt: true,
      setPublishedAt: true,
    });
  });

  it("does not auto-publish when the seller is not approved", () => {
    const result = resolveSaveStatus({ current: null, intent: "submit", sellerApproved: false, autoPublish: true });
    expect(result).toMatchObject({ ok: true, status: "PENDING_REVIEW", setPublishedAt: false });
  });

  it("sends an edited PUBLISHED listing back to DRAFT on Save", () => {
    expect(resolveSaveStatus({ current: "PUBLISHED", intent: "draft", sellerApproved: true, autoPublish: false })).toMatchObject({
      ok: true,
      status: "DRAFT",
      setSubmittedAt: false,
    });
  });

  it("re-submits an edited PUBLISHED listing for review (DRAFT then PENDING_REVIEW)", () => {
    expect(resolveSaveStatus({ current: "PUBLISHED", intent: "submit", sellerApproved: true, autoPublish: false })).toMatchObject({
      ok: true,
      status: "PENDING_REVIEW",
      setSubmittedAt: true,
    });
  });

  it("re-publishes an edited PUBLISHED listing immediately when auto-publish is on", () => {
    expect(resolveSaveStatus({ current: "PUBLISHED", intent: "submit", sellerApproved: true, autoPublish: true })).toMatchObject({
      ok: true,
      status: "PUBLISHED",
      setPublishedAt: true,
    });
  });

  it("keeps a rejected listing rejected on Save and allows resubmission", () => {
    expect(resolveSaveStatus({ current: "REJECTED", intent: "draft", sellerApproved: true, autoPublish: false })).toMatchObject({ ok: true, status: "REJECTED" });
    expect(resolveSaveStatus({ current: "REJECTED", intent: "submit", sellerApproved: true, autoPublish: false })).toMatchObject({
      ok: true,
      status: "PENDING_REVIEW",
    });
  });

  it("refuses to resubmit a listing already awaiting review", () => {
    expect(resolveSaveStatus({ current: "PENDING_REVIEW", intent: "submit", sellerApproved: true, autoPublish: true })).toEqual({
      ok: false,
      reason: "not_submittable",
    });
  });

  it("refuses to edit archived listings", () => {
    expect(resolveSaveStatus({ current: "ARCHIVED", intent: "draft", sellerApproved: true, autoPublish: false })).toEqual({
      ok: false,
      reason: "archived",
    });
  });
});
