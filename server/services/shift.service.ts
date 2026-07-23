import { prisma } from "../db.js";

// ----------------------------------------------------
// DOUBLE-BOOKING PREVENTION
// A given employee may not hold two overlapping shift assignments at the
// same time. These helpers compute real overlap (correctly handling
// overnight shifts that cross midnight) and look up any conflicting
// assignment for a candidate shift before it is created.
// ----------------------------------------------------

export type ShiftTimeRange = { date: string; startTime: string; endTime: string };

export const shiftToRange = (s: ShiftTimeRange): { start: Date; end: Date } => {
  const [y, mo, d] = s.date.split("-").map(Number);
  const [sh, sm] = (s.startTime || "00:00").split(":").map(Number);
  const [eh, em] = (s.endTime || "00:00").split(":").map(Number);
  const start = new Date(y, (mo || 1) - 1, d || 1, sh || 0, sm || 0, 0);
  const end = new Date(y, (mo || 1) - 1, d || 1, eh || 0, em || 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1); // shift crosses midnight
  return { start, end };
};

export const shiftsOverlap = (a: ShiftTimeRange, b: ShiftTimeRange): boolean => {
  const ra = shiftToRange(a);
  const rb = shiftToRange(b);
  return ra.start < rb.end && rb.start < ra.end;
};

export const dateStr = (d: Date): string => d.toISOString().split("T")[0];

// Returns the conflicting shift (if any) that `employeeId` is already
// assigned to and that overlaps with `candidate`. Pass `excludeShiftIds`
// to ignore specific shifts (e.g. the shift currently being edited, or
// shifts already being vacated as part of the same swap operation).
export const findBookingConflict = async (
  employeeId: string,
  candidate: ShiftTimeRange,
  excludeShiftIds: string[] = []
) => {
  const [y, mo, d] = candidate.date.split("-").map(Number);
  const prevDate = new Date(y, (mo || 1) - 1, (d || 1) - 1);
  const nextDate = new Date(y, (mo || 1) - 1, (d || 1) + 1);

  const existingAssignments = await prisma.shiftAssignment.findMany({
    where: {
      employeeId,
      status: "ASSIGNED",
      shift: {
        date: { gte: dateStr(prevDate), lte: dateStr(nextDate) },
        ...(excludeShiftIds.length ? { id: { notIn: excludeShiftIds } } : {}),
      },
    },
    include: { shift: true },
  });

  for (const a of existingAssignments) {
    if (shiftsOverlap(candidate, a.shift)) {
      return a.shift;
    }
  }
  return null;
};

export const describeConflict = (conflict: { name: string; date: string; startTime: string; endTime: string }) =>
  `al ingepland voor "${conflict.name}" op ${conflict.date} van ${conflict.startTime} tot ${conflict.endTime} en kan niet dubbel geboekt worden voor hetzelfde tijdslot`;

export const conflictMessage = (conflict: { name: string; date: string; startTime: string; endTime: string }) =>
  `Deze medewerker is ${describeConflict(conflict)}.`;
