import express from "express";
import { asyncHandler } from "../middleware/error.middleware.js";
import { prisma } from "../db.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";

export const reportsRouter = express.Router();

reportsRouter.get("/api/reports/summary", authenticate, requireAdmin, asyncHandler(async (req, res) => {
      // Basic reports: shift counts, leave counters, employee metrics
      const employeeCount = await prisma.employee.count();
      const pendingLeaveCount = await prisma.leaveRequest.count({ where: { status: "PENDING" } });
      const pendingSwapCount = await prisma.swapRequest.count({ where: { status: "ACCEPTED_TARGET" } });
      const totalShifts = await prisma.shift.count();

      const employees = await prisma.employee.findMany({
        include: {
          user: true,
          assignments: {
            include: { shift: true },
          },
        },
      });

      // Calculate total allocated hours per employee
      const employeeStats = employees.map((emp) => {
        let totalHours = 0;
        emp.assignments.forEach((a) => {
          try {
            const startHour = Number(a.shift.startTime.split(":")[0]);
            const startMin = Number(a.shift.startTime.split(":")[1]);
            const endHour = Number(a.shift.endTime.split(":")[0]);
            const endMin = Number(a.shift.endTime.split(":")[1]);
            let hours = endHour - startHour + (endMin - startMin) / 60;
            if (hours < 0) hours += 24; // Handle night shifts spanning midnight
            totalHours += hours;
          } catch (e) {}
        });

        return {
          id: emp.id,
          name: emp.user.name,
          email: emp.user.email,
          assignedHours: totalHours,
          assignmentCount: emp.assignments.length,
        };
      });

      return res.json({
        employeeCount,
        pendingLeaveCount,
        pendingSwapCount,
        totalShifts,
        employeeStats,
      });
    }));
