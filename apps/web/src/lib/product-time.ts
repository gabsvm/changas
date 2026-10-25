export const PRODUCT_TIME_ZONE = "America/Argentina/Buenos_Aires";

const localDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/i;

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partsAt(timestamp: number): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: PRODUCT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(timestamp);
  const value = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((entry) => entry.type === type);
    if (!part) throw new Error(`Missing ${type} date part.`);
    return Number(part.value);
  };
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function validCalendarDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): boolean {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    hour < 24 &&
    minute < 60 &&
    second < 60
  );
}

/** Parse datetime-local values as Buenos Aires wall time; explicit offsets remain absolute. */
export function parseProductDateTime(value: string): Date | null {
  const match = localDateTimePattern.exec(value.trim());
  if (!match) return null;

  const [year, month, day, hour, minute, second, fraction, offset] = match
    .slice(1)
    .map((part) => part ?? "");
  const y = Number(year);
  const mo = Number(month);
  const d = Number(day);
  const h = Number(hour);
  const mi = Number(minute);
  const s = Number(second || 0);
  const ms = Number((fraction || "").padEnd(3, "0"));
  if (!validCalendarDate(y, mo, d, h, mi, s)) return null;

  const normalized = `${year}-${month}-${day}T${hour}:${minute}:${second || "00"}.${String(ms).padStart(3, "0")}${offset}`;
  if (offset) {
    if (offset !== "Z" && offset !== "z") {
      const offsetHours = Number(offset.slice(1, 3));
      const offsetMinutes = Number(offset.slice(4, 6));
      if (offsetHours > 23 || offsetMinutes > 59) return null;
    }
    const timestamp = Date.parse(normalized);
    return Number.isFinite(timestamp) ? new Date(timestamp) : null;
  }

  const localEpoch = Date.UTC(y, mo - 1, d, h, mi, s, ms);
  let timestamp = localEpoch;
  for (let attempt = 0; attempt < 3; attempt++) {
    const local = partsAt(timestamp);
    const representedEpoch = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    timestamp =
      localEpoch - (representedEpoch - Math.floor(timestamp / 1000) * 1000);
  }
  const resolved = new Date(timestamp);
  const result = partsAt(timestamp);
  if (
    result.year !== y ||
    result.month !== mo ||
    result.day !== d ||
    result.hour !== h ||
    result.minute !== mi ||
    result.second !== s ||
    resolved.getUTCMilliseconds() !== ms
  ) {
    return null;
  }
  return resolved;
}

export function formatProductDateTime(value: string | Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: PRODUCT_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(typeof value === "string" ? new Date(value) : value);
}
