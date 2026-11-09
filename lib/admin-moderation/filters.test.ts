import { describe, expect, it } from "vitest";
import { firstParam, parseReportFilter, parseRequirementFilter } from "./filters";

describe("parseReportFilter", () => {
  it("defaults to open reports for missing or unknown values", () => {
    expect(parseReportFilter(undefined)).toBe("OPEN");
    expect(parseReportFilter("bogus")).toBe("OPEN");
    expect(parseReportFilter("open")).toBe("OPEN"); // case-sensitive: only the enum values
  });

  it("accepts each known filter", () => {
    expect(parseReportFilter("RESOLVED")).toBe("RESOLVED");
    expect(parseReportFilter("DISMISSED")).toBe("DISMISSED");
    expect(parseReportFilter("all")).toBe("all");
  });
});

describe("parseRequirementFilter", () => {
  it("defaults to all requirements", () => {
    expect(parseRequirementFilter(undefined)).toBe("all");
    expect(parseRequirementFilter("nope")).toBe("all");
  });

  it("accepts open and closed", () => {
    expect(parseRequirementFilter("OPEN")).toBe("OPEN");
    expect(parseRequirementFilter("CLOSED")).toBe("CLOSED");
  });
});

describe("firstParam", () => {
  it("takes the first value of a repeated search param", () => {
    expect(firstParam(["OPEN", "CLOSED"])).toBe("OPEN");
    expect(firstParam("RESOLVED")).toBe("RESOLVED");
    expect(firstParam(undefined)).toBeUndefined();
  });
});
