import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { scanDependencies, generateReport, calculateHealthScore, type ScanResult, type DependencyInfo, createAbandonmentThreshold } from '../src/index';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('dep-age', () => {
  let tmpDir: string;
  
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-age-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('scans valid package.json and returns structured results', async () => {
    const packagePath = path.join(tmpDir, 'package.json');
    fs.writeFileSync(packagePath, JSON.stringify({
      dependencies: { fresh: '1.0.0', recent: '2.1.3' }
    }));

    const mockDate = new Date(Date.now() - 86400000).toISOString();
    globalThis.fetch = async (url) => {
      const pkg = url.toString().split('/').pop()!;
      const latest = pkg === 'fresh' ? '1.2.0' : '2.2.0';
      return new Response(JSON.stringify({
        'dist-tags': { latest },
        versions: { [latest]: { version: latest } },
        time: { modified: mockDate, created: mockDate, [latest]: mockDate }
      }));
    };

    const result = await scanDependencies({ packageJsonPath: packagePath });
    expect(Object.keys(result)).toHaveLength(2);
    expect(result.fresh?.ageInDays).toBeGreaterThan(0);
    expect(result.recent?.ageInDays).toBeGreaterThan(0);
  });

  it('throws informative error for missing package.json', async () => {
    const badPath = path.join(tmpDir, 'nonexistent.json');
    await expect(scanDependencies({ packageJsonPath: badPath }))
      .rejects.toThrow(`ENOENT: no such file or directory, open '${badPath}'`);
  });

  it('flags packages older than abandonment threshold', async () => {
    const packagePath = path.join(tmpDir, 'package.json');
    fs.writeFileSync(packagePath, JSON.stringify({ dependencies: { ancient: '0.1.0' } }));

    const oldDate = new Date(Date.now() - 86400000 * 731).toISOString();
    globalThis.fetch = async () => new Response(JSON.stringify({
      'dist-tags': { latest: '5.0.0' },
      versions: { '5.0.0': { version: '5.0.0' } },
      time: { modified: oldDate, created: oldDate, '5.0.0': oldDate }
    }));

    const result = await scanDependencies({
      packageJsonPath: packagePath,
      abandonmentThreshold: createAbandonmentThreshold(730)
    });

    expect(result.ancient?.isAbandoned).toBe(true);
  });

  it('generates valid reports in all formats', () => {
    const mockResult: ScanResult = {
      testpkg: {
        name: 'testpkg',
        currentVersion: '1.0.0',
        publishedDate: new Date(Date.now() - 86400000),
        ageInDays: 1,
        isAbandoned: false,
        alternatives: ['newpkg']
      }
    };

    expect(generateReport(mockResult, { format: 'text' })).toInclude('testpkg');
    expect(JSON.parse(generateReport(mockResult, { format: 'json' }))).toBeArray();
    expect(generateReport(mockResult, { format: 'markdown' })).toInclude('| testpkg |');
  });

  it('handles registry fetch errors gracefully', async () => {
    const packagePath = path.join(tmpDir, 'package.json');
    fs.writeFileSync(packagePath, JSON.stringify({ dependencies: { errorpkg: '3.0.0' } }));

    globalThis.fetch = async () => { throw new Error('Simulated network failure'); };
    const result = await scanDependencies({ packageJsonPath: packagePath });

    expect(Object.keys(result)).toHaveLength(0);
  });

  it('uses cache if enabled and available', async () => {
    const packagePath = path.join(tmpDir, 'package.json');
    fs.writeFileSync(packagePath, JSON.stringify({ dependencies: { cachedpkg: '1.0.0' } }));

    const mockDate = new Date(Date.now() - 86400000).toISOString();
    let fetchCount = 0;
    globalThis.fetch = async (url) => {
      fetchCount++;
      const pkg = url.toString().split('/').pop()!;
      const latest = '1.0.0';
      return new Response(JSON.stringify({
        'dist-tags': { latest },
        versions: { [latest]: { version: latest } },
        time: { modified: mockDate, created: mockDate, [latest]: mockDate }
      }));
    };

    // First scan, should fetch
    const result1 = await scanDependencies({ packageJsonPath, useCache: true, cachePath: tmpDir });
    expect(fetchCount).toBe(1);
    expect(result1.cachedpkg).toBeDefined();

    // Second scan, should use cache
    const result2 = await scanDependencies({ packageJsonPath, useCache: true, cachePath: tmpDir });
    expect(fetchCount).toBe(1); // Fetch count should not increase
    expect(result2.cachedpkg).toBeDefined();

    // Third scan with cache disabled, should fetch again
    const result3 = await scanDependencies({ packageJsonPath, useCache: false });
    expect(fetchCount).toBe(2); // Fetch count should increase
    expect(result3.cachedpkg).toBeDefined();
  });

  it('invalidates cache if stale', async () => {
    const packagePath = path.join(tmpDir, 'package.json');
    fs.writeFileSync(packagePath, JSON.stringify({ dependencies: { stalepkg: '1.0.0' } }));

    const mockDate = new Date(Date.now() - 86400000).toISOString();
    let fetchCount = 0;
    globalThis.fetch = async (url) => {
      fetchCount++;
      const pkg = url.toString().split('/').pop()!;
      const latest = '1.0.0';
      return new Response(JSON.stringify({
        'dist-tags': { latest },
        versions: { [latest]: { version: latest } },
        time: { modified: mockDate, created: mockDate, [latest]: mockDate }
      }));
    };

    // First scan, fetch and cache
    await scanDependencies({ packageJsonPath, useCache: true, cachePath: tmpDir, cacheTTL: 1000 });
    expect(fetchCount).toBe(1);

    // Wait for cache to expire
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Second scan, cache should be stale, fetch again
    await scanDependencies({ packageJsonPath, useCache: true, cachePath: tmpDir, cacheTTL: 1000 });
    expect(fetchCount).toBe(2);
  });
});

describe('calculateHealthScore', () => {
  function makeDep(name: string, ageInDays: number): DependencyInfo {
    return {
      name,
      currentVersion: '1.0.0',
      publishedDate: new Date(Date.now() - ageInDays * 86400000),
      ageInDays,
      isAbandoned: ageInDays >= 730,
    };
  }

  it('returns perfect score for all fresh deps', () => {
    const result: ScanResult = {
      a: makeDep('a', 30),
      b: makeDep('b', 60),
    };
    const health = calculateHealthScore(result);
    expect(health.score).toBe(100);
    expect(health.grade).toBe('A');
    expect(health.freshCount).toBe(2);
    expect(health.agingCount).toBe(0);
    expect(health.abandonedCount).toBe(0);
  });

  it('returns zero score for all abandoned deps', () => {
    const result: ScanResult = {
      a: makeDep('a', 800),
      b: makeDep('b', 900),
    };
    const health = calculateHealthScore(result);
    expect(health.score).toBe(0);
    expect(health.grade).toBe('F');
    expect(health.freshCount).toBe(0);
    expect(health.agingCount).toBe(0);
    expect(health.abandonedCount).toBe(2);
  });

  it('returns 100 for empty deps', () => {
    const health = calculateHealthScore({});
    expect(health.score).toBe(100);
    expect(health.totalDeps).toBe(0);
  });

  it('calculates mixed scores correctly', () => {
    const result: ScanResult = {
      fresh: makeDep('fresh', 100),
      aging: makeDep('aging', 500),
      old: makeDep('old', 800),
    };
    const health = calculateHealthScore(result);
    expect(health.score).toBe(50); // (100 + 50 + 0) / 3 = 50
    expect(health.grade).toBe('D');
    expect(health.freshCount).toBe(1);
    expect(health.agingCount).toBe(1);
    expect(health.abandonedCount).toBe(1);
  });

  it('respects custom threshold', () => {
    const result: ScanResult = {
      a: makeDep('a', 200),
    };
    // With threshold 365, half=182, so 200 days = aging
    const health = calculateHealthScore(result, createAbandonmentThreshold(365));
    expect(health.freshCount).toBe(0);
    expect(health.agingCount).toBe(1);
    expect(health.abandonedCount).toBe(0);
    expect(health.score).toBe(50);
  });

  it('identifies oldest package', () => {
    const result: ScanResult = {
      young: makeDep('young', 10),
      old: makeDep('old', 999),
    };
    const health = calculateHealthScore(result);
    expect(health.oldestPackage).toBe('old');
  });

  it('provides summary text', () => {
    const result: ScanResult = {
      a: makeDep('a', 800),
    };
    const health = calculateHealthScore(result);
    expect(health.summary).toContain('abandoned');
    expect(health.summary).toContain('1 of 1');
  });

  it('calculates granular scores correctly', () => {
    const result: ScanResult = {
      veryFresh: makeDep('veryFresh', 10),
      fresh: makeDep('fresh', 100),
      aging: makeDep('aging', 300),
      old: makeDep('old', 600),
      abandoned: makeDep('abandoned', 800),
    };
    const health = calculateHealthScore(result, createAbandonmentThreshold(730));

    expect(health.veryFreshCount).toBe(1);
    expect(health.freshCount).toBe(1);
    expect(health.agingCount).toBe(2); // aging and old fall into this category
    expect(health.abandonedCount).toBe(1);
    expect(health.score).toBe(50); // (100*1 + 75*1 + 50*1 + 25*1 + 0*1) / 5 = (100+75+50+25+0)/5 = 250/5 = 50
    expect(health.grade).toBe('D');
  });
});
