import { test, expect } from "vitest";
import formatDate from "./formatDate";

export function formatDateTest() {
  expect(formatDate("4/1/2025, 12:34 PM")).toBe("04/01/2025");
}

test("formatDate should pad single digits", formatDateTest);
