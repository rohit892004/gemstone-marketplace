import { describe, expect, it } from "vitest";
import { pickReportedUserId } from "./reported-user";

describe("pickReportedUserId", () => {
  it("names the sender of the reported message when it is not the reporter", () => {
    expect(
      pickReportedUserId({ reporterId: "u_buyer", participantIds: ["u_buyer", "u_seller"], messageSenderId: "u_seller" }),
    ).toBe("u_seller");
  });

  it("does not name the reporter, even when the reporter sent the message", () => {
    expect(
      pickReportedUserId({ reporterId: "u_buyer", participantIds: ["u_buyer", "u_seller"], messageSenderId: "u_buyer" }),
    ).toBe("u_seller");
  });

  it("uses the single other participant for a conversation-wide report", () => {
    expect(pickReportedUserId({ reporterId: "u_a", participantIds: ["u_a", "u_b"], messageSenderId: null })).toBe("u_b");
  });

  it("returns null when there is no single target", () => {
    expect(
      pickReportedUserId({ reporterId: "u_a", participantIds: ["u_a", "u_b", "u_c"], messageSenderId: null }),
    ).toBeNull();
    expect(pickReportedUserId({ reporterId: "u_a", participantIds: ["u_a"], messageSenderId: null })).toBeNull();
  });

  it("ignores duplicate participant rows", () => {
    expect(pickReportedUserId({ reporterId: "u_a", participantIds: ["u_a", "u_b", "u_b"], messageSenderId: null })).toBe(
      "u_b",
    );
  });
});
