import { expect, test } from "vitest";
import { Store, markReactive } from "../src/index";
import { STORE_SET_SILENT } from "../src/Store";

function getStore(async = false) {
	return new Store({ async });
}

function keys(s) {
	return Object.keys(s);
}

test("constructor", () => {
	const store = getStore();
	expect(store).toBeDefined();
});

test("set state", () => {
	const store = getStore();
	store.setState({
		test: 1,
		obj: { id: 2 },
	});

	expect(store.getState()).is.deep.equal({
		test: 1,
		obj: { id: 2 },
	});
});

test("get reactive state", () => {
	const store = getStore();
	store.setState({
		test: 1,
	});
	const reactiveState = store.getReactive();

	let last = [];
	reactiveState.test.subscribe(state => {
		last.push(state);
	});

	expect(last).to.deep.eq([1]);

	store.setState({
		test: 2,
	});
	expect(last).to.deep.eq([1, 2]);

	store.setState({
		other: 1,
	});
	expect(last).to.deep.eq([1, 2]);

	store.setState({
		test: 1,
	});
	expect(last).to.deep.eq([1, 2, 1]);
});

test("async store", async () => {
	await new Promise(resolve => {
		const store = getStore(true);
		store.setState({
			test: 1,
		});
		const reactiveState = store.getReactive();

		let last = [];
		reactiveState.test.subscribe(state => {
			last.push(state);
		});

		expect(last).to.deep.eq([]);

		store.setState({
			test: 2,
		});
		expect(last).to.deep.eq([]);

		setTimeout(() => {
			expect(last).to.deep.eq([1, 2]);
			resolve();
		}, 100);
	});
});

test("store ignores old values", () => {
	const store = getStore();
	store.setState({
		a: 1,
		b: "2",
		c: new Date(2018, 1, 1),
		d: [1],
		e: { x: 1 },
	});

	let ss = store.setState({
		a: 1,
		b: "2",
		c: new Date(2018, 1, 1),
		d: [1],
		e: { x: 1 },
	});
	expect(keys(ss)).to.deep.eq(["d", "e"]);

	ss = store.setState({
		a: "1",
		b: 2,
		c: new Date(2018, 1, 2),
	});
	expect(keys(ss)).to.deep.eq(["a", "b", "c"]);
});

test("reactive objects", () => {
	const store = getStore();
	store.setState({
		a: markReactive({ x: 1 }),
	});

	let count = 0;
	store.getReactive().a.x.subscribe(() => {
		count++;
	});

	expect(store.getState().a.x).to.deep.eq(1);
	expect(count).to.deep.eq(1);

	let ss = store.setState({
		a: { x: 2 },
	});
	expect(keys(ss)).to.deep.eq(["a.x", "a"]);
	expect(store.getState().a.x).to.deep.eq(2);
	expect(count).to.deep.eq(2);

	ss = store.setState({
		a: {},
	});
	expect(keys(ss)).to.deep.eq(["a"]);
	expect(store.getState().a.x).to.deep.eq(2);
	expect(count).to.deep.eq(2);

	ss = store.setState({});
	expect(keys(ss)).to.deep.eq([]);
	expect(store.getState().a.x).to.deep.eq(2);
	expect(count).to.deep.eq(2);

	ss = store.setState({
		a: { x: 3 },
	});
	expect(keys(ss)).to.deep.eq(["a.x", "a"]);
	expect(store.getState().a.x).to.deep.eq(3);
	expect(count).to.deep.eq(3);
});

test("reactive arrays", () => {
	const store = getStore();
	store.setState({
		a: markReactive([1]),
	});

	let count = 0;
	store.getReactive().a[0].subscribe(() => {
		count++;
	});

	expect(store.getState().a[0]).to.deep.eq(1);
	expect(count).to.deep.eq(1);

	let ss = store.setState({
		a: [2],
	});
	expect(keys(ss)).to.deep.eq(["a.0", "a"]);
	expect(store.getState().a[0]).to.deep.eq(2);
	expect(count).to.deep.eq(2);

	ss = store.setState({
		a: [],
	});
	expect(keys(ss)).to.deep.eq(["a"]);
	expect(store.getState().a[0]).to.deep.eq(2);
	expect(count).to.deep.eq(2);

	ss = store.setState({});
	expect(keys(ss)).to.deep.eq([]);
	expect(store.getState().a[0]).to.deep.eq(2);
	expect(count).to.deep.eq(2);

	ss = store.setState({
		a: [3],
	});
	expect(keys(ss)).to.deep.eq(["a.0", "a"]);
	expect(store.getState().a[0]).to.deep.eq(3);
	expect(count).to.deep.eq(3);
});

test("reactive arrays, skip params", () => {
	const store = getStore();
	store.setState({
		a: markReactive([4, 1]),
	});

	let count = 0;
	store.getReactive().a[1].subscribe(() => {
		count++;
	});

	expect(store.getState().a[1]).to.deep.eq(1);
	expect(count).to.deep.eq(1);

	let ss = store.setState({
		a: [, 2], // eslint-disable-line no-sparse-arrays
	});
	expect(keys(ss)).to.deep.eq(["a.1", "a"]);
	expect(store.getState().a[1]).to.deep.eq(2);
	expect(count).to.deep.eq(2);

	ss = store.setState({
		a: [],
	});
	expect(keys(ss)).to.deep.eq(["a"]);
	expect(store.getState().a[1]).to.deep.eq(2);
	expect(count).to.deep.eq(2);

	ss = store.setState({});
	expect(keys(ss)).to.deep.eq([]);
	expect(store.getState().a[1]).to.deep.eq(2);
	expect(count).to.deep.eq(2);

	ss = store.setState({
		a: [, 3], // eslint-disable-line no-sparse-arrays
	});
	expect(keys(ss)).to.deep.eq(["a.1", "a"]);
	expect(store.getState().a[1]).to.deep.eq(3);
	expect(count).to.deep.eq(3);
});

test("reactive nested structure", () => {
	const store = getStore();
	store.setState({
		a: markReactive([
			markReactive({ x: 1, y: 4 }),
			markReactive({ x: 2, y: 4 }),
		]),
	});

	let count = 0;
	store.getReactive().a[1].x.subscribe(() => {
		count++;
	});
	expect(count).to.deep.eq(1);

	// eslint-disable-next-line no-sparse-arrays
	const ss = store.setState({ a: [, { x: 3 }] });
	expect(keys(ss)).to.deep.eq(["a.1.x", "a.1", "a"]);
	expect(store.getState().a[1].x).to.deep.eq(3);
	expect(store.getState().a[1].y).to.deep.eq(4);
	expect(count).to.deep.eq(2);
});

test("nested markReactive", () => {
	const store = getStore();
	store.setState({
		a: markReactive(
			[
				{ x: 1, y: 4 },
				{ x: 2, y: 4 },
			],
			true
		),
	});

	let count = 0;
	store.getReactive().a[1].x.subscribe(() => {
		count++;
	});
	expect(count).to.deep.eq(1);

	// eslint-disable-next-line no-sparse-arrays
	const ss = store.setState({ a: [, { x: 3 }] });
	expect(keys(ss)).to.deep.eq(["a.1.x", "a.1", "a"]);
	expect(store.getState().a[1].x).to.deep.eq(3);
	expect(store.getState().a[1].y).to.deep.eq(4);
	expect(count).to.deep.eq(2);
});

test("subscribe and unsubscribe", () => {
	const store = getStore();
	store.setState({ x: 1 });

	let count = 0;
	const un = store.getReactive().x.subscribe(() => {
		count++;
	});
	expect(count).to.deep.eq(1);

	store.setState({ x: 2 });
	expect(count).to.deep.eq(2);

	store.setState({ x: 2 });
	expect(count).to.deep.eq(2);

	un();
	store.setState({ x: 3 });
	expect(count).to.deep.eq(2);
});

test("empty values", () => {
	const store = getStore();
	store.setState({ x: null, y: undefined, z: "" });
	expect(store.getState()).to.deep.eq({ x: null, y: undefined, z: "" });
});

test("writable api", () => {
	const store = getStore();
	store.setState({ x: 1, y: markReactive({ z: 2 }) });

	const list = obj => {
		const l = [];
		for (let key in obj) {
			l.push(key);
		}
		return l;
	};

	expect(list(store.getReactive())).to.deep.eq(["x", "y"]);
	expect(list(store.getReactive().x)).to.deep.eq([
		"subscribe",
		"__trigger",
		"__parse",
	]);
	expect(list(store.getReactive().y)).to.deep.eq([
		"subscribe",
		"__trigger",
		"__parse",
		"z",
	]);
	expect(list(store.getReactive().y.z)).to.deep.eq([
		"subscribe",
		"__trigger",
		"__parse",
	]);
	expect(store.getState()).to.deep.eq({ x: 1, y: { z: 2 } });

	store.setState({ y: { z: 3 } });

	expect(list(store.getReactive())).to.deep.eq(["x", "y"]);
	expect(list(store.getReactive().x)).to.deep.eq([
		"subscribe",
		"__trigger",
		"__parse",
	]);
	expect(list(store.getReactive().y)).to.deep.eq([
		"subscribe",
		"__trigger",
		"__parse",
		"z",
	]);
	expect(list(store.getReactive().y.z)).to.deep.eq([
		"subscribe",
		"__trigger",
		"__parse",
	]);
	expect(store.getState()).to.deep.eq({ x: 1, y: { z: 3 } });

	store.setState({ y: { z: 4, e: 5 } });

	expect(list(store.getReactive())).to.deep.eq(["x", "y"]);
	expect(list(store.getReactive().x)).to.deep.eq([
		"subscribe",
		"__trigger",
		"__parse",
	]);
	expect(list(store.getReactive().y)).to.deep.eq([
		"subscribe",
		"__trigger",
		"__parse",
		"z",
		"e",
	]);
	expect(list(store.getReactive().y.z)).to.deep.eq([
		"subscribe",
		"__trigger",
		"__parse",
	]);
	expect(store.getState()).to.deep.eq({ x: 1, y: { z: 4, e: 5 } });
});

test("get immeditate state", () => {
	const store = getStore();
	store.setState({
		test: 1,
	});

	expect(store.getState().test).is.equal(1);

	store.setState({
		test: 2,
	});

	expect(store.getState().test).is.equal(2);
});

test("set state async", async () => {
	const store = getStore();
	const cValues = [];
	store.setState({ c: 1 });

	store.getReactive().c.subscribe(v => {
		cValues.push(v);
	});
	expect(cValues).to.deep.eq([1]);

	let asig;
	asig = store.setState({ c: 1 }, STORE_SET_SILENT);
	expect(asig).to.deep.eq({});
	expect(cValues).to.deep.eq([1]);

	asig = store.setState({ c: 2 }, STORE_SET_SILENT);
	expect(!!asig.c).eq(true);
	expect(store.getState()).to.deep.eq({ c: 2 });
	expect(cValues).to.deep.eq([1]);

	asig.c();
	expect(cValues).to.deep.eq([1, 2]);

	asig = store.setState({ c: 3 }, STORE_SET_SILENT);
	store.setState({ c: 4 }, STORE_SET_SILENT);
	store.setState({ c: 5 }, STORE_SET_SILENT);
	asig.c();
	expect(cValues).to.deep.eq([1, 2, 5]);
});
