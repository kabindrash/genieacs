# GenieACS Expression Language Specification

## Overview

The Expression Language is a SQL-like query language used throughout GenieACS for device filtering, preconditions, validations, and computed values. It supports logical operations, comparisons, arithmetic, string manipulation, and CASE expressions.

**Primary Files**:
- `lib/common/expression/parser.ts` - Expression parser (Parsimmon-based)
- `lib/common/expression/util.ts` - Evaluation and manipulation
- `lib/common/expression/normalize.ts` - Polynomial normalization
- `lib/common/expression/synth.ts` - Expression synthesis/minimization
- `lib/common/expression/bigint.ts` - BigInt operations
- `lib/common/expression/pagination.ts` - Pagination expression handling

## Expression AST

### Structure

Expressions are represented as recursive arrays with operator at index 0:

```typescript
type Expression = string | number | boolean | null | Expression[];

// Examples:
["=", "Parameter.Name", "value"]           // Equality
["AND", ["=", "A", 1], [">", "B", 0]]       // Logical AND
["FUNC", "UPPER", ["PARAM", "Name"]]       // Function call
["PARAM", "Device.DeviceInfo.SerialNumber"] // Parameter reference
```

### Operator Categories

| Category | Operators |
|----------|-----------|
| Logical | `AND`, `OR`, `NOT` |
| Comparison | `=`, `<>`, `>`, `>=`, `<`, `<=` |
| Pattern | `LIKE`, `NOT LIKE` |
| Null Check | `IS NULL`, `IS NOT NULL` |
| Arithmetic | `+`, `-`, `*`, `/`, `%` |
| String | `\|\|` (concatenation) |
| Control | `CASE` |
| Special | `FUNC`, `PARAM` |

## Parser (`parser.ts`)

### Parser Combinator Architecture

Uses **Parsimmon** library for recursive descent parsing.

```typescript
const lang = parsimmon.createLanguage({
  Expression: (r) => binaryLeft(r.OrOperator,
    binaryLeft(r.AndOperator,
      unary(r.NotOperator, r.Comparison))),
  // ... other rules
});

export function parse(str: string): Expression
export function parseList(str: string): Expression[]
export function stringify(exp: Expression): string
```

### Operator Precedence

| Level | Operators | Associativity |
|-------|-----------|---------------|
| 10 | `OR` | Left |
| 11 | `AND` | Left |
| 12 | `NOT` | Unary |
| 20 | `=`, `<>`, `>`, `>=`, `<`, `<=`, `LIKE`, `IS NULL` | Binary |
| 30 | `\|\|` (concat) | Left |
| 31 | `+`, `-` | Left |
| 32 | `*`, `/`, `%` | Left |

### Value Types

| Type | Syntax | Example |
|------|--------|---------|
| String (SQL) | Single quotes | `'hello'` |
| String (JS) | Double quotes with escapes | `"hello\nworld"` |
| Number | JSON number syntax | `42`, `-3.14`, `1e10` |
| Boolean | Case-insensitive | `true`, `FALSE` |
| Null | Case-insensitive | `null`, `NULL` |
| Parameter | Dot-separated path | `Device.Info.Name` |
| Dynamic Path | Curly braces | `Device.{Type}.Value` |

### Function Syntax

```sql
FUNCTION_NAME(arg1, arg2, ...)
```

**Built-in Functions**:
| Function | Arguments | Description |
|----------|-----------|-------------|
| `NOW()` | 0 | Current timestamp |
| `UPPER(str)` | 1 | Uppercase conversion |
| `LOWER(str)` | 1 | Lowercase conversion |
| `ROUND(num, precision?)` | 1-2 | Round to decimal places |
| `COALESCE(val1, val2, ...)` | 1+ | First non-null value |

### CASE Expression

```sql
CASE
  WHEN condition1 THEN result1
  WHEN condition2 THEN result2
  ELSE default_result
END
```

**AST Representation**:
```typescript
["CASE", condition1, result1, condition2, result2, true, default_result]
```

### LIKE Pattern Matching

```sql
parameter LIKE 'pattern%' ESCAPE '\\'
```

**Pattern Characters**:
| Character | Meaning |
|-----------|---------|
| `%` | Match any sequence |
| `_` | Match single character |
| `ESCAPE char` | Escape special chars |

### Tree Traversal

```typescript
// Synchronous map
export function map<T>(exp: Expression, callback: (e: Expression) => T): T

// Asynchronous map
export async function mapAsync(
  exp: Expression,
  callback: (e: Expression) => Promise<Expression>
): Promise<Expression>
```

## Evaluator (`util.ts`)

### Core Evaluation

```typescript
export function evaluate(
  exp: Expression,
  obj?: Record<string, unknown> | ((e: string) => Expression),
  now?: number,
  cb?: (e: Expression) => Expression
): Expression

// Async version for extension calls
export async function evaluateAsync(
  exp: Expression,
  obj?: Record<string, unknown>,
  now?: number,
  cb?: (e: Expression) => Promise<Expression>
): Promise<Expression>
```

### Three-Value Logic

Null handling follows SQL semantics:

| Expression | Result |
|------------|--------|
| `NULL AND TRUE` | NULL |
| `NULL AND FALSE` | FALSE |
| `NULL OR TRUE` | TRUE |
| `NULL OR FALSE` | NULL |
| `NOT NULL` | NULL |
| `NULL = anything` | NULL |

### Evaluation Callback

The `evaluateCallback` function handles operator-specific logic:

```typescript
export function evaluateCallback(exp: Expression): Expression
```

**Operator Handling**:
- **CASE**: Returns matching branch or null
- **COALESCE**: Returns first non-null argument
- **AND**: Short-circuits on false, flattens nested ANDs
- **OR**: Short-circuits on true, flattens nested ORs
- **LIKE**: Converts pattern to RegExp with caching
- **Arithmetic**: Type coercion and null propagation

### LIKE to RegExp Conversion

```typescript
export function likePatternToRegExp(
  pat: string,
  esc = "",
  flags = ""
): RegExp
```

**Conversion Rules**:
| SQL LIKE | RegExp |
|----------|--------|
| `%` | `.*` |
| `_` | `.` |
| Special chars | Escaped |

### Expression Combination

```typescript
// Combine with AND (flattening nested ANDs)
export function and(exp1: Expression, exp2: Expression): Expression

// Combine with OR (flattening nested ORs)
export function or(exp1: Expression, exp2: Expression): Expression

// Extract all PARAM references
export function extractParams(exp: Expression): Expression[]
```

## Normalizer (`normalize.ts`)

### Purpose

Converts expressions to canonical polynomial form for:
- Comparison and equality testing
- Simplification
- Optimization

### Mathematical Model

Expressions are represented as polynomials over indeterminates:

```typescript
interface Term {
  indeterminates: Indeterminates;  // Variable part
  coefficientNumerator: bigint;    // Numerator
  coefficientDenominator: bigint;  // Denominator
}

class Polynomial {
  terms: Term[];
}
```

### Indeterminates

Variable tracking with exponents:

```typescript
class Indeterminates {
  map: Map<string, number>;      // variable -> exponent
  sortedKeys: string[];          // sorted for comparison

  reciprocal(): Indeterminates   // Negate all exponents
  static multiply(a, b): Indeterminates  // Combine exponents
  static compare(a, b): number   // Ordering for sorting
}
```

### Simplification

```typescript
// Combine like terms, reduce fractions
static simplifyTerms(terms: Term[]): Term[]
```

Uses GCD for fraction reduction:
```typescript
function findGcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}
```

## Synthesizer (`synth.ts`)

### Purpose

Minimizes boolean expressions using the **Espresso** algorithm for:
- Query optimization
- Filter simplification
- Canonical form generation

### Architecture

```typescript
abstract class SynthContextBase<T, U> {
  variables: Map<string, number>;  // Variable registry
  clauses: Map<number, U>;         // Index -> clause mapping

  getVar(c: U): number;            // Get/create variable index
  getClause(v: number): U;         // Retrieve clause by index

  abstract getMinterms(exp: T, res: boolean): Minterm[];
  abstract getDcSet(minterms: Minterm[]): Minterm[];

  minimize(minterms: Minterm[], dcSet?: Minterm[]): Minterm[];
}
```

### Minterm Representation

Minterms are arrays where each index represents a variable:

```typescript
type Minterm = number[];
// 0 = variable is 0
// 1 = variable is 1
// 2 = don't care
```

### Clause Classes

```typescript
abstract class Clause {
  abstract true(context): Minterm[];   // Minterms where clause is true
  abstract false(context): Minterm[];  // Minterms where clause is false
  abstract null(context): Minterm[];   // Minterms where clause is null

  expression(): Expression;            // Convert to expression
  isNullable(c: Clause.IsNull): boolean;
}

namespace Clause {
  class Not extends Clause { ... }      // Logical NOT
  class Or extends Clause { ... }       // Logical OR
  class And extends Clause { ... }      // Logical AND
  class Exp extends Clause { ... }      // Expression wrapper
  class IsNull extends Clause { ... }   // Null check
  class Comparison extends Clause { ... } // Comparison operations
}
```

### Espresso Integration

Uses `espresso-iisojs` library for two-level logic minimization:

```typescript
import { espresso, complement, tautology } from "espresso-iisojs";

minimize(minterms: Minterm[], dcSet: Minterm[] = []): Minterm[] {
  return espresso(
    minterms,
    [...this.getDcSet([...minterms, ...dcSet]), ...dcSet],
    { canRaise, canLower, bias }
  );
}
```

## BigInt Operations (`bigint.ts`)

### Purpose

Provides BigInt operations that work across Node.js versions:

```typescript
export type bigint = BigInt;

export function BigInt(n: number | string): bigint;
export function add(a: bigint, b: bigint): bigint;
export function sub(a: bigint, b: bigint): bigint;
export function mul(a: bigint, b: bigint): bigint;
export function div(a: bigint, b: bigint): bigint;
export function rem(a: bigint, b: bigint): bigint;
export function eq(a: bigint, b: bigint): boolean;
export function ne(a: bigint, b: bigint): boolean;
export function lt(a: bigint, b: bigint): boolean;
export function le(a: bigint, b: bigint): boolean;
export function gt(a: bigint, b: bigint): boolean;
export function ge(a: bigint, b: bigint): boolean;
```

## Pagination (`pagination.ts`)

### Purpose

Handles expression-based pagination for query results.

### Key Functions

```typescript
// Extract sortable fields from expression
export function extractSortFields(filter: Expression): string[];

// Generate cursor-based pagination expression
export function cursorExpression(
  sort: { field: string; direction: 1 | -1 }[],
  cursor: Record<string, unknown>
): Expression;
```

## Usage Examples

### Device Filtering

```javascript
// Filter by serial number pattern
const filter = parse("DeviceID.SerialNumber LIKE 'ABC%'");

// Filter by tag and parameter
const filter = parse(
  "Tags.configured = true AND Device.Info.Uptime > 3600"
);

// Compound filter with OR
const filter = parse(
  "ProductClass = 'Router' OR ProductClass = 'Gateway'"
);
```

### Preconditions

```javascript
// Preset precondition
const precondition = parse(
  "Tags.needsUpdate = true AND Events.Inform > NOW() - 86400000"
);

// Evaluate against device
const result = evaluate(precondition, deviceParams, Date.now());
```

### Computed Values

```javascript
// Virtual parameter expression
const expr = parse(
  "UPPER(Device.DeviceInfo.Manufacturer) || '-' || Device.DeviceInfo.ModelName"
);
```

### Query Optimization

```javascript
// Minimize complex filter
const context = createSynthContext();
const minterms = context.getMinterms(clause, true);
const minimized = context.minimize(minterms);
const optimized = context.toExpression(minimized);
```

## Performance Considerations

### Caching

- **RegExp Cache**: WeakMap caches compiled LIKE patterns
- **Expression Stringify**: Memoized for repeated serialization
- **Clause Expression**: Lazy evaluation with caching

### Optimization Tips

1. **Pre-parse expressions**: Parse once, evaluate many times
2. **Use minimization**: For complex boolean logic
3. **Avoid deep nesting**: Flattened AND/OR are more efficient
4. **Leverage short-circuit**: Order conditions by selectivity

### Complexity

| Operation | Complexity |
|-----------|------------|
| Parse | O(n) linear in expression length |
| Evaluate | O(n) linear in AST size |
| Normalize | O(n²) for polynomial operations |
| Synthesize | Exponential worst-case (Espresso) |

## Error Handling

### Parser Errors

```typescript
try {
  const expr = parse("invalid syntax here");
} catch (err) {
  // Parsimmon error with position information
  console.error(err.message);
}
```

### Evaluation Errors

- Unknown operators: Throws error
- Type mismatches: Null propagation
- Division by zero: Returns null
