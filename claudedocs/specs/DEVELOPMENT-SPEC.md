# GenieACS Development & Build Specification

## Overview

This document covers the build system, test infrastructure, development tooling, and deployment configuration for GenieACS.

**Primary Files**:
- `build/build.ts` - Production build orchestration
- `build/lint.ts` - Code quality validation
- `build/assets.ts` - Asset placeholder constants
- `test/*.ts` - Unit test suite (11 test files)
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `.eslintrc.json` - ESLint configuration

## Build System

### Architecture

GenieACS uses **esbuild** for fast TypeScript bundling with a custom build pipeline.

```
build/build.ts
      │
      ├─ init() ─────────────────────┐
      │                               │
      ├─ generateIconsSprite() ──┐   │
      │                          │   │
      ├─ copyStatic() ───────────┼───┼─→ generateFrontendJs()
      │                          │   │
      ├─ generateCss() ──────────┼───┘
      │                          │
      └─ generateBackendJs() ←───┘
```

### Build Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Production build to `dist/` |
| `npm run lint` | Run ESLint + TypeScript + Prettier |
| `npm run test` | Run test suite |

### Build Pipeline Steps

**1. Initialization** (`init()`):
- Generate build metadata (date + git commit hash)
- Parse and strip devDependencies from package.json
- Clean output directory
- Create output structure (`dist/bin`, `dist/public`)

**2. Static Assets** (`copyStatic()`):
- Copy LICENSE, README.md, CHANGELOG.md
- Hash and rename logo.svg, favicon.png for cache busting

**3. CSS Generation** (`generateCss()`):
- Bundle `ui/css/app.css`
- Minify in production mode
- Generate source maps
- Output hashed filename

**4. Icons Sprite** (`generateIconsSprite()`):
- Read SVG icons from `ui/icons/`
- Optimize with SVGO
- Generate combined SVG sprite with symbols
- Hash output filename

**5. Frontend JS** (`generateFrontendJs()`):
- Bundle `ui/app.ts` with dependencies
- Inline: parsimmon, espresso-iisojs, codemirror, mithril, yaml
- External: all other dependencies
- Output: ESM format with code splitting

**6. Backend JS** (`generateBackendJs()`):
- Bundle 5 services: cwmp, ext, nbi, fs, ui
- Target: Node.js 12.13.0
- Add shebang header
- Set executable permissions

### esbuild Configuration

**Backend Build**:
```typescript
{
  bundle: true,
  platform: "node",
  target: "node12.13.0",
  packages: "external",
  sourcemap: "inline",
  minify: MODE === "production",
  banner: { js: "#!/usr/bin/env node" }
}
```

**Frontend Build**:
```typescript
{
  bundle: true,
  platform: "browser",
  format: "esm",
  splitting: true,
  target: ["chrome109", "safari15.6", "firefox115", "opera102", "edge118"],
  sourcemap: "linked",
  minify: MODE === "production"
}
```

### Build Plugins

**assetsPlugin**: Replaces `build/assets.ts` imports with actual hashed filenames

**packageDotJsonPlugin**: Redirects package.json imports to dist version

**inlineDepsPlugin**: Marks specific dependencies for bundling, others as external

### Build Metadata

Versioning format: `{version}+{buildMetadata}`

**Build Metadata Generation**:
1. Get current date (YYMMDD)
2. Get git HEAD commit hash
3. Check for uncommitted changes
4. If clean: `{date}{commit[0:4]}`
5. If dirty: `{date}{md5(commit+diff+newFiles)[0:4]}`

## TypeScript Configuration

### tsconfig.json

```json
{
  "compilerOptions": {
    "lib": ["ES2022", "dom"],
    "module": "ES2022",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "alwaysStrict": true,
    "noImplicitReturns": true,
    "strictFunctionTypes": true,
    "isolatedModules": true,
    "noEmit": true,
    "allowImportingTsExtensions": true
  }
}
```

### Type Checking

| Option | Purpose |
|--------|---------|
| `noEmit` | Type-check only (esbuild handles emit) |
| `alwaysStrict` | Enforce strict mode |
| `noImplicitReturns` | All code paths must return |
| `strictFunctionTypes` | Strict function parameter checking |
| `isolatedModules` | esbuild compatibility |

### Include Paths

- `./bin/*.ts` - Service entry points
- `./lib/**/*` - Core library
- `./ui/**/*` - Frontend code
- `./test/**/*` - Test suite
- `./build/**/*` - Build scripts

## Code Quality Tools

### Linting Pipeline (`build/lint.ts`)

Runs three tools in parallel:
1. **Prettier** - Code formatting
2. **ESLint** - Static analysis
3. **TypeScript** - Type checking

```typescript
async function runAll(): Promise<void> {
  const prom1 = runPrettier();  // prettier --prose-wrap always --write .
  const prom2 = runEslint();    // eslint 'bin/*.ts' 'lib/**/*.ts' ...
  const prom3 = runTsc();       // tsc --noEmit
  // Execute in parallel, output sequentially
}
```

### ESLint Configuration

**Parser**: @typescript-eslint/parser

**Extends**:
- eslint:recommended
- plugin:@typescript-eslint/recommended
- prettier

**Key Rules**:

| Rule | Setting | Purpose |
|------|---------|---------|
| `no-shadow` | error (allow `err`) | Prevent variable shadowing |
| `handle-callback-err` | error | Enforce error handling |
| `prefer-arrow-callback` | error | Consistent callback style |
| `prefer-const` | error (destructuring: all) | Immutability preference |
| `eqeqeq` | error (null: ignore) | Strict equality |
| `@typescript-eslint/no-floating-promises` | error | Prevent unhandled promises |
| `@typescript-eslint/explicit-function-return-type` | error | Type safety |

## Test Infrastructure

### Test Framework

Uses Node.js built-in test runner (`node:test`) with `node:assert`.

### Test Execution

```bash
npm run test
# Expands to:
esbuild --bundle --platform=node --target=node18 \
  --packages=external --sourcemap=inline --outdir=test test/*.ts \
  && node --test --enable-source-maps test/*.js \
  && rm test/*.js
```

**Process**:
1. Bundle TypeScript tests with esbuild
2. Run with Node.js test runner
3. Enable source maps for error traces
4. Clean up compiled JS files

### Test Suite

| Test File | Module Under Test | Coverage |
|-----------|-------------------|----------|
| `auth.ts` | `lib/auth.ts` | Digest authentication |
| `db.ts` | `lib/db/` | Database operations |
| `device.ts` | Device data handling | Device state management |
| `pagination.ts` | Pagination logic | List pagination |
| `path.ts` | `lib/common/path.ts` | Path parsing/manipulation |
| `path-set.ts` | `lib/common/path-set.ts` | PathSet operations |
| `ping.ts` | `lib/ping.ts` | Network ping |
| `synth.ts` | Data synthesis | Data generation |
| `util.ts` | `lib/util.ts` | Utility functions |
| `xml-parser.ts` | `lib/xml-parser.ts` | XML parsing |
| `yaml.ts` | YAML handling | YAML operations |

### Test Examples

**Authentication Test** (`test/auth.ts`):
```typescript
void test("digest", () => {
  const challenges = [
    `Digest realm="${realm}",nonce="${nonce}"`,
    `Digest realm="${realm}",nonce="${nonce}",qop="auth"`,
    `Digest realm="${realm}",nonce="${nonce}",qop="auth-int"`,
  ];

  for (const challenge of challenges) {
    const wwwAuthHeader = auth.parseWwwAuthenticateHeader(challenge);
    const solution = auth.solveDigest(...);
    const authHeader = auth.parseAuthorizationHeader(solution);
    assert.strictEqual(authHeader["response"], expectedDigest);
  }
});
```

**Path Parsing Test** (`test/path.ts`):
```typescript
void test("parse", () => {
  assert.throws(() => Path.parse("."));      // Invalid: starts with dot
  assert.throws(() => Path.parse("a."));     // Invalid: ends with dot
  assert.throws(() => Path.parse("a..b"));   // Invalid: consecutive dots
  assert.doesNotThrow(() => Path.parse("*")); // Valid: wildcard
  assert.doesNotThrow(() => Path.parse("")); // Valid: empty path
});
```

**XML Parser Test** (`test/xml-parser.ts`):
```typescript
void test("decodeEntities", () => {
  assert.strictEqual(
    decodeEntities("&&amp;&lt;&gt;&quot;&apos;&gt;&#167;&#xd842;&#xDFB7;;"),
    "&&<>\"'>§𠮷;"
  );
});
```

## Dependencies

### Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@breejs/later` | ^4.2.0 | Cron expression parsing |
| `@koa/bodyparser` | ^5.1.1 | HTTP body parsing |
| `@koa/router` | ^13.1.0 | HTTP routing |
| `bson` | ^4.7.2 | BSON serialization |
| `espresso-iisojs` | ^1.0.8 | ISO date parsing |
| `iconv-lite` | ^0.6.3 | Character encoding |
| `ipaddr.js` | ^2.2.0 | IP address utilities |
| `jsonwebtoken` | ^9.0.2 | JWT handling |
| `koa` | ^2.15.3 | HTTP framework |
| `koa-compress` | ^5.1.0 | Response compression |
| `koa-jwt` | ^4.0.3 | JWT middleware |
| `koa-send` | ^5.0.1 | Static file serving |
| `mongodb` | ^4.16.0 | Database driver |
| `parsimmon` | ^1.18.1 | Parser combinator |
| `seedrandom` | ^3.0.5 | Deterministic random |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.4.5 | TypeScript compiler |
| `esbuild` | ^0.21.4 | Bundler |
| `eslint` | ^8.57.0 | Linting |
| `prettier` | ^3.3.1 | Code formatting |
| `mithril` | ^2.2.2 | UI framework |
| `codemirror` | ^5.65.16 | Code editor |
| `sql.js` | ^1.10.3 | SQLite (client-side) |
| `svgo` | ^3.3.2 | SVG optimization |
| `yaml` | ^1.10.2 | YAML parsing |

### Type Definitions

- `@types/codemirror`
- `@types/jsonwebtoken`
- `@types/koa`
- `@types/koa-compress`
- `@types/mithril`
- `@types/node`
- `@types/parsimmon`
- `@types/seedrandom`

## Deployment

### Build Output Structure

```
dist/
├── bin/
│   ├── genieacs-cwmp     # CWMP service
│   ├── genieacs-ext      # Extension runner
│   ├── genieacs-fs       # File server
│   ├── genieacs-nbi      # NBI REST API
│   └── genieacs-ui       # UI server
├── public/
│   ├── app-{hash}.js     # Frontend bundle
│   ├── app-{hash}.css    # Stylesheet
│   ├── icons-{hash}.svg  # Icon sprite
│   ├── logo-{hash}.svg   # Logo
│   └── favicon-{hash}.png
├── package.json          # Stripped (no devDeps)
├── npm-shrinkwrap.json   # Locked dependencies
├── LICENSE
├── README.md
└── CHANGELOG.md
```

### Service Binaries

Each binary is a standalone Node.js script:
- Shebang: `#!/usr/bin/env node`
- Permissions: Executable (mode | 73)
- Dependencies: External (installed via npm)
- Source maps: Inline for debugging

### Installation Steps

```bash
# Build production distribution
npm run build

# Install in production
cd dist
npm install --production

# Start services
./bin/genieacs-cwmp &
./bin/genieacs-nbi &
./bin/genieacs-fs &
./bin/genieacs-ui &
```

### Environment Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Node.js | 12.13.0 | 18+ |
| MongoDB | 4.0 | 6.0+ |
| Memory | 512MB | 2GB+ |
| Disk | 100MB | 1GB+ |

### Service Ports

| Service | Default Port | Config Option |
|---------|--------------|---------------|
| CWMP | 7547 | `CWMP_PORT` |
| NBI | 7557 | `NBI_PORT` |
| FS | 7567 | `FS_PORT` |
| UI | 3000 | `UI_PORT` |

## Development Workflow

### Setup

```bash
# Clone repository
git clone https://github.com/genieacs/genieacs.git
cd genieacs

# Install dependencies
npm install

# Run linting
npm run lint

# Run tests
npm run test

# Development build
NODE_ENV=development npm run build
```

### Code Style

**Formatting**: Prettier with `--prose-wrap always`

**TypeScript**: Strict settings with explicit return types

**Imports**: Use `.ts` extensions (`allowImportingTsExtensions`)

### Adding Tests

1. Create `test/<module>.ts`
2. Import Node.js test utilities:
   ```typescript
   import test from "node:test";
   import assert from "node:assert";
   ```
3. Use `void test("name", () => { ... })` pattern
4. Run with `npm run test`

### Debugging

**Source Maps**: Enabled inline for both development and production

**Test Debugging**:
```bash
# Run tests with inspection
node --inspect --test test/*.js
```

**Service Debugging**:
```bash
# Run service with inspection
node --inspect ./bin/genieacs-cwmp
```

## Performance Considerations

### Build Optimization

- **Parallel execution**: Build steps run concurrently where possible
- **Asset hashing**: Enables cache busting and long-term caching
- **Tree shaking**: External dependencies excluded from bundle
- **Minification**: Production builds minified

### Frontend Optimization

- **Code splitting**: ESM format with dynamic imports
- **Browser targets**: Modern browsers only (2022+)
- **Source maps**: Linked (separate files) in production

### Backend Optimization

- **External packages**: Not bundled, loaded at runtime
- **Inline source maps**: Smaller output, easier debugging
- **Node.js 12 target**: Wide compatibility

## Troubleshooting

### Common Build Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `External import found` | Dependency not externalized | Add to `inlineDepsPlugin` |
| Type errors | TypeScript strict mode | Fix type annotations |
| Missing shebang | Windows line endings | Convert to Unix |

### Test Failures

| Issue | Cause | Solution |
|-------|-------|----------|
| Module not found | Missing `.ts` extension | Add extension to import |
| Async timeout | Long-running operation | Increase test timeout |
| Source map errors | Build artifacts stale | Clean and rebuild |

## Version History

| Version | Node.js | esbuild | TypeScript |
|---------|---------|---------|------------|
| 1.2.13 | 12.13+ | 0.21.4 | 5.4.5 |
