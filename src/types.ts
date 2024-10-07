export interface IStringHash<T> {
	[key: string]: T;
}

export type TDataBlock = {
	in: string[];
	out: string[];
	exec: (ctx: TDataConfig) => void;
	length?: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Parser = (val: any) => any;

export type TDataConfig = TDataBlock[];
export type TParserHash = IStringHash<Parser>;
export type TID = number | string;

export interface IHasID {
	id?: TID;
}

export interface IEventConfig {
	intercept?: boolean;
	tag?: number | string | symbol;
}

export interface IHasIDAndParent {
	id?: TID;
	parent: TID;
	$level: number;
	data?: IHasIDAndParent[];
	open?: boolean;
}

export type TDispatch<T> = <A extends keyof T>(action: A, data: T[A]) => void;
export interface DataHash {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any;
}

export interface IWritable<T> {
	subscribe: (fn: (v: T) => void) => void;
	update: (fn: (v: T) => T) => void;
	set: (val: T) => void;
}

type TTrigger<T> = (v: T) => void;
type SomeCallback = () => void;
export type TAsyncSignals = { [key: string]: SomeCallback | null };

export interface IPublicWritable<T> {
	subscribe: (fn: TTrigger<T>) => void;
	__trigger(): void;
	__parse: (
		val: T,
		key: string,
		signals: TAsyncSignals,
		mode: TStateMode
	) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TWritableCreator = (val: any) => IWritable<typeof val>;

export interface IEventBus<T> {
	exec(name: keyof T, ev: T[keyof T]): Promise<T[keyof T]>;
	setNext(next: IEventBus<T>): IEventBus<T>;
}

export type ToReactive<Type> = {
	[Property in keyof Type]: IWritable<Type[Property]>;
};

export type TStateMode = number;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CommonEvent = { [key: string]: any };