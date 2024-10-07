import { expect, test } from "vitest";
import DataRouter from "../src/DataRouter";
import Store, { markReactive } from "../src/Store";
import EventBus from "../src/EventBus";

function getEventBus() {
	return new EventBus();
}

function keys(s) {
	return Object.keys(s);
}

async function sleep(time) {
	await new Promise(res => setTimeout(res, time));
}

test("create data-router", () => {
	let obj = {};

	const dr = new DataRouter(v => (obj = { ...obj, ...v }), [], {});
	dr.setState({ a: 1 });

	expect(obj).to.deep.eq({ a: 1 });
});

test("sync trigger changes", () => {
	let obj = { b: 0 };
	const setter = v => {
		obj = { ...obj, ...v };
		return v;
	};
	const dr = new DataRouter(
		setter,
		[
			{
				in: ["a"],
				out: ["b"],
				exec: ctx => dr.setState({ b: obj.b + 1 }, ctx),
			},
		],
		{}
	);

	dr.setState({ c: 1 });
	expect(obj).to.deep.eq({ c: 1, b: 0 });
	dr.setState({ a: 1 });
	dr.setState({ a: 1 });
	dr.setState({ a: 1 });
	expect(obj).to.deep.eq({ a: 1, c: 1, b: 3 });
});

test("async trigger changes", async () => {
	let obj = { b: 0 };
	const asyncSetter = v => {
		obj = { ...obj, ...v };
		const t = { ...v };
		for (const key in t) t[key] = () => true;
		return t;
	};
	const dr = new DataRouter(
		asyncSetter,
		[
			{
				in: ["a"],
				out: ["b"],
				exec: ctx => dr.setState({ b: obj.b + 1 }, ctx),
			},
		],
		{}
	);

	dr.setState({ c: 1 });
	expect(obj).to.deep.eq({ c: 1, b: 0 });
	await sleep(10);
	expect(obj).to.deep.eq({ c: 1, b: 0 });

	dr.setStateAsync({ a: 1 });
	dr.setStateAsync({ a: 1 });
	dr.setStateAsync({ a: 1 });
	expect(obj).to.deep.eq({ a: 1, b: 0, c: 1 });
	await sleep(50);
	expect(obj).to.deep.eq({ a: 1, b: 1, c: 1 });
});

test("event bus handler for data-router", () => {
	const bus = getEventBus();
	let obj = {},
		obj2 = null;
	bus.on("init-state", d => (obj2 = d));

	const dr = new DataRouter(v => (obj = { ...obj, ...v }), [], {}, bus);

	dr.setState({ a: 1 });

	expect(obj).to.deep.eq({ a: 1 });
	expect(obj2).to.deep.eq(null);

	dr.init({ a: 1 });

	expect(obj).to.deep.eq({ a: 1 });
	expect(obj2).to.deep.eq({ a: 1 });

	dr.init({ b: 1, a: 2 });

	expect(obj).to.deep.eq({ b: 1, a: 2 });
	expect(obj2).to.deep.eq({ b: 1, a: 2 });

	dr.init({ b: 2 });

	expect(obj).to.deep.eq({ b: 2, a: 2 });
	expect(obj2).to.deep.eq({ b: 2 });
});

test("state recalculations", () => {
	const store = new Store();
	let count = 0;

	const dr = new DataRouter(store.setState.bind(store), [
		{
			in: ["start", "end"],
			out: ["full"],
			exec: ctx => {
				const { start, end } = store.getState();
				count++;
				dr.setState({ full: `${start}-${end}` }, ctx);
			},
		},
	]);

	dr.setState({ start: 1, end: 2 });
	expect(store.getState()).to.deep.eq({ start: 1, end: 2, full: "1-2" });
	expect(count).to.deep.eq(1);

	dr.setState({ start: 1, end: 3 });
	expect(store.getState()).to.deep.eq({ start: 1, end: 3, full: "1-3" });
	expect(count).to.deep.eq(2);

	dr.setState({ start: 1 });
	expect(store.getState()).to.deep.eq({ start: 1, end: 3, full: "1-3" });
	expect(count).to.deep.eq(2);
});

test("array state recalculations", () => {
	const store = new Store();
	let count = 0;

	const configs = [];
	for (let i = 0; i < 2; i++) {
		configs.push({
			in: [`panels.${i}.start`, `panels.${i}.end`],
			out: [`panels.${i}.full`],
			exec: ctx => {
				const { start, end } = store.getState().panels[i];
				count++;

				const upd = { panels: [] };
				upd.panels[i] = { full: `${start}-${end}` };
				dr.setState(upd, ctx);
			},
		});
	}

	const dr = new DataRouter(store.setState.bind(store), configs);

	let ss = dr.setState({
		panels: markReactive([
			markReactive({ start: 1, end: 2 }),
			markReactive({ start: 1, end: 2 }),
		]),
	});
	expect(keys(ss)).to.deep.eq([
		"panels.0.start",
		"panels.0.end",
		"panels.0",
		"panels.1.start",
		"panels.1.end",
		"panels.1",
		"panels",
	]);
	expect(store.getState()).to.deep.eq({
		panels: [
			{ start: 1, end: 2, full: "1-2" },
			{ start: 1, end: 2, full: "1-2" },
		],
	});
	expect(count).to.deep.eq(2);

	dr.setState({ panels: [{ start: 2 }] });
	expect(store.getState()).to.deep.eq({
		panels: [
			{ start: 2, end: 2, full: "2-2" },
			{ start: 1, end: 2, full: "1-2" },
		],
	});
	expect(count).to.deep.eq(3);

	// eslint-disable-next-line no-sparse-arrays
	dr.setState({ panels: [, { end: 4 }] });
	expect(store.getState()).to.deep.eq({
		panels: [
			{ start: 2, end: 2, full: "2-2" },
			{ start: 1, end: 4, full: "1-4" },
		],
	});
	expect(count).to.deep.eq(4);
});

test("usage with store", async () => {
	const store = new Store();
	store.setState({ b: 0 });

	const dr = new DataRouter(store, [
		{
			in: ["a"],
			out: ["b"],
			exec: ctx => dr.setState({ b: store.getState().b + 1 }, ctx),
		},
	]);

	dr.setState({ a: 1 });
	expect(store.getState()).deep.eq({ a: 1, b: 1 });

	let aValues = [];
	let bValues = [];
	store.getReactive().a.subscribe(v => aValues.push(v));
	store.getReactive().b.subscribe(v => bValues.push(v));
	expect(aValues).to.deep.eq([1]);
	expect(bValues).to.deep.eq([1]);

	dr.setState({ a: 100 });
	expect(store.getState()).deep.eq({ a: 100, b: 2 });
	expect(aValues).to.deep.eq([1, 100]);
	expect(bValues).to.deep.eq([1, 2]);

	dr.setStateAsync({ a: 101 });
	expect(store.getState()).deep.eq({ a: 101, b: 2 });
	expect(aValues).to.deep.eq([1, 100]);
	expect(bValues).to.deep.eq([1, 2]);
	await sleep(10);
	expect(store.getState()).deep.eq({ a: 101, b: 3 });
	expect(aValues).to.deep.eq([1, 100, 101]);
	expect(bValues).to.deep.eq([1, 2, 3]);

	dr.setStateAsync({ a: 200 });
	dr.setStateAsync({ a: 300 });
	dr.setStateAsync({ a: 400 });
	await sleep(10);
	expect(store.getState()).deep.eq({ a: 400, b: 4 });
	expect(aValues).to.deep.eq([1, 100, 101, 400]);
	expect(bValues).to.deep.eq([1, 2, 3, 4]);
});
