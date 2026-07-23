import express from "express";
import { asyncHandler } from "../middleware/error.middleware.js";
import { logAction } from "../services/audit.service.js";
import { sendEmailNotification } from "../services/email.service.js";
import { authenticate } from "../middleware/auth.middleware.js";

export const feedbackRouter = express.Router();

const FEEDBACK_RECIPIENT = process.env.FEEDBACK_EMAIL || "dematthi@hotmail.be";

feedbackRouter.post("/api/feedback", authenticate, asyncHandler(async (req: any, res) => {
    const { type, page, description } = req.body || {};

    if (!type || !["bug", "feature"].includes(type)) {
      return res.status(400).json({ error: "Ongeldig type: gebruik 'bug' of 'feature'." });
    }
    if (!page || typeof page !== "string") {
      return res.status(400).json({ error: "Pagina is verplicht." });
    }
    if (!description || typeof description !== "string" || !description.trim()) {
      return res.status(400).json({ error: "Beschrijving is verplicht." });
    }

    const isBug = type === "bug";
    const label = isBug ? "Bugmelding" : "Feature-aanvraag";
    const reporterName = req.user?.name || "Onbekende gebruiker";
    const reporterEmail = req.user?.email || "onbekend";
    const reporterRole = req.user?.role || "onbekend";
    const userAgent = String(req.headers["user-agent"] || "onbekend");
    const timestamp = new Date().toLocaleString("nl-BE", { timeZone: "Europe/Brussels" });

    const escapeHtml = (value: string) =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const bodyHtml = `
      <h3 style="margin-top:0;">${label}: ${escapeHtml(page)}</h3>
      <p style="white-space:pre-wrap;">${escapeHtml(description.trim())}</p>
      <ul>
        <li><strong>Pagina:</strong> ${escapeHtml(page)}</li>
        <li><strong>Gemeld door:</strong> ${escapeHtml(reporterName)} (${escapeHtml(reporterEmail)}, ${escapeHtml(reporterRole)})</li>
        <li><strong>Tijdstip:</strong> ${escapeHtml(timestamp)}</li>
        <li><strong>Browser:</strong> ${escapeHtml(userAgent)}</li>
      </ul>`;

    try {
      await sendEmailNotification(
        FEEDBACK_RECIPIENT,
        `[${label}] ${page}`,
        bodyHtml,
        { ctaLabel: "Open het platform" }
      );
      await logAction(
        req.user?.id || null,
        isBug ? "FEEDBACK_BUG_REPORTED" : "FEEDBACK_FEATURE_REQUESTED",
        `${label} verzonden voor pagina "${page}"`
      );
      return res.json({ success: true, message: "Bedankt! Je melding is verzonden." });
    } catch (err: any) {
      console.error("Failed to send feedback email:", err);
      return res.status(500).json({ error: "Kon de melding niet verzenden. Probeer het later opnieuw." });
    }
  }));
