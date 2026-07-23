import path from "path";
import fs from "fs";
import { prisma } from "../db.js";

// Email Notifications Helper
const EMAILS_FILE = path.join(process.cwd(), "prisma", "emails.json");

export function getSentEmails() {
  try {
    if (fs.existsSync(EMAILS_FILE)) {
      return JSON.parse(fs.readFileSync(EMAILS_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to read emails file", e);
  }
  return [];
}

export function saveSentEmail(email: any) {
  try {
    const list = getSentEmails();
    list.unshift(email);
    if (list.length > 200) list.pop();
    fs.writeFileSync(EMAILS_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write emails file", e);
  }
}

export function getPublicBaseUrl(req: any) {
  const configured = process.env.APP_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const forwardedProto = String(req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0].trim();
  const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000").split(",")[0].trim();
  return `${forwardedProto}://${forwardedHost}`;
}

export function resolvePlatformUrl(overrideUrl?: string) {
  if (overrideUrl) return overrideUrl.replace(/\/$/, "");
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  if (process.env.PUBLIC_IP) return `http://${process.env.PUBLIC_IP.replace(/^https?:\/\//, "")}`;
  return "http://127.0.0.1:3000";
}

export async function sendEmailNotification(
  to: string,
  subject: string,
  bodyHtml: string,
  options?: { platformUrl?: string; ctaLabel?: string }
) {
  let status = "Simulatie (Gezien in e-maillogboeken)";
  const platformUrl = resolvePlatformUrl(options?.platformUrl);
  const ctaLabel = options?.ctaLabel || "Open het platform";

  // Read configuration from the Settings model in DB, fallback to process.env
  let resendApiKey = "";
  let senderEmail = "noreply@hetverbandternat.be";
  let emailServiceType = "simulation";
  let smtpHost = "";
  let smtpPort = "587";
  let smtpUser = "";
  let smtpPass = "";

  try {
    const resendKeySetting = await prisma.setting.findUnique({ where: { key: "resend_api_key" } });
    const senderSetting = await prisma.setting.findUnique({ where: { key: "sender_email" } });
    const serviceTypeSetting = await prisma.setting.findUnique({ where: { key: "email_service_type" } });
    const smtpHostSetting = await prisma.setting.findUnique({ where: { key: "smtp_host" } });
    const smtpPortSetting = await prisma.setting.findUnique({ where: { key: "smtp_port" } });
    const smtpUserSetting = await prisma.setting.findUnique({ where: { key: "smtp_user" } });
    const smtpPassSetting = await prisma.setting.findUnique({ where: { key: "smtp_pass" } });

    resendApiKey = resendKeySetting?.value || process.env.RESEND_API_KEY || "";
    senderEmail = senderSetting?.value || process.env.SENDER_EMAIL || "noreply@hetverbandternat.be";
    emailServiceType = serviceTypeSetting?.value || (resendApiKey ? "resend" : "simulation");
    smtpHost = smtpHostSetting?.value || "";
    smtpPort = smtpPortSetting?.value || "587";
    smtpUser = smtpUserSetting?.value || "";
    smtpPass = smtpPassSetting?.value || "";
  } catch (e) {
    console.error("Failed to read email settings from DB, using fallback", e);
    resendApiKey = process.env.RESEND_API_KEY || "";
    senderEmail = process.env.SENDER_EMAIL || "noreply@hetverbandternat.be";
    emailServiceType = resendApiKey ? "resend" : "simulation";
  }

  const emailHtml = `
      <div style="margin:0;padding:0;background:#f8fafc;">
        <div style="max-width:640px;margin:0 auto;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
          <div style="border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);border:1px solid #e2e8f0;background:#ffffff;">
            <div style="padding:24px 28px;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#fff;">
              <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;opacity:.9;">Het Verband Ternat Planner</div>
              <div style="font-size:22px;line-height:1.2;font-weight:800;margin-top:8px;">${subject}</div>
            </div>
            <div style="padding:28px;line-height:1.6;font-size:14px;color:#334155;">
              ${bodyHtml}
              <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;">
                <a href="${platformUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;">${ctaLabel}</a>
                <div style="margin-top:12px;font-size:12px;color:#64748b;word-break:break-all;">
                  Alternatief: <a href="${platformUrl}" style="color:#2563eb;text-decoration:underline;">${platformUrl}</a>
                </div>
              </div>
            </div>
            <div style="padding:16px 28px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
              Dit bericht is automatisch verzonden door het planningsplatform.
            </div>
          </div>
        </div>
      </div>
    `;

  if (emailServiceType === "resend" && resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: `Het Verband Ternat Planner <${senderEmail}>`,
          to,
          subject,
          html: emailHtml,
        }),
      });
      if (response.ok) {
        status = "Verzonden via Resend";
      } else {
        const errorText = await response.text();
        status = `Resend Fout: ${errorText}`;
      }
    } catch (e: any) {
      status = `Resend Fout: ${e.message}`;
    }
  } else if (emailServiceType === "smtp" && smtpHost && smtpUser && smtpPass) {
    try {
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtpPort),
        secure: smtpPort === "465",
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      await transporter.sendMail({
        from: `Het Verband Ternat Planner <${senderEmail}>`,
        to,
        subject,
        html: emailHtml,
      });
      status = "Verzonden via SMTP";
    } catch (e: any) {
      status = `SMTP Fout: ${e.message}`;
    }
  }

  const emailEntry = {
    id: Math.random().toString(36).substring(2, 9),
    to,
    subject,
    body: emailHtml,
    sentAt: new Date().toISOString(),
    status,
  };

  saveSentEmail(emailEntry);
  console.log(`[EMAIL DISPATCH] To: ${to} | Subject: ${subject} | Status: ${status}`);
}

export function buildSwapDetailsHtml(swap: {
  shift: any;
  targetShift?: any;
  requester: any;
  target: any;
  reason: string;
  comment?: string | null;
}) {
  return `
      <ul>
        <li><strong>Te geven shift:</strong> ${swap.shift.name} op ${swap.shift.date} (${swap.shift.startTime} - ${swap.shift.endTime})</li>
        ${swap.targetShift ? `<li><strong>Te ontvangen shift:</strong> ${swap.targetShift.name} op ${swap.targetShift.date} (${swap.targetShift.startTime} - ${swap.targetShift.endTime})</li>` : "<li><strong>Te ontvangen shift:</strong> Niet ingevuld, open ruil</li>"}
        <li><strong>Reden:</strong> ${swap.reason}</li>
        ${swap.comment ? `<li><strong>Opmerking:</strong> ${swap.comment}</li>` : ""}
      </ul>`;
}

export function buildSwapActionButtons(baseUrl: string, acceptPath: string, declinePath: string) {
  return `
      <p style="margin:20px 0;">
        <a href="${baseUrl}${acceptPath}" style="display:inline-block;padding:10px 16px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;margin-right:8px;">Accepteren</a>
        <a href="${baseUrl}${declinePath}" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Weigeren</a>
      </p>`;
}
