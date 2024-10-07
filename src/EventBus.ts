import type { IEventConfig, IEventBus } from "./types";

export default class EventBus<T, A extends keyof T> {
	private _handlers: {
		[key in A]: { (v: T[A]): void | boolean | Promise<boolean> }[];
	};
	protected _nextHandler: IEventBus<T>;
	protected _tag: WeakMap<
		{ (v: T[A]): void | boolean | Promise<boolean> },
		number | string | symbol
	>;

	constructor() {
		this._nextHandler = null;
		this._handlers = {} as {
			[key in A]: { (v: T[A]): void | boolean | Promise<boolean> }[];
		};
		this._tag = new WeakMap();

		this.exec = this.exec.bind(this);
	}
	on(
		name: A,
		handler: (v: T[A]) => void | boolean | Promise<boolean>,
		config?: IEventConfig
	):void {
		let prev = this._handlers[name];
		if (!prev) {
			prev = this._handlers[name] = [handler];
		} else {
			if (config && config.intercept) prev.unshift(handler);
			else prev.push(handler);
		}

		if (config && config.tag) this._tag.set(handler, config.tag);
	}
	intercept(
		name: A,
		handler: (v: T[A]) => void | boolean | Promise<boolean>,
		config?: IEventConfig
	):void {
		this.on(name, handler, { ...config, intercept: true });
	}
	detach(tag: number | string | symbol):void {
		for (const key in this._handlers) {
			const stack = this._handlers[key];
			for (let i = stack.length - 1; i >= 0; i--) {
				if (this._tag.get(stack[i]) === tag) {
					stack.splice(i, 1);
				}
			}
		}
	}
	async exec(name: A, ev: T[A]): Promise<T[A]> {
		const stack = this._handlers[name];
		if (stack) {
			for (let i = 0; i < stack.length; i++) {
				const res = stack[i](ev);
				if (res === false) return;
				if (res && (res as Promise<boolean>).then) {
					const res2 = await (res as Promise<boolean>);
					if (res2 === false) return;
				}
			}
		}

		if (this._nextHandler) await this._nextHandler.exec(name, ev);

		return ev;
	}
	setNext(next: IEventBus<T>): IEventBus<T> {
		return (this._nextHandler = next);
	}
}
