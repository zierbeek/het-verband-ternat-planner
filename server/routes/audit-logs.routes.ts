import express from "express";
import { asyncHandler } from "../middleware/error.middleware.js";
import { prisma } from "../db.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";

export const auditLogsRouter = express.Router();

auditLogsRouter.get("/api/audit-logs", authenticate, requireAdmin, asyncHandler(async (req, res) => {
      const logs = await prisma.auditLog.findMany({
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return res.json(logs);
    }));
