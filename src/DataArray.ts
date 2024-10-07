import { uid } from "./helpers";
import type { IHasID, TID } from "./types";

export default class _DataArray<T extends IHasID> {
	private _pool: Map<TID, T>;
	private _data: T[];
	constructor(raw: T[]) {
		this._data = raw;
		this._pool = new Map();
		for (let i = 0; i < raw.length; i++) {
			const obj = raw[i];
			this._pool.set(obj.id, obj);
		}
	}
	add(raw: T):void {
		raw = { id: uid(), ...raw };
		this._data.push(raw);
		this._pool.set(raw.id, raw);
	}
	update(id: TID, raw: T):void {
		const index = this._data.findIndex(link => link.id == id);
		const old = this._data[index];
		const updated = { ...old, ...raw };
		this._data[index] = updated;
		this._pool.set(updated.id, updated);
	}
	remove(id: TID):void {
		this._data = this._data.filter(a => a.id != id);
		this._pool.delete(id);
	}
	filter(cb: (value: T) => boolean): void {
		this._data = this._data.filter(x => {
			const check = cb(x);
			if (!check) this._pool.delete(x.id);
			return check;
		});
	}
	byId(id: TID): T {
		return this._pool.get(id);
	}
	map<D>(cb: (value: T, index: number, array: T[]) => D): D[] {
		return this._data.map(cb);
	}
	forEach(cb: (value: T, index: number, array: T[]) => void): void {
		this._data.forEach(cb);
	}
}
