import express from "express";
import { asyncHandler } from "../middleware/error.middleware.js";
import { prisma } from "../db.js";
import { logAction } from "../services/audit.service.js";
import { getPublicBaseUrl, sendEmailNotification } from "../services/email.service.js";
import { findBookingConflict, conflictMessage } from "../services/shift.service.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";

export const shiftsRouter = express.Router();

shiftsRouter.get("/api/shifts", authenticate, asyncHandler(async (req, res) => {
    const { startDate, endDate, employeeId } = req.query;
    try {
      const whereClause: any = {};
      if (startDate && endDate) {
        whereClause.date = {
          gte: startDate as string,
          lte: endDate as string,
        };
      }
      if (employeeId) {
        whereClause.assignments = {
          some: {
            employeeId: employeeId as string,
          },
        };
      }

      const shifts = await prisma.shift.findMany({
        where: whereClause,
        include: {
          assignments: {
            include: {
              employee: {
                include: { user: true },
              },
            },
          },
        },
        orderBy: { date: "asc" },
      });
      return res.json(shifts);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

shiftsRouter.post("/api/shifts", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { name, startTime, endTime, date, color, requiredEmployees, notes, employeeId } = req.body;
    if (!name || !startTime || !endTime || !date) {
      return res.status(400).json({ error: "Missing required shift fields" });
    }

    try {
      if (employeeId) {
        const conflict = await findBookingConflict(employeeId, { date, startTime, endTime });
        if (conflict) {
          return res.status(409).json({ error: conflictMessage(conflict) });
        }
      }

      const shift = await prisma.shift.create({
        data: {
          name,
          startTime,
          endTime,
          date,
          color: color || "#3b82f6",
          requiredEmployees: requiredEmployees !== undefined ? Number(requiredEmployees) : 1,
          notes,
        },
      });

      if (employeeId) {
        await prisma.shiftAssignment.create({
          data: {
            shiftId: shift.id,
            employeeId,
            status: "ASSIGNED",
          },
        });

        // Send email to assigned employee
        try {
          const assignedEmployee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: { user: true }
          });
          if (assignedEmployee && assignedEmployee.user.email) {
            await sendEmailNotification(
              assignedEmployee.user.email,
              "Nieuwe shift toegewezen - Het Verband Ternat",
              `<h3>Beste ${assignedEmployee.user.name},</h3>
               <p>Er is een nieuwe shift aan u toegewezen op de planning:</p>
               <ul>
                 <li><strong>Shift:</strong> ${name}</li>
                 <li><strong>Datum:</strong> ${date}</li>
                 <li><strong>Tijd:</strong> ${startTime} - ${endTime}</li>
                 ${notes ? `<li><strong>Opmerking:</strong> ${notes}</li>` : ""}
               </ul>
                <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
                { platformUrl: getPublicBaseUrl(req), ctaLabel: "Bekijk de shift" }
            );
          }
        } catch (mailErr) {
          console.error("Failed to send assignment mail:", mailErr);
        }
      }

      await logAction(req.user.id, "SHIFT_CREATE", `Created shift: ${name} on ${date}`, null, shift);
      return res.status(201).json(shift);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

shiftsRouter.put("/api/shifts/:id", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const { name, startTime, endTime, date, color, requiredEmployees, notes, employeeId } = req.body;

    try {
      const shift = await prisma.shift.findUnique({
        where: { id },
        include: { assignments: true },
      });
      if (!shift) {
        return res.status(404).json({ error: "Shift not found" });
      }

      const effectiveDate = date || shift.date;
      const effectiveStart = startTime || shift.startTime;
      const effectiveEnd = endTime || shift.endTime;

      // Which employee(s) must be checked against the double-booking restriction?
      // - `employeeId` explicitly present in the request body (e.g. the "Medewerker
      //   toewijzen" dialog) means the caller is deliberately (re)assigning someone,
      //   so check that employee. An explicit falsy value (null/"") means "unassign",
      //   which never conflicts.
      // - `employeeId` absent from the body happens when a shift is dragged to a new
      //   day/slot without touching its assignment (see handlePlannerDrop on the
      //   client). The shift keeps its current employee(s), so the restriction must
      //   still be checked against them for the new date/time - otherwise moving an
      //   already-assigned shift onto a day where that employee is already booked
      //   silently bypasses the restriction.
      const employeeIdsToCheck: string[] =
        employeeId !== undefined
          ? employeeId
            ? [employeeId]
            : []
          : shift.assignments.map((a) => a.employeeId);

      for (const empId of employeeIdsToCheck) {
        const conflict = await findBookingConflict(
          empId,
          { date: effectiveDate, startTime: effectiveStart, endTime: effectiveEnd },
          [id]
        );
        if (conflict) {
          return res.status(409).json({ error: conflictMessage(conflict) });
        }
      }

      const updated = await prisma.shift.update({
        where: { id },
        data: {
          name: name || shift.name,
          startTime: startTime || shift.startTime,
          endTime: endTime || shift.endTime,
          date: date || shift.date,
          color: color || shift.color,
          requiredEmployees: requiredEmployees !== undefined ? Number(requiredEmployees) : shift.requiredEmployees,
          notes: notes !== undefined ? notes : shift.notes,
        },
      });

      if (employeeId !== undefined) {
        // Clear old assignments and add new one
        await prisma.shiftAssignment.deleteMany({ where: { shiftId: id } });
        if (employeeId) {
          await prisma.shiftAssignment.create({
            data: {
              shiftId: id,
              employeeId,
              status: "ASSIGNED",
            },
          });

          // Send email to assigned employee
          try {
            const assignedEmployee = await prisma.employee.findUnique({
              where: { id: employeeId },
              include: { user: true }
            });
            if (assignedEmployee && assignedEmployee.user.email) {
              await sendEmailNotification(
                assignedEmployee.user.email,
                "Gewijzigde of nieuwe shift toegewezen - Het Verband Ternat",
                `<h3>Beste ${assignedEmployee.user.name},</h3>
                 <p>Uw planning is bijgewerkt. U bent toegewezen aan de volgende shift:</p>
                 <ul>
                   <li><strong>Shift:</strong> ${updated.name}</li>
                   <li><strong>Datum:</strong> ${updated.date}</li>
                   <li><strong>Tijd:</strong> ${updated.startTime} - ${updated.endTime}</li>
                   ${updated.notes ? `<li><strong>Opmerking:</strong> ${updated.notes}</li>` : ""}
                 </ul>
                    <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
                    { platformUrl: getPublicBaseUrl(req), ctaLabel: "Open uw bijgewerkte planning" }
              );
            }
          } catch (mailErr) {
            console.error("Failed to send update assignment mail:", mailErr);
          }
        }
      }

      await logAction(req.user.id, "SHIFT_UPDATE", `Updated shift ${id}`, shift, updated);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

shiftsRouter.delete("/api/shifts/:id", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    try {
      const shift = await prisma.shift.findUnique({ where: { id } });
      if (!shift) {
        return res.status(404).json({ error: "Shift not found" });
      }

      // Manually delete related elements first to prevent SQLite Foreign Key errors
      await prisma.shiftChangeRequest.deleteMany({
        where: { assignment: { shiftId: id } }
      });
      await prisma.shiftAssignment.deleteMany({ where: { shiftId: id } });
      await prisma.swapRequest.deleteMany({
        where: {
          OR: [
            { shiftId: id },
            { targetShiftId: id }
          ]
        }
      });

      await prisma.shift.delete({ where: { id } });
      await logAction(req.user.id, "SHIFT_DELETE", `Deleted shift: ${shift.name} on ${shift.date}`, shift, null);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));
