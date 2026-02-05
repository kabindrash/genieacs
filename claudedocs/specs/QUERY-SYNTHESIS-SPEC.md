# GenieACS Query Synthesis Specification

## Overview

The `lib/db/synth.ts` module (654 lines) provides the expression-to-MongoDB query synthesis engine. It converts GenieACS expression language queries into optimized MongoDB queries using Boolean minimization techniques (Espresso/Quine-McCluskey algorithm).

**Primary File**: `lib/db/synth.ts`

## Core Functions

### toMongoQuery

```typescript
export function toMongoQuery(
  exp: Expression,
  resource: string
): Record<string, unknown>
```

Converts an expression language query to a MongoDB query document.

**Parameters**:
- `exp` - Expression AST to convert
- `resource` - Collection name for field mapping

**Returns**: MongoDB query document suitable for `find()` or `aggregate()`

**Example**:
```typescript
// Expression
const exp = ["AND",
  ["=", "DeviceID.SerialNumber", "ABC123"],
  [">", "Events.Inform", Date.now() - 86400000]
];

// MongoDB Query
const query = toMongoQuery(exp, "devices");
// Result:
// {
//   "_id": "ABC123",
//   "Events.Inform": { "$gt": 1704067200000 }
// }
```

### validQuery

```typescript
export function validQuery(
  exp: Expression,
  resource: string
): boolean
```

Validates that an expression can be converted to a valid MongoDB query.

**Validation Checks**:
- All referenced parameters exist for the resource
- Operators are supported
- Types are compatible
- No unsupported constructs

## MongoSynthContext Class

The core synthesis engine extending `SynthContextBase` from the expression module.

```typescript
class MongoSynthContext extends SynthContextBase<Expression, MongoClause> {
  constructor(resource: string);

  // Convert expression to minterms
  getMinterms(exp: Expression, res: boolean): Minterm[];

  // Get don't-care set for minimization
  getDcSet(minterms: Minterm[]): Minterm[];

  // Convert minimized minterms back to MongoDB query
  toQuery(minterms: Minterm[]): Record<string, unknown>;
}
```

## Synthesis Algorithm

### Phase 1: Expression Parsing

```
Expression AST
    │
    ▼
┌───────────────────┐
│ Clause Generation │ ← Create MongoClause for each operation
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Variable Registry │ ← Map clauses to variable indices
└─────────┬─────────┘
          │
          ▼
Clause Tree
```

### Phase 2: Minterm Generation

Convert clause tree to sum-of-products form:
```
Clause: A AND (B OR C)
         │
         ▼
Minterms: [A, B, -]  ← A AND B
          [A, -, C]  ← A AND C
```

**Minterm Values**:
| Value | Meaning |
|-------|---------|
| 0 | Variable is false |
| 1 | Variable is true |
| 2 | Don't care |

### Phase 3: Boolean Minimization

Apply Espresso algorithm to minimize minterms:
```typescript
const minimized = espresso(
  minterms,      // ON-set (true results)
  dcSet,         // DC-set (don't care)
  { canRaise, canLower, bias }
);
```

### Phase 4: Query Generation

Convert minimized minterms to MongoDB query:
```
Minimized minterms
    │
    ▼
┌──────────────────┐
│ Clause Lookup    │ ← Get MongoClause for each variable
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Query Building   │ ← Combine with $and/$or
└────────┬─────────┘
         │
         ▼
MongoDB Query Document
```

## MongoClause Classes

### Base Class

```typescript
abstract class MongoClause {
  abstract true(context: MongoSynthContext): Minterm[];
  abstract false(context: MongoSynthContext): Minterm[];
  abstract null(context: MongoSynthContext): Minterm[];
  abstract toQuery(negated: boolean): Record<string, unknown>;
}
```

### MongoClauseCompare

Handles comparison operators: `=`, `<>`, `>`, `>=`, `<`, `<=`

```typescript
class MongoClauseCompare<T> extends MongoClause {
  constructor(
    field: string,
    operator: string,
    value: T,
    types: string[]
  );

  toQuery(negated: boolean): Record<string, unknown> {
    // Generates: { field: { $eq/$ne/$gt/$gte/$lt/$lte: value } }
  }
}
```

**Type Handling**:
| Type | MongoDB Representation |
|------|----------------------|
| `string` | Direct value |
| `number` | Direct value |
| `boolean` | Boolean |
| `timestamp` | Date object |
| `ObjectId` | ObjectId |

### MongoClauseArray

Handles array field comparisons.

```typescript
class MongoClauseArray extends MongoClause {
  constructor(field: string, operator: string, value: unknown);

  toQuery(negated: boolean): Record<string, unknown> {
    // Generates: { field: { $elemMatch: ... } }
  }
}
```

### MongoClauseType

Handles type checking for IS NULL / IS NOT NULL.

```typescript
class MongoClauseType extends MongoClause {
  constructor(field: string, types: string[]);

  toQuery(negated: boolean): Record<string, unknown> {
    // IS NULL: { field: null }
    // IS NOT NULL: { field: { $ne: null } }
  }
}
```

### MongoClauseLike

Handles LIKE pattern matching with regex conversion.

```typescript
class MongoClauseLike extends MongoClause {
  constructor(field: string, pattern: string, escape?: string);

  toQuery(negated: boolean): Record<string, unknown> {
    // Generates: { field: { $regex: pattern } }
  }
}
```

**Pattern Conversion**:
| LIKE Pattern | Regex |
|--------------|-------|
| `%` | `.*` |
| `_` | `.` |
| `\%` | `%` (escaped) |
| `\_` | `_` (escaped) |

## Helper Functions

### getParam

```typescript
function getParam(
  param: string,
  resource: string
): { field: string; types: string[] }
```

Maps expression parameter names to MongoDB field paths.

**Resource Field Mappings**:
| Resource | Parameter | MongoDB Field |
|----------|-----------|---------------|
| `devices` | `DeviceID.SerialNumber` | `_id` |
| `devices` | `Events.Inform` | `_lastInform` |
| `devices` | `Tags.*` | `_tags` |
| `faults` | `Device` | `_id` (parsed) |

### getTypes

```typescript
function getTypes(param: string, resource: string): string[]
```

Returns possible types for a parameter.

**Type Categories**:
| Category | Types |
|----------|-------|
| String fields | `["string"]` |
| Numeric fields | `["number"]` |
| Timestamp fields | `["number", "date"]` |
| ID fields | `["string", "objectId"]` |

### roundOid

```typescript
function roundOid(
  value: unknown,
  direction: "up" | "down"
): ObjectId
```

Rounds ObjectId values for range queries.

**Algorithm**:
```typescript
// Extract timestamp from ObjectId
const timestamp = oid.getTimestamp();

// Round based on direction
if (direction === "up") {
  // Increment to next second
  return ObjectId.createFromTime(timestamp + 1);
} else {
  // Use current second
  return ObjectId.createFromTime(timestamp);
}
```

**Use Case**: Enable `>` and `<` comparisons on ObjectId fields.

## Type Coercion

### String to Number

```typescript
// Expression: [">", "Events.Inform", "2024-01-01"]
// Converts "2024-01-01" to timestamp number
```

### Date Handling

```typescript
// Expression with Date object
const exp = [">", "Events.Inform", new Date("2024-01-01")];

// Converted to milliseconds timestamp for MongoDB
// { "_lastInform": { "$gt": 1704067200000 } }
```

### ObjectId Range Queries

```typescript
// Expression: [">", "_id", someObjectId]
// Uses roundOid() for proper boundary handling
```

## Query Optimization

### Minterm Reduction

Before:
```
(A AND B) OR (A AND C) OR (A AND B AND D)
```

After minimization:
```
A AND (B OR C)
```

### Redundant Clause Elimination

```typescript
// Expression with redundancy
["AND", ["=", "A", 1], ["=", "A", 1], [">", "B", 0]]

// Optimized MongoDB query
{ "A": 1, "B": { "$gt": 0 } }
```

### $and/$or Flattening

```typescript
// Nested structure
{ "$and": [{ "$and": [{ "A": 1 }, { "B": 2 }] }, { "C": 3 }] }

// Flattened
{ "$and": [{ "A": 1 }, { "B": 2 }, { "C": 3 }] }
```

## Resource-Specific Handling

### Devices Collection

```typescript
// Special field mappings
const deviceMappings = {
  "DeviceID.SerialNumber": "_id",
  "DeviceID.OUI": "_oui",
  "DeviceID.ProductClass": "_productClass",
  "Events.Inform": "_lastInform",
  "Events.Registered": "_registered"
};
```

### Faults Collection

```typescript
// Composite _id parsing
// _id format: "deviceId:channel"
// Expression: ["=", "Device", "ABC123"]
// Query: { "_id": { "$regex": "^ABC123:" } }
```

### Tasks Collection

```typescript
// ObjectId timestamp handling for age queries
// Expression: [">", "_id", threshold]
// Uses roundOid for proper comparison
```

## Integration Example

```typescript
// In lib/db/db.ts
import { toMongoQuery } from "./synth.ts";

async function queryDevices(filter: Expression): Promise<Device[]> {
  const query = toMongoQuery(filter, "devices");
  return db.collection("devices").find(query).toArray();
}

// Usage
const devices = await queryDevices([
  "AND",
  ["LIKE", "DeviceID.SerialNumber", "ABC%"],
  [">", "Events.Inform", Date.now() - 3600000],
  ["IS NOT NULL", ["PARAM", "Tags.configured"]]
]);
```

## Performance Considerations

### Query Complexity

| Expression Complexity | Minterm Count | Query Time |
|----------------------|---------------|------------|
| Simple (1-2 clauses) | 1-4 | < 1ms |
| Moderate (3-5 clauses) | 4-16 | 1-5ms |
| Complex (6+ clauses) | 16-64 | 5-20ms |

### Minimization Limits

- Espresso algorithm is exponential worst-case
- Practical limit: ~20 variables per query
- Timeout protection in synthesis loop

### Index Utilization

Generated queries are designed for index usage:
- Equality conditions first
- Range conditions after
- Regex patterns last

## Error Handling

### Invalid Expressions

```typescript
try {
  const query = toMongoQuery(invalidExp, "devices");
} catch (err) {
  // "Unknown parameter: InvalidPath"
  // "Unsupported operator: INVALID"
  // "Type mismatch: expected number, got string"
}
```

### Unsupported Operations

| Operation | Status | Alternative |
|-----------|--------|-------------|
| `CASE` | Not supported | Pre-evaluate |
| `FUNC` calls | Not supported | Virtual params |
| Nested `PARAM` | Not supported | Flatten expression |

## Debugging

### Query Inspection

```typescript
import { toMongoQuery } from "./db/synth.ts";

const exp = ["AND", ["=", "A", 1], [">", "B", 0]];
const query = toMongoQuery(exp, "devices");

console.log(JSON.stringify(query, null, 2));
// {
//   "A": 1,
//   "B": { "$gt": 0 }
// }
```

### Minterm Visualization

For debugging synthesis:
```typescript
// Internal debugging (not exported)
const context = new MongoSynthContext("devices");
const minterms = context.getMinterms(exp, true);
console.log("Minterms:", minterms);
// [[1, 1], [1, 2]] - Variable assignments
```
