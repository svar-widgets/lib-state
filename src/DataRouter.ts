import type {
	TDataConfig,
	TDataBlock,
	TParserHash,
	IStringHash,
	TAsyncSignals,
	TStateMode,
} from "./types";
import type EventBus from "./EventBus";
import { STORE_SET_SILENT } from "./Store";

type TSetter<T> = (data: Partial<T>, mode?: TStateMode) => TAsyncSignals;
type TStoreLike<T> = {
	setState: TSetter<T>;
};

type AsyncUpdate = {
	timer: number;
	signals: TAsyncSignals;
};

export default class DataRouter<T, D, E> {
	private _setter: TSetter<T>;
	private _routes: TDataConfig;
	private _triggers: Map<string, TDataBlock[]>;
	private _sources: Map<string, IStringHash<boolean>>;
	private _prev: Partial<D>;
	private _parsers: TParserHash;
	private _bus: EventBus<E, keyof E> | undefined;
	private _async: AsyncUpdate | null;

	constructor(
		s: TSetter<T> | TStoreLike<T>,
		r: TDataConfig,
		p: TParserHash,
		b?: EventBus<E, keyof E>
	) {
		if (typeof s === "function") this._setter = s;
		else this._setter = s.setState.bind(s);

		this._routes = r;
		this._parsers = p;
		this._prev = {};

		this._triggers = new Map();
		this._sources = new Map();
		this._routes.forEach(a => {
			a.in.forEach(k => {
				const arr = this._triggers.get(k) || [];
				arr.push(a);
				this._triggers.set(k, arr);
			});
			a.out.forEach(k => {
				const h: IStringHash<boolean> = this._sources.get(k) || {};
				a.in.forEach(i => (h[i] = true));
				this._sources.set(k, h);
			});
		});

		this._routes.forEach(a => {
			a.length = Math.max(
				...a.in.map(key => _calckSize(key, this._sources, 1))
			);
		});

		this._bus = b;
	}
	init(cfg: Partial<D>):void {
		const next: Partial<T> = {};
		for (const key in cfg) {
			if (this._prev[key] !== cfg[key]) {
				const parser = this._parsers[key];
				next[key as unknown as keyof T] = parser ? parser(cfg[key]) : cfg[key];
			}
		}

		this._prev = this._prev ? { ...this._prev, ...cfg } : { ...cfg };
		this.setState(next);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if (this._bus) this._bus.exec("init-state" as any, next as any);
	}
	setStateAsync(updates: Partial<T>): TAsyncSignals {
		const signals = this._setter(updates, STORE_SET_SILENT);
		if (this._async) {
			Object.assign(this._async.signals, signals);
		} else {
			this._async = {
				signals,
				timer: setTimeout(this._applyState.bind(this), 1) as unknown as number,
			};
		}

		return signals;
	}
	_applyState():void {
		const obj = this._async;
		if (!obj) return;
		this._async = null;

		// trigger dynamic values calculation
		this._triggerUpdates(obj.signals, []);
		// trigger external subscription
		for (const key in obj.signals) {
			const h = obj.signals[key];
			if (h) h();
		}
	}
	setState(updates: Partial<T>, ctx: TDataConfig = []): TAsyncSignals {
		const signals = this._setter(updates);
		this._triggerUpdates(signals, ctx);
		return signals;
	}
	private _triggerUpdates(signals: TAsyncSignals, ctx: TDataConfig) {
		const keys = Object.keys(signals);
		const needExec = !ctx.length;
		ctx = ctx || [];

		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			const trgs = this._triggers.get(key);
			if (trgs) {
				trgs.forEach(a => {
					if (ctx.indexOf(a) == -1) {
						ctx.push(a);
					}
				});
			}
		}

		if (needExec) {
			this._execNext(ctx);
		}
	}
	private _execNext(ctx: TDataConfig) {
		while (ctx.length) {
			ctx.sort((a, b) => (a.length! < b.length! ? 1 : -1));

			const next = ctx[ctx.length - 1];
			ctx.splice(ctx.length - 1);
			next.exec(ctx);
		}
	}
}

function _calckSize(
	key: string,
	sources: Map<string, IStringHash<boolean>>,
	prev: number
): number {
	const next = sources.get(key);
	if (!next) return prev;

	const sizes = Object.keys(next).map(a => _calckSize(a, sources, prev + 1));
	return Math.max(...sizes);
}
