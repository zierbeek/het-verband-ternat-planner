import express from "express";
import { asyncHandler } from "../middleware/error.middleware.js";
import { prisma } from "../db.js";
import { logAction } from "../services/audit.service.js";
import { dateStr, findBookingConflict } from "../services/shift.service.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";

export const shiftTemplatesRouter = express.Router();

const MAX_TEMPLATE_GENERATE_DAYS = 366;

const parseDaysOfWeek = (raw: string): number[] => {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d: any) => Number.isInteger(d) && d >= 0 && d <= 6);
  } catch {
    return [];
  }
};

shiftTemplatesRouter.get("/api/shift-templates", authenticate, asyncHandler(async (req, res) => {
      const templates = await prisma.shiftTemplate.findMany({
        orderBy: { createdAt: "asc" },
      });
      return res.json(templates);
    }));

shiftTemplatesRouter.post("/api/shift-templates", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const {
      name, startTime, endTime, color, requiredEmployees, notes,
      daysOfWeek, recurrencePattern, startDate, endDate, defaultEmployeeId,
    } = req.body;

    if (!name || !startTime || !endTime || !startDate) {
      return res.status(400).json({ error: "Naam, tijden en startdatum zijn verplicht." });
    }
    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      return res.status(400).json({ error: "Selecteer minstens één dag van de week." });
    }
    const validDays = daysOfWeek.filter((d: any) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (validDays.length === 0) {
      return res.status(400).json({ error: "Ongeldige dagen van de week." });
    }

    try {
      const template = await prisma.shiftTemplate.create({
        data: {
          name,
          startTime,
          endTime,
          color: color || "#8b5cf6",
          requiredEmployees: requiredEmployees !== undefined ? Number(requiredEmployees) : 1,
          notes,
          daysOfWeek: JSON.stringify(validDays),
          recurrencePattern: recurrencePattern === "BIWEEKLY" ? "BIWEEKLY" : "WEEKLY",
          startDate,
          endDate: endDate || null,
          defaultEmployeeId: defaultEmployeeId || null,
        },
      });
      await logAction(req.user.id, "SHIFT_TEMPLATE_CREATE", `Created shift template: ${name}`);
      return res.status(201).json(template);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

shiftTemplatesRouter.put("/api/shift-templates/:id", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const {
      name, startTime, endTime, color, requiredEmployees, notes,
      daysOfWeek, recurrencePattern, startDate, endDate, defaultEmployeeId, isActive,
    } = req.body;

    try {
      const existing = await prisma.shiftTemplate.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Sjabloon niet gevonden." });

      let daysOfWeekJson = existing.daysOfWeek;
      if (daysOfWeek !== undefined) {
        if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
          return res.status(400).json({ error: "Selecteer minstens één dag van de week." });
        }
        const validDays = daysOfWeek.filter((d: any) => Number.isInteger(d) && d >= 0 && d <= 6);
        if (validDays.length === 0) {
          return res.status(400).json({ error: "Ongeldige dagen van de week." });
        }
        daysOfWeekJson = JSON.stringify(validDays);
      }

      const updated = await prisma.shiftTemplate.update({
        where: { id },
        data: {
          name: name !== undefined ? name : existing.name,
          startTime: startTime !== undefined ? startTime : existing.startTime,
          endTime: endTime !== undefined ? endTime : existing.endTime,
          color: color !== undefined ? color : existing.color,
          requiredEmployees: requiredEmployees !== undefined ? Number(requiredEmployees) : existing.requiredEmployees,
          notes: notes !== undefined ? notes : existing.notes,
          daysOfWeek: daysOfWeekJson,
          recurrencePattern: recurrencePattern !== undefined
            ? (recurrencePattern === "BIWEEKLY" ? "BIWEEKLY" : "WEEKLY")
            : existing.recurrencePattern,
          startDate: startDate !== undefined ? startDate : existing.startDate,
          endDate: endDate !== undefined ? (endDate || null) : existing.endDate,
          defaultEmployeeId: defaultEmployeeId !== undefined ? (defaultEmployeeId || null) : existing.defaultEmployeeId,
          isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
        },
      });
      await logAction(req.user.id, "SHIFT_TEMPLATE_UPDATE", `Updated shift template ${id}`, existing, updated);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

shiftTemplatesRouter.delete("/api/shift-templates/:id", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const { deleteGeneratedShifts } = req.query;
    try {
      const existing = await prisma.shiftTemplate.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Sjabloon niet gevonden." });

      if (deleteGeneratedShifts === "true") {
        const generated = await prisma.shift.findMany({ where: { templateId: id } });
        const generatedIds = generated.map((s) => s.id);
        if (generatedIds.length > 0) {
          await prisma.shiftChangeRequest.deleteMany({ where: { assignment: { shiftId: { in: generatedIds } } } });
          await prisma.shiftAssignment.deleteMany({ where: { shiftId: { in: generatedIds } } });
          await prisma.swapRequest.deleteMany({
            where: { OR: [{ shiftId: { in: generatedIds } }, { targetShiftId: { in: generatedIds } }] },
          });
          await prisma.shift.deleteMany({ where: { id: { in: generatedIds } } });
        }
      } else {
        // Keep already-generated shifts as standalone shifts; just detach them from the template.
        await prisma.shift.updateMany({ where: { templateId: id }, data: { templateId: null } });
      }

      await prisma.shiftTemplate.delete({ where: { id } });
      await logAction(req.user.id, "SHIFT_TEMPLATE_DELETE", `Deleted shift template: ${existing.name} (removed generated shifts: ${deleteGeneratedShifts === "true"})`);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

shiftTemplatesRouter.post("/api/shift-templates/:id/generate", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const { rangeStart, rangeEnd, assignEmployee } = req.body;
    if (!rangeStart || !rangeEnd) {
      return res.status(400).json({ error: "Geef een start- en einddatum op voor de generatie." });
    }

    try {
      const template = await prisma.shiftTemplate.findUnique({ where: { id } });
      if (!template) return res.status(404).json({ error: "Sjabloon niet gevonden." });
      if (!template.isActive) return res.status(400).json({ error: "Dit sjabloon is niet actief." });

      const genStart = new Date(rangeStart);
      const genEnd = new Date(rangeEnd);
      const dayCount = Math.round((genEnd.getTime() - genStart.getTime()) / (1000 * 60 * 60 * 24));
      if (dayCount < 0) {
        return res.status(400).json({ error: "Einddatum moet na de startdatum liggen." });
      }
      if (dayCount > MAX_TEMPLATE_GENERATE_DAYS) {
        return res.status(400).json({ error: `Periode mag maximaal ${MAX_TEMPLATE_GENERATE_DAYS} dagen zijn.` });
      }

      const templateStart = new Date(template.startDate);
      const templateEnd = template.endDate ? new Date(template.endDate) : null;
      const effectiveStart = genStart > templateStart ? genStart : templateStart;
      const effectiveEnd = templateEnd && templateEnd < genEnd ? templateEnd : genEnd;

      const activeDays = parseDaysOfWeek(template.daysOfWeek);
      const shouldUseAlternateWeek = template.recurrencePattern === "BIWEEKLY";

      // Existing shifts from this template in the window, to avoid re-creating duplicates on re-run.
      const existingGenerated = await prisma.shift.findMany({
        where: {
          templateId: id,
          date: { gte: rangeStart, lte: rangeEnd },
        },
        select: { date: true },
      });
      const existingDates = new Set(existingGenerated.map((s) => s.date));

      let totalCreated = 0;
      let skippedExisting = 0;
      let skippedConflicts = 0;
      const conflicts: { date: string }[] = [];

      const cursor = new Date(effectiveStart);
      let weekIndex = 0;
      let lastWeekStart: Date | null = null;

      while (cursor <= effectiveEnd) {
        const dow = cursor.getDay();

        // Track ISO-ish week boundaries (Monday start) to know odd/even week for BIWEEKLY.
        const weekStart = new Date(cursor);
        const mondayOffset = (weekStart.getDay() + 6) % 7;
        weekStart.setDate(weekStart.getDate() - mondayOffset);
        if (!lastWeekStart || weekStart.getTime() !== lastWeekStart.getTime()) {
          if (lastWeekStart) weekIndex++;
          lastWeekStart = weekStart;
        }

        const isEligibleWeek = !shouldUseAlternateWeek || weekIndex % 2 === 0;

        if (activeDays.includes(dow) && isEligibleWeek) {
          const dateStr = cursor.toISOString().split("T")[0];

          if (existingDates.has(dateStr)) {
            skippedExisting++;
          } else {
            let hasConflict = false;
            if (assignEmployee && template.defaultEmployeeId) {
              const conflict = await findBookingConflict(template.defaultEmployeeId, {
                date: dateStr,
                startTime: template.startTime,
                endTime: template.endTime,
              });
              if (conflict) hasConflict = true;
            }

            if (hasConflict) {
              skippedConflicts++;
              conflicts.push({ date: dateStr });
            } else {
              const newShift = await prisma.shift.create({
                data: {
                  name: template.name,
                  startTime: template.startTime,
                  endTime: template.endTime,
                  date: dateStr,
                  color: template.color,
                  requiredEmployees: template.requiredEmployees,
                  notes: template.notes,
                  templateId: template.id,
                  isRecurring: true,
                  recurrencePattern: template.recurrencePattern,
                },
              });
              totalCreated++;

              if (assignEmployee && template.defaultEmployeeId) {
                await prisma.shiftAssignment.create({
                  data: {
                    shiftId: newShift.id,
                    employeeId: template.defaultEmployeeId,
                    status: "ASSIGNED",
                  },
                });
              }
            }
          }
        }

        cursor.setDate(cursor.getDate() + 1);
      }

      await logAction(
        req.user.id,
        "SHIFT_TEMPLATE_GENERATE",
        `Generated ${totalCreated} shift(en) from template "${template.name}" for ${rangeStart} to ${rangeEnd} (skipped existing: ${skippedExisting}, skipped conflicts: ${skippedConflicts})`
      );
      return res.json({ success: true, count: totalCreated, skippedExisting, skippedConflicts, conflicts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));
