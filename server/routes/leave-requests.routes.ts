import express from "express";
import { asyncHandler } from "../middleware/error.middleware.js";
import { prisma } from "../db.js";
import { logAction } from "../services/audit.service.js";
import { getPublicBaseUrl, sendEmailNotification } from "../services/email.service.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";

export const leaveRequestsRouter = express.Router();

leaveRequestsRouter.get("/api/leave-requests", authenticate, asyncHandler(async (req: any, res) => {
      const { all } = req.query;
      const whereClause: any = {};
      
      if (req.user.role === "EMPLOYEE" && all !== "true") {
        const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
        if (emp) {
          whereClause.employeeId = emp.id;
        }
      } else if (req.user.role === "EMPLOYEE" && all === "true") {
        // Employees requesting all leave requests can only see APPROVED leaves for privacy
        whereClause.status = "APPROVED";
      }

      const list = await prisma.leaveRequest.findMany({
        where: whereClause,
        include: {
          employee: {
            include: { user: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return res.json(list);
    }));

leaveRequestsRouter.post("/api/leave-requests", authenticate, asyncHandler(async (req: any, res) => {
    const { type, startDate, endDate, reason } = req.body;
    if (!type || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: "Missing leave details" });
    }

    try {
      const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
      if (!emp) {
        return res.status(400).json({ error: "Employee profile required to request leave" });
      }

      const request = await prisma.leaveRequest.create({
        data: {
          employeeId: emp.id,
          type,
          startDate,
          endDate,
          reason,
          status: "PENDING",
        },
      });

      // Notify Administrators
      const admins = await prisma.user.findMany({ where: { role: "ADMINISTRATOR" } });
      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            title: "Nieuwe verlofaanvraag",
            message: `${req.user.name} vroeg verlof aan (${type}) van ${startDate} tot ${endDate}`,
            link: "/admin/leave",
          },
        });

        // Send email notification to Admin
        try {
          await sendEmailNotification(
            admin.email,
            `Nieuwe verlofaanvraag van ${req.user.name}`,
            `<h3>Nieuwe verlofaanvraag ontvangen</h3>
             <p>Medewerker <strong>${req.user.name}</strong> heeft verlof aangevraagd:</p>
             <ul>
               <li><strong>Type:</strong> ${type}</li>
               <li><strong>Periode:</strong> ${startDate} tot ${endDate}</li>
               <li><strong>Reden:</strong> ${reason}</li>
             </ul>
             <p>U kunt deze aanvraag goedkeuren of weigeren in het beheercentrum.</p>
               <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
              { platformUrl: getPublicBaseUrl(req), ctaLabel: "Open beheercentrum" }
          );
        } catch (mailErr) {
          console.error("Failed to send leave admin mail:", mailErr);
        }
      }

      await logAction(req.user.id, "LEAVE_REQUEST", `Leave request created from ${startDate} to ${endDate}`);
      return res.status(201).json(request);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

leaveRequestsRouter.post("/api/leave-requests/:id/approve", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const { comment } = req.body;

    try {
      const leave = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { employee: true },
      });
      if (!leave) return res.status(404).json({ error: "Leave request not found" });


      // A beheerder cannot approve their own leave request
      if (leave.employee.userId === req.user.id) {
        return res.status(403).json({ error: "U kunt uw eigen verlofaanvraag niet goedkeuren. Vraag een andere beheerder om dit te doen." });
      }
      // Only one administrator needs to approve a leave request. If another
      // administrator already resolved it (approved, rejected or cancelled),
      // don't let a second approval silently overwrite that decision.
      if (leave.status !== "PENDING") {
        return res.status(409).json({
          error: `Deze verlofaanvraag is al ${leave.status === "APPROVED" ? "goedgekeurd" : leave.status === "REJECTED" ? "geweigerd" : "verwerkt"} door een andere beheerder.`,
        });
      }

      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          comment,
          approvalHistory: JSON.stringify([
            { action: "APPROVED", actor: req.user.name, date: new Date().toISOString(), comment },
          ]),
        },
      });

      // Notify the employee
      await prisma.notification.create({
        data: {
          userId: leave.employee.userId,
          title: "Verlofaanvraag goedgekeurd",
          message: `Uw verlofaanvraag van ${leave.startDate} tot ${leave.endDate} is goedgekeurd door ${req.user.name}.`,
          link: "/schedule",
        },
      });

      // Send email to Employee
      try {
        const empUser = await prisma.user.findUnique({ where: { id: leave.employee.userId } });
        if (empUser && empUser.email) {
          await sendEmailNotification(
            empUser.email,
            "Verlofaanvraag goedgekeurd - Het Verband Ternat",
            `<h3>Beste ${empUser.name},</h3>
             <p>Uw verlofaanvraag voor de periode <strong>${leave.startDate} tot ${leave.endDate}</strong> is <strong>GOEDGEKEURD</strong> door ${req.user.name}.</p>
             ${comment ? `<p><strong>Opmerking beheerder:</strong> ${comment}</p>` : ""}
             <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
            { platformUrl: getPublicBaseUrl(req), ctaLabel: "Bekijk uw planning" }
          );
        }
      } catch (mailErr) {
        console.error("Failed to send leave approve mail:", mailErr);
      }

      await logAction(req.user.id, "LEAVE_APPROVE", `Approved leave request ${id} for employee ${leave.employeeId}`);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

leaveRequestsRouter.post("/api/leave-requests/:id/reject", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const { comment } = req.body;

    try {
      const leave = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { employee: true },
      });
      if (!leave) return res.status(404).json({ error: "Leave request not found" });


      // A beheerder cannot reject their own leave request
      if (leave.employee.userId === req.user.id) {
        return res.status(403).json({ error: "U kunt uw eigen verlofaanvraag niet weigeren. Vraag een andere beheerder om dit te doen." });
      }
      // Only one administrator needs to decide on a leave request. If another
      // administrator already resolved it, don't silently overwrite that.
      if (leave.status !== "PENDING") {
        return res.status(409).json({
          error: `Deze verlofaanvraag is al ${leave.status === "APPROVED" ? "goedgekeurd" : leave.status === "REJECTED" ? "geweigerd" : "verwerkt"} door een andere beheerder.`,
        });
      }

      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          comment,
          approvalHistory: JSON.stringify([
            { action: "REJECTED", actor: req.user.name, date: new Date().toISOString(), comment },
          ]),
        },
      });

      // Notify Employee
      await prisma.notification.create({
        data: {
          userId: leave.employee.userId,
          title: "Verlofaanvraag geweigerd",
          message: `Uw verlofaanvraag van ${leave.startDate} tot ${leave.endDate} is geweigerd door ${req.user.name}.`,
          link: "/schedule",
        },
      });

      // Send email to Employee
      try {
        const empUser = await prisma.user.findUnique({ where: { id: leave.employee.userId } });
        if (empUser && empUser.email) {
          await sendEmailNotification(
            empUser.email,
            "Verlofaanvraag geweigerd - Het Verband Ternat",
            `<h3>Beste ${empUser.name},</h3>
             <p>Uw verlofaanvraag voor de periode <strong>${leave.startDate} tot ${leave.endDate}</strong> is helaas <strong>GEWEIGERD</strong> door ${req.user.name}.</p>
             ${comment ? `<p><strong>Opmerking beheerder:</strong> ${comment}</p>` : ""}
             <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
            { platformUrl: getPublicBaseUrl(req), ctaLabel: "Bekijk uw planning" }
          );
        }
      } catch (mailErr) {
        console.error("Failed to send leave reject mail:", mailErr);
      }

      await logAction(req.user.id, "LEAVE_REJECT", `Rejected leave request ${id}`);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

leaveRequestsRouter.post("/api/leave-requests/:id/cancel", authenticate, asyncHandler(async (req: any, res) => {
    const { id } = req.params;

    try {
      const leave = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { employee: true },
      });
      if (!leave) return res.status(404).json({ error: "Leave request not found" });

      const isOwner = leave.employee.userId === req.user.id;
      const isAdmin = req.user.role === "ADMINISTRATOR";
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "U kunt enkel uw eigen verlofaanvragen annuleren" });
      }

      if (leave.status === "CANCELLED") {
        return res.status(400).json({ error: "Deze verlofaanvraag is al geannuleerd" });
      }
      if (leave.status === "REJECTED") {
        return res.status(400).json({ error: "Een geweigerde verlofaanvraag kan niet geannuleerd worden" });
      }

      let existingHistory: any[] = [];
      try {
        existingHistory = JSON.parse(leave.approvalHistory || "[]");
      } catch {
        existingHistory = [];
      }

      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: "CANCELLED",
          approvalHistory: JSON.stringify([
            ...existingHistory,
            { action: "CANCELLED", actor: req.user.name, date: new Date().toISOString() },
          ]),
        },
      });

      // Notify the other party
      if (isOwner) {
        // Employee cancelled their own request -> notify administrators
        const admins = await prisma.user.findMany({ where: { role: "ADMINISTRATOR" } });
        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              title: "Verlofaanvraag geannuleerd",
              message: `${req.user.name} heeft de verlofaanvraag van ${leave.startDate} tot ${leave.endDate} geannuleerd.`,
              link: "/admin/leave",
            },
          });
        }
      } else {
        // Admin cancelled the employee's request -> notify the employee
        await prisma.notification.create({
          data: {
            userId: leave.employee.userId,
            title: "Verlofaanvraag geannuleerd",
            message: `Uw verlofaanvraag van ${leave.startDate} tot ${leave.endDate} is geannuleerd door ${req.user.name}.`,
            link: "/schedule",
          },
        });

        // Send email to Employee
        try {
          const empUser = await prisma.user.findUnique({ where: { id: leave.employee.userId } });
          if (empUser && empUser.email) {
            await sendEmailNotification(
              empUser.email,
              "Verlofaanvraag geannuleerd - Het Verband Ternat",
              `<h3>Beste ${empUser.name},</h3>
               <p>Uw verlofaanvraag voor de periode <strong>${leave.startDate} tot ${leave.endDate}</strong> is geannuleerd door ${req.user.name}.</p>
               <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
              { platformUrl: getPublicBaseUrl(req), ctaLabel: "Bekijk uw planning" }
            );
          }
        } catch (mailErr) {
          console.error("Failed to send leave cancel mail:", mailErr);
        }
      }

      await logAction(req.user.id, "LEAVE_CANCEL", `Cancelled leave request ${id}`);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));
