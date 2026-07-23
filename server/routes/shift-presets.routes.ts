import express from "express";
import { asyncHandler } from "../middleware/error.middleware.js";
import { prisma } from "../db.js";
import { logAction } from "../services/audit.service.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";

export const shiftPresetsRouter = express.Router();

shiftPresetsRouter.get("/api/shift-presets", authenticate, asyncHandler(async (req, res) => {
      const presets = await prisma.shiftPreset.findMany({
        orderBy: { order: "asc" },
      });
      return res.json(presets);
    }));

shiftPresetsRouter.post("/api/shift-presets", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { label, startTime, endTime, color, defaultEmployeeId } = req.body;
    if (!label || !startTime || !endTime) {
      return res.status(400).json({ error: "Naam, starttijd en eindtijd zijn verplicht." });
    }

    try {
      const highest = await prisma.shiftPreset.findFirst({ orderBy: { order: "desc" } });
      const preset = await prisma.shiftPreset.create({
        data: {
          label,
          startTime,
          endTime,
          color: color || "#10b981",
          order: highest ? highest.order + 1 : 0,
          defaultEmployeeId: defaultEmployeeId || null,
        },
      });
      await logAction(req.user.id, "SHIFT_PRESET_CREATE", `Created shift preset: ${label} (${startTime}-${endTime})`);
      return res.status(201).json(preset);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

shiftPresetsRouter.put("/api/shift-presets/:id", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const { label, startTime, endTime, color, order, defaultEmployeeId } = req.body;

    try {
      const existing = await prisma.shiftPreset.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Preset not found" });

      const updated = await prisma.shiftPreset.update({
        where: { id },
        data: {
          label: label !== undefined ? label : existing.label,
          startTime: startTime !== undefined ? startTime : existing.startTime,
          endTime: endTime !== undefined ? endTime : existing.endTime,
          color: color !== undefined ? color : existing.color,
          order: order !== undefined ? Number(order) : existing.order,
          defaultEmployeeId: defaultEmployeeId !== undefined ? (defaultEmployeeId || null) : existing.defaultEmployeeId,
        },
      });
      await logAction(req.user.id, "SHIFT_PRESET_UPDATE", `Updated shift preset ${id}`, existing, updated);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

shiftPresetsRouter.delete("/api/shift-presets/:id", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    try {
      const existing = await prisma.shiftPreset.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Preset not found" });

      await prisma.shiftPreset.delete({ where: { id } });
      await logAction(req.user.id, "SHIFT_PRESET_DELETE", `Deleted shift preset: ${existing.label}`);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));
