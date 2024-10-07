import type { IEventBus, TDispatch, CommonEvent } from "./types";

export default class EventBusRouter<T> implements IEventBus<T> {
	private _dispatch: TDispatch<T>;
	protected _nextHandler: IEventBus<T>;

	constructor(dispatch: TDispatch<T>) {
		this._nextHandler = null;
		this._dispatch = dispatch;
		this.exec = this.exec.bind(this);
	}
	async exec(name: keyof T, ev: CommonEvent): Promise<T[keyof T]> {
		this._dispatch(name, ev as T[keyof T]);
		if (this._nextHandler) await this._nextHandler.exec(name, ev as T[keyof T]);
		return ev as T[keyof T];
	}
	setNext(next: IEventBus<T>): IEventBus<T> {
		return (this._nextHandler = next);
	}
}
