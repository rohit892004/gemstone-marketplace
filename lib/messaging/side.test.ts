import { describe, expect, it } from "vitest";
import { conversationSide, sideWhere } from "./side";

describe("conversationSide", () => {
  it("is BUYING for the enquirer on a listing, and SELLING for the listing's seller", () => {
    const enquiry = { kind: "ENQUIRY" as const, startedById: "seller_a" };
    expect(conversationSide(enquiry, "seller_a")).toBe("BUYING");
    expect(conversationSide(enquiry, "seller_b")).toBe("SELLING");
  });

  it("is BUYING for the requirement's poster, and SELLING for a seller who responded", () => {
    const thread = { kind: "REQUIREMENT" as const, startedById: "seller_b", requirement: { buyerId: "seller_a" } };
    expect(conversationSide(thread, "seller_a")).toBe("BUYING");
    expect(conversationSide(thread, "seller_b")).toBe("SELLING");
  });

  it("uses the starter for general chats", () => {
    const chat = { kind: "GENERAL" as const, startedById: "seller_a" };
    expect(conversationSide(chat, "seller_a")).toBe("BUYING");
    expect(conversationSide(chat, "seller_b")).toBe("SELLING");
  });
});

describe("sideWhere", () => {
  it("buying: requirements the user posted, or enquiries and chats the user started", () => {
    const where = sideWhere("seller_a", "buying");
    expect(where).toEqual({
      OR: [{ requirement: { is: { buyerId: "seller_a" } } }, { requirementId: null, startedById: "seller_a" }],
    });
  });

  it("selling: requirements posted by someone else, or enquiries and chats the user did not start", () => {
    const where = sideWhere("seller_a", "selling");
    expect(where).toEqual({
      OR: [{ requirement: { is: { buyerId: { not: "seller_a" } } } }, { requirementId: null, startedById: { not: "seller_a" } }],
    });
  });
});
