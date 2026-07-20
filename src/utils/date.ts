// `date.toISOString().split("T")[0]` first converts to UTC, which rolls a
// local-midnight Date back to the previous day in any timezone ahead of UTC
// (e.g. Europe/Brussels, UTC+1/+2). Shifts are stored and matched by plain
// "YYYY-MM-DD" strings, so that silent day-shift is what made shifts appear
// on the wrong cell in the week/month calendar grids. This formats using
// the Date's local fields instead, so the key always matches the day the
// calendar is actually showing.
export const toDateStr = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
