# Event System - Specification

## Overview

The Event System provides a chainable event processing pipeline. EventBus is the primary event hub where handlers are registered and events dispatched. Multiple event processors can be linked into a chain via `setNext()` - any object implementing `exec()` and `setNext()` qualifies. EventBusRouter adapts a plain dispatch function into a chain link. EventResolver enables event initiators to receive a callback when their event reaches a specific stage of the pipeline (typically used for server-side confirmation flows).

## Quick Reference

### EventBus

| Method        | Purpose                                           | Returns               |
| ------------- | ------------------------------------------------- | --------------------- |
| `on()`        | Register a handler for an event                   | `void`                |
| `intercept()` | Register a handler that runs before existing ones | `void`                |
| `detach()`    | Remove all handlers with a given tag              | `void`                |
| `exec()`      | Dispatch an event through handlers and chain      | `Promise<T[keyof T]>` |
| `setNext()`   | Link the next processor in the chain              | `IEventBus<T>`        |

### EventBusRouter

| Method      | Purpose                                          | Returns               |
| ----------- | ------------------------------------------------ | --------------------- |
| `exec()`    | Forward event to a dispatch function, then chain | `Promise<T[keyof T]>` |
| `setNext()` | Link the next processor in the chain             | `IEventBus<T>`        |

### EventResolver

| Method      | Purpose                                            | Returns               |
| ----------- | -------------------------------------------------- | --------------------- |
| `exec()`    | Call the resolve callback on the event, then chain | `Promise<T[keyof T]>` |
| `setNext()` | Link the next processor in the chain               | `IEventBus<T>`        |

## Public Interface

### Type Definitions

```typescript
// Common interface for any event chain participant
interface IEventBus<T> {
	exec(name: keyof T, ev: T[keyof T]): Promise<T[keyof T]>;
	setNext(next: IEventBus<T>): IEventBus<T>;
}

// Handler configuration
interface IEventConfig {
	intercept?: boolean; // If true, handler is prepended (runs before existing handlers)
	tag?: number | string | symbol; // Tag for bulk removal via detach()
}

// Dispatch function signature (used by EventBusRouter)
type TDispatch<T> = <A extends keyof T>(action: A, data: T[A]) => void;
```

### EventBus

```typescript
class EventBus<T, A extends keyof T> implements IEventBus<T> {
	constructor();
	on(
		name: A,
		handler: (ev: T[A]) => void | boolean | Promise<boolean>,
		config?: IEventConfig
	): void;
	intercept(
		name: A,
		handler: (ev: T[A]) => void | boolean | Promise<boolean>,
		config?: IEventConfig
	): void;
	detach(tag: number | string | symbol): void;
	exec(name: A, ev: T[A]): Promise<T[A]>;
	setNext(next: IEventBus<T>): IEventBus<T>;
}
```

#### on()

```typescript
on(
	name: A,
	handler: (ev: T[A]) => void | boolean | Promise<boolean>,
	config?: IEventConfig
): void
```

**Purpose**: Register a handler for a named event.

**Parameters**:

- `name` - Event name
- `handler` - Callback invoked when the event fires. Return `false` (sync or async) to stop propagation. Any other return value continues the chain.
- `config` - Optional configuration:
  - `intercept`: if `true`, prepends the handler (runs before previously registered handlers)
  - `tag`: associates a tag for later bulk removal via `detach()`

**Behavior**:

- By default, handlers are appended (run in registration order)
- With `intercept: true`, the handler is prepended to the stack
- Multiple handlers for the same event are supported
- The handler receives the event object by reference - mutations are visible to subsequent handlers

#### intercept()

```typescript
intercept(
	name: A,
	handler: (ev: T[A]) => void | boolean | Promise<boolean>,
	config?: IEventConfig
): void
```

**Purpose**: Shorthand for `on()` with `intercept: true`. Registers a handler that runs before existing handlers.

#### detach()

```typescript
detach(tag: number | string | symbol): void
```

**Purpose**: Remove all handlers across all events that were registered with the given tag.

**Behavior**:

- Scans all event handler stacks and removes matching handlers
- Iterates in reverse to handle index shifts during removal
- A handler without a tag is never removed by `detach()`

#### exec()

```typescript
exec(name: A, ev: T[A]): Promise<T[A]>
```

**Purpose**: Dispatch an event through all registered handlers, then forward to the next chain link.

**Parameters**:

- `name` - Event name
- `ev` - Event data object (passed by reference to all handlers)

**Returns**: The event object after processing, or `undefined` if propagation was stopped.

**Behavior**:

- Calls handlers in stack order (intercept handlers first, then appended handlers)
- If any handler returns `false` (sync) or resolves to `false` (async), propagation stops immediately - remaining handlers and the chain are skipped, returns `undefined`
- If all handlers pass, forwards to the next chain link via `this._nextHandler.exec()`
- If no handlers are registered for the event name, proceeds directly to the chain
- The event object is shared across all handlers - mutations accumulate

#### setNext()

```typescript
setNext(next: IEventBus<T>): IEventBus<T>
```

**Purpose**: Link the next processor in the event chain.

**Returns**: The `next` processor (for chaining `setNext()` calls).

**Behavior**:

- Replaces any previously set next handler
- Set to `null` to terminate the chain

### EventBusRouter

```typescript
class EventBusRouter<T> implements IEventBus<T> {
	constructor(dispatch: TDispatch<T>);
	exec(name: keyof T, ev: CommonEvent): Promise<T[keyof T]>;
	setNext(next: IEventBus<T>): IEventBus<T>;
}
```

**Purpose**: Adapts a plain dispatch function into a chain-compatible event processor. Useful for inserting custom logic (e.g., a Store's action dispatcher) into the event pipeline without implementing the full `IEventBus` interface.

#### constructor

```typescript
constructor(dispatch: TDispatch<T>)
```

**Parameters**:

- `dispatch` - A function that receives `(name, eventData)` and performs some action. Does not control propagation - the chain always continues after dispatch.

#### exec()

```typescript
exec(name: keyof T, ev: CommonEvent): Promise<T[keyof T]>
```

**Behavior**:

- Calls the dispatch function synchronously with the event name and data
- Forwards to the next chain link (if set)
- Always continues - the dispatch function cannot stop propagation

### EventResolver

```typescript
class EventResolver<T> implements IEventBus<T> {
	constructor(key: string);
	exec(name: keyof T, ev: CommonEvent): Promise<T[keyof T]>;
	setNext(next: IEventBus<T>): IEventBus<T>;
}
```

**Purpose**: Calls a callback embedded in the event object itself, enabling the event initiator to receive a signal when the event reaches this point in the chain. Typically placed at the end of the pipeline to notify the caller after all processing (including server persistence) is complete.

#### constructor

```typescript
constructor(key: string)
```

**Parameters**:

- `key` - The property name to look for on the event object (e.g., `"resolve"`)

#### exec()

```typescript
exec(name: keyof T, ev: CommonEvent): Promise<T[keyof T]>
```

**Behavior**:

- If `ev[key]` exists and is a function, calls it with the event object and awaits the result
- If `ev[key]` is absent or falsy, skips the callback
- Forwards to the next chain link (if set)
- Always continues - the resolve callback cannot stop propagation

## Implementation Details

### Chain Architecture

The event pipeline is a singly-linked list of `IEventBus` implementations connected via `setNext()`. Any object with `exec()` and `setNext()` can participate. A typical chain looks like:

```
EventBus → EventBusRouter → EventResolver
   │              │               │
handlers    dispatch fn     resolve callback
```

Each link calls the next after completing its own work. The chain is traversed for every `exec()` call - there is no caching or shortcutting.

### Propagation Control

Only EventBus handlers can stop propagation (by returning `false`). EventBusRouter and EventResolver always forward to the next link. This means:

- Handlers registered via `on()`/`intercept()` act as guards - they can inspect and cancel events
- Router and Resolver are transparent pass-through links - they perform side effects but never block

### Handler Execution Order

Within an EventBus, handlers for a given event run in stack order:

1. Handlers registered with `intercept: true` (most recent intercept first, since each prepends)
2. Handlers registered with `on()` (in registration order)

This allows later code to insert handlers that run before earlier-registered ones, useful for validation or authorization checks added by plugins.

### Resolve Pattern

The EventResolver enables a request/response pattern over the event pipeline:

1. Caller creates an event object with a resolve callback: `{ id, task, resolve: (ev) => { ... } }`
2. Caller dispatches the event via `exec()`
3. The event flows through handlers (local store updates, server persistence, etc.)
4. When the event reaches the EventResolver link, it calls `ev.resolve(ev)` - at this point `ev` contains any modifications made by earlier handlers (e.g., server-assigned IDs replacing temp IDs)
5. The caller's resolve callback receives the final event state

This is typically used for optimistic updates: the client applies changes locally, sends to server, and on confirmation the resolve callback updates the local object with server-side data (real IDs, timestamps, etc.).

## Examples

```javascript
import { EventBus, EventBusRouter, EventResolver } from "@svar/state";

// --- Basic event handling ---

const bus = new EventBus();

bus.on("update-task", ev => {
	console.log("updating", ev.id);
	// mutate ev to enrich it
	ev.timestamp = Date.now();
});

bus.on("update-task", ev => {
	console.log("saving to server", ev.id);
});

await bus.exec("update-task", { id: 1, task: { name: "New" } });
// logs: "updating 1", "saving to server 1"

// --- Stopping propagation ---

bus.intercept("delete-task", ev => {
	if (ev.protected) return false; // cancel the event
});

bus.on("delete-task", ev => {
	console.log("deleted", ev.id);
});

await bus.exec("delete-task", { id: 1, protected: true });
// nothing logged - intercept returned false

// --- Chaining processors ---

const bus = new EventBus();
const router = new EventBusRouter((name, data) => {
	// forward to store action dispatcher
	store.dispatch(name, data);
});
const resolver = new EventResolver("resolve");

bus.setNext(router);
router.setNext(resolver);

// --- Resolve pattern (optimistic update) ---

bus.on("add-task", ev => {
	ev.task.id = tempID(); // assign temp ID locally
	localStore.add(ev.task); // optimistic local update
	serverAPI.post("/tasks", ev.task); // send to server (async, result comes later)
});

await bus.exec("add-task", {
	task: { name: "Design" },
	resolve: ev => {
		// called when event reaches the resolver link
		// by this point, ev.task has the temp ID assigned by the handler
		// server confirmation would update the temp ID to real one
		localStore.update(ev.task.id, ev.serverData);
	},
});

// --- Tagged handler removal ---

const TAG = Symbol("plugin-v1");

bus.on("update-task", handler1, { tag: TAG });
bus.on("delete-task", handler2, { tag: TAG });
bus.on("update-task", handler3); // no tag

bus.detach(TAG);
// handler1 and handler2 removed, handler3 remains
```
