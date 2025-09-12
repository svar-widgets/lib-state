export type IWritable<T> = {
	subscribe: (fn: (v: T) => void) => void;
	update: (fn: (v: T) => T) => void;
	set: (val: T) => void;
};

export type ICallback<T> = (v: T) => void;

export function writable<T>(value: T): IWritable<T> {
	let subscriptions: ICallback<T>[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let timer: any;

	const triggerAsync = (b: T) => {
		if (timer) return;

		timer = setTimeout(() => {
			timer = null;
			subscriptions.forEach(a => {
				if (a) a(b);
			});
		}, 1);
	};

	return {
		subscribe: (handler: ICallback<T>) => {
			subscriptions.push(handler);
			triggerAsync(value);

			return () => (subscriptions = subscriptions.filter(a => a != handler));
		},
		set: (nv: T) => {
			value = nv;
			triggerAsync(value);
		},
		update: (cb: (v: T) => T) => {
			value = cb(value);
			triggerAsync(value);
		},
	};
}
