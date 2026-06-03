import type { IEventBus, TDispatch } from "./types";

export default class EventBusRouter<T> implements IEventBus<T> {
	private _dispatch: TDispatch<T>;
	protected _nextHandler: IEventBus<T>;

	constructor(dispatch: TDispatch<T>) {
		this._nextHandler = null;
		this._dispatch = dispatch;
		this.exec = this.exec.bind(this);
	}
	async exec(name: keyof T, ev: T[keyof T]): Promise<T[keyof T]> {
		this._dispatch(name, ev);
		if (this._nextHandler) await this._nextHandler.exec(name, ev);
		return ev;
	}
	setNext(next: IEventBus<T>): IEventBus<T> {
		return (this._nextHandler = next);
	}
}
