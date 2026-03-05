import type { ScanResult, HealthScore, AbandonmentThreshold } from './types';
import { DEFAULT_ABANDONMENT_THRESHOLD } from './types';

/**
 * Calculate a dependency health score (0-100) for the project.
 * Scoring: fresh (<1yr) = full marks, aging (1-2yr) = half, abandoned (>2yr) = 0.
 */
export function calculateHealthScore(
  result: ScanResult,
  threshold?: AbandonmentThreshold
): HealthScore {
  const t = threshold ?? DEFAULT_ABANDONMENT_THRESHOLD;
  const deps = Object.values(result);
  const total = deps.length;

  if (total === 0) {
    return {
      score: 100, grade: 'A', totalDeps: 0,
      freshCount: 0, agingCount: 0, abandonedCount: 0,
      averageAgeDays: 0, oldestPackage: null,
      summary: 'No dependencies to evaluate.',
    };
  }

  const halfThreshold = Math.floor(t / 2);
  let freshCount = 0;
  let agingCount = 0;
  let abandonedCount = 0;
  let totalAge = 0;
  let oldest = deps[0];

  for (const dep of deps) {
    totalAge += dep.ageInDays;
    if (dep.ageInDays > oldest.ageInDays) oldest = dep;

    if (dep.ageInDays < halfThreshold) freshCount++;
    else if (dep.ageInDays < t) agingCount++;
    else abandonedCount++;
  }

  // Score: each dep contributes proportionally
  // Fresh = 100%, Aging = 50%, Abandoned = 0%
  const rawScore = ((freshCount * 100) + (agingCount * 50)) / total;
  const score = Math.round(Math.max(0, Math.min(100, rawScore)));

  const grade: HealthScore['grade'] =
    score >= 90 ? 'A' :
    score >= 75 ? 'B' :
    score >= 60 ? 'C' :
    score >= 40 ? 'D' : 'F';

  const avgAge = Math.round(totalAge / total);
  const summary = abandonedCount === 0
    ? `All ${total} dependencies are actively maintained.`
    : `${abandonedCount} of ${total} dependencies may be abandoned (>${t} days since last publish).`;

  return {
    score, grade, totalDeps: total,
    freshCount, agingCount, abandonedCount,
    averageAgeDays: avgAge,
    oldestPackage: oldest.name,
    summary,
  };
}
