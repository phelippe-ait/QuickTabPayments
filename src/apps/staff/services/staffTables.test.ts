import { describe, expect, it } from "vitest";
import { naturalSortTableNumber } from "./staffTables";

describe("naturalSortTableNumber", () => {
  it("sorts numeric table labels naturally", () => {
    const sorted = ["10", "2", "1", "11"].sort(naturalSortTableNumber);
    expect(sorted).toEqual(["1", "2", "10", "11"]);
  });

  it("handles letter suffixes", () => {
    const sorted = ["A2", "A10", "A1"].sort(naturalSortTableNumber);
    expect(sorted).toEqual(["A1", "A2", "A10"]);
  });
});
