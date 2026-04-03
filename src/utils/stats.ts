import type { BenchmarkRun } from '../types';

export interface MetricStats {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  ci95Low: number;
  ci95High: number;
  n: number;
}

export function computeStats(values: number[]): MetricStats {
  const n = values.length;
  if (n === 0) return { mean: 0, stdDev: 0, min: 0, max: 0, ci95Low: 0, ci95High: 0, n: 0 };
  if (n === 1) return { mean: values[0], stdDev: 0, min: values[0], max: values[0], ci95Low: values[0], ci95High: values[0], n: 1 };

  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1); // sample variance
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const margin = 1.96 * (stdDev / Math.sqrt(n));

  return {
    mean,
    stdDev,
    min,
    max,
    ci95Low: mean - margin,
    ci95High: mean + margin,
    n,
  };
}

/** Group completed runs by "modelId::taskId" key */
export function groupRunsByModelTask(runs: BenchmarkRun[]): Map<string, BenchmarkRun[]> {
  const map = new Map<string, BenchmarkRun[]>();
  for (const run of runs) {
    if (run.status !== 'completed') continue;
    const key = `${run.modelId}::${run.taskId}`;
    const arr = map.get(key) || [];
    arr.push(run);
    map.set(key, arr);
  }
  return map;
}

/** Extract metric values from a group of runs */
export function getMetricValues(runs: BenchmarkRun[], metricKey: string): number[] {
  return runs
    .filter((r) => r.metrics)
    .map((r) => (r.metrics as any)[metricKey])
    .filter((v): v is number => v != null && !isNaN(v));
}
