import express from "express";
import { asyncHandler } from "../middleware/error.middleware.js";
import { getSentEmails } from "../services/email.service.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";

export const emailsRouter = express.Router();

emailsRouter.get("/api/emails", authenticate, requireAdmin, asyncHandler(async (req, res) => {
      const list = getSentEmails();
      return res.json(list);
    }));
