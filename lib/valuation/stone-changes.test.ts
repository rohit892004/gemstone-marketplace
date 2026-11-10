import { describe, expect, it } from "vitest";
import { changedKeyStoneFields } from "./stone-changes";

const before = { species: "Ruby", caratWeight: "1.200", treatment: null, certificateLabId: "lab_1", certificateNo: "GIA-1", title: "Old" };

describe("changedKeyStoneFields", () => {
  it("reports nothing when the key stone details are unchanged", () => {
    expect(changedKeyStoneFields(before, { ...before, title: "New title" })).toEqual([]);
  });

  it("treats carat with different decimal places as the same weight", () => {
    expect(changedKeyStoneFields({ caratWeight: "2.5" }, { caratWeight: "2.500" })).toEqual([]);
    expect(changedKeyStoneFields({ caratWeight: 2.5 }, { caratWeight: "2.500" })).toEqual([]);
  });

  it("reports a carat change", () => {
    expect(changedKeyStoneFields(before, { ...before, caratWeight: "1.25" })).toEqual(["caratWeight"]);
  });

  it("treats an empty value and null as the same", () => {
    expect(changedKeyStoneFields({ treatment: null }, { treatment: "  " })).toEqual([]);
  });

  it("reports treatment, certificate and species changes", () => {
    expect(changedKeyStoneFields(before, { treatment: "Heated", certificateNo: "GIA-2", species: "Sapphire" })).toEqual([
      "species",
      "treatment",
      "certificateNo",
    ]);
  });

  it("ignores key fields the update does not carry", () => {
    expect(changedKeyStoneFields(before, { title: "x" })).toEqual([]);
  });
});
