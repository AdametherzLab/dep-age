import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { type HealthScore } from './types';
import { superjson } from './utils';

export const healthHistory = sqliteTable('health_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  score: integer('score').notNull(),
  grade: text('grade').notNull(),
  totalDeps: integer('total_deps').notNull(),
  abandonedCount: integer('abandoned_count').notNull(),
  data: text('data').notNull(),
}, (table) => ({
  timestampIdx: index('timestamp_idx').on(table.timestamp),
}));

type DatabaseConfig = {
  dbPath?: string;
};

export class HealthHistory {
  private db: ReturnType<typeof drizzle>;
  
  constructor(config: DatabaseConfig = {}) {
    const dbPath = config.dbPath ?? './dep-age-history.sqlite';
    const sqlite = new Database(dbPath);
    this.db = drizzle(sqlite);
  }

  async saveSnapshot(health: HealthScore): Promise<void> {
    await this.db.insert(healthHistory).values({
      timestamp: Math.floor(Date.now() / 1000),
      score: health.score,
      grade: health.grade,
      totalDeps: health.totalDeps,
      abandonedCount: health.abandonedCount,
      data: superjson.stringify(health),
    });
  }

  async getHistory(start: Date, end: Date): Promise<HealthScore[]> {
    const results = await this.db
      .select()
      .from(healthHistory)
      .where(
        sql`timestamp >= ${Math.floor(start.getTime() / 1000)} AND timestamp <= ${Math.floor(end.getTime() / 1000)}`
      )
      .orderBy(asc(healthHistory.timestamp));

    return results.map(row => superjson.parse<HealthScore>(row.data));
  }
}

export function initHealthHistory(dbPath?: string): HealthHistory {
  return new HealthHistory({ dbPath });
}
