import express from "express";
import { asyncHandler } from "../middleware/error.middleware.js";
import { prisma } from "../db.js";
import { logAction } from "../services/audit.service.js";
import { authenticate } from "../middleware/auth.middleware.js";

export const employeesRouter = express.Router();

employeesRouter.get("/api/employees", authenticate, asyncHandler(async (req, res) => {
      const employees = await prisma.employee.findMany({
        include: { user: true },
      });
      return res.json(employees);
    }));

employeesRouter.put("/api/employees/:id", authenticate, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const { preferredShifts, preferredColleagues } = req.body;

    // Employees can update their own, Admins can update any
    try {
      const employee = await prisma.employee.findUnique({
        where: { id },
        include: { user: true },
      });
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      if (req.user.role !== "ADMINISTRATOR" && employee.userId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden: Cannot update other employees" });
      }

      const updated = await prisma.employee.update({
        where: { id },
        data: {
          preferredShifts: preferredShifts !== undefined ? JSON.stringify(preferredShifts) : employee.preferredShifts,
          preferredColleagues: preferredColleagues !== undefined ? JSON.stringify(preferredColleagues) : employee.preferredColleagues,
        },
      });

      await logAction(
        req.user.id,
        "EMPLOYEE_UPDATE",
        `Updated employee profile for ${employee.user.name}`,
        employee,
        updated
      );

      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));
