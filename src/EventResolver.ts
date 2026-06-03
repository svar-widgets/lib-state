import type { IEventBus, CommonEvent } from "./types";

export default class EventResolver<T> implements IEventBus<T> {
	private _key: string;
	protected _nextHandler: IEventBus<T>;

	constructor(key: string) {
		this._key = key;
		this._nextHandler = null;

		this.exec = this.exec.bind(this);
	}
	async exec(name: keyof T, ev: T[keyof T]): Promise<T[keyof T]> {
		const obj = ev as CommonEvent;
		if (obj && obj[this._key]) await obj[this._key](obj);
		if (this._nextHandler) {
			await this._nextHandler.exec(name, ev);
		}

		return ev;
	}
	setNext(next: IEventBus<T>): IEventBus<T> {
		return (this._nextHandler = next);
	}
}
