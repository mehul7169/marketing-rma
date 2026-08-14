export type DateChunk = {
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
};

function parseCivil(iso: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Invalid date: ${iso}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function formatCivil(year: number, month: number, day: number): string {
  const dt = new Date(Date.UTC(year, month - 1, day));
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Split [fromISO, toISO] into calendar-month chunks (inclusive). Civil dates, not server TZ. */
export function getMonthlyChunks(fromISO: string, toISO: string): DateChunk[] {
  const [fy, fm, fd] = parseCivil(fromISO);
  const [ty, tm, td] = parseCivil(toISO);
  if (fromISO > toISO) {
    throw new Error(`from (${fromISO}) must be on or before to (${toISO})`);
  }

  const chunks: DateChunk[] = [];
  let y = fy;
  let m = fm;

  while (y < ty || (y === ty && m <= tm)) {
    const monthStartDay = y === fy && m === fm ? fd : 1;
    const monthEndDay = y === ty && m === tm ? td : daysInMonth(y, m);
    chunks.push({
      start: formatCivil(y, m, monthStartDay),
      end: formatCivil(y, m, monthEndDay)
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  return chunks;
}

/** Format chunk for console logs, e.g. "2026-01 through 2026-01-31". */
export function formatChunkLabel(chunk: DateChunk): string {
  const startMonth = chunk.start.slice(0, 7);
  if (chunk.start.slice(0, 7) === chunk.end.slice(0, 7)) {
    return `${startMonth} through ${chunk.end}`;
  }
  return `${chunk.start} through ${chunk.end}`;
}
