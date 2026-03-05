# dep-age

[![CI](https://github.com/AdametherzLab/dep-age/actions/workflows/ci.yml/badge.svg)](https://github.com/AdametherzLab/dep-age/actions) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Detect abandoned npm dependencies** — health scores, CLI, GitHub Action. Zero runtime deps.

## Features

- Detect abandoned dependencies (configurable threshold, default 2 years)
- Health score 0-100 with letter grade (A-F)
- CLI with colored output, multiple formats (text, JSON, markdown)
- GitHub Action for CI pipelines
- Sort/filter by name, age, or status
- Zero runtime dependencies — pure TypeScript

## CLI

```bash
# Scan current project
npx @adametherzlab/dep-age

# Custom threshold (1 year), markdown output
npx @adametherzlab/dep-age --threshold 365 --format markdown

# Just the health score
npx @adametherzlab/dep-age --score-only

# CI mode — exit non-zero if abandoned deps found
npx @adametherzlab/dep-age --abandoned-only
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--path <dir>` | Path to package.json | `./package.json` |
| `--threshold <days>` | Days before marking abandoned | `730` |
| `--format <fmt>` | Output: `text`, `json`, `markdown` | `text` |
| `--abandoned-only` | Only show abandoned packages | `false` |
| `--sort <field>` | Sort by: `name`, `age`, `status` | `age` |
| `--score-only` | Only output the health score | `false` |
| `--no-color` | Disable colored output | — |

### Sample Output

```
Dependency Health: 72/100 (C)
14 deps scanned | 8 fresh | 4 aging | 2 abandoned

Name                 Version         Age        Status          Alternatives
--------------------------------------------------------------------------------
lodash               3.10.1          2155       ABANDONED       lodash-es, ramda
express              4.18.2          730        ABANDONED       fastify, koa
typescript           5.2.2           45         ACTIVE
```

## GitHub Action

```yaml
- uses: AdametherzLab/dep-age@v2
  with:
    path: './package.json'
    threshold: '730'
    fail-on-abandoned: 'true'
    format: 'markdown'
```

### Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `path` | Path to package.json | `./package.json` |
| `threshold` | Days before marking abandoned | `730` |
| `fail-on-abandoned` | Fail if abandoned deps found | `true` |
| `format` | Output format | `markdown` |

### Outputs

| Output | Description |
|--------|-------------|
| `score` | Health score (0-100) |
| `grade` | Letter grade (A-F) |
| `abandoned-count` | Number of abandoned deps |
| `report` | Full report output |

## Programmatic API

```typescript
import {
  scanDependencies,
  generateReport,
  calculateHealthScore,
  createAbandonmentThreshold
} from '@adametherzlab/dep-age';

const result = await scanDependencies({
  packageJsonPath: './package.json',
});

// Health score
const health = calculateHealthScore(result);
console.log(`Score: ${health.score}/100 (${health.grade})`);

// Full report
console.log(generateReport(result, { format: 'markdown' }));
```

### `scanDependencies(options)`

Scans dependencies from package.json against the npm registry.

```typescript
const result = await scanDependencies({
  packageJsonPath: './package.json',
  abandonmentThreshold: createAbandonmentThreshold(365), // 1 year
});
```

### `calculateHealthScore(result, threshold?)`

Returns a health score object:

```typescript
interface HealthScore {
  score: number;        // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalDeps: number;
  freshCount: number;   // < half threshold
  agingCount: number;   // half to full threshold
  abandonedCount: number;
  averageAgeDays: number;
  oldestPackage: string | null;
  summary: string;
}
```

Scoring: fresh deps = 100%, aging = 50%, abandoned = 0%.

### `generateReport(result, options?)`

Formats scan results as text, JSON, or markdown table.

```typescript
generateReport(result, {
  format: 'markdown',
  showOnlyAbandoned: true,
  sortBy: 'age',
  color: false,
});
```

## Installation

```bash
npm install @adametherzlab/dep-age
# or
bun add @adametherzlab/dep-age
```

## License

MIT © [AdametherzLab](https://github.com/AdametherzLab)
