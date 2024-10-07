import { expect, test } from "vitest";
import { DataTree } from "../src/index";

function getDataTree() {
	const tree = new DataTree([
		{ id: 1, label: "1.0" },
		{ id: 2, label: "2.0" },
		{ id: 3, label: "3.0" },
		{ id: 21, label: "2.1", parent: 2 },
		{ id: 22, label: "2.2", parent: 2 },
		{ id: 23, label: "2.3", parent: 2 },
		{ id: 221, label: "2.2.1", parent: 22 },
	]);

	return tree;
}

test("eachChild", () => {
	const tree = getDataTree();

	let data = [];
	tree.eachChild(a => data.push(a.id), 0);
	expect(data, "full tree").to.deep.equal([1, 2, 21, 22, 221, 23, 3]);

	data = [];
	tree.eachChild(a => data.push(a.id), 2);
	expect(data, "branch 2").to.deep.equal([21, 22, 221, 23]);

	data = [];
	tree.eachChild(a => data.push(a.id), 3);
	expect(data, "branch 3").to.deep.equal([]);
});

test("forEach", () => {
	const tree = getDataTree();
	let data = [];

	tree.forEach(a => data.push(a.id));
	expect(data.sort(), "full tree").to.deep.equal(
		[1, 2, 21, 22, 221, 23, 3].sort()
	);
});

test("add", () => {
	const t = getDataTree();
	t.add({ id: "x1" }, -1);
	expect(t.getBranch(0).map(a => a.id)).to.deep.equal([1, 2, 3, "x1"]);
	t.add({ id: "x2" }, 0);
	expect(t.getBranch(0).map(a => a.id)).to.deep.equal(["x2", 1, 2, 3, "x1"]);
	t.add({ id: "x3" }, 2);
	expect(t.getBranch(0).map(a => a.id)).to.deep.equal([
		"x2",
		1,
		"x3",
		2,
		3,
		"x1",
	]);

	t.add({ id: "y1", parent: 2 }, -1);
	expect(t.getBranch(2).map(a => a.id)).to.deep.equal([21, 22, 23, "y1"]);

	t.add({ id: "z1", parent: 3 }, -1);
	expect(t.getBranch(3).map(a => a.id)).to.deep.equal(["z1"]);
});

test("remove", () => {
	const t = getDataTree();
	expect(t.byId("z1")).toBeFalsy();
	expect(t.getBranch(3)).toBeFalsy();

	t.add({ id: "z1", parent: 3 }, -1);
	expect(t.byId("z1")).toBeTruthy();
	expect(t.getBranch(3).map(a => a.id)).to.deep.equal(["z1"]);

	t.update(3, { open: true });
	expect(t.byId(3).open).toBeTruthy();

	t.remove("z1");
	expect(t.byId("z1")).toBeFalsy();
	expect(t.getBranch(3)).toBeFalsy();
	expect(t.byId(3).open).toBeFalsy();
});

test("addAfter", () => {
	const t = getDataTree();
	t.addAfter({ id: "y1", parent: 2 }, null);
	expect(t.getBranch(2).map(a => a.id)).to.deep.equal([21, 22, 23, "y1"]);
	t.addAfter({ id: "y2" }, 22);
	expect(t.getBranch(2).map(a => a.id)).to.deep.equal([21, 22, "y2", 23, "y1"]);

	expect(t.byId("y2").$level).to.equal(2);
	expect(t.byId("y2").parent).to.equal(2);

	t.addAfter({ id: "x1" }, 1);
	expect(t.getBranch(0).map(a => a.id)).to.deep.equal([1, "x1", 2, 3]);
	t.addAfter({ id: "x2" }, 3);
	expect(t.getBranch(0).map(a => a.id)).to.deep.equal([1, "x1", 2, 3, "x2"]);

	expect(t.byId("x2").$level).to.equal(1);
	expect(t.byId("x2").parent).to.equal(0);
});
