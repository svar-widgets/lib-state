# DataArray & DataTree - Specification

## Overview

DataArray and DataTree are indexed collection classes that provide O(1) ID-based lookup on top of ordered data. DataArray manages a flat list of objects with unique IDs. DataTree extends this to hierarchical (parent-child) data with nesting levels, branch operations, and tree traversal. Both are used as the primary data containers within SVAR Store state, where they are typically created by DataRouter parsers from raw arrays.

## Quick Reference

### DataArray

| Method      | Purpose                                    | Returns |
| ----------- | ------------------------------------------ | ------- |
| `add()`     | Append an item (auto-assigns ID if absent) | `void`  |
| `update()`  | Merge new values into an existing item     | `void`  |
| `remove()`  | Remove an item by ID                       | `void`  |
| `filter()`  | Remove items that fail the predicate       | `void`  |
| `byId()`    | Look up an item by ID                      | `T`     |
| `map()`     | Map over items in order                    | `D[]`   |
| `forEach()` | Iterate over items in order                | `void`  |

### DataTree

| Method        | Purpose                                      | Returns |
| ------------- | -------------------------------------------- | ------- |
| `parse()`     | Bulk-load items into a parent branch         | `void`  |
| `add()`       | Insert an item at a position within a branch | `void`  |
| `addAfter()`  | Insert an item after a sibling               | `void`  |
| `remove()`    | Remove an item and its descendants           | `void`  |
| `update()`    | Merge new values into an existing node       | `void`  |
| `move()`      | Relocate a node within the tree              | `void`  |
| `toArray()`   | Flatten visible tree to ordered array        | `T[]`   |
| `byId()`      | Look up a node by ID                         | `T`     |
| `getBranch()` | Get the children array of a node             | `T[]`   |
| `forEach()`   | Iterate over all nodes (excluding root)      | `void`  |
| `eachChild()` | Recursively iterate descendants of a node    | `void`  |
| `setLevel()`  | Recalculate nesting levels for a subtree     | `void`  |

## Public Interface

### Type Definitions

```typescript
type TID = string | number;

// Minimum shape required by DataArray
interface IHasID {
	id?: TID;
}

// Minimum shape required by DataTree
interface IHasIDAndParent {
	id?: TID;
	parent: TID;
	$level: number;
	data?: IHasIDAndParent[]; // Children array (null if leaf)
	open?: boolean; // Whether children are visible in toArray()
}
```

### DataArray

```typescript
class DataArray<T extends IHasID> {
	constructor(raw: T[]);
	add(raw: T): void;
	update(id: TID, raw: T): void;
	remove(id: TID): void;
	filter(cb: (value: T) => boolean): void;
	byId(id: TID): T;
	map<D>(cb: (value: T, index: number, array: T[]) => D): D[];
	forEach(cb: (value: T, index: number, array: T[]) => void): void;
}
```

#### constructor

```typescript
constructor(raw: T[])
```

**Purpose**: Create a DataArray from a raw array, building the ID index.

**Parameters**:

- `raw` - Array of objects, each with an `id` property

**Behavior**:

- Stores the array as the ordered backing list
- Indexes every item by `id` for O(1) lookup
- Does not copy the input array - the original array is used as the internal store

#### add()

```typescript
add(raw: T): void
```

**Purpose**: Append an item to the end of the collection.

**Behavior**:

- If `raw.id` is absent, auto-assigns a unique numeric ID via `uid()`
- Appends to the ordered list and adds to the index
- Mutates the item in-place (assigns `id` onto the object)

#### update()

```typescript
update(id: TID, raw: T): void
```

**Purpose**: Merge new values into an existing item.

**Parameters**:

- `id` - ID of the item to update
- `raw` - Partial object with values to merge

**Behavior**:

- Creates a new object by spreading the existing item with `raw` (`{ ...old, ...raw }`)
- Replaces the item in both the ordered list and the index
- The old object reference is discarded

#### remove()

```typescript
remove(id: TID): void
```

**Purpose**: Remove an item by ID.

**Behavior**:

- Filters the item out of the ordered list and deletes it from the index
- Uses loose equality (`!=`) for the filter comparison

#### filter()

```typescript
filter(cb: (value: T) => boolean): void
```

**Purpose**: Remove all items that fail the predicate. Destructive - modifies the collection in place.

**Parameters**:

- `cb` - Predicate function. Items where `cb` returns `false` are removed.

**Behavior**:

- Replaces the internal ordered list with filtered results
- Removes rejected items from the index

#### byId()

```typescript
byId(id: TID): T
```

**Purpose**: Look up an item by ID.

**Returns**: The item, or `undefined` if not found.

#### map() / forEach()

```typescript
map<D>(cb: (value: T, index: number, array: T[]) => D): D[]
forEach(cb: (value: T, index: number, array: T[]) => void): void
```

**Purpose**: Standard array iteration over items in insertion order. Signatures match `Array.prototype.map` and `Array.prototype.forEach`.

### DataTree

```typescript
class DataTree<T extends IHasIDAndParent> {
	constructor(raw?: T[]);
	parse(raw: T[], parent: TID): void;
	add(raw: T, index: number): void;
	addAfter(raw: T, after: TID): void;
	remove(id: TID): void;
	update<Data>(id: TID, values: Data): void;
	move(id: TID, mode: string, target: TID): void;
	toArray(): T[];
	byId(id: TID): T;
	getBranch(id: TID): T[];
	forEach(cb: (value: T) => void): void;
	eachChild(cb: (value: T, index: number) => void, parent: TID): void;
	setLevel(root: IHasIDAndParent, level: number, copy: boolean): void;
}
```

#### constructor

```typescript
constructor(raw?: T[])
```

**Purpose**: Create a DataTree, optionally populating it from a flat array.

**Behavior**:

- Creates a virtual root node with `id: 0`, `$level: 0`, and an empty `data` array. This root is never exposed in iteration or `toArray()` but serves as the top-level parent.
- If `raw` is provided, calls `parse(raw, 0)` to populate the tree

#### parse()

```typescript
parse(raw: T[], parent: TID): void
```

**Purpose**: Bulk-load a flat array of items into the tree under a given parent.

**Parameters**:

- `raw` - Flat array of items. Each item's `parent` field determines its position in the hierarchy. If `parent` is not set on an item, it defaults to the `parent` parameter.
- `parent` - ID of the branch to load into

**Behavior**:

- First pass: indexes all items, defaulting `parent` to the provided value and clearing `data` to `null`
- Second pass: groups items under their parent nodes by building `data` arrays
- Third pass: recalculates `$level` for all loaded nodes
- Items whose `parent` references an unknown ID are silently dropped (no error)

#### add()

```typescript
add(raw: T, index: number): void
```

**Purpose**: Insert a single item at a specific position within its parent's children.

**Parameters**:

- `raw` - The item to add. Must have `parent` set (defaults to `0` if absent).
- `index` - Position within the parent's `data` array. Use `-1` to append at the end.

**Behavior**:

- Sets `$level` based on the parent's level
- Adds to the index and splices into the parent's `data` array
- Creates a new `data` array reference on the parent (immutable update for reactivity)

#### addAfter()

```typescript
addAfter(raw: T, after: TID): void
```

**Purpose**: Insert an item immediately after a sibling node.

**Parameters**:

- `raw` - The item to add
- `after` - ID of the sibling to insert after. If falsy, appends to the end of `raw.parent`'s branch.

**Behavior**:

- Looks up the sibling's parent and index, then delegates to `add()` at `index + 1`
- Sets `raw.parent` to the sibling's parent

#### remove()

```typescript
remove(id: TID): void
```

**Purpose**: Remove a node and all its descendants from the tree.

**Behavior**:

- Recursively removes the node and all descendants from the index
- Filters the node out of its parent's `data` array
- If the parent's `data` becomes empty, clears it to `null` and removes the `open` flag

#### update()

```typescript
update<Data>(id: TID, values: Data): void
```

**Purpose**: Merge new values into an existing node.

**Behavior**:

- Creates a new object by spreading the existing node with `values`
- Replaces the node in both the index and its parent's `data` array
- Creates a new `data` array reference on the parent (immutable update for reactivity)

#### move()

```typescript
move(id: TID, mode: string, target: TID): void
```

**Purpose**: Relocate a node (and its subtree) to a new position in the tree.

**Parameters**:

- `id` - ID of the node to move
- `mode` - One of `"before"`, `"after"`, or `"child"`:
  - `"before"` / `"after"` - Place as a sibling of `target`
  - `"child"` - Place as the last child of `target`
- `target` - ID of the reference node

**Behavior**:

- Removes the node from its current parent's `data` array
- Inserts it at the new position (as sibling or child of `target`)
- Updates `parent` and recalculates `$level` for the moved node and all its descendants
- Creates new `data` array references on both the old and new parent
- If the old parent's `data` becomes empty, clears it to `null`
- No-op if the node would end up at the same position

#### toArray()

```typescript
toArray(): T[]
```

**Purpose**: Flatten the tree into an ordered array, respecting open/closed state.

**Returns**: Array of nodes in depth-first order, including only nodes whose ancestors are all `open: true`.

**Behavior**:

- Starts from the root's children (root itself is excluded)
- Recursively includes a node's children only if `node.open === true`
- Closed branches are represented by the parent node alone - children are omitted

#### byId()

```typescript
byId(id: TID): T
```

**Purpose**: Look up a node by ID. O(1).

**Returns**: The node, or `undefined` if not found.

#### getBranch()

```typescript
getBranch(id: TID): T[]
```

**Purpose**: Get the direct children of a node.

**Returns**: The `data` array of the node. Returns `null` if the node is a leaf.

#### forEach()

```typescript
forEach(cb: (value: T) => void): void
```

**Purpose**: Iterate over all nodes in the tree, excluding the virtual root.

**Behavior**:

- Iterates over the full index (all nodes regardless of open/closed state)
- Skips the virtual root node (ID `0`)
- Iteration order follows Map insertion order (parse/add order), not tree depth-first order

#### eachChild()

```typescript
eachChild(cb: (value: T, index: number) => void, parent: TID): void
```

**Purpose**: Recursively iterate over all descendants of a node in depth-first order.

**Parameters**:

- `cb` - Callback receiving each descendant and its index within its parent's `data` array
- `parent` - ID of the ancestor node to start from

**Behavior**:

- Visits all descendants regardless of `open` state
- Depth-first: visits a child, then all of that child's descendants, before the next sibling
- Does not include the `parent` node itself

#### setLevel()

```typescript
setLevel(root: IHasIDAndParent, level: number, copy: boolean): void
```

**Purpose**: Recalculate `$level` for all descendants of a node.

**Parameters**:

- `root` - The parent node whose children should be updated
- `level` - The `$level` value to assign to `root`'s direct children
- `copy` - If `true`, creates shallow copies of each node (for immutable update patterns). If `false`, mutates nodes in place.

**Behavior**:

- Recursively sets `$level` on all descendants, incrementing by 1 at each depth
- When `copy` is `true`, replaces each node in the `data` array with a shallow copy and updates the index
- Creates a new `data` array reference on `root`

## Implementation Details

### Virtual Root Node

DataTree maintains a virtual root node at ID `0` that serves as the top-level container. This node:

- Has `$level: 0` and `parent: null`
- Its `data` array holds the top-level items
- Is excluded from `forEach()` and `toArray()` output
- Can be passed as the parent to `parse()`, `add()`, and `getBranch()`

### Immutable Update Pattern

Both classes create new object references when updating items (`{ ...old, ...values }`). DataTree additionally creates new `data` array references on parent nodes when their children change. This ensures that identity-based change detection (as used by Store) correctly detects modifications when the collection is set back into state.

### Index Consistency

Both classes maintain a `Map<TID, T>` index that must stay in sync with the ordered data. All mutation methods (`add`, `update`, `remove`, `filter`, `move`) update both the ordered storage and the index atomically. There is no separate "rebuild index" operation.

## Examples

```javascript
import { DataArray } from "@svar/state";

// --- DataArray ---

const links = new DataArray([
	{ id: 1, source: "A", target: "B" },
	{ id: 2, source: "B", target: "C" },
]);

links.byId(1); // { id: 1, source: "A", target: "B" }
links.byId(99); // undefined

links.add({ source: "C", target: "D" });
// Auto-assigned ID, now 3 items

links.update(1, { type: "e2s" });
links.byId(1).type; // "e2s"

links.remove(2);
links.map(l => l.id); // [1, <auto-id>]

links.filter(l => l.source !== "C");
// Only items with source !== "C" remain
```

```javascript
import { DataTree } from "@svar/state";

// --- DataTree ---

const tasks = new DataTree([
	{ id: 1, parent: 0, text: "Project" },
	{ id: 2, parent: 1, text: "Design" },
	{ id: 3, parent: 1, text: "Develop" },
	{ id: 4, parent: 0, text: "Launch" },
]);

tasks.byId(2); // { id: 2, parent: 1, $level: 2, ... }
tasks.getBranch(1); // [node2, node3]
tasks.getBranch(4); // null (leaf node)

// toArray respects open state - initially all closed
tasks.toArray(); // [node1, node4] (children of closed nodes hidden)

tasks.update(1, { open: true });
tasks.toArray(); // [node1, node2, node3, node4]

// Move node 4 as child of node 1
tasks.move(4, "child", 1);
tasks.getBranch(1); // [node2, node3, node4]
tasks.byId(4).parent; // 1
tasks.byId(4).$level; // 2

// Remove a branch
tasks.remove(1);
// Removes node 1, 2, 3, 4 (all descendants)
tasks.toArray(); // []

// Bulk load into a parent
tasks.parse(
	[
		{ id: 10, text: "New root" },
		{ id: 11, parent: 10, text: "Child" },
	],
	0
);
tasks.byId(11).$level; // 2
```
