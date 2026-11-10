import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_LABEL,
  DISCLAIMER_TEXT,
  ESTIMATE_METHOD_NOTE,
  EXPERT_REASON_TEXT,
  METHOD_LABEL,
  STATUS_BODY,
  STATUS_LABEL,
  VERIFY_METHOD_LABEL,
  VERIFY_STATUS_LABEL,
  WIZARD_STEPS,
  expertReasonText,
  statusLabel,
  stepText,
} from "./requester-copy";

const STATUSES = ["DRAFT", "SUBMITTED", "AUTO_VALUED", "IN_EXPERT_REVIEW", "NEEDS_INFO", "COMPLETED", "REJECTED"];

describe("statusLabel", () => {
  it("has a label for every valuation status", () => {
    for (const status of STATUSES) {
      expect(STATUS_LABEL[status], status).toBeTruthy();
      expect(statusLabel(status)).toBe(STATUS_LABEL[status]);
    }
  });

  it("shows Withdrawn over any status when the report is withdrawn", () => {
    expect(statusLabel("AUTO_VALUED", true)).toBe("Withdrawn");
    expect(statusLabel("COMPLETED", true)).toBe("Withdrawn");
  });

  it("falls back to a neutral label for an unknown status", () => {
    expect(statusLabel("SOMETHING_NEW")).toBe("In progress");
  });

  it("keeps the labels distinct so the list is readable", () => {
    const labels = STATUSES.map((s) => STATUS_LABEL[s]);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("status body copy", () => {
  it("has body copy for each status that a requester sees on the result page", () => {
    for (const status of ["DRAFT", "AUTO_VALUED", "IN_EXPERT_REVIEW", "NEEDS_INFO", "COMPLETED", "REJECTED"]) {
      expect(STATUS_BODY[status], status).toBeTruthy();
    }
  });

  it("does not promise an estimate while the request is with an expert", () => {
    expect(STATUS_BODY.IN_EXPERT_REVIEW).toMatch(/no estimate yet/i);
  });
});

describe("disclaimer and method copy", () => {
  it("states the valuation is indicative and not a certified appraisal", () => {
    expect(DISCLAIMER_TEXT).toMatch(/indicative only/i);
    expect(DISCLAIMER_TEXT).toMatch(/not a certified appraisal/i);
  });

  it("never says the system analyses photos", () => {
    const copy = [ESTIMATE_METHOD_NOTE, DISCLAIMER_TEXT, ...Object.values(STATUS_BODY), ...Object.values(EXPERT_REASON_TEXT)];
    for (const text of copy) {
      expect(text).not.toMatch(/analys\w*\s+(the\s+|your\s+)?(photo|image|picture)/i);
      expect(text).not.toMatch(/(photo|image)s?\s+(are|is)\s+analys/i);
    }
    expect(ESTIMATE_METHOD_NOTE).toMatch(/does not look at your photos/i);
  });

  it("labels the automatic and expert methods as the spec names them", () => {
    expect(METHOD_LABEL.AUTO).toBe("Automatic (rule-based, indicative)");
    expect(METHOD_LABEL.EXPERT).toBe("Expert review (valuer sign-off)");
  });

  it("labels each confidence level", () => {
    expect(CONFIDENCE_LABEL).toEqual({ LOW: "Low", MEDIUM: "Medium", HIGH: "High" });
  });
});

describe("expert reason text", () => {
  it("explains every engine reason in plain words", () => {
    for (const code of ["REQUESTED", "INCOMPLETE", "LOW_CONFIDENCE", "ABOVE_THRESHOLD", "NO_REFERENCE"]) {
      expect(expertReasonText(code)).toBe(EXPERT_REASON_TEXT[code]);
    }
  });

  it("falls back for an unknown code and never returns the raw code", () => {
    expect(expertReasonText("MYSTERY")).toBe("A valuer needs to review this request.");
  });
});

describe("verification copy", () => {
  it("has exactly the three public statuses and two methods", () => {
    expect(Object.keys(VERIFY_STATUS_LABEL).sort()).toEqual(["NOT_COMPLETE", "VALID", "WITHDRAWN"]);
    expect(VERIFY_STATUS_LABEL.VALID).toBe("Valid");
    expect(VERIFY_STATUS_LABEL.WITHDRAWN).toBe("Withdrawn");
    expect(VERIFY_STATUS_LABEL.NOT_COMPLETE).toBe("Not complete");
    expect(VERIFY_METHOD_LABEL).toEqual({ AUTO: "Automatic", EXPERT: "Expert" });
  });
});

describe("wizard steps", () => {
  it("has three steps and labels them Step N of 3", () => {
    expect(WIZARD_STEPS.map((s) => s.label)).toEqual(["Upload", "Review", "Result"]);
    expect(stepText(1)).toBe("Step 1 of 3");
    expect(stepText(3)).toBe("Step 3 of 3");
  });
});
