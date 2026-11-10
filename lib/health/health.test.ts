import { describe, expect, it } from "vitest";
import { buildHealthResult } from "./health";

describe("buildHealthResult", () => {
  it("returns 200 with ok status and version when the database answers", () => {
    expect(buildHealthResult(true, "1.2.3")).toEqual({
      httpStatus: 200,
      body: { status: "ok", database: "ok", version: "1.2.3" },
    });
  });

  it("returns 503 and reports only the database state when it does not", () => {
    const result = buildHealthResult(false, "1.2.3");
    expect(result).toEqual({ httpStatus: 503, body: { status: "degraded", database: "down" } });
    expect(JSON.stringify(result.body)).not.toMatch(/version/);
  });
});
