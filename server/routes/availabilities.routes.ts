import express from "express";
import { asyncHandler } from "../middleware/error.middleware.js";
import { prisma } from "../db.js";
import { logAction } from "../services/audit.service.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";

export const availabilitiesRouter = express.Router();

availabilitiesRouter.get("/api/availabilities", authenticate, requireAdmin, asyncHandler(async (req, res) => {
      const list = await prisma.availability.findMany();
      return res.json(list);
    }));

availabilitiesRouter.get("/api/availabilities/:employeeId", authenticate, asyncHandler(async (req, res) => {
    const { employeeId } = req.params;
    try {
      const list = await prisma.availability.findMany({
        where: { employeeId },
      });
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

availabilitiesRouter.post("/api/availabilities", authenticate, asyncHandler(async (req: any, res) => {
    const { employeeId, dayOfWeek, date, isAvailable, isSpecificDate, startTime, endTime } = req.body;
    if (!employeeId) return res.status(400).json({ error: "Missing employee ID" });

    try {
      const emp = await prisma.employee.findUnique({
        where: { id: employeeId },
      });
      if (!emp) return res.status(404).json({ error: "Employee profile not found" });

      if (req.user.role !== "ADMINISTRATOR" && emp.userId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden: Cannot update other's availability" });
      }

      let availability;
      if (isSpecificDate && date) {
        // Upsert by specific date
        const existing = await prisma.availability.findFirst({
          where: { employeeId, date, isSpecificDate: true },
        });

        if (existing) {
          availability = await prisma.availability.update({
            where: { id: existing.id },
            data: { isAvailable, startTime: startTime || "00:00", endTime: endTime || "23:59" },
          });
        } else {
          availability = await prisma.availability.create({
            data: { employeeId, date, isSpecificDate: true, isAvailable, startTime: startTime || "00:00", endTime: endTime || "23:59" },
          });
        }
      } else if (dayOfWeek !== undefined) {
        // Upsert by recurring day of week
        const existing = await prisma.availability.findFirst({
          where: { employeeId, dayOfWeek, isSpecificDate: false },
        });

        if (existing) {
          availability = await prisma.availability.update({
            where: { id: existing.id },
            data: { isAvailable, startTime: startTime || "00:00", endTime: endTime || "23:59" },
          });
        } else {
          availability = await prisma.availability.create({
            data: { employeeId, dayOfWeek: Number(dayOfWeek), isSpecificDate: false, isAvailable, startTime: startTime || "00:00", endTime: endTime || "23:59" },
          });
        }
      } else {
        return res.status(400).json({ error: "Provide either dayOfWeek or specific date" });
      }

      await logAction(req.user.id, "AVAILABILITY_UPDATE", `Updated availability settings for employee ${employeeId}`);
      return res.json(availability);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));
