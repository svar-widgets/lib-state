import { isSame } from "../src/helpers";
import { test, expect } from "vitest";

test("isSame", () => {
	expect(isSame("a", "a")).toBe(true);
	expect(isSame("a", "b")).toBe(false);

	expect(isSame({ a: 1, b: "2" }, { a: 1, b: "2" })).toBe(true);
	expect(isSame({ a: 1, b: "2" }, { a: 1, b: "2", c: 3 })).toBe(false);
	expect(isSame({ a: 1, b: "2", c: 3 }, { a: 1, b: "2" })).toBe(false);
	expect(isSame({ a: 1, b: "2" }, { a: 1, b: "3" })).toBe(false);
	expect(isSame({ a: 1, b: "2" }, { a: 1, c: "2" })).toBe(false);
	expect(isSame({ a: 1 }, { a: 2 })).toBe(false);

	expect(isSame({ a: [1] }, { a: [1] })).toBe(true);
	expect(isSame({ a: [1] }, { a: [1, 2] })).toBe(false);
	expect(isSame({ a: [1] }, { a: [2] })).toBe(false);

	expect(isSame({ a: new Date(111111111) }, { a: new Date(111111111) })).toBe(
		true
	);
	expect(isSame({ a: new Date(111111111) }, { a: new Date(111111112) })).toBe(
		false
	);

	expect(isSame({ a: { key: 1 } }, { a: { key: 1 } })).toBe(true);
	expect(isSame({ a: { key: 1 } }, { a: { key: 2 } })).toBe(false);

	expect(isSame({ c: [{ a: 1 }, { a: 2 }] }, { c: [{ a: 1 }, { a: 2 }] })).toBe(
		true
	);
	expect(isSame({ c: [{ a: 1 }, { a: 2 }] }, { c: [{ a: 1 }, { a: 3 }] })).toBe(
		false
	);
});
