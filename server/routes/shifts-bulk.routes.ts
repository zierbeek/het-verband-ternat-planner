import express from "express";
import { asyncHandler } from "../middleware/error.middleware.js";
import { prisma } from "../db.js";
import { logAction } from "../services/audit.service.js";
import { getPublicBaseUrl, sendEmailNotification } from "../services/email.service.js";
import { findBookingConflict } from "../services/shift.service.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";

export const shiftsBulkRouter = express.Router();

const MAX_BULK_SHIFTS = 500;

const loadBulkShifts = async (shiftIds: string[]) => {
  return prisma.shift.findMany({
    where: { id: { in: shiftIds } },
    include: { assignments: true },
  });
};

shiftsBulkRouter.post("/api/shifts/bulk-delete", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { shiftIds } = req.body;
    if (!Array.isArray(shiftIds) || shiftIds.length === 0) {
      return res.status(400).json({ error: "Geen shifts geselecteerd." });
    }
    if (shiftIds.length > MAX_BULK_SHIFTS) {
      return res.status(400).json({ error: `Maximaal ${MAX_BULK_SHIFTS} shifts tegelijk.` });
    }

    try {
      const shifts = await loadBulkShifts(shiftIds);
      if (shifts.length === 0) {
        return res.status(404).json({ error: "Geen van de geselecteerde shifts bestaat nog." });
      }

      const foundIds = shifts.map((s) => s.id);

      await prisma.shiftChangeRequest.deleteMany({ where: { assignment: { shiftId: { in: foundIds } } } });
      await prisma.shiftAssignment.deleteMany({ where: { shiftId: { in: foundIds } } });
      await prisma.swapRequest.deleteMany({
        where: { OR: [{ shiftId: { in: foundIds } }, { targetShiftId: { in: foundIds } }] },
      });
      await prisma.shift.deleteMany({ where: { id: { in: foundIds } } });

      await logAction(req.user.id, "SHIFT_BULK_DELETE", `Bulk verwijderd: ${shifts.length} shift(en)`, shifts, null);
      return res.json({ success: true, count: shifts.length, notFound: shiftIds.length - shifts.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

shiftsBulkRouter.post("/api/shifts/bulk-assign", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { shiftIds, employeeId } = req.body;
    if (!Array.isArray(shiftIds) || shiftIds.length === 0) {
      return res.status(400).json({ error: "Geen shifts geselecteerd." });
    }
    if (shiftIds.length > MAX_BULK_SHIFTS) {
      return res.status(400).json({ error: `Maximaal ${MAX_BULK_SHIFTS} shifts tegelijk.` });
    }

    try {
      const shifts = await loadBulkShifts(shiftIds);
      if (shifts.length === 0) {
        return res.status(404).json({ error: "Geen van de geselecteerde shifts bestaat nog." });
      }

      let assignedEmployee: any = null;
      if (employeeId) {
        assignedEmployee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { user: true } });
        if (!assignedEmployee) {
          return res.status(404).json({ error: "Medewerker niet gevonden." });
        }
      }

      let updated = 0;
      let skippedConflicts = 0;
      const conflicts: { shiftId: string; name: string; date: string }[] = [];

      for (const shift of shifts) {
        if (employeeId) {
          const conflict = await findBookingConflict(
            employeeId,
            { date: shift.date, startTime: shift.startTime, endTime: shift.endTime },
            [shift.id]
          );
          if (conflict) {
            skippedConflicts++;
            conflicts.push({ shiftId: shift.id, name: shift.name, date: shift.date });
            continue;
          }
        }

        await prisma.shiftAssignment.deleteMany({ where: { shiftId: shift.id } });
        if (employeeId) {
          await prisma.shiftAssignment.create({
            data: { shiftId: shift.id, employeeId, status: "ASSIGNED" },
          });
        }
        updated++;
      }

      if (assignedEmployee && assignedEmployee.user.email && updated > 0) {
        try {
          await sendEmailNotification(
            assignedEmployee.user.email,
            "Meerdere shifts toegewezen - Het Verband Ternat",
            `<h3>Beste ${assignedEmployee.user.name},</h3>
             <p>U bent toegewezen aan ${updated} shift(en) op de planning. Bekijk uw rooster voor de details.</p>
             <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
            { platformUrl: getPublicBaseUrl(req), ctaLabel: "Bekijk uw planning" }
          );
        } catch (mailErr) {
          console.error("Failed to send bulk assignment mail:", mailErr);
        }
      }

      await logAction(
        req.user.id,
        "SHIFT_BULK_ASSIGN",
        `Bulk toewijzing: ${updated} shift(en) ${employeeId ? `aan medewerker ${employeeId}` : "onbezet gemaakt"} (${skippedConflicts} overgeslagen door conflict)`
      );
      return res.json({ success: true, count: updated, skippedConflicts, conflicts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

shiftsBulkRouter.post("/api/shifts/bulk-shift-dates", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { shiftIds, dayOffset } = req.body;
    if (!Array.isArray(shiftIds) || shiftIds.length === 0) {
      return res.status(400).json({ error: "Geen shifts geselecteerd." });
    }
    if (shiftIds.length > MAX_BULK_SHIFTS) {
      return res.status(400).json({ error: `Maximaal ${MAX_BULK_SHIFTS} shifts tegelijk.` });
    }
    const offset = Number(dayOffset);
    if (!Number.isFinite(offset) || offset === 0) {
      return res.status(400).json({ error: "Ongeldig aantal dagen om te verschuiven." });
    }

    try {
      const shifts = await loadBulkShifts(shiftIds);
      if (shifts.length === 0) {
        return res.status(404).json({ error: "Geen van de geselecteerde shifts bestaat nog." });
      }

      let updated = 0;
      let skippedConflicts = 0;
      const conflicts: { shiftId: string; name: string; date: string }[] = [];

      for (const shift of shifts) {
        const [y, mo, d] = shift.date.split("-").map(Number);
        const newDate = new Date(y, (mo || 1) - 1, (d || 1) + offset);
        const newDateStr = newDate.toISOString().split("T")[0];

        const assignedIds = shift.assignments.map((a) => a.employeeId);
        let hasConflict = false;
        for (const empId of assignedIds) {
          const conflict = await findBookingConflict(
            empId,
            { date: newDateStr, startTime: shift.startTime, endTime: shift.endTime },
            [shift.id]
          );
          if (conflict) {
            hasConflict = true;
            break;
          }
        }

        if (hasConflict) {
          skippedConflicts++;
          conflicts.push({ shiftId: shift.id, name: shift.name, date: shift.date });
          continue;
        }

        await prisma.shift.update({ where: { id: shift.id }, data: { date: newDateStr } });
        updated++;
      }

      await logAction(
        req.user.id,
        "SHIFT_BULK_SHIFT_DATES",
        `Bulk verschuiving: ${updated} shift(en) met ${offset} dag(en) (${skippedConflicts} overgeslagen door conflict)`
      );
      return res.json({ success: true, count: updated, skippedConflicts, conflicts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

shiftsBulkRouter.post("/api/shifts/copy-week", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { sourceStartDate, targetStartDate, copyEmployees } = req.body;
    if (!sourceStartDate || !targetStartDate) {
      return res.status(400).json({ error: "Missing source or target date" });
    }

    try {
      const sourceDate = new Date(sourceStartDate);
      const targetDate = new Date(targetStartDate);

      // Get Saturday/Sunday bounding of the source week
      const sourceEnd = new Date(sourceDate);
      sourceEnd.setDate(sourceDate.getDate() + 6);

      const sourceEndStr = sourceEnd.toISOString().split("T")[0];

      const shifts = await prisma.shift.findMany({
        where: {
          date: {
            gte: sourceStartDate,
            lte: sourceEndStr,
          },
        },
        include: { assignments: true },
      });

      const dayDifference = Math.round((targetDate.getTime() - sourceDate.getTime()) / (1000 * 60 * 60 * 24));
      let totalCreated = 0;
      let skippedConflicts = 0;

      for (const s of shifts) {
        const currentShiftDate = new Date(s.date);
        currentShiftDate.setDate(currentShiftDate.getDate() + dayDifference);
        const newDateStr = currentShiftDate.toISOString().split("T")[0];

        const newShift = await prisma.shift.create({
          data: {
            name: s.name,
            startTime: s.startTime,
            endTime: s.endTime,
            date: newDateStr,
            color: s.color,
            requiredEmployees: s.requiredEmployees,
            notes: s.notes,
          },
        });

        totalCreated++;

        // Copy assignments optionally
        if (copyEmployees !== false) {
          for (const assign of s.assignments) {
            const conflict = await findBookingConflict(assign.employeeId, {
              date: newDateStr,
              startTime: s.startTime,
              endTime: s.endTime,
            });
            if (conflict) {
              skippedConflicts++;
              continue;
            }
            await prisma.shiftAssignment.create({
              data: {
                shiftId: newShift.id,
                employeeId: assign.employeeId,
                status: "ASSIGNED",
              },
            });
          }
        }
      }

      await logAction(req.user.id, "SHIFT_COPY_WEEK", `Copied week ${sourceStartDate} to ${targetStartDate} (with employees: ${copyEmployees !== false})`);
      return res.json({ success: true, count: totalCreated, skippedConflicts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

shiftsBulkRouter.post("/api/shifts/repeat-week", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { sourceStartDate, repeatWeeksCount, copyEmployees } = req.body;
    if (!sourceStartDate || !repeatWeeksCount) {
      return res.status(400).json({ error: "Ontbrekende bronweek of herhaal aantal." });
    }
    const weeks = Number(repeatWeeksCount);
    if (weeks < 1 || weeks > 24) {
      return res.status(400).json({ error: "Aantal weken moet tussen 1 en 24 liggen." });
    }

    try {
      const sourceDate = new Date(sourceStartDate);
      const sourceEnd = new Date(sourceDate);
      sourceEnd.setDate(sourceDate.getDate() + 6);
      const sourceEndStr = sourceEnd.toISOString().split("T")[0];

      const shifts = await prisma.shift.findMany({
        where: {
          date: {
            gte: sourceStartDate,
            lte: sourceEndStr,
          },
        },
        include: { assignments: true },
      });

      let totalCreated = 0;
      let skippedConflicts = 0;

      for (let i = 1; i <= weeks; i++) {
        const dayDifference = i * 7;
        for (const s of shifts) {
          const currentShiftDate = new Date(s.date);
          currentShiftDate.setDate(currentShiftDate.getDate() + dayDifference);
          const newDateStr = currentShiftDate.toISOString().split("T")[0];

          const newShift = await prisma.shift.create({
            data: {
              name: s.name,
              startTime: s.startTime,
              endTime: s.endTime,
              date: newDateStr,
              color: s.color,
              requiredEmployees: s.requiredEmployees,
              notes: s.notes,
            },
          });

          totalCreated++;

          if (copyEmployees) {
            for (const assign of s.assignments) {
              const conflict = await findBookingConflict(assign.employeeId, {
                date: newDateStr,
                startTime: s.startTime,
                endTime: s.endTime,
              });
              if (conflict) {
                skippedConflicts++;
                continue;
              }
              await prisma.shiftAssignment.create({
                data: {
                  shiftId: newShift.id,
                  employeeId: assign.employeeId,
                  status: "ASSIGNED",
                },
              });
            }
          }
        }
      }

      await logAction(req.user.id, "SHIFT_REPEAT_WEEK", `Repeated week ${sourceStartDate} for ${weeks} weeks into the future (Copy employees: ${copyEmployees})`);
      return res.json({ success: true, count: totalCreated, skippedConflicts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

shiftsBulkRouter.post("/api/shifts/copy-month", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { sourceYearMonth, targetYearMonth, copyEmployees } = req.body;
    if (!sourceYearMonth || !targetYearMonth) {
      return res.status(400).json({ error: "Ontbrekende bron- of doelmaand." });
    }

    try {
      const [srcYear, srcMonth] = sourceYearMonth.split("-").map(Number);
      const [tgtYear, tgtMonth] = targetYearMonth.split("-").map(Number);

      const srcStartStr = `${sourceYearMonth}-01`;
      const srcEnd = new Date(srcYear, srcMonth, 0);
      const srcEndStr = srcEnd.toISOString().split("T")[0];

      const shifts = await prisma.shift.findMany({
        where: {
          date: {
            gte: srcStartStr,
            lte: srcEndStr,
          },
        },
        include: { assignments: true },
      });

      let totalCreated = 0;
      let skippedConflicts = 0;

      const getOccurrencesInMonth = (year: number, monthIdx: number) => {
        const occurrences: { [key: string]: Date[] } = {
          "0": [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": []
        };
        const date = new Date(year, monthIdx, 1);
        while (date.getMonth() === monthIdx) {
          const day = date.getDay();
          occurrences[day].push(new Date(date));
          date.setDate(date.getDate() + 1);
        }
        return occurrences;
      };

      const srcOccurrences = getOccurrencesInMonth(srcYear, srcMonth - 1);
      const tgtOccurrences = getOccurrencesInMonth(tgtYear, tgtMonth - 1);

      for (const s of shifts) {
        const sDate = new Date(s.date);
        const dayOfWeek = sDate.getDay();
        const occIndex = srcOccurrences[dayOfWeek].findIndex(d => d.toISOString().split("T")[0] === s.date);
        if (occIndex === -1) continue;

        const targetDatesList = tgtOccurrences[dayOfWeek];
        if (!targetDatesList || targetDatesList.length === 0) continue;
        const targetDateObj = targetDatesList[occIndex] || targetDatesList[targetDatesList.length - 1];
        const newDateStr = targetDateObj.toISOString().split("T")[0];

        const newShift = await prisma.shift.create({
          data: {
            name: s.name,
            startTime: s.startTime,
            endTime: s.endTime,
            date: newDateStr,
            color: s.color,
            requiredEmployees: s.requiredEmployees,
            notes: s.notes,
          },
        });

        totalCreated++;

        if (copyEmployees) {
          for (const assign of s.assignments) {
            const conflict = await findBookingConflict(assign.employeeId, {
              date: newDateStr,
              startTime: s.startTime,
              endTime: s.endTime,
            });
            if (conflict) {
              skippedConflicts++;
              continue;
            }
            await prisma.shiftAssignment.create({
              data: {
                shiftId: newShift.id,
                employeeId: assign.employeeId,
                status: "ASSIGNED",
              },
            });
          }
        }
      }

      await logAction(req.user.id, "SHIFT_COPY_MONTH", `Copied month ${sourceYearMonth} to ${targetYearMonth} (with employees: ${copyEmployees})`);
      return res.json({ success: true, count: totalCreated, skippedConflicts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

shiftsBulkRouter.post("/api/shifts/send-month-schedule", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { yearMonth, excludedUserIds = [] } = req.body;
    if (!yearMonth) {
      return res.status(400).json({ error: "Ontbrekende maand selectie." });
    }

    try {
      const excludedIds = new Set(Array.isArray(excludedUserIds) ? excludedUserIds.map((id) => String(id)) : []);

      const users = await prisma.user.findMany({
        include: {
          employee: {
            include: {
              assignments: {
                include: {
                  shift: true,
                },
                where: {
                  shift: {
                    date: {
                      startsWith: yearMonth,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      });

      const allMonthShifts = await prisma.shift.findMany({
        where: {
          date: {
            startsWith: yearMonth,
          },
        },
        include: {
          assignments: {
            include: {
              employee: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      });

      let emailsSentCount = 0;

      for (const user of users) {
        if (!user.email || excludedIds.has(user.id)) continue;

        const myAssignments = user.employee?.assignments
          ? user.employee.assignments
              .map((a) => a.shift)
              .sort((a, b) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                return a.startTime.localeCompare(b.startTime);
              })
          : [];

        if (user.role === "ADMINISTRATOR" || !user.employee) {
          const overviewRows = allMonthShifts
            .map((shift) => {
              const assignedNames = shift.assignments.length
                ? shift.assignments
                    .map((assignment) => assignment.employee.user?.name)
                    .filter(Boolean)
                    .join(", ")
                : "Onbezet";

              return `
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:10px;border:1px solid #e2e8f0;font-weight:bold;">${shift.date}</td>
                  <td style="padding:10px;border:1px solid #e2e8f0;">${shift.name}</td>
                  <td style="padding:10px;border:1px solid #e2e8f0;font-family:monospace;">${shift.startTime} - ${shift.endTime}</td>
                  <td style="padding:10px;border:1px solid #e2e8f0;">${assignedNames}</td>
                </tr>
              `;
            })
            .join("");

          const emailBody = `
            <div style="font-family:sans-serif; max-width:600px; margin:0 auto; color:#334155;">
              <h2 style="color:#2563eb; border-bottom:2px solid #e2e8f0; padding-bottom:10px;">Maandplanning - ${yearMonth}</h2>
              <p>Beste <strong>${user.name}</strong>,</p>
              <p>De maandplanning voor <strong>${yearMonth}</strong> is gepubliceerd.</p>
              <p>U bent beheerder of hebt geen persoonlijk roosterprofiel, daarom ontvangt u het overzicht van alle geplande shiften.</p>
              <table style="width:100%; border-collapse:collapse; font-family:sans-serif; font-size:14px; margin-top:15px;">
                <thead>
                  <tr style="background-color:#f1f5f9; text-align:left; border-bottom:2px solid #cbd5e1;">
                    <th style="padding:10px; border:1px solid #e2e8f0;">Datum</th>
                    <th style="padding:10px; border:1px solid #e2e8f0;">Dienstnaam</th>
                    <th style="padding:10px; border:1px solid #e2e8f0;">Tijd</th>
                    <th style="padding:10px; border:1px solid #e2e8f0;">Toegewezen aan</th>
                  </tr>
                </thead>
                <tbody>
                  ${overviewRows || `<tr><td colspan="4" style="padding:10px; border:1px solid #e2e8f0;">Geen shiften ingepland voor deze maand.</td></tr>`}
                </tbody>
              </table>
              <p style="margin-top:25px; font-size:12px; color:#64748b; line-height:1.5; border-top:1px solid #e2e8f0; padding-top:15px;">
                U kunt het platform direct openen via de link onderaan deze e-mail.
              </p>
              <p style="font-weight:bold; margin-top:20px;">Met vriendelijke groet,<br/>Het Verband Ternat Planner</p>
            </div>
          `;

          await sendEmailNotification(user.email, `Maandplanning ${yearMonth}`, emailBody, {
            platformUrl: getPublicBaseUrl(req),
            ctaLabel: "Open de maandplanning",
          });
          emailsSentCount++;
          continue;
        }

        if (myAssignments.length === 0) {
          // Send an email stating there are no scheduled shifts for this month
          const emailBody = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155;">
              <h2 style="color: #2563eb; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Dienstregeling - ${yearMonth}</h2>
              <p>Beste <strong>${user.name}</strong>,</p>
              <p>De planning voor de maand <strong>${yearMonth}</strong> is zojuist gepubliceerd door de beheerder.</p>
              <p>U bent voor deze maand niet ingepland op actieve shifts.</p>
              <br/>
              <p style="font-weight: bold; margin-top: 20px;">Met vriendelijke groet,<br/>Het Verband Ternat Planner</p>
            </div>
          `;
          await sendEmailNotification(user.email, `Uw planning voor ${yearMonth}`, emailBody, {
            platformUrl: getPublicBaseUrl(req),
            ctaLabel: "Open uw planning",
          });
          emailsSentCount++;
          continue;
        }

        // Build list of shifts
        let shiftsHtml = `
          <table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 14px; margin-top: 15px;">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: left; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 10px; border: 1px solid #e2e8f0;">Datum</th>
                <th style="padding: 10px; border: 1px solid #e2e8f0;">Dienstnaam</th>
                <th style="padding: 10px; border: 1px solid #e2e8f0;">Starttijd</th>
                <th style="padding: 10px; border: 1px solid #e2e8f0;">Eindtijd</th>
                <th style="padding: 10px; border: 1px solid #e2e8f0;">Notities</th>
              </tr>
            </thead>
            <tbody>
        `;

        for (const shift of myAssignments) {
          const dateParts = shift.date.split("-");
          const formattedDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : shift.date;

          shiftsHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">${formattedDate}</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0;"><span style="background-color: ${shift.color}20; color: ${shift.color}; padding: 3px 8px; border-radius: 4px; font-weight: bold;">${shift.name}</span></td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace;">${shift.startTime}</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace;">${shift.endTime}</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; color: #64748b; font-style: italic;">${shift.notes || "-"}</td>
            </tr>
          `;
        }

        shiftsHtml += `
            </tbody>
          </table>
        `;

        const emailBody = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155;">
            <h2 style="color: #2563eb; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Persoonlijke Dienstregeling - ${yearMonth}</h2>
            <p>Beste <strong>${user.name}</strong>,</p>
            <p>De planning voor de maand <strong>${yearMonth}</strong> is zojuist definitief vastgesteld en gepubliceerd door de beheerder.</p>
            <p>Hieronder vindt u uw persoonlijke dienstrooster voor deze maand:</p>
            
            ${shiftsHtml}
            
            <p style="margin-top: 25px; font-size: 12px; color: #64748b; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 15px;">
              U kunt tevens inloggen op het online beheerplatform om diensten te ruilen, verlofaanvragen in te dienen of uw wekelijkse beschikbaarheid aan te passen.
            </p>
            <p style="font-weight: bold; margin-top: 20px;">Met vriendelijke groet,<br/>Het Verband Ternat Planner</p>
          </div>
        `;

        await sendEmailNotification(user.email, `Uw persoonlijke dienstrooster voor ${yearMonth}`, emailBody, {
          platformUrl: getPublicBaseUrl(req),
          ctaLabel: "Open uw rooster",
        });
        emailsSentCount++;
      }

      await logAction(req.user.id, "SHIFT_SEND_MONTHLY_EMAIL", `Sent monthly schedule emails for ${yearMonth} to ${emailsSentCount} recipients`);
      return res.json({ success: true, count: emailsSentCount });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));
