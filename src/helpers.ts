let iid = new Date().valueOf();
export const uid = ():number => iid++;

export function tempID(): string {
	return "temp://" + iid++;
}

export function isTempID(v: string | number): boolean {
	return (
		typeof v === "string" && v.length === 20 && parseInt(v.substr(7)) > 1e12
	);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isSameObject(left: any, right: any): boolean {
	if (Object.keys(left).length !== Object.keys(right).length) return false;
	
	for (const key in right) {
		const v = left[key];
		const nv = right[key];

		if (!isSame(v, nv)) return false;
	}
	return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isSame(v: any, nv: any): boolean {
	const primitiveValue =
		typeof v === "number" ||
		typeof v === "string" ||
		typeof v === "boolean" ||
		v === null;
	if (primitiveValue) return v === nv;

	// different types of data
	if (typeof v !== typeof nv) return false;
	// data vs null
	if ((v === null || nv === null) && v !== nv) return false;
	// dates
	if (v instanceof Date && nv instanceof Date && v.getTime() !== nv.getTime())
		return false;
	// arrays and objects
	if (typeof v === "object") {
		if (Array.isArray(v) && Array.isArray(nv)) {
			if (v.length !== nv.length) return false;
			for (let i = v.length - 1; i >= 0; i--) {
				if (!isSame(v[i], nv[i])) return false;
			}
			return true;
		} else {
			return isSameObject(v, nv);
		}
	}

	return v === nv;
}

export function deepCopy<T>(obj: T): T {
	if (typeof obj !== "object") return obj;
	if (obj === null) return obj;
	if (obj instanceof Date) return new Date(obj) as T;
	if (obj instanceof Array) return obj.map(deepCopy) as T;

	const out: T = {} as T;
	for (const key in obj) {
		out[key] = deepCopy(obj[key]);
	}
	return out;
}
