/** Layout classes for one weekday row in the knowledge hours editor. */
export const HOURS_DAY_ROW_CLASS =
  "flex flex-col gap-3 rounded-lg border px-3 py-3 sm:grid sm:grid-cols-[9rem_auto_minmax(0,1fr)_minmax(0,1fr)] sm:items-start sm:gap-3";

/** Opens/Closes pair: stacked below 400px, two columns from 400px until sm, then join the desktop grid. */
export const HOURS_TIME_FIELDS_CLASS =
  "grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:contents";

export const HOURS_TIME_INPUT_CLASS =
  "h-11 min-h-11 w-full min-w-0 text-base tabular-nums";

export function formatClockTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || hours < 0 || hours > 23) return value;
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return value;
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = ((hours + 11) % 12) + 1;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}
