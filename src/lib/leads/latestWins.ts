/** Ignore stale async work when a newer query has already started. */
export function makeLatestWins() {
  let seq = 0;
  return {
    begin(): number {
      seq += 1;
      return seq;
    },
    isLatest(n: number): boolean {
      return n === seq;
    }
  };
}
