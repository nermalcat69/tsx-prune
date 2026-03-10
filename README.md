# tsx-prune

> Analyze and safely remove unused components, files, imports, and exports in TypeScript/React codebases.

[![npm version](https://img.shields.io/npm/v/tsx-prune.svg)](https://www.npmjs.com/package/tsx-prune)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Features

- **Unused file detection** — find files unreachable from your entry points
- **Unused export detection** — find exports never imported anywhere
- **Unused import detection** — find and remove imports not used in the file body
- **React component detection** — detect JSX components never referenced anywhere
- **Safe deletion** — never deletes test files, stories, or spec files
- **Config file support** — `tsx-prune.config.ts` / `tsx-prune.config.json`
- **tsconfig path aliases** — respects `baseUrl` and `paths` from your `tsconfig.json`
- **JSON output** — machine-readable output for CI pipelines
- **Fast** — uses ts-morph AST cache and fast-glob for 10k+ file projects

---

## Installation

```bash
# Global install
bun add -g tsx-prune
npm install -g tsx-prune

# Or use without installing
bunx tsx-prune
npx tsx-prune
```

---

## Usage

```bash
# Dry run (default) — shows what would be removed
tsx-prune

# Delete unused files
tsx-prune --delete

# Remove unused imports
tsx-prune --fix-imports

# Remove export modifier from unused exports
tsx-prune --fix-exports

# All fixes together
tsx-prune --delete --fix-imports --fix-exports

# Custom entry points
tsx-prune --entry src/main.tsx src/server.ts

# Ignore patterns
tsx-prune --ignore "src/legacy/**" "src/vendor/**"

# JSON output (for CI)
tsx-prune --json

# Silent mode
tsx-prune --silent

# Custom tsconfig
tsx-prune --tsconfig tsconfig.app.json

# Use a config file
tsx-prune --config tsx-prune.config.ts
```

---

## Example Output

```
  Scanning 342 files...
  Entry points: 3 found

  Unused Files:
    ✗ src/components/OldCard.tsx
    ✗ src/utils/legacyHelpers.ts
    2 unused files found

  Unused Exports:
    src/components/Button.tsx
      ✗ <ButtonGroup>
      ✗ ButtonSize

    1 file with unused exports

  Unused React Components:
    <ButtonGroup>, <CardVariant>
    2 unused components found

  ─────────────────────────────────────────
  Summary: 342 files scanned
    ✗ 2 unused files
    ✗ 2 unused exports
    ✗ 2 unused React components

  Dry run complete. Use --delete to remove files.
```

---

## Configuration File

Create `tsx-prune.config.ts` (or `.json`) at your project root:

```ts
// tsx-prune.config.ts
export default {
  entry: ["src/main.tsx", "src/server.ts"],
  ignore: [
    "src/legacy/**",
    "src/vendor/**",
    "**/*.generated.ts",
  ],
};
```

```json
// tsx-prune.config.json
{
  "entry": ["src/main.tsx"],
  "ignore": ["src/legacy/**"]
}
```

---

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--delete` | Delete unused files | `false` (dry run) |
| `--dry-run` | Show what would be deleted | `true` |
| `--fix-imports` | Remove unused import statements | `false` |
| `--fix-exports` | Remove `export` from unused exports | `false` |
| `--entry <paths...>` | Entry point files or globs | `src/main.tsx`, `src/index.tsx`, etc. |
| `--ignore <patterns...>` | Additional glob patterns to ignore | — |
| `--root <dir>` | Root directory to scan | `process.cwd()` |
| `--tsconfig <path>` | Path to tsconfig.json | `./tsconfig.json` |
| `--json` | Output results as JSON | `false` |
| `--silent` | Suppress all output | `false` |
| `--config <path>` | Path to config file | auto-detected |

---

## Default Entry Points

When no `--entry` is specified, tsx-prune looks for:

- `src/main.tsx` / `src/main.ts`
- `src/index.tsx` / `src/index.ts`
- `src/app.tsx` / `src/App.tsx`
- `src/pages/**` (Next.js pages router)
- `src/app/**` (Next.js app router)
- `pages/**`
- `app/**`

---

## Safety Rules

tsx-prune **never** deletes:

- `*.test.ts` / `*.test.tsx`
- `*.spec.ts` / `*.spec.tsx`
- `*.stories.tsx` / `*.stories.ts`
- Files inside `__tests__/` or `tests/`
- Files inside `.storybook/`
- Files with dynamic imports pointing to them

---

## Comparison

| Feature | tsx-prune | ts-prune | knip |
|---------|-----------|----------|------|
| Unused files | ✓ | — | ✓ |
| Unused exports | ✓ | ✓ | ✓ |
| Unused imports | ✓ | — | ✓ |
| React component detection | ✓ | — | — |
| Safe deletion CLI | ✓ | — | — |
| JSX-aware analysis | ✓ | — | — |
| tsconfig paths | ✓ | — | ✓ |
| Config file | ✓ | — | ✓ |
| JSON output | ✓ | — | ✓ |
| React-optimized | ✓ | — | — |

---

## Programmatic API

```ts
import {
  scanFiles,
  Parser,
  buildGraphFromFileInfos,
  analyze,
  reportAnalysis,
} from "tsx-prune";

const files = await scanFiles({
  root: "./src",
  extensions: [".ts", ".tsx"],
  ignore: [],
  entry: [],
});

const parser = new Parser({
  tsconfig: "./tsconfig.json",
  root: "./src",
  extensions: [".ts", ".tsx"],
});

parser.addFiles(files);
const fileInfos = new Map(files.map((f) => [f, parser.parseFile(f)]));

const graph = buildGraphFromFileInfos(fileInfos);
const result = analyze(graph, fileInfos, {
  entryPoints: ["./src/main.tsx"],
  ignorePatterns: [],
});

reportAnalysis(result, { json: false, silent: false, cwd: process.cwd() });
```

---

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Run directly (no build step needed with Bun)
bun run src/cli.ts

# Type-check
bun run lint

# Test
bun test
```

---

## License

MIT
