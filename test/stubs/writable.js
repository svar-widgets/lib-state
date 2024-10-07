export function writable(value) {
	let subscriptions = [];
	let timer;

	// const trigger = b =>
	// 	subscriptions.forEach(a => {
	// 		if (a) a(b);
	// 	});
	const triggerAsync = b => {
		if (timer) return;

		timer = setTimeout(() => {
			timer = null;
			subscriptions.forEach(a => {
				if (a) a(b);
			});
		}, 1);
	};

	return {
		subscribe: handler => {
			subscriptions.push(handler);
			triggerAsync(value);

			return () => (subscriptions = subscriptions.filter(a => a != handler));
		},
		set: nv => {
			value = nv;
			triggerAsync(value);
		},
		update: cb => {
			value = cb(value);
			triggerAsync(value);
		},
	};
}
