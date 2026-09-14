/**
 * Small measuring helper for the performance tests.
 *
 * The median is measured, not the mean: a single outlier from garbage
 * collection or other load on the machine should not tip the result. Warm-up
 * rounds run first so that JIT compilation is not what gets measured.
 *
 * The budgets in the tests are deliberately generous against the measured
 * values. They are not meant to pin milliseconds but orders of magnitude: a
 * loop that accidentally turns quadratic shows up, a slower machine does not.
 */
export interface BenchResult {
  median: number;
  min: number;
  max: number;
  runs: number;
}

export function bench(
  fn: () => void,
  { runs = 20, warmup = 3 }: { runs?: number; warmup?: number } = {}
): BenchResult {
  for (let i = 0; i < warmup; i++) fn();

  const timings: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn();
    timings.push(performance.now() - start);
  }

  timings.sort((a, b) => a - b);

  return {
    median: timings[Math.floor(timings.length / 2)],
    min: timings[0],
    max: timings[timings.length - 1],
    runs
  };
}

export function report(name: string, result: BenchResult, budget: number) {
  const line = [
    name.padEnd(46),
    `median ${result.median.toFixed(3)} ms`.padEnd(22),
    `min ${result.min.toFixed(3)}`.padEnd(14),
    `max ${result.max.toFixed(3)}`.padEnd(14),
    `budget ${budget} ms`
  ].join(' ');

  console.log(line);
}
