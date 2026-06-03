# Store & DataRouter - Specification

## Overview

The Store and DataRouter modules form a framework-agnostic reactive state management system. Store provides the core state container that wraps values into reactive observables via an externally supplied adapter (e.g., Svelte writable, React useState). DataRouter sits on top of Store and adds two capabilities: computed property recalculation (declarative dependency tracking between state fields) and input normalization via parsers. Together they enable component libraries to maintain reactive state with automatic derived-value propagation, independent of any specific UI framework.

## Quick Reference

### Store

| Method          | Purpose                                      | Returns         |
| --------------- | -------------------------------------------- | --------------- |
| `setState()`    | Set state properties, trigger subscribers    | `TAsyncSignals` |
| `getState()`    | Get current plain values                     | `T`             |
| `getReactive()` | Get reactive wrappers (subscribable objects) | `TState<T>`     |

### DataRouter

| Method            | Purpose                                              | Returns         |
| ----------------- | ---------------------------------------------------- | --------------- |
| `init()`          | Initialize state with defaults, apply parsers        | `void`          |
| `setState()`      | Set state and trigger computed recalculations (sync) | `TAsyncSignals` |
| `setStateAsync()` | Set state silently, batch and flush on next tick     | `TAsyncSignals` |

### markReactive()

| Function         | Purpose                                    | Returns |
| ---------------- | ------------------------------------------ | ------- |
| `markReactive()` | Tag an object for nested reactive wrapping | `T`     |

### Constants

| Constant           | Value | Purpose                                     |
| ------------------ | ----- | ------------------------------------------- |
| `STORE_SET_SILENT` | 2     | Defer subscriber notifications (batch mode) |

## Public Interface

### Type Definitions

```typescript
// Framework-specific writable factory - Store delegates reactive wrapping to this
// e.g., Svelte's `writable`, or a custom React adapter
type TWritableCreator = (val: any) => IWritable<typeof val>;

// Full writable interface expected from framework adapters
interface IWritable<T> {
	subscribe: (fn: (v: T) => void) => void;
	update: (fn: (v: T) => T) => void;
	set: (val: T) => void;
}

// Store configuration
interface StoreConfig {
	writable: TWritableCreator; // Framework adapter for creating reactive wrappers
	async: boolean; // If true, subscriber notifications are asynchronous and coalesced
}

// Signals map returned by setState - keys are dot-separated property paths,
// values are either trigger functions (in silent mode) or null (already triggered)
type TAsyncSignals = { [key: string]: SomeCallback | null };

// State mode flag - bitmask
type TStateMode = number;

// Base constraint for Store's generic type parameter
interface DataHash {
	[key: string]: any;
}

// Computed property dependency declaration
type TDataBlock = {
	in: string[]; // Input fields that trigger recalculation
	out: string[]; // Output fields produced by recalculation
	exec: (ctx: TDataConfig) => void; // Recalculation function
	length?: number; // Computed: dependency chain depth (set by DataRouter)
};

type TDataConfig = TDataBlock[];

// Parser map - transforms raw input values during init()
type TParserHash = { [key: string]: (val: any) => any };
```

### Store

```typescript
class Store<T extends DataHash> {
	constructor(config: StoreConfig);
	setState(data: Partial<T>, mode?: TStateMode | TDataConfig): TAsyncSignals;
	getState(): T;
	getReactive(): TState<T>;
}
```

#### constructor

```typescript
constructor(config: StoreConfig)
```

**Purpose**: Create a new Store instance with the given framework adapter and sync/async mode.

**Parameters**:

- `config.writable` - Factory function that creates framework-specific reactive wrappers. Store calls this for each state property on first set.
- `config.async` - When `true`, subscriber notifications are asynchronous: multiple synchronous changes to the same property within a single call stack are coalesced into a single notification with the final value. When `false`, notifications fire synchronously after each `setState()` call.

**Behavior**:

- The Store starts empty - no reactive properties exist until `setState()` is first called

#### setState()

```typescript
setState(data: Partial<T>, mode?: TStateMode | TDataConfig): TAsyncSignals
```

**Purpose**: Update one or more state properties, create reactive wrappers for new properties, and notify subscribers.

**Parameters**:

- `data` - Partial state object with properties to set
- `mode` - Optional. Either a `TStateMode` bitmask or a `TDataConfig` array (overloaded for internal use by DataRouter)

**Returns**: A signals map where keys are dot-separated property paths that were touched, and values are either trigger callbacks (in silent mode) or `null` (already triggered).

**Behavior**:

- For each key in `data`:
  - **Existing property with unchanged value**: Skips update. Equality checks: strict equality for primitives, `getTime()` comparison for Date instances. Object/array references that are `===` identical are assumed changed (not skipped) to handle mutation patterns.
  - **Existing property with changed value**: Stores the new value and triggers subscribers (immediately or deferred based on `config.async`). In `STORE_SET_SILENT` mode, defers the notification - the trigger callback is stored in the signals map for the caller to invoke later.
  - **New property**: Creates a reactive wrapper for the property. If the value has a `__reactive` marker (set by `markReactive()`), creates a nested reactive structure where sub-properties are individually subscribable.
- Returns the accumulated signals map for all touched properties

**Edge Cases**:

- Setting a property to the same primitive value is a no-op (skipped)
- Setting a property to the same Date (by timestamp) is a no-op
- Setting an object/array to the same reference is NOT skipped - the Store assumes mutable objects may have changed
- Properties with `__reactive` marker get nested wrapping on first set only

#### getState()

```typescript
getState(): T
```

**Purpose**: Return the current plain values object.

**Behavior**:

- Returns the current values reference directly (not a copy)
- Mutations to the returned object affect the store's state

#### getReactive()

```typescript
getReactive(): TState<T>
```

**Purpose**: Return the reactive wrappers map, where each property is a subscribable object.

**Returns**: An object mirroring the state shape, where each value is a subscribable reactive wrapper.

**Behavior**:

- Returns the reactive wrappers map directly
- Subscribers added via `subscribe()` receive the current value immediately on subscription (sync or async depending on `config.async`)
- The unsubscribe function returned by `subscribe()` removes the subscriber from the list

### DataRouter

```typescript
class DataRouter<T, D, E> {
	constructor(
		store: TSetter<T> | TStoreLike<T>,
		routes: TDataConfig,
		parsers: TParserHash,
		bus?: EventBus<E, keyof E>
	);
	init(cfg: Partial<D>): void;
	setState(updates: Partial<T>, ctx?: TDataConfig): TAsyncSignals;
	setStateAsync(updates: Partial<T>): TAsyncSignals;
}
```

#### constructor

```typescript
constructor(
	store: TSetter<T> | TStoreLike<T>,
	routes: TDataConfig,
	parsers: TParserHash,
	bus?: EventBus<E, keyof E>
)
```

**Purpose**: Create a DataRouter that wraps a Store (or raw setter function) with computed property recalculation and input parsing.

**Parameters**:

- `store` - Either a `setState` function directly, or an object with a `setState` method (typically a Store instance)
- `routes` - Array of `TDataBlock` declarations defining computed property dependencies. Each block declares input fields (`in`), output fields (`out`), and an `exec` function that reads current state and calls `setState` with derived values.
- `parsers` - Parser map. Keys are property names; values are transform functions applied during `init()` to normalize raw input (e.g., converting a plain array into a DataArray instance).
- `bus` - Optional EventBus. If provided, `init()` emits an `"init-state"` event after initialization.

**Behavior**:

- Indexes the dependency declarations: maps each input field to the blocks it triggers, and each output field to the input fields that produce it
- Computes dependency chain depth for each block to determine execution order. Blocks with deeper dependency chains execute later, ensuring prerequisites complete first.

#### init()

```typescript
init(cfg: Partial<D>): void
```

**Purpose**: Initialize state with provided configuration values, applying parsers to transform raw input.

**Parameters**:

- `cfg` - Configuration object with initial property values

**Behavior**:

- Compares each key against previously initialized values; skips unchanged properties
- Applies matching parser from the parser map to each changed value (e.g., converting `tasks: [...]` to `tasks: new GanttDataTree([...])`)
- Passes parsed values to `setState()`, which triggers computed property recalculation
- Stores a merged copy of `cfg` for future diff comparison on re-initialization
- If an EventBus was provided, emits `"init-state"` with the parsed values
- Calling `init()` multiple times is supported - only changed properties are re-processed

#### setState()

```typescript
setState(updates: Partial<T>, ctx?: TDataConfig): TAsyncSignals
```

**Purpose**: Update state synchronously and trigger computed property recalculation.

**Parameters**:

- `updates` - Partial state with properties to set
- `ctx` - Optional execution context (array of already-queued TDataBlocks). Used internally to prevent duplicate recalculation during cascading updates.

**Returns**: Signals map from the underlying Store's `setState`.

**Behavior**:

- Calls the underlying Store's `setState()` to apply the values and get the signals map
- Scans the signals map keys against the trigger index to find all TDataBlocks whose input fields were touched
- Collects triggered blocks, deduplicating against the `ctx` array
- If this is the top-level call (no existing `ctx`), executes collected blocks in dependency order:
  - Sorts blocks by `length` descending and processes from the end (shallowest dependencies first)
  - Each block's `exec` receives the `ctx` array, allowing it to call `setState()` recursively without re-triggering already-queued blocks
  - Newly triggered blocks from cascading updates are added to the queue and processed in order
- If called within a block's `exec` (non-empty `ctx`), only collects triggered blocks without executing - the top-level loop handles execution

#### setStateAsync()

```typescript
setStateAsync(updates: Partial<T>): TAsyncSignals
```

**Purpose**: Update state in batched/deferred mode. Multiple calls within the same tick are merged and flushed together.

**Returns**: Signals map from the underlying Store's silent `setState`.

**Behavior**:

- Calls the underlying Store's `setState()` with `STORE_SET_SILENT` mode - this stores values and records trigger callbacks but does not notify subscribers
- If no pending batch exists, creates one and schedules `_applyState()` asynchronously (next tick)
- If a batch already exists, merges the new signals into the pending batch
- On flush (`_applyState()`):
  - Triggers computed property recalculation for all accumulated signals
  - Calls each stored trigger callback to notify subscribers
- This is the preferred method for event handlers that may trigger multiple state changes in sequence

### markReactive()

```typescript
function markReactive<T>(t: T, nested?: boolean): T;
```

**Purpose**: Tag an object so that Store creates nested reactive wrappers for its sub-properties, making each sub-property individually subscribable.

**Parameters**:

- `t` - The object to mark
- `nested` - If `true`, recursively marks all object-type sub-properties

**Returns**: The same object `t` (modified in-place).

**Behavior**:

- Adds a non-enumerable, non-writable `__reactive` property set to `true`
- When Store encounters a value with `__reactive` during `setState()`, it creates a nested reactive structure: the parent object gets a writable wrapper, and each sub-property also gets its own writable wrapper
- Updates to the parent re-process sub-properties individually, enabling fine-grained subscriptions
- The `__reactive` marker is non-enumerable to avoid interfering with iteration

## Implementation Details

### Framework Adapter Pattern

Store does not depend on any specific UI framework. Instead, it accepts a `TWritableCreator` factory function that produces framework-compatible reactive wrappers. In practice:

- **Svelte**: passes `writable` from `svelte/store`
- **React/Vue**: passes a custom adapter that bridges to the framework's reactivity system

Store creates its own internal reactive wrappers that manage subscriber lists and notification timing. The framework adapter from `TWritableCreator` is accepted at construction but the internal wrapping handles the actual publish/subscribe mechanics.

### Sync vs Async Mode

The `async` flag on `StoreConfig` controls two behaviors:

1. **Subscriber notification**: When async, notifications are deferred and coalesced. If a property is changed N times within a single synchronous call stack, subscribers receive only one notification with the final value. This prevents cascading renders and avoids intermediate state flicker.
2. **Initial subscription delivery**: When async, `subscribe()` delivers the current value to the new subscriber asynchronously rather than inline. This allows the subscriber to finish setup before receiving the first value.

In sync mode, every `setState()` call that changes a value triggers subscribers immediately and inline. This is appropriate when the caller needs the UI to reflect each intermediate state (e.g., during drag operations).

### Computed Property Execution Order

DataRouter determines execution order by computing the dependency chain depth for each TDataBlock:

- A block with no transitive dependencies has depth 1
- A block whose inputs depend on another block's outputs has depth = max(dependency depths) + 1
- Execution proceeds from shallowest (depth 1) to deepest, ensuring that when a block executes, all its input dependencies have already been recalculated

The execution loop processes blocks by sorting the queue in descending depth order and popping from the end (shallowest first). New blocks triggered by cascading updates are inserted into the queue and the sort is re-applied.

### Batched Async Updates

`setStateAsync()` implements a simple batching strategy:

- First call in a tick: creates a batch object with signals and schedules an asynchronous flush
- Subsequent calls: merge signals into the existing batch via `Object.assign`
- Flush: runs computed recalculation on accumulated signals, then triggers all stored subscriber callbacks

This ensures that multiple rapid state changes (e.g., from a single user interaction) result in one recalculation pass and one subscriber notification cycle.

### Change Detection Strategy

Store uses a fast but imperfect change detection approach optimized for the common case:

- **Primitives**: strict equality (`===`) - skip if unchanged
- **Dates**: `getTime()` comparison - skip if timestamps match
- **Objects/arrays**: reference equality only. Same reference is treated as changed (not skipped), because the pattern of mutating an object and re-setting it is common in SVAR components (e.g., `tasks.update(id, data); setState({ tasks })`)

This means Store errs on the side of re-rendering rather than missing updates from mutations.

### Nested Reactive Objects

The `markReactive()` + nested wrapping mechanism enables a pattern where a configuration object's sub-properties can be individually subscribed to:

```
const config = markReactive({ theme: "dark", locale: "en" });
store.setState({ config });
// Now config.theme and config.locale are individually subscribable
```

When a nested reactive object is updated, Store does not replace the parent wrapper. Instead, it recursively processes sub-properties, triggering only the sub-property subscribers that actually changed.

## Examples

```javascript
import Store, { markReactive } from "@svar/state";
import DataRouter from "@svar/state";
import { writable } from "svelte/store";

// --- Basic Store usage ---

const store = new Store({ writable, async: false });

// First setState creates reactive wrappers
store.setState({ count: 0, name: "Alice" });

// Subscribe to individual properties
const reactive = store.getReactive();
reactive.count.subscribe(v => console.log("count:", v)); // immediately logs: "count: 0"

// Update triggers subscribers
store.setState({ count: 1 }); // logs: "count: 1"

// Read current values
const state = store.getState();
console.log(state.count); // 1
console.log(state.name); // "Alice"

// --- DataRouter with computed properties ---

const router = new DataRouter(
	store,
	[
		// When "items" or "filter" changes, recompute "_filteredItems"
		{
			in: ["items", "filter"],
			out: ["_filteredItems"],
			exec: ctx => {
				const { items, filter } = store.getState();
				const _filteredItems = filter ? items.filter(filter) : items;
				router.setState({ _filteredItems }, ctx);
			},
		},
		// When "_filteredItems" changes, recompute "_count"
		{
			in: ["_filteredItems"],
			out: ["_count"],
			exec: ctx => {
				const { _filteredItems } = store.getState();
				router.setState({ _count: _filteredItems.length }, ctx);
			},
		},
	],
	{
		// Parser: normalize raw items array on init
		items: v => [...v],
	}
);

// init applies parsers and triggers computed recalculation
router.init({
	items: [1, 2, 3, 4, 5],
	filter: null,
});
// State now has: items, filter, _filteredItems: [1,2,3,4,5], _count: 5

// Setting filter triggers cascade: filter -> _filteredItems -> _count
router.setState({ filter: v => v > 3 });
// _filteredItems: [4, 5], _count: 2

// --- Real-world pattern: Gantt DataStore ---

class DataStore extends Store {
	constructor(w) {
		super({ writable: w, async: false });

		this._router = new DataRouter(
			super.setState.bind(this),
			[
				{
					in: ["tasks", "cellHeight"],
					out: ["_tasks"],
					exec: ctx => {
						const { tasks, cellHeight } = this.getState();
						const _tasks = tasks.map((t, i) => ({
							...t,
							$y: i * cellHeight,
						}));
						this.setState({ _tasks }, ctx);
					},
				},
			],
			{
				tasks: v => new DataArray(v), // parse raw array into DataArray
			}
		);
	}

	init(cfg) {
		this._router.init({ selected: [], ...cfg });
	}

	setState(state, ctx) {
		return this._router.setState(state, ctx);
	}

	setStateAsync(state) {
		this._router.setStateAsync(state);
	}
}
```
