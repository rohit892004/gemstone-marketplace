import { describe, expect, it } from "vitest";
import { computeSellerRating } from "./rating";

describe("computeSellerRating", () => {
  it("returns null and zero when there are no approved reviews", () => {
    expect(computeSellerRating([])).toEqual({ ratingAverage: null, reviewCount: 0 });
  });

  it("averages approved ratings to 2 decimal places", () => {
    expect(computeSellerRating([5])).toEqual({ ratingAverage: "5.00", reviewCount: 1 });
    expect(computeSellerRating([5, 4, 4])).toEqual({ ratingAverage: "4.33", reviewCount: 3 });
    expect(computeSellerRating([5, 4, 4, 5, 4, 3])).toEqual({ ratingAverage: "4.17", reviewCount: 6 });
  });

  it("rounds half up at the second decimal", () => {
    // 9 / 8 = 1.125, which rounds half up to 1.13
    expect(computeSellerRating([2, 1, 1, 1, 1, 1, 1, 1])).toEqual({ ratingAverage: "1.13", reviewCount: 8 });
  });

  it("keeps trailing zeros", () => {
    expect(computeSellerRating([4, 4, 4, 4])).toEqual({ ratingAverage: "4.00", reviewCount: 4 });
  });
});
