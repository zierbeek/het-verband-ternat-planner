import express from "express";
import { asyncHandler } from "../middleware/error.middleware.js";
import { prisma } from "../db.js";
import { hashPassword } from "../auth.js";
import { logAction } from "../services/audit.service.js";
import { sendEmailNotification } from "../services/email.service.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";

export const adminRouter = express.Router();

adminRouter.get("/api/admin/employees", authenticate, requireAdmin, asyncHandler(async (req, res) => {
      const list = await prisma.user.findMany({
        include: { employee: true },
        orderBy: { name: "asc" },
      });
      return res.json(list);
    }));

adminRouter.post("/api/admin/employees", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "E-mail, naam en wachtwoord zijn verplicht." });
    }

    try {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: "Er bestaat al een account met dit e-mailadres." });
      }

      const passwordHash = hashPassword(password);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: role || "EMPLOYEE",
        },
      });

      // Every user gets an Employee profile, regardless of role, so that
      // administrators can also be assigned to shifts (not just employees).
      const employee = await prisma.employee.create({
        data: {
          userId: user.id,
          preferredShifts: "[]",
          preferredColleagues: "[]",
        },
      });

      await logAction(req.user.id, "ADMIN_CREATE_USER", `Beheerder heeft gebruiker ${user.email} aangemaakt met de rol ${user.role}`);
      return res.status(201).json({ user: { id: user.id, email: user.email, role: user.role, name: user.name, employee } });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

adminRouter.delete("/api/admin/employees/:id", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ error: "U kunt uw eigen account niet verwijderen." });
    }

    try {
      const targetUser = await prisma.user.findUnique({
        where: { id },
        include: { employee: true },
      });

      if (!targetUser) {
        return res.status(404).json({ error: "Gebruiker niet gevonden." });
      }

      // If they are an employee, delete related records first to prevent SQLite FK constraint errors
      if (targetUser.employee) {
        const empId = targetUser.employee.id;
        await prisma.shiftAssignment.deleteMany({ where: { employeeId: empId } });
        await prisma.availability.deleteMany({ where: { employeeId: empId } });
        await prisma.leaveRequest.deleteMany({ where: { employeeId: empId } });
        await prisma.shiftChangeRequest.deleteMany({ where: { employeeId: empId } });
        await prisma.swapRequest.deleteMany({
          where: {
            OR: [
              { requesterId: empId },
              { targetId: empId }
            ]
          }
        });
        await prisma.employee.delete({ where: { id: empId } });
      }

      await prisma.notification.deleteMany({ where: { userId: id } });
      await prisma.announcement.deleteMany({ where: { authorId: id } });
      await prisma.user.delete({ where: { id } });

      await logAction(req.user.id, "ADMIN_DELETE_USER", `Beheerder heeft account ${targetUser.email} verwijderd`);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

adminRouter.put("/api/admin/employees/:id", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const { name, email, role, password } = req.body;

    try {
      const userToUpdate = await prisma.user.findUnique({
        where: { id },
        include: { employee: true },
      });

      if (!userToUpdate) {
        return res.status(404).json({ error: "Gebruiker niet gevonden." });
      }

      // Check email collision
      if (email && email !== userToUpdate.email) {
        const collision = await prisma.user.findUnique({ where: { email } });
        if (collision) {
          return res.status(400).json({ error: "Er bestaat al een account met dit e-mailadres." });
        }
      }

      const updateData: any = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (role) updateData.role = role;
      if (password) {
        updateData.passwordHash = hashPassword(password);
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
      });

      // Every user needs an Employee profile, regardless of role, so that
      // administrators can also be assigned to shifts. Back-fill it here for
      // any pre-existing account (e.g. an administrator created before this
      // change) that doesn't have one yet.
      if (!userToUpdate.employee) {
        await prisma.employee.create({
          data: {
            userId: updatedUser.id,
            preferredShifts: "[]",
            preferredColleagues: "[]",
          },
        });
      }

      await logAction(req.user.id, "ADMIN_UPDATE_USER", `Beheerder heeft account van ${updatedUser.email} bijgewerkt`);
      return res.json({ success: true, user: { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name, role: updatedUser.role } });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

adminRouter.get("/api/admin/settings", authenticate, requireAdmin, asyncHandler(async (req, res) => {
      const list = await prisma.setting.findMany({});
      return res.json(list);
    }));

adminRouter.put("/api/admin/settings", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const settingsObj = req.body;
    try {
      for (const [key, value] of Object.entries(settingsObj)) {
        await prisma.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value), description: `${key} instelling` },
        });
      }
      await logAction(req.user.id, "ADMIN_UPDATE_SETTINGS", "Beheerder heeft e-mail- of systeeminstellingen bijgewerkt");
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

adminRouter.get("/api/admin/users", authenticate, requireAdmin, asyncHandler(async (req, res) => {
      const users = await prisma.user.findMany({
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });
      return res.json(users);
    }));

adminRouter.post("/api/admin/test-email", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ error: "Ontvanger e-mailadres is verplicht." });
    }

    try {
      await sendEmailNotification(
        to,
        "Test E-mail - Het Verband Ternat Planner",
        `<h3>Test succesvol!</h3>
         <p>Beste beheerder,</p>
         <p>Dit is een test e-mail om te bevestigen dat uw e-mailnotificatie-instellingen van Het Verband Ternat correct zijn geconfigureerd.</p>
         <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`
      );
      return res.json({ success: true, message: "Test e-mail verzonden!" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

adminRouter.post("/api/admin/reset-db", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
      // Clean up all tables in reverse dependency order
      await prisma.shiftChangeRequest.deleteMany({});
      await prisma.swapRequest.deleteMany({});
      await prisma.shiftAssignment.deleteMany({});
      await prisma.availability.deleteMany({});
      await prisma.leaveRequest.deleteMany({});
      await prisma.shift.deleteMany({});
      await prisma.announcement.deleteMany({});
      await prisma.setting.deleteMany({});
      await prisma.notification.deleteMany({});
      await prisma.auditLog.deleteMany({});
      await prisma.employee.deleteMany({});
      await prisma.user.deleteMany({});

      const { seedDatabase } = await import("./server/seed.js");
      await seedDatabase();

      await logAction(null, "DB_RESET", "Database is succesvol gereset naar de standaard Nederlandse seeddata");
      return res.json({ success: true, message: "Database is succesvol gereset!" });
    }));
