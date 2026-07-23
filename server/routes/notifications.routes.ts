import express from "express";
import { asyncHandler } from "../middleware/error.middleware.js";
import { prisma } from "../db.js";
import { authenticate } from "../middleware/auth.middleware.js";

export const notificationsRouter = express.Router();

notificationsRouter.get("/api/notifications", authenticate, asyncHandler(async (req: any, res) => {
      const list = await prisma.notification.findMany({
        where: { userId: req.user.id, isArchived: false },
        orderBy: { createdAt: "desc" },
      });
      return res.json(list);
    }));

notificationsRouter.post("/api/notifications/:id/read", authenticate, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    try {
      await prisma.notification.updateMany({
        where: { id, userId: req.user.id },
        data: { isRead: true },
      });
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

notificationsRouter.put("/api/notifications/:id/archive", authenticate, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    try {
      const updated = await prisma.notification.updateMany({
        where: { id, userId: req.user.id },
        data: { isArchived: true },
      });
      return res.json({ success: true, count: updated.count });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

notificationsRouter.delete("/api/notifications/:id", authenticate, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    try {
      const deleted = await prisma.notification.deleteMany({
        where: { id, userId: req.user.id },
      });
      return res.json({ success: true, count: deleted.count });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));
