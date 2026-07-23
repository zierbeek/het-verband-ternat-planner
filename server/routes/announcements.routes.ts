import express from "express";
import { asyncHandler } from "../middleware/error.middleware.js";
import { prisma } from "../db.js";
import { logAction } from "../services/audit.service.js";
import { getPublicBaseUrl, sendEmailNotification } from "../services/email.service.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";

export const announcementsRouter = express.Router();

announcementsRouter.get("/api/announcements", authenticate, asyncHandler(async (req, res) => {
      const list = await prisma.announcement.findMany({
        where: { isArchived: false },
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      return res.json(list);
    }));

announcementsRouter.post("/api/announcements", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: "Missing title or content" });

    try {
      const announcement = await prisma.announcement.create({
        data: {
          title,
          content,
          authorId: req.user.id,
        },
      });

      // Create local notifications for everyone
      const users = await prisma.user.findMany({});
      for (const u of users) {
        await prisma.notification.create({
          data: {
            userId: u.id,
            title: "Nieuwe aankondiging",
            message: `Beheerder plaatste: ${title}`,
            link: `/?announcementId=${announcement.id}`,
          },
        });
      }

      // Send an email to everyone with a known email address
      for (const u of users) {
        if (!u.email) continue;
        try {
          await sendEmailNotification(
            u.email,
            `Nieuwe aankondiging: ${title}`,
            `<h3>Beste ${u.name},</h3>
             <p>Er is een nieuwe aankondiging geplaatst door ${req.user.name}:</p>
             <div style="margin:16px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
               <p style="margin:0 0 6px 0;font-weight:bold;color:#0f172a;">${title}</p>
               <p style="margin:0;white-space:pre-wrap;">${content}</p>
             </div>
             <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
            { platformUrl: getPublicBaseUrl(req), ctaLabel: "Bekijk de aankondiging" }
          );
        } catch (mailErr) {
          console.error(`Failed to send announcement mail to ${u.email}:`, mailErr);
        }
      }

      await logAction(req.user.id, "ANNOUNCEMENT_CREATE", `Created announcement: ${title}`);
      return res.status(201).json(announcement);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

announcementsRouter.put("/api/announcements/:id/archive", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    try {
      const updated = await prisma.announcement.update({
        where: { id },
        data: { isArchived: true },
      });
      await logAction(req.user.id, "ANNOUNCEMENT_ARCHIVE", `Archived announcement ${updated.title}`);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

announcementsRouter.delete("/api/announcements/:id", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    try {
      await prisma.announcement.delete({ where: { id } });
      await logAction(req.user.id, "ANNOUNCEMENT_DELETE", `Deleted announcement ${id}`);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));
