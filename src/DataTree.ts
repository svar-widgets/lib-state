import type { IHasIDAndParent, TID } from "./types";

export default class DataTree<T extends IHasIDAndParent> {
	public _pool: Map<TID, T>;

	constructor(raw?: T[]) {
		const top: IHasIDAndParent = {
			id: 0,
			$level: 0,
			data: [],
			parent: null,
		};
		const items: Map<TID, T> = new Map();
		items.set(0, top as T);
		this._pool = items;

		if (raw && raw.length) this.parse(raw, 0);
	}
	parse(raw: T[], parent: TID):void {
		const items = this._pool;

		for (let i = 0; i < raw.length; i++) {
			const obj = raw[i];
			obj.parent = obj.parent || parent;
			obj.data = null;
			items.set(obj.id, obj);
		}

		for (let i = 0; i < raw.length; i++) {
			const obj = raw[i];
			const temp = items.get(obj.parent);
			if (temp) {
				if (!temp.data) temp.data = [];
				temp.data.push(obj);
			}
		}

		const top = items.get(parent);
		setLevel(top.data, top.$level + 1);
	}
	add(raw: T, index: number): void {
		this._pool.set(raw.id, raw);

		const parent = this._pool.get(raw.parent || 0);
		raw.$level = parent.$level + 1;

		if (parent.data) {
			if (index === -1) parent.data.push(raw);
			else parent.data.splice(index, -1, raw);
		} else parent.data = [raw];
	}
	addAfter(raw: T, after: TID):void {
		if (!after) {
			return this.add(raw, -1);
		}

		const node = this.byId(after);
		const parent = this.byId(node.parent);
		const index = parent.data.indexOf(node) + 1;

		raw.parent = parent.id;
		raw.$level = parent.$level + 1;
		this.add(raw, index);
	}
	remove(id: TID): void {
		const obj = this._pool.get(id);
		this._remove(obj);
		const parent = this._pool.get(obj.parent);
		parent.data = parent.data.filter(a => a.id != id);
		this._clearBranch(parent);
	}
	_remove(obj: T):void {
		if (obj.data) {
			obj.data.forEach(i => this._remove(i as T));
		}
		this._pool.delete(obj.id);
	}
	update<Data>(id: TID, values: Data): void {
		let obj = this._pool.get(id);
		const branch = this._pool.get(obj.parent);
		const index = branch.data.indexOf(obj);

		obj = { ...obj, ...values };

		branch.data[index] = obj;
		this._pool.set(obj.id, obj);
	}
	move(id: TID, mode: string, target: TID): void {
		const now = this._pool.get(id);
		const dropChild = mode === "child";
		const tobj = this._pool.get(target);
		const tLevel = tobj.$level + (dropChild ? 1 : 0);
		if (!now || !tobj) return;

		const parent = this._pool.get(now.parent);
		const newParent = dropChild ? tobj : this._pool.get(tobj.parent);
		if (!newParent.data) newParent.data = [];

		const index = parent.data.indexOf(now);
		parent.data.splice(index, 1);
		const newIndex = dropChild
			? newParent.data.length
			: newParent.data.indexOf(tobj) + (mode === "after" ? 1 : 0);
		newParent.data.splice(newIndex, -1, now);

		if (parent === newParent && index === newIndex) return null;

		now.parent = newParent.id;

		if (now.$level !== tLevel) setLevel([now], tLevel);

		this._clearBranch(parent);
	}

	private _clearBranch(obj: T): void {
		if (obj.data && !obj.data.length) {
			if (obj.open) delete obj.open;
			obj.data = null;
		}
	}

	toArray(): T[] {
		const out: T[] = [];
		const kids = this._pool.get(0).data;
		if (kids) toArray(kids, out);
		return out;
	}
	byId(id: TID): T {
		return this._pool.get(id);
	}

	getBranch(id: TID): T[] {
		return this._pool.get(id).data as T[];
	}

	forEach(cb: (value: T) => void): void {
		this._pool.forEach((value, key) => {
			if (key !== 0) cb(value);
		});
	}

	eachChild(cb: (value: T, index: number) => void, parent: TID): void {
		const p = this.byId(parent);
		if (!p || !p.data) return;
		p.data.forEach((child, index) => {
			cb(this.byId(child.id), index);
			this.eachChild(cb, child.id);
		});
	}
}

function toArray<T extends IHasIDAndParent>(line: T[], out: T[]): void {
	line.forEach(a => {
		out.push(a);
		if (a.open === true) {
			toArray(a.data, out);
		}
	});
}

function setLevel(data: IHasIDAndParent[], level: number): void {
	for (let i = 0; i < data.length; i++) {
		const next = data[i];
		next.$level = level;
		if (next.data) setLevel(next.data, level + 1);
	}
}
