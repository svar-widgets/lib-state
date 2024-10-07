import { expect, test } from "vitest";
import { EventBus, EventResolver } from "../src/index";

function getEventBus() {
	return new EventBus();
}

function sleep(ms) {
	return new Promise(res => setTimeout(res, ms));
}

test("constructor", () => {
	const bus = getEventBus();
	expect(bus).toBeDefined();
});

test("exec event", () => {
	return new Promise(res => {
		const bus = getEventBus();
		bus.on("test-event", data => {
			expect(data).is.equal(1);
			res();
		});
		bus.exec("test-event", 1);
	});
});

test("exec event chain", () => {
	let count = 0;
	const bus = getEventBus();

	bus.on("test-event", data => {
		expect(data).is.equal(1);
		expect(count).is.equal(0);
		count += 1;
	});
	bus.on("test-event", data => {
		expect(data).is.equal(1);
		expect(count).is.equal(1);
		count += 10;
	});

	bus.exec("test-event", 1);
	expect(count).is.equal(11);
});

test("exec backward event chain, config", () => {
	let count = 0;
	const bus = getEventBus();

	bus.on(
		"test-event",
		data => {
			expect(data).is.equal(1);
			expect(count).is.equal(10);
			count += 1;
		},
		{ intercept: true }
	);
	bus.on(
		"test-event",
		data => {
			expect(data).is.equal(1);
			expect(count).is.equal(0);
			count += 10;
		},
		{ intercept: true }
	);

	bus.exec("test-event", 1);
	expect(count).is.equal(11);
});

test("exec backward event chain, api", () => {
	let count = 0;
	const bus = getEventBus();

	bus.intercept("test-event", data => {
		expect(data).is.equal(1);
		expect(count).is.equal(10);
		count += 1;
	});
	bus.intercept("test-event", data => {
		expect(data).is.equal(1);
		expect(count).is.equal(0);
		count += 10;
	});

	bus.exec("test-event", 1);
	expect(count).is.equal(11);
});

test("exec async event chain", () => {
	let count = 0;
	const bus = getEventBus();

	return new Promise(res => {
		bus.on("test-event", data => {
			expect(data).is.equal(1);
			expect(count).is.equal(0);
			count += 1;
		});
		bus.on("test-event", data => {
			expect(data).is.equal(1);
			expect(count).is.equal(1);
			return new Promise(res2 => {
				setTimeout(() => {
					count += 10;
					res2();
				}, 50);
			});
		});
		bus.on("test-event", data => {
			expect(data).is.equal(1);
			expect(count).is.equal(11);
			res();
		});

		bus.exec("test-event", 1);
	});
});

test("exec and block event chain", () => {
	let count = 0;
	const bus = getEventBus();

	bus.on("test-event", () => {
		count += 1;
		return false;
	});
	bus.on("test-event", () => {
		count += 10;
	});

	bus.exec("test-event", 1);
	expect(count).is.equal(1);
});

test("exec and block async event chain", () => {
	let count = 0;
	const bus = getEventBus();

	return new Promise(res => {
		bus.on("test-event", data => {
			expect(data).is.equal(1);
			expect(count).is.equal(0);
			count += 1;
		});
		bus.on("test-event", data => {
			expect(data).is.equal(1);
			expect(count).is.equal(1);
			return new Promise(res2 => {
				setTimeout(() => {
					count += 10;
					setTimeout(() => res(), 100);
					res2(false);
				}, 50);
			});
		});
		bus.on("test-event", () => {
			count += 100;
		});

		bus.exec("test-event", 1);
	}).then(() => {
		expect(count).is.equal(11);
	});
});

test("detach events", () => {
	let count = 0;
	const bus = getEventBus();

	bus.on(
		"test-event",
		() => {
			count += 1;
		},
		{ tag: 1 }
	);
	bus.on("test-event", () => {
		count += 10;
	});
	bus.on(
		"test-event",
		() => {
			count += 100;
		},
		{ tag: 1 }
	);

	bus.detach(1);
	bus.exec("test-event", 1);
	expect(count).is.equal(10);
});

test("event resolver", () => {
	let count = 0;
	const bus = getEventBus();
	let last = bus;

	bus.on("test-event", data => {
		data.count++;
	});

	bus.exec("test-event", { count: 0, resolve: data => (count = data.count) });
	expect(count).is.equal(0);

	last.setNext(new EventResolver("resolve"));

	bus.exec("test-event", { count: 0, resolve: data => (count = data.count) });
	expect(count).is.equal(1);
});

test("event sync", async () => {
	let ev;
	const bus = getEventBus();

	bus.on("test-event", async data => {
		data.count++;
	});
	bus.on("test-event", async data => {
		await sleep(1);
		data.count++;
	});

	ev = await bus.exec("test-event", { count: 0 });
	expect(ev.count).is.equal(2);

	const bus2 = getEventBus();
	bus2.on("test-event", async data => {
		await sleep(1);
		data.count += 2;
	});

	bus.setNext(bus2);
	ev = await bus.exec("test-event", { count: 0 });
	expect(ev.count).is.equal(4);
});
