import { deepCopy } from "../src/helpers";
import { test, expect } from "vitest";

test("isSame", () => {
	let a, b;

	a = 1;
	b = deepCopy(a);
	expect(a).to.deep.eq(b);

	a = "test";
	b = deepCopy(a);
	expect(a).to.deep.eq(b);

	a = new Date(111111111);
	b = deepCopy(a);
	expect(a.getTime()).to.deep.eq(b.getTime());
	expect(a).not.toBe(b);

	a = [1, 2, 3];
	b = deepCopy(a);
	expect(a).to.deep.eq(b);
	expect(a).not.toBe(b);

	a = { a: 1, b: "2" };
	b = deepCopy(a);
	expect(a).to.deep.eq(b);
	expect(a).not.toBe(b);
});
