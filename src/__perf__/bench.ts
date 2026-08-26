/**
 * Kleine Messhilfe fuer die Laufzeittests.
 *
 * Gemessen wird der Median, nicht der Mittelwert: ein einzelner Ausreisser
 * durch Garbage Collection oder eine andere Last auf der Maschine soll das
 * Ergebnis nicht kippen. Vorher laufen Aufwaermrunden, damit nicht die
 * JIT-Kompilierung gemessen wird.
 *
 * Die Budgets in den Tests sind bewusst grosszuegig gegen die gemessenen
 * Werte gesetzt. Sie sollen keine Millisekunden festschreiben, sondern
 * Groessenordnungen: eine Schleife, die versehentlich quadratisch wird, faellt
 * auf, ein langsamerer Rechner nicht.
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
    `Budget ${budget} ms`
  ].join(' ');

  console.log(line);
}
