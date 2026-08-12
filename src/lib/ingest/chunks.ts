import {
  addMonths,
  endOfMonth,
  format,
  max as maxDate,
  min as minDate,
  parseISO,
  startOfMonth
} from "date-fns";

export type DateChunk = {
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
};

function formatDateISO(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Split [fromISO, toISO] into calendar-month chunks (inclusive). */
export function getMonthlyChunks(fromISO: string, toISO: string): DateChunk[] {
  const from = parseISO(fromISO);
  const to = parseISO(toISO);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error(`Invalid date range: ${fromISO} → ${toISO}`);
  }
  if (from > to) {
    throw new Error(`from (${fromISO}) must be on or before to (${toISO})`);
  }

  const chunks: DateChunk[] = [];
  let cursor = startOfMonth(from);

  while (cursor <= to) {
    const monthStart = maxDate([cursor, from]);
    const monthEnd = minDate([endOfMonth(cursor), to]);
    chunks.push({ start: formatDateISO(monthStart), end: formatDateISO(monthEnd) });
    cursor = startOfMonth(addMonths(cursor, 1));
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
