import express from "express";
import { asyncHandler } from "../middleware/error.middleware.js";
import { prisma } from "../db.js";
import { logAction } from "../services/audit.service.js";
import { getPublicBaseUrl, sendEmailNotification } from "../services/email.service.js";
import { findBookingConflict, conflictMessage } from "../services/shift.service.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";

export const changeRequestsRouter = express.Router();

changeRequestsRouter.get("/api/change-requests", authenticate, asyncHandler(async (req: any, res) => {
      const whereClause: any = {};
      if (req.user.role === "EMPLOYEE") {
        const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
        if (emp) {
          whereClause.employeeId = emp.id;
        }
      }

      const list = await prisma.shiftChangeRequest.findMany({
        where: whereClause,
        include: {
          assignment: {
            include: { shift: true },
          },
          employee: {
            include: { user: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return res.json(list);
    }));

changeRequestsRouter.post("/api/change-requests", authenticate, asyncHandler(async (req: any, res) => {
    const { assignmentId, type, requestedStartTime, requestedEndTime, reason, comment } = req.body;
    if (!assignmentId || !type || !reason) {
      return res.status(400).json({ error: "Missing required details" });
    }

    try {
      const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
      if (!emp) return res.status(400).json({ error: "Employee profile required" });

      const request = await prisma.shiftChangeRequest.create({
        data: {
          assignmentId,
          employeeId: emp.id,
          type,
          requestedStartTime,
          requestedEndTime,
          reason,
          comment,
          status: "PENDING",
        },
      });

      // Notify Administrators
      const admins = await prisma.user.findMany({ where: { role: "ADMINISTRATOR" } });
      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            title: "Nieuwe dienstwisselaanvraag",
            message: `${req.user.name} vroeg een dienstwissel aan (${type})`,
            link: "/admin/requests",
          },
        });

        // Send email to Admin
        try {
          await sendEmailNotification(
            admin.email,
            `Nieuwe dienstwissel aanvraag van ${req.user.name}`,
            `<h3>Nieuwe dienstwissel aanvraag ontvangen</h3>
             <p>Medewerker <strong>${req.user.name}</strong> heeft een dienstwijziging aangevraagd:</p>
             <ul>
               <li><strong>Type:</strong> ${type}</li>
               <li><strong>Reden:</strong> ${reason}</li>
               ${requestedStartTime ? `<li><strong>Gewenste Tijd:</strong> ${requestedStartTime} - ${requestedEndTime}</li>` : ""}
               ${comment ? `<li><strong>Toelichting:</strong> ${comment}</li>` : ""}
             </ul>
             <p>Beoordeel deze aanvraag in het beheercentrum.</p>
             <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`
          );
        } catch (mailErr) {
          console.error("Failed to send shift change admin mail:", mailErr);
        }
      }

      await logAction(req.user.id, "SHIFT_CHANGE_REQUEST_CREATE", `Submitted shift change request: ${type}`);
      return res.status(201).json(request);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

changeRequestsRouter.post("/api/change-requests/:id/resolve", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const { status, comment } = req.body; // status must be "APPROVED" or "REJECTED"

    if (status !== "APPROVED" && status !== "REJECTED") {
      return res.status(400).json({ error: "Status must be APPROVED or REJECTED" });
    }

    try {
      const reqDetails = await prisma.shiftChangeRequest.findUnique({
        where: { id },
        include: {
          assignment: {
            include: { shift: true },
          },
          employee: true,
        },
      });

      if (!reqDetails) return res.status(404).json({ error: "Request not found" });

      // If approving a time change, make sure the new time doesn't create a
      // double-booking against another shift this employee already has.
      if (status === "APPROVED" && reqDetails.type === "TIME_CHANGE" && reqDetails.requestedStartTime && reqDetails.requestedEndTime) {
        const conflict = await findBookingConflict(
          reqDetails.employeeId,
          {
            date: reqDetails.assignment.shift.date,
            startTime: reqDetails.requestedStartTime,
            endTime: reqDetails.requestedEndTime,
          },
          [reqDetails.assignment.shiftId]
        );
        if (conflict) {
          return res.status(409).json({ error: conflictMessage(conflict) });
        }
      }

      const updated = await prisma.shiftChangeRequest.update({
        where: { id },
        data: {
          status,
          comment,
          approvalHistory: JSON.stringify([
            { action: status, actor: req.user.name, date: new Date().toISOString(), comment },
          ]),
        },
      });

      // If approved and type is TIME_CHANGE, we can update the shift or keep as metadata
      if (status === "APPROVED" && reqDetails.type === "TIME_CHANGE" && reqDetails.requestedStartTime && reqDetails.requestedEndTime) {
        // Update shift time
        await prisma.shift.update({
          where: { id: reqDetails.assignment.shiftId },
          data: {
            startTime: reqDetails.requestedStartTime,
            endTime: reqDetails.requestedEndTime,
          },
        });
      } else if (status === "APPROVED" && reqDetails.type === "ABSENCE") {
        // Remove assignment
        await prisma.shiftAssignment.delete({ where: { id: reqDetails.assignmentId } });
      }

      // Notify employee
      await prisma.notification.create({
        data: {
          userId: reqDetails.employee.userId,
          title: `Dienstwissel ${status === "APPROVED" ? "goedgekeurd" : "geweigerd"}`,
          message: `Uw dienstwisselaanvraag is ${status === "APPROVED" ? "goedgekeurd" : "geweigerd"} door ${req.user.name}.`,
          link: "/schedule",
        },
      });

      // Send email to Employee
      try {
        const empUser = await prisma.user.findUnique({ where: { id: reqDetails.employee.userId } });
        if (empUser && empUser.email) {
          const vertaaldStatus = status === "APPROVED" ? "GOEDGEKEURD" : "GEWEIGERD";
          await sendEmailNotification(
            empUser.email,
            `Dienstwissel aanvraag ${vertaaldStatus.toLowerCase()} - Het Verband Ternat`,
            `<h3>Beste ${empUser.name},</h3>
             <p>Uw aanvraag voor een dienstwijziging is <strong>${vertaaldStatus}</strong> door beheerder ${req.user.name}.</p>
             ${comment ? `<p><strong>Opmerking beheerder:</strong> ${comment}</p>` : ""}
             <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
            { platformUrl: getPublicBaseUrl(req), ctaLabel: "Bekijk uw planning" }
          );
        }
      } catch (mailErr) {
        console.error("Failed to send shift change resolve mail:", mailErr);
      }

      await logAction(req.user.id, "SHIFT_CHANGE_REQUEST_RESOLVE", `Resolved shift change request ${id} as ${status}`);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));
