import type {
	DataHash,
	IPublicWritable,
	TAsyncSignals,
	TStateMode,
	TDataConfig,
	TWritableCreator,
} from "./types";

// export const STORE_SET_DEFAULT:TStateMode = 1;
export const STORE_SET_SILENT: TStateMode = 2;

type TState<Type> = {
	[Property in keyof Type]: IPublicWritable<Type[Property]>;
};

type StoreConfig = {
	writable: TWritableCreator;
	async: boolean;
}

export default class Store<T extends DataHash> {
	private _state: TState<T>;
	private _values: T;
	private _writable: TWritableCreator;
	private _async: boolean;

	constructor(config: StoreConfig) {
		if (config) {
			this._writable = config.writable;
			this._async = config.async;
		}

		this._values = {} as T;
		this._state = {} as TState<T>;
	}
	setState(
		data: Partial<T>,
		mode: TStateMode | TDataConfig = 0
	): TAsyncSignals {
		const signals = {} as TAsyncSignals;
		this._wrapProperties(
			data,
			this._state,
			this._values,
			"",
			signals,
			mode as TStateMode
		);
		return signals;
	}
	getState(): T {
		return this._values;
	}
	getReactive(): TState<T> {
		return this._state;
	}
	private _wrapProperties(
		data: any, // eslint-disable-line @typescript-eslint/no-explicit-any
		state: any, // eslint-disable-line @typescript-eslint/no-explicit-any
		values: any, // eslint-disable-line @typescript-eslint/no-explicit-any
		parent: string,
		signals: TAsyncSignals,
		mode: TStateMode
	) {
		for (const key in data) {
			const os = state[key];
			const ov = values[key];
			const nv = data[key];

			if (os) {
				// same value
				if (ov === nv && typeof nv !== "object") continue;
				// so maybe we have two dates
				if (nv instanceof Date) {
					if (ov instanceof Date && ov.getTime() === nv.getTime()) continue;
				} else {
					// we have two pointers to the same array of or same object
					// assume that they are different
				}
			}

			const fullKey = parent + (parent ? "." : "") + key;

			if (os) {
				if (os.__parse(nv, fullKey, signals, mode)) values[key] = nv;

				// eslint-disable-next-line no-bitwise
				if (mode & STORE_SET_SILENT) signals[fullKey] = os.__trigger;
				else os.__trigger();
			} else {
				if (nv && nv.__reactive) {
					state[key] = this._wrapNested(nv, nv, fullKey, signals);
				} else {
					state[key] = this._wrapWritable(nv);
				}
				values[key] = nv;
			}
			signals[fullKey] = signals[fullKey] || null;
		}
	}
	private _wrapNested(
		data: any, // eslint-disable-line @typescript-eslint/no-explicit-any
		values: any, // eslint-disable-line @typescript-eslint/no-explicit-any
		fullKey: string,
		signals: TAsyncSignals
	) {
		const state = this._wrapWritable(data);
		this._wrapProperties(data, state, values, fullKey, signals, 0);

		state.__parse = (
			v: any, // eslint-disable-line @typescript-eslint/no-explicit-any
			fullKey: string,
			signals: TAsyncSignals,
			mode: TStateMode
		) => {
			this._wrapProperties(v, state, values, fullKey, signals, mode);
			return false;
		};
		return state;
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private _wrapWritable(val: any): IPublicWritable<any> {
		const ss = [] as ((v: typeof val) => void)[];

		const __triggerSync = function () {
			for (let i = 0; i < ss.length; i++) {
				ss[i](val);
			}
		};
		const __trigger = () => {
			if (ss.length) {
				if (this._async) setTimeout(__triggerSync, 1);
				else __triggerSync();
			}
		};
		const subscribe = (fn: (v: typeof val) => void) => {
			ss.push(fn);

			if (this._async) setTimeout(fn, 1, val);
			else fn(val);

			return () => {
				const i = ss.indexOf(fn);
				if (i >= 0) ss.splice(i, 1);
			};
		};
		const __parse = function (v: typeof val) {
			val = v;
			return true;
		};

		return {
			subscribe,
			__trigger,
			__parse,
		};
	}
}

export function markReactive<T>(t: T, nested?: boolean): T {
	Object.defineProperty(t, "__reactive", {
		value: true,
		enumerable: false,
		writable: false,
	});
	if (nested === true) {
		for (const key in t) {
			const sub = t[key];
			if (typeof sub === "object" && sub !== null) {
				markReactive(sub, true);
			}
		}
	}
	return t;
}
