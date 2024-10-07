import type { IEventBus, CommonEvent } from "./types";

export default class EventResolver<T> implements IEventBus<T> {
	private _key: string;
	protected _nextHandler: IEventBus<T>;

	constructor(key: string) {
		this._key = key;
		this._nextHandler = null;

		this.exec = this.exec.bind(this);
	}
	async exec(name: keyof T, ev: CommonEvent): Promise<T[keyof T]> {
		if (ev && ev[this._key]) await ev[this._key](ev);
		if (this._nextHandler) {
			await this._nextHandler.exec(name, ev as T[keyof T]);
		}

		return ev as T[keyof T];
	}
	setNext(next: IEventBus<T>): IEventBus<T> {
		return (this._nextHandler = next);
	}
}
