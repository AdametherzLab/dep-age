import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { HealthHistory, healthHistory } from '../src/history';
import { type HealthScore } from '../src/types';
import { Database } from 'better-sqlite3';

const mockHealth: HealthScore = {
  score: 85,
  grade: 'B',
  totalDeps: 42,
  veryFreshCount: 10,
  freshCount: 15,
  agingCount: 10,
  oldCount: 5,
  abandonedCount: 2,
  averageAgeDays: 120,
  oldestPackage: 'old-pkg',
  summary: 'Mock health summary',
  explanation: ['Test explanation'],
};

describe('Health History Tracking', () => {
  let db: Database;
  let healthHistory: HealthHistory;

  beforeEach(() => {
    db = new Database(':memory:');
    healthHistory = new HealthHistory({ dbPath: ':memory:' });
  });

  afterEach(() => {
    db.close();
  });

  it('should save and retrieve health snapshots', async () => {
    await healthHistory.saveSnapshot(mockHealth);
    
    const start = new Date(Date.now() - 60000);
    const end = new Date();
    const history = await healthHistory.getHistory(start, end);
    
    expect(history).toHaveLength(1);
    expect(history[0].score).toBe(85);
    expect(history[0].abandonedCount).toBe(2);
    expect(history[0].oldestPackage).toBe('old-pkg');
  });

  it('should filter by date range', async () => {
    const oldDate = new Date('2020-01-01');
    const mockOldHealth: HealthScore = { ...mockHealth, score: 70 };
    
    // Save with mocked timestamps
    await healthHistory.db.insert(healthHistory).values({
      timestamp: Math.floor(oldDate.getTime() / 1000),
      score: mockOldHealth.score,
      grade: mockOldHealth.grade,
      totalDeps: mockOldHealth.totalDeps,
      abandonedCount: mockOldHealth.abandonedCount,
      data: JSON.stringify(mockOldHealth),
    });
    
    await healthHistory.saveSnapshot(mockHealth);
    
    const recentHistory = await healthHistory.getHistory(
      new Date(Date.now() - 60000),
      new Date()
    );
    
    const fullHistory = await healthHistory.getHistory(
      new Date('2019-01-01'),
      new Date()
    );
    
    expect(recentHistory).toHaveLength(1);
    expect(fullHistory).toHaveLength(2);
  });

  it('should maintain data integrity through serialization', async () => {
    const complexHealth: HealthScore = {
      ...mockHealth,
      publishedDate: new Date('2023-01-01'),
      explanation: ['Complex explanation with dates'],
    };

    await healthHistory.saveSnapshot(complexHealth);
    const [result] = await healthHistory.getHistory(
      new Date(Date.now() - 60000),
      new Date()
    );

    expect(result.explanation).toEqual(['Complex explanation with dates']);
    expect(result.publishedDate instanceof Date).toBeTrue();
  });
});
