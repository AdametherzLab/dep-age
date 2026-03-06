import type { ScanResult, HealthScore, AbandonmentThreshold } from './types';
import { DEFAULT_ABANDONMENT_THRESHOLD } from './types';

/**
 * Calculate a dependency health score (0-100) for the project.
 * Scoring: very fresh (<0.25*T) = 100%, fresh (<0.5*T) = 75%, aging (<0.75*T) = 50%, old (<1.0*T) = 25%, abandoned (>=1.0*T) = 0%.
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
      veryFreshCount: 0, freshCount: 0, agingCount: 0, oldCount: 0, abandonedCount: 0,
      averageAgeDays: 0, oldestPackage: null,
      summary: 'No dependencies to evaluate.',
    };
  }

  const quarterThreshold = Math.floor(t / 4);
  const halfThreshold = Math.floor(t / 2);
  const threeQuarterThreshold = Math.floor(t * 3 / 4);

  let veryFreshCount = 0;
  let freshCount = 0;
  let agingCount = 0;
  let oldCount = 0;
  let abandonedCount = 0;
  let totalAge = 0;
  let oldest = deps[0];

  for (const dep of deps) {
    totalAge += dep.ageInDays;
    if (dep.ageInDays > oldest.ageInDays) oldest = dep;

    if (dep.ageInDays < quarterThreshold) veryFreshCount++;
    else if (dep.ageInDays < halfThreshold) freshCount++;
    else if (dep.ageInDays < threeQuarterThreshold) agingCount++;
    else if (dep.ageInDays < t) oldCount++;
    else abandonedCount++;
  }

  // Score: each dep contributes proportionally based on its category
  // Very Fresh = 100%, Fresh = 75%, Aging = 50%, Old = 25%, Abandoned = 0%
  const rawScore = (
    (veryFreshCount * 100) +
    (freshCount * 75) +
    (agingCount * 50) +
    (oldCount * 25)
  ) / total;
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
    veryFreshCount, freshCount, agingCount, oldCount, abandonedCount,
    averageAgeDays: avgAge,
    oldestPackage: oldest.name,
    summary,
  };
}
