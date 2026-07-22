import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { prisma } from "./server/db.js";
import { hashPassword, comparePassword, generateToken, verifyToken, generateEmailActionToken, verifyEmailActionToken, generateAdminEmailActionToken, verifyAdminEmailActionToken } from "./server/auth.js";
import { seedDatabase } from "./server/seed.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // Database auto-seeding
  try {
    await seedDatabase();
  } catch (error) {
    console.error("Failed to seed database:", error);
  }

  // Audit Log Helper
  async function logAction(userId: string | null, action: string, details: string, oldValue?: any, newValue?: any, ip?: string) {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          details,
          oldValue: oldValue ? JSON.stringify(oldValue) : null,
          newValue: newValue ? JSON.stringify(newValue) : null,
          ipAddress: ip || "127.0.0.1",
        },
      });
    } catch (e) {
      console.error("Error creating audit log:", e);
    }
  }

  // Email Notifications Helper
  const EMAILS_FILE = path.join(process.cwd(), "prisma", "emails.json");

  function getSentEmails() {
    try {
      if (fs.existsSync(EMAILS_FILE)) {
        return JSON.parse(fs.readFileSync(EMAILS_FILE, "utf-8"));
      }
    } catch (e) {
      console.error("Failed to read emails file", e);
    }
    return [];
  }

  function saveSentEmail(email: any) {
    try {
      const list = getSentEmails();
      list.unshift(email);
      if (list.length > 200) list.pop();
      fs.writeFileSync(EMAILS_FILE, JSON.stringify(list, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to write emails file", e);
    }
  }

  function getPublicBaseUrl(req: any) {
    const configured = process.env.APP_URL;
    if (configured) {
      return configured.replace(/\/$/, "");
    }

    const forwardedProto = String(req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0].trim();
    const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000").split(",")[0].trim();
    return `${forwardedProto}://${forwardedHost}`;
  }

  function resolvePlatformUrl(overrideUrl?: string) {
    if (overrideUrl) return overrideUrl.replace(/\/$/, "");
    if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
    if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
    if (process.env.PUBLIC_IP) return `http://${process.env.PUBLIC_IP.replace(/^https?:\/\//, "")}`;
    return "http://127.0.0.1:3000";
  }

  async function sendEmailNotification(to: string, subject: string, bodyHtml: string, options?: { platformUrl?: string; ctaLabel?: string }) {
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
            "Authorization": `Bearer ${resendApiKey}`
          },
          body: JSON.stringify({
            from: `Het Verband Ternat Planner <${senderEmail}>`,
            to,
            subject,
            html: emailHtml
          })
        });
        if (response.ok) {
          status = "Verzonden via Resend";
        } else {
          const errorText = await response.text();
          status = `Resend Fout: ${errorText}`;
        }
      } catch (e) {
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
      } catch (e) {
        status = `SMTP Fout: ${e.message}`;
      }
    }

    const emailEntry = {
      id: Math.random().toString(36).substring(2, 9),
      to,
      subject,
      body: emailHtml,
      sentAt: new Date().toISOString(),
      status
    };

    saveSentEmail(emailEntry);
    console.log(`[EMAIL DISPATCH] To: ${to} | Subject: ${subject} | Status: ${status}`);
  }

  function buildSwapDetailsHtml(swap: { shift: any; targetShift?: any; requester: any; target: any; reason: string; comment?: string | null }) {
    return `
      <ul>
        <li><strong>Te geven shift:</strong> ${swap.shift.name} op ${swap.shift.date} (${swap.shift.startTime} - ${swap.shift.endTime})</li>
        ${swap.targetShift ? `<li><strong>Te ontvangen shift:</strong> ${swap.targetShift.name} op ${swap.targetShift.date} (${swap.targetShift.startTime} - ${swap.targetShift.endTime})</li>` : "<li><strong>Te ontvangen shift:</strong> Niet ingevuld, open ruil</li>"}
        <li><strong>Reden:</strong> ${swap.reason}</li>
        ${swap.comment ? `<li><strong>Opmerking:</strong> ${swap.comment}</li>` : ""}
      </ul>`;
  }

  function buildSwapActionButtons(baseUrl: string, acceptPath: string, declinePath: string) {
    return `
      <p style="margin:20px 0;">
        <a href="${baseUrl}${acceptPath}" style="display:inline-block;padding:10px 16px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;margin-right:8px;">Accepteren</a>
        <a href="${baseUrl}${declinePath}" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">Weigeren</a>
      </p>`;
  }

  // Auth Middleware
  const authenticate = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing token" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
    req.user = decoded;
    next();
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== "ADMINISTRATOR") {
      return res.status(403).json({ error: "Forbidden: Administrator access required" });
    }
    next();
  };

  // ----------------------------------------------------
  // DOUBLE-BOOKING PREVENTION
  // A given employee may not hold two overlapping shift assignments at the
  // same time. These helpers compute real overlap (correctly handling
  // overnight shifts that cross midnight) and look up any conflicting
  // assignment for a candidate shift before it is created.
  // ----------------------------------------------------

  type ShiftTimeRange = { date: string; startTime: string; endTime: string };

  const shiftToRange = (s: ShiftTimeRange): { start: Date; end: Date } => {
    const [y, mo, d] = s.date.split("-").map(Number);
    const [sh, sm] = (s.startTime || "00:00").split(":").map(Number);
    const [eh, em] = (s.endTime || "00:00").split(":").map(Number);
    const start = new Date(y, (mo || 1) - 1, d || 1, sh || 0, sm || 0, 0);
    const end = new Date(y, (mo || 1) - 1, d || 1, eh || 0, em || 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1); // shift crosses midnight
    return { start, end };
  };

  const shiftsOverlap = (a: ShiftTimeRange, b: ShiftTimeRange): boolean => {
    const ra = shiftToRange(a);
    const rb = shiftToRange(b);
    return ra.start < rb.end && rb.start < ra.end;
  };

  const dateStr = (d: Date): string => d.toISOString().split("T")[0];

  // Returns the conflicting shift (if any) that `employeeId` is already
  // assigned to and that overlaps with `candidate`. Pass `excludeShiftIds`
  // to ignore specific shifts (e.g. the shift currently being edited, or
  // shifts already being vacated as part of the same swap operation).
  const findBookingConflict = async (
    employeeId: string,
    candidate: ShiftTimeRange,
    excludeShiftIds: string[] = []
  ) => {
    const [y, mo, d] = candidate.date.split("-").map(Number);
    const prevDate = new Date(y, (mo || 1) - 1, (d || 1) - 1);
    const nextDate = new Date(y, (mo || 1) - 1, (d || 1) + 1);

    const existingAssignments = await prisma.shiftAssignment.findMany({
      where: {
        employeeId,
        status: "ASSIGNED",
        shift: {
          date: { gte: dateStr(prevDate), lte: dateStr(nextDate) },
          ...(excludeShiftIds.length ? { id: { notIn: excludeShiftIds } } : {}),
        },
      },
      include: { shift: true },
    });

    for (const a of existingAssignments) {
      if (shiftsOverlap(candidate, a.shift)) {
        return a.shift;
      }
    }
    return null;
  };

  const describeConflict = (conflict: { name: string; date: string; startTime: string; endTime: string }) =>
    `al ingepland voor "${conflict.name}" op ${conflict.date} van ${conflict.startTime} tot ${conflict.endTime} en kan niet dubbel geboekt worden voor hetzelfde tijdslot`;

  const conflictMessage = (conflict: { name: string; date: string; startTime: string; endTime: string }) =>
    `Deze medewerker is ${describeConflict(conflict)}.`;

  // ----------------------------------------------------
  // AUTHENTICATION ENDPOINTS
  // ----------------------------------------------------

  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: "User already exists with this email" });
      }

      const passwordHash = hashPassword(password);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: role || "EMPLOYEE",
        },
      });

      // Every user gets an Employee profile, regardless of role, so that
      // administrators can also be assigned to shifts (not just employees).
      const employee = await prisma.employee.create({
        data: {
          userId: user.id,
          preferredShifts: "[]",
          preferredColleagues: "[]",
        },
      });

      await logAction(user.id, "USER_REGISTER", `User registered as ${user.role}`);

      const token = generateToken(user);
      return res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name, employee } });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { employee: true },
      });
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const isValid = comparePassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Check if this is the default admin account that needs password change
      // Only allow default admin login if password is still the default
      const isDefaultAdmin = user.email === "admin@planner.com" && password === "admin123";
      const requiresPasswordChange = isDefaultAdmin;
      
      // If someone tries to login with default admin credentials but password was already changed,
      // reject the login for security
      if (user.email === "admin@planner.com" && password === "admin123" && !isDefaultAdmin) {
        return res.status(401).json({ 
          error: "Default admin password has been changed. Please use your new credentials or contact an administrator." 
        });
      }

      const token = generateToken(user);
      await logAction(user.id, "USER_LOGIN", `User logged in successfully${isDefaultAdmin ? " (default admin, password change required)" : ""}`);

      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          employee: user.employee,
          hasCompletedFirstTimeGuide: user.hasCompletedFirstTimeGuide,
        },
        requiresPasswordChange,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // PUBLIC ICAL FEED SYNCHRONIZATION
  // ----------------------------------------------------
  app.get("/api/calendar/sync/:userId/feed.ics", async (req, res) => {
    const { userId } = req.params;
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { employee: true },
      });

      if (!user) {
        return res.status(404).send("Gebruiker niet gevonden.");
      }

      // Every account (including administrators) has an Employee profile, so
      // "mine vs. all" can no longer be inferred from whether user.employee
      // exists - that's always true. Instead the person explicitly picks via
      // ?scope=all|mine. Default stays "mine" for old links that don't pass
      // the param yet, so existing subscriptions don't suddenly change.
      const scope = req.query.scope === "all" ? "all" : "mine";

      let shifts = [];
      if (scope === "mine" && user.employee) {
        shifts = await prisma.shift.findMany({
          where: {
            assignments: {
              some: {
                employeeId: user.employee.id,
              },
            },
          },
          include: {
            assignments: {
              include: {
                employee: {
                  include: { user: true },
                },
              },
            },
          },
          orderBy: { date: "asc" },
        });
      } else {
        // scope === "all" (explicitly chosen), or this account has no Employee
        // profile for some reason (legacy accounts predating auto-creation).
        shifts = await prisma.shift.findMany({
          include: {
            assignments: {
              include: {
                employee: {
                  include: { user: true },
                },
              },
            },
          },
          orderBy: { date: "asc" },
        });
      }

      // Construct iCal / ICS content
      let ics = "BEGIN:VCALENDAR\r\n";
      ics += "VERSION:2.0\r\n";
      ics += "PRODID:-//Thuisverpleging Het Verband Ternat//Planner//NL\r\n";
      ics += "CALSCALE:GREGORIAN\r\n";
      ics += "METHOD:PUBLISH\r\n";
      if (scope === "all") {
        ics += "X-WR-CALNAME:Het Verband - Volledige Planning\r\n";
      } else {
        ics += `X-WR-CALNAME:Het Verband - Shifts van ${user.name}\r\n`;
      }
      ics += "X-WR-TIMEZONE:Europe/Brussels\r\n";

      // Date & Time Parsing/Formatting Helpers
      // Shift dates/times are stored as naive "YYYY-MM-DD" / "HH:MM" strings that
      // represent wall-clock time in Europe/Brussels. We must convert them to a
      // correct UTC instant WITHOUT relying on the server process's own timezone
      // (Docker/node:alpine containers default to UTC, not Europe/Brussels, which
      // previously caused every event to be off by 1-2 hours depending on DST).
      const zonedTimeToUtc = (dateStr: string, timeStr: string, timeZone = "Europe/Brussels"): Date => {
        const [year, month, day] = dateStr.split("-").map(Number);
        const [hours, minutes] = timeStr.split(":").map(Number);
        const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes || 0, 0));
        const dtf = new Intl.DateTimeFormat("en-US", {
          timeZone,
          hourCycle: "h23",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        const parts = dtf.formatToParts(utcGuess).reduce((acc: any, p) => {
          acc[p.type] = p.value;
          return acc;
        }, {});
        const asIfLocal = Date.UTC(
          Number(parts.year),
          Number(parts.month) - 1,
          Number(parts.day),
          Number(parts.hour),
          Number(parts.minute),
          Number(parts.second)
        );
        const diff = utcGuess.getTime() - asIfLocal;
        return new Date(utcGuess.getTime() + diff);
      };
      const parseDateTime = (dateStr: string, timeStr: string): Date => zonedTimeToUtc(dateStr, timeStr);

      const formatUTC = (d: Date): string => {
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(d.getUTCDate()).padStart(2, "0");
        const hh = String(d.getUTCHours()).padStart(2, "0");
        const min = String(d.getUTCMinutes()).padStart(2, "0");
        const ss = String(d.getUTCSeconds()).padStart(2, "0");
        return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`;
      };

      // Escape TEXT values per RFC 5545 §3.3.11 (backslash, semicolon, comma,
      // and any line breaks). Without this, free-text shift names/notes typed
      // by administrators (which can contain commas, semicolons, or actual
      // newlines from the notes textarea) corrupt the ICS file: content lines
      // get silently truncated or broken, which is why some calendars ended up
      // showing nothing (or garbled) at all for affected shifts.
      const escapeICSText = (value: string): string =>
        String(value)
          .replace(/\\/g, "\\\\")
          .replace(/;/g, "\\;")
          .replace(/,/g, "\\,")
          .replace(/\r\n|\r|\n/g, "\\n");

      // Fold content lines longer than 75 octets per RFC 5545 §3.1, so strict
      // calendar clients don't choke on long SUMMARY/DESCRIPTION values.
      const foldLine = (line: string): string => {
        const maxLen = 75;
        if (Buffer.byteLength(line, "utf8") <= maxLen) return line;
        let result = "";
        let chunk = "";
        let byteLen = 0;
        for (const ch of line) {
          const chBytes = Buffer.byteLength(ch, "utf8");
          if (byteLen + chBytes > maxLen) {
            result += (result ? "\r\n " : "") + chunk;
            chunk = "";
            byteLen = 0;
          }
          chunk += ch;
          byteLen += chBytes;
        }
        result += (result ? "\r\n " : "") + chunk;
        return result;
      };

      for (const shift of shifts) {
        const start = parseDateTime(shift.date, shift.startTime);
        let end = parseDateTime(shift.date, shift.endTime);
        
        // Handle night shifts crossing midnight (e.g. 22:00 to 06:00)
        if (end < start) {
          end.setDate(end.getDate() + 1);
        }

        // DTSTAMP must be "when this VEVENT representation was generated",
        // which is fine as "now" - it is NOT a change-detection signal.
        // Calendar clients (Google/Apple/Outlook) decide whether a
        // previously-imported event has actually changed by comparing
        // SEQUENCE/LAST-MODIFIED against what they already stored for that
        // UID. Previously we emitted neither, so SEQUENCE implicitly stayed
        // at 0 forever and LAST-MODIFIED was absent - meaning an edited
        // shift (time change, reassignment, ...) looked identical to the
        // client on every re-poll and it kept showing the stale version it
        // originally imported. That's the "not syncing" bug: the feed
        // content was correct, but clients had no reliable signal to know
        // it had changed.
        //
        // Fix: derive LAST-MODIFIED from the most recent real change to
        // this shift, which is either the shift row itself (time, name,
        // notes, ...) or any of its assignments (who's working it) -
        // reassigning an employee doesn't touch Shift.updatedAt since it's
        // a separate related row.
        const assignmentTimestamps = (shift.assignments || [])
          .map((a: any) => a.updatedAt)
          .filter(Boolean);
        const lastModifiedDate = assignmentTimestamps.reduce(
          (latest: Date, ts: Date) => (ts > latest ? ts : latest),
          shift.updatedAt
        );

        const dtStamp = formatUTC(new Date());
        const dtStart = formatUTC(start);
        const dtEnd = formatUTC(end);
        const lastModified = formatUTC(new Date(lastModifiedDate));
        // A monotonically increasing SEQUENCE per change is the more
        // widely-honored signal (RFC 5545 §3.8.7.4) - derive one
        // deterministically from the last-modified timestamp (seconds since
        // epoch) so it only ever increases as real edits happen, without
        // needing a dedicated counter column on the Shift model.
        const sequence = Math.floor(new Date(lastModifiedDate).getTime() / 1000);

        // Build description
        const descParts = [];
        if (shift.notes) {
          descParts.push(`Opmerking: ${shift.notes}`);
        }
        
        const assignedNames = shift.assignments
          ?.map((a: any) => a.employee?.user?.name)
          .filter(Boolean)
          .join(", ");
        
        if (assignedNames) {
          descParts.push(`Medewerkers: ${assignedNames}`);
        }

        const description = descParts.join("\n");

        ics += foldLine("BEGIN:VEVENT") + "\r\n";
        ics += foldLine(`UID:shift-${shift.id}@homenursing.org`) + "\r\n";
        ics += foldLine(`DTSTAMP:${dtStamp}`) + "\r\n";
        ics += foldLine(`LAST-MODIFIED:${lastModified}`) + "\r\n";
        ics += foldLine(`SEQUENCE:${sequence}`) + "\r\n";
        ics += foldLine(`DTSTART:${dtStart}`) + "\r\n";
        ics += foldLine(`DTEND:${dtEnd}`) + "\r\n";

        if (scope === "all") {
          ics += foldLine(`SUMMARY:${escapeICSText(shift.name)} (${shift.assignments?.length || 0}/${shift.requiredEmployees})`) + "\r\n";
        } else {
          ics += foldLine(`SUMMARY:${escapeICSText(shift.name)}`) + "\r\n";
        }

        if (description) {
          ics += foldLine(`DESCRIPTION:${escapeICSText(description)}`) + "\r\n";
        }
        ics += "END:VEVENT\r\n";
      }

      ics += "END:VCALENDAR\r\n";

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      // Use "inline" (not "attachment") so calendar apps treat this as a live,
      // pollable subscription feed instead of a one-off file download when the
      // link is opened directly (this matters for the "Direct Abonneren" flow).
      res.setHeader("Content-Disposition", `inline; filename="planning-${userId}.ics"`);
      // Explicitly forbid caching of this response by any intermediary (CDN,
      // reverse proxy, browser). Without this, a proxy sitting in front of the
      // app can legally cache and keep re-serving an old/empty version of the
      // feed to calendar clients even after new shifts are assigned, which
      // looks exactly like "nothing syncs".
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      return res.send(ics);
    } catch (err) {
      return res.status(500).send("Fout bij genereren van iCal feed: " + err.message);
    }
  });

  app.get("/api/auth/me", authenticate, async (req: any, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { employee: true },
      });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        employee: user.employee,
        hasCompletedFirstTimeGuide: user.hasCompletedFirstTimeGuide,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Marks the first-time onboarding guide as seen for the current account.
  // Stored on the User row (rather than localStorage) so it follows the
  // account across browsers/devices and isn't reset by clearing site data.
  app.post("/api/auth/complete-first-time-guide", authenticate, async (req: any, res) => {
    try {
      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { hasCompletedFirstTimeGuide: true },
      });
      return res.json({ success: true, hasCompletedFirstTimeGuide: user.hasCompletedFirstTimeGuide });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // EMPLOYEES ENDPOINTS
  // ----------------------------------------------------

  app.get("/api/employees", authenticate, async (req, res) => {
    try {
      const employees = await prisma.employee.findMany({
        include: { user: true },
      });
      return res.json(employees);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/employees/:id", authenticate, async (req: any, res) => {
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
  });

  // ----------------------------------------------------
  // SHIFTS ENDPOINTS
  // ----------------------------------------------------

  app.get("/api/shifts", authenticate, async (req, res) => {
    const { startDate, endDate, employeeId } = req.query;
    try {
      const whereClause: any = {};
      if (startDate && endDate) {
        whereClause.date = {
          gte: startDate as string,
          lte: endDate as string,
        };
      }
      if (employeeId) {
        whereClause.assignments = {
          some: {
            employeeId: employeeId as string,
          },
        };
      }

      const shifts = await prisma.shift.findMany({
        where: whereClause,
        include: {
          assignments: {
            include: {
              employee: {
                include: { user: true },
              },
            },
          },
        },
        orderBy: { date: "asc" },
      });
      return res.json(shifts);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/shifts", authenticate, requireAdmin, async (req: any, res) => {
    const { name, startTime, endTime, date, color, requiredEmployees, notes, employeeId } = req.body;
    if (!name || !startTime || !endTime || !date) {
      return res.status(400).json({ error: "Missing required shift fields" });
    }

    try {
      if (employeeId) {
        const conflict = await findBookingConflict(employeeId, { date, startTime, endTime });
        if (conflict) {
          return res.status(409).json({ error: conflictMessage(conflict) });
        }
      }

      const shift = await prisma.shift.create({
        data: {
          name,
          startTime,
          endTime,
          date,
          color: color || "#3b82f6",
          requiredEmployees: requiredEmployees !== undefined ? Number(requiredEmployees) : 1,
          notes,
        },
      });

      if (employeeId) {
        await prisma.shiftAssignment.create({
          data: {
            shiftId: shift.id,
            employeeId,
            status: "ASSIGNED",
          },
        });

        // Send email to assigned employee
        try {
          const assignedEmployee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: { user: true }
          });
          if (assignedEmployee && assignedEmployee.user.email) {
            await sendEmailNotification(
              assignedEmployee.user.email,
              "Nieuwe shift toegewezen - Het Verband Ternat",
              `<h3>Beste ${assignedEmployee.user.name},</h3>
               <p>Er is een nieuwe shift aan u toegewezen op de planning:</p>
               <ul>
                 <li><strong>Shift:</strong> ${name}</li>
                 <li><strong>Datum:</strong> ${date}</li>
                 <li><strong>Tijd:</strong> ${startTime} - ${endTime}</li>
                 ${notes ? `<li><strong>Opmerking:</strong> ${notes}</li>` : ""}
               </ul>
                <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
                { platformUrl: getPublicBaseUrl(req), ctaLabel: "Bekijk de shift" }
            );
          }
        } catch (mailErr) {
          console.error("Failed to send assignment mail:", mailErr);
        }
      }

      await logAction(req.user.id, "SHIFT_CREATE", `Created shift: ${name} on ${date}`, null, shift);
      return res.status(201).json(shift);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/shifts/:id", authenticate, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    const { name, startTime, endTime, date, color, requiredEmployees, notes, employeeId } = req.body;

    try {
      const shift = await prisma.shift.findUnique({
        where: { id },
        include: { assignments: true },
      });
      if (!shift) {
        return res.status(404).json({ error: "Shift not found" });
      }

      const effectiveDate = date || shift.date;
      const effectiveStart = startTime || shift.startTime;
      const effectiveEnd = endTime || shift.endTime;

      // Which employee(s) must be checked against the double-booking restriction?
      // - `employeeId` explicitly present in the request body (e.g. the "Medewerker
      //   toewijzen" dialog) means the caller is deliberately (re)assigning someone,
      //   so check that employee. An explicit falsy value (null/"") means "unassign",
      //   which never conflicts.
      // - `employeeId` absent from the body happens when a shift is dragged to a new
      //   day/slot without touching its assignment (see handlePlannerDrop on the
      //   client). The shift keeps its current employee(s), so the restriction must
      //   still be checked against them for the new date/time - otherwise moving an
      //   already-assigned shift onto a day where that employee is already booked
      //   silently bypasses the restriction.
      const employeeIdsToCheck: string[] =
        employeeId !== undefined
          ? employeeId
            ? [employeeId]
            : []
          : shift.assignments.map((a) => a.employeeId);

      for (const empId of employeeIdsToCheck) {
        const conflict = await findBookingConflict(
          empId,
          { date: effectiveDate, startTime: effectiveStart, endTime: effectiveEnd },
          [id]
        );
        if (conflict) {
          return res.status(409).json({ error: conflictMessage(conflict) });
        }
      }

      const updated = await prisma.shift.update({
        where: { id },
        data: {
          name: name || shift.name,
          startTime: startTime || shift.startTime,
          endTime: endTime || shift.endTime,
          date: date || shift.date,
          color: color || shift.color,
          requiredEmployees: requiredEmployees !== undefined ? Number(requiredEmployees) : shift.requiredEmployees,
          notes: notes !== undefined ? notes : shift.notes,
        },
      });

      if (employeeId !== undefined) {
        // Clear old assignments and add new one
        await prisma.shiftAssignment.deleteMany({ where: { shiftId: id } });
        if (employeeId) {
          await prisma.shiftAssignment.create({
            data: {
              shiftId: id,
              employeeId,
              status: "ASSIGNED",
            },
          });

          // Send email to assigned employee
          try {
            const assignedEmployee = await prisma.employee.findUnique({
              where: { id: employeeId },
              include: { user: true }
            });
            if (assignedEmployee && assignedEmployee.user.email) {
              await sendEmailNotification(
                assignedEmployee.user.email,
                "Gewijzigde of nieuwe shift toegewezen - Het Verband Ternat",
                `<h3>Beste ${assignedEmployee.user.name},</h3>
                 <p>Uw planning is bijgewerkt. U bent toegewezen aan de volgende shift:</p>
                 <ul>
                   <li><strong>Shift:</strong> ${updated.name}</li>
                   <li><strong>Datum:</strong> ${updated.date}</li>
                   <li><strong>Tijd:</strong> ${updated.startTime} - ${updated.endTime}</li>
                   ${updated.notes ? `<li><strong>Opmerking:</strong> ${updated.notes}</li>` : ""}
                 </ul>
                    <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
                    { platformUrl: getPublicBaseUrl(req), ctaLabel: "Open uw bijgewerkte planning" }
              );
            }
          } catch (mailErr) {
            console.error("Failed to send update assignment mail:", mailErr);
          }
        }
      }

      await logAction(req.user.id, "SHIFT_UPDATE", `Updated shift ${id}`, shift, updated);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/shifts/:id", authenticate, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    try {
      const shift = await prisma.shift.findUnique({ where: { id } });
      if (!shift) {
        return res.status(404).json({ error: "Shift not found" });
      }

      // Manually delete related elements first to prevent SQLite Foreign Key errors
      await prisma.shiftChangeRequest.deleteMany({
        where: { assignment: { shiftId: id } }
      });
      await prisma.shiftAssignment.deleteMany({ where: { shiftId: id } });
      await prisma.swapRequest.deleteMany({
        where: {
          OR: [
            { shiftId: id },
            { targetShiftId: id }
          ]
        }
      });

      await prisma.shift.delete({ where: { id } });
      await logAction(req.user.id, "SHIFT_DELETE", `Deleted shift: ${shift.name} on ${shift.date}`, shift, null);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // BULK SHIFT OPERATIONS
  // Operate on an explicit list of shift IDs at once (selected via the
  // "Bulk bewerken" mode in the calendar). Each op re-validates against the
  // double-booking restriction the same way the single-shift endpoints do,
  // and reports per-shift outcomes so partial failures are still visible.
  // ----------------------------------------------------

  const MAX_BULK_SHIFTS = 500;

  const loadBulkShifts = async (shiftIds: string[]) => {
    return prisma.shift.findMany({
      where: { id: { in: shiftIds } },
      include: { assignments: true },
    });
  };

  app.post("/api/shifts/bulk-delete", authenticate, requireAdmin, async (req: any, res) => {
    const { shiftIds } = req.body;
    if (!Array.isArray(shiftIds) || shiftIds.length === 0) {
      return res.status(400).json({ error: "Geen shifts geselecteerd." });
    }
    if (shiftIds.length > MAX_BULK_SHIFTS) {
      return res.status(400).json({ error: `Maximaal ${MAX_BULK_SHIFTS} shifts tegelijk.` });
    }

    try {
      const shifts = await loadBulkShifts(shiftIds);
      if (shifts.length === 0) {
        return res.status(404).json({ error: "Geen van de geselecteerde shifts bestaat nog." });
      }

      const foundIds = shifts.map((s) => s.id);

      await prisma.shiftChangeRequest.deleteMany({ where: { assignment: { shiftId: { in: foundIds } } } });
      await prisma.shiftAssignment.deleteMany({ where: { shiftId: { in: foundIds } } });
      await prisma.swapRequest.deleteMany({
        where: { OR: [{ shiftId: { in: foundIds } }, { targetShiftId: { in: foundIds } }] },
      });
      await prisma.shift.deleteMany({ where: { id: { in: foundIds } } });

      await logAction(req.user.id, "SHIFT_BULK_DELETE", `Bulk verwijderd: ${shifts.length} shift(en)`, shifts, null);
      return res.json({ success: true, count: shifts.length, notFound: shiftIds.length - shifts.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/shifts/bulk-assign", authenticate, requireAdmin, async (req: any, res) => {
    const { shiftIds, employeeId } = req.body;
    if (!Array.isArray(shiftIds) || shiftIds.length === 0) {
      return res.status(400).json({ error: "Geen shifts geselecteerd." });
    }
    if (shiftIds.length > MAX_BULK_SHIFTS) {
      return res.status(400).json({ error: `Maximaal ${MAX_BULK_SHIFTS} shifts tegelijk.` });
    }

    try {
      const shifts = await loadBulkShifts(shiftIds);
      if (shifts.length === 0) {
        return res.status(404).json({ error: "Geen van de geselecteerde shifts bestaat nog." });
      }

      let assignedEmployee: any = null;
      if (employeeId) {
        assignedEmployee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { user: true } });
        if (!assignedEmployee) {
          return res.status(404).json({ error: "Medewerker niet gevonden." });
        }
      }

      let updated = 0;
      let skippedConflicts = 0;
      const conflicts: { shiftId: string; name: string; date: string }[] = [];

      for (const shift of shifts) {
        if (employeeId) {
          const conflict = await findBookingConflict(
            employeeId,
            { date: shift.date, startTime: shift.startTime, endTime: shift.endTime },
            [shift.id]
          );
          if (conflict) {
            skippedConflicts++;
            conflicts.push({ shiftId: shift.id, name: shift.name, date: shift.date });
            continue;
          }
        }

        await prisma.shiftAssignment.deleteMany({ where: { shiftId: shift.id } });
        if (employeeId) {
          await prisma.shiftAssignment.create({
            data: { shiftId: shift.id, employeeId, status: "ASSIGNED" },
          });
        }
        updated++;
      }

      if (assignedEmployee && assignedEmployee.user.email && updated > 0) {
        try {
          await sendEmailNotification(
            assignedEmployee.user.email,
            "Meerdere shifts toegewezen - Het Verband Ternat",
            `<h3>Beste ${assignedEmployee.user.name},</h3>
             <p>U bent toegewezen aan ${updated} shift(en) op de planning. Bekijk uw rooster voor de details.</p>
             <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
            { platformUrl: getPublicBaseUrl(req), ctaLabel: "Bekijk uw planning" }
          );
        } catch (mailErr) {
          console.error("Failed to send bulk assignment mail:", mailErr);
        }
      }

      await logAction(
        req.user.id,
        "SHIFT_BULK_ASSIGN",
        `Bulk toewijzing: ${updated} shift(en) ${employeeId ? `aan medewerker ${employeeId}` : "onbezet gemaakt"} (${skippedConflicts} overgeslagen door conflict)`
      );
      return res.json({ success: true, count: updated, skippedConflicts, conflicts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/shifts/bulk-shift-dates", authenticate, requireAdmin, async (req: any, res) => {
    const { shiftIds, dayOffset } = req.body;
    if (!Array.isArray(shiftIds) || shiftIds.length === 0) {
      return res.status(400).json({ error: "Geen shifts geselecteerd." });
    }
    if (shiftIds.length > MAX_BULK_SHIFTS) {
      return res.status(400).json({ error: `Maximaal ${MAX_BULK_SHIFTS} shifts tegelijk.` });
    }
    const offset = Number(dayOffset);
    if (!Number.isFinite(offset) || offset === 0) {
      return res.status(400).json({ error: "Ongeldig aantal dagen om te verschuiven." });
    }

    try {
      const shifts = await loadBulkShifts(shiftIds);
      if (shifts.length === 0) {
        return res.status(404).json({ error: "Geen van de geselecteerde shifts bestaat nog." });
      }

      let updated = 0;
      let skippedConflicts = 0;
      const conflicts: { shiftId: string; name: string; date: string }[] = [];

      for (const shift of shifts) {
        const [y, mo, d] = shift.date.split("-").map(Number);
        const newDate = new Date(y, (mo || 1) - 1, (d || 1) + offset);
        const newDateStr = newDate.toISOString().split("T")[0];

        const assignedIds = shift.assignments.map((a) => a.employeeId);
        let hasConflict = false;
        for (const empId of assignedIds) {
          const conflict = await findBookingConflict(
            empId,
            { date: newDateStr, startTime: shift.startTime, endTime: shift.endTime },
            [shift.id]
          );
          if (conflict) {
            hasConflict = true;
            break;
          }
        }

        if (hasConflict) {
          skippedConflicts++;
          conflicts.push({ shiftId: shift.id, name: shift.name, date: shift.date });
          continue;
        }

        await prisma.shift.update({ where: { id: shift.id }, data: { date: newDateStr } });
        updated++;
      }

      await logAction(
        req.user.id,
        "SHIFT_BULK_SHIFT_DATES",
        `Bulk verschuiving: ${updated} shift(en) met ${offset} dag(en) (${skippedConflicts} overgeslagen door conflict)`
      );
      return res.json({ success: true, count: updated, skippedConflicts, conflicts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/shifts/copy-week", authenticate, requireAdmin, async (req: any, res) => {
    const { sourceStartDate, targetStartDate, copyEmployees } = req.body;
    if (!sourceStartDate || !targetStartDate) {
      return res.status(400).json({ error: "Missing source or target date" });
    }

    try {
      const sourceDate = new Date(sourceStartDate);
      const targetDate = new Date(targetStartDate);

      // Get Saturday/Sunday bounding of the source week
      const sourceEnd = new Date(sourceDate);
      sourceEnd.setDate(sourceDate.getDate() + 6);

      const sourceEndStr = sourceEnd.toISOString().split("T")[0];

      const shifts = await prisma.shift.findMany({
        where: {
          date: {
            gte: sourceStartDate,
            lte: sourceEndStr,
          },
        },
        include: { assignments: true },
      });

      const dayDifference = Math.round((targetDate.getTime() - sourceDate.getTime()) / (1000 * 60 * 60 * 24));
      let totalCreated = 0;
      let skippedConflicts = 0;

      for (const s of shifts) {
        const currentShiftDate = new Date(s.date);
        currentShiftDate.setDate(currentShiftDate.getDate() + dayDifference);
        const newDateStr = currentShiftDate.toISOString().split("T")[0];

        const newShift = await prisma.shift.create({
          data: {
            name: s.name,
            startTime: s.startTime,
            endTime: s.endTime,
            date: newDateStr,
            color: s.color,
            requiredEmployees: s.requiredEmployees,
            notes: s.notes,
          },
        });

        totalCreated++;

        // Copy assignments optionally
        if (copyEmployees !== false) {
          for (const assign of s.assignments) {
            const conflict = await findBookingConflict(assign.employeeId, {
              date: newDateStr,
              startTime: s.startTime,
              endTime: s.endTime,
            });
            if (conflict) {
              skippedConflicts++;
              continue;
            }
            await prisma.shiftAssignment.create({
              data: {
                shiftId: newShift.id,
                employeeId: assign.employeeId,
                status: "ASSIGNED",
              },
            });
          }
        }
      }

      await logAction(req.user.id, "SHIFT_COPY_WEEK", `Copied week ${sourceStartDate} to ${targetStartDate} (with employees: ${copyEmployees !== false})`);
      return res.json({ success: true, count: totalCreated, skippedConflicts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/shifts/repeat-week", authenticate, requireAdmin, async (req: any, res) => {
    const { sourceStartDate, repeatWeeksCount, copyEmployees } = req.body;
    if (!sourceStartDate || !repeatWeeksCount) {
      return res.status(400).json({ error: "Ontbrekende bronweek of herhaal aantal." });
    }
    const weeks = Number(repeatWeeksCount);
    if (weeks < 1 || weeks > 24) {
      return res.status(400).json({ error: "Aantal weken moet tussen 1 en 24 liggen." });
    }

    try {
      const sourceDate = new Date(sourceStartDate);
      const sourceEnd = new Date(sourceDate);
      sourceEnd.setDate(sourceDate.getDate() + 6);
      const sourceEndStr = sourceEnd.toISOString().split("T")[0];

      const shifts = await prisma.shift.findMany({
        where: {
          date: {
            gte: sourceStartDate,
            lte: sourceEndStr,
          },
        },
        include: { assignments: true },
      });

      let totalCreated = 0;
      let skippedConflicts = 0;

      for (let i = 1; i <= weeks; i++) {
        const dayDifference = i * 7;
        for (const s of shifts) {
          const currentShiftDate = new Date(s.date);
          currentShiftDate.setDate(currentShiftDate.getDate() + dayDifference);
          const newDateStr = currentShiftDate.toISOString().split("T")[0];

          const newShift = await prisma.shift.create({
            data: {
              name: s.name,
              startTime: s.startTime,
              endTime: s.endTime,
              date: newDateStr,
              color: s.color,
              requiredEmployees: s.requiredEmployees,
              notes: s.notes,
            },
          });

          totalCreated++;

          if (copyEmployees) {
            for (const assign of s.assignments) {
              const conflict = await findBookingConflict(assign.employeeId, {
                date: newDateStr,
                startTime: s.startTime,
                endTime: s.endTime,
              });
              if (conflict) {
                skippedConflicts++;
                continue;
              }
              await prisma.shiftAssignment.create({
                data: {
                  shiftId: newShift.id,
                  employeeId: assign.employeeId,
                  status: "ASSIGNED",
                },
              });
            }
          }
        }
      }

      await logAction(req.user.id, "SHIFT_REPEAT_WEEK", `Repeated week ${sourceStartDate} for ${weeks} weeks into the future (Copy employees: ${copyEmployees})`);
      return res.json({ success: true, count: totalCreated, skippedConflicts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/shifts/copy-month", authenticate, requireAdmin, async (req: any, res) => {
    const { sourceYearMonth, targetYearMonth, copyEmployees } = req.body;
    if (!sourceYearMonth || !targetYearMonth) {
      return res.status(400).json({ error: "Ontbrekende bron- of doelmaand." });
    }

    try {
      const [srcYear, srcMonth] = sourceYearMonth.split("-").map(Number);
      const [tgtYear, tgtMonth] = targetYearMonth.split("-").map(Number);

      const srcStartStr = `${sourceYearMonth}-01`;
      const srcEnd = new Date(srcYear, srcMonth, 0);
      const srcEndStr = srcEnd.toISOString().split("T")[0];

      const shifts = await prisma.shift.findMany({
        where: {
          date: {
            gte: srcStartStr,
            lte: srcEndStr,
          },
        },
        include: { assignments: true },
      });

      let totalCreated = 0;
      let skippedConflicts = 0;

      const getOccurrencesInMonth = (year: number, monthIdx: number) => {
        const occurrences: { [key: string]: Date[] } = {
          "0": [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": []
        };
        const date = new Date(year, monthIdx, 1);
        while (date.getMonth() === monthIdx) {
          const day = date.getDay();
          occurrences[day].push(new Date(date));
          date.setDate(date.getDate() + 1);
        }
        return occurrences;
      };

      const srcOccurrences = getOccurrencesInMonth(srcYear, srcMonth - 1);
      const tgtOccurrences = getOccurrencesInMonth(tgtYear, tgtMonth - 1);

      for (const s of shifts) {
        const sDate = new Date(s.date);
        const dayOfWeek = sDate.getDay();
        const occIndex = srcOccurrences[dayOfWeek].findIndex(d => d.toISOString().split("T")[0] === s.date);
        if (occIndex === -1) continue;

        const targetDatesList = tgtOccurrences[dayOfWeek];
        if (!targetDatesList || targetDatesList.length === 0) continue;
        const targetDateObj = targetDatesList[occIndex] || targetDatesList[targetDatesList.length - 1];
        const newDateStr = targetDateObj.toISOString().split("T")[0];

        const newShift = await prisma.shift.create({
          data: {
            name: s.name,
            startTime: s.startTime,
            endTime: s.endTime,
            date: newDateStr,
            color: s.color,
            requiredEmployees: s.requiredEmployees,
            notes: s.notes,
          },
        });

        totalCreated++;

        if (copyEmployees) {
          for (const assign of s.assignments) {
            const conflict = await findBookingConflict(assign.employeeId, {
              date: newDateStr,
              startTime: s.startTime,
              endTime: s.endTime,
            });
            if (conflict) {
              skippedConflicts++;
              continue;
            }
            await prisma.shiftAssignment.create({
              data: {
                shiftId: newShift.id,
                employeeId: assign.employeeId,
                status: "ASSIGNED",
              },
            });
          }
        }
      }

      await logAction(req.user.id, "SHIFT_COPY_MONTH", `Copied month ${sourceYearMonth} to ${targetYearMonth} (with employees: ${copyEmployees})`);
      return res.json({ success: true, count: totalCreated, skippedConflicts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/shifts/send-month-schedule", authenticate, requireAdmin, async (req: any, res) => {
    const { yearMonth, excludedUserIds = [] } = req.body;
    if (!yearMonth) {
      return res.status(400).json({ error: "Ontbrekende maand selectie." });
    }

    try {
      const excludedIds = new Set(Array.isArray(excludedUserIds) ? excludedUserIds.map((id) => String(id)) : []);

      const users = await prisma.user.findMany({
        include: {
          employee: {
            include: {
              assignments: {
                include: {
                  shift: true,
                },
                where: {
                  shift: {
                    date: {
                      startsWith: yearMonth,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      });

      const allMonthShifts = await prisma.shift.findMany({
        where: {
          date: {
            startsWith: yearMonth,
          },
        },
        include: {
          assignments: {
            include: {
              employee: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      });

      let emailsSentCount = 0;

      for (const user of users) {
        if (!user.email || excludedIds.has(user.id)) continue;

        const myAssignments = user.employee?.assignments
          ? user.employee.assignments
              .map((a) => a.shift)
              .sort((a, b) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                return a.startTime.localeCompare(b.startTime);
              })
          : [];

        if (user.role === "ADMINISTRATOR" || !user.employee) {
          const overviewRows = allMonthShifts
            .map((shift) => {
              const assignedNames = shift.assignments.length
                ? shift.assignments
                    .map((assignment) => assignment.employee.user?.name)
                    .filter(Boolean)
                    .join(", ")
                : "Onbezet";

              return `
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:10px;border:1px solid #e2e8f0;font-weight:bold;">${shift.date}</td>
                  <td style="padding:10px;border:1px solid #e2e8f0;">${shift.name}</td>
                  <td style="padding:10px;border:1px solid #e2e8f0;font-family:monospace;">${shift.startTime} - ${shift.endTime}</td>
                  <td style="padding:10px;border:1px solid #e2e8f0;">${assignedNames}</td>
                </tr>
              `;
            })
            .join("");

          const emailBody = `
            <div style="font-family:sans-serif; max-width:600px; margin:0 auto; color:#334155;">
              <h2 style="color:#2563eb; border-bottom:2px solid #e2e8f0; padding-bottom:10px;">Maandplanning - ${yearMonth}</h2>
              <p>Beste <strong>${user.name}</strong>,</p>
              <p>De maandplanning voor <strong>${yearMonth}</strong> is gepubliceerd.</p>
              <p>U bent beheerder of hebt geen persoonlijk roosterprofiel, daarom ontvangt u het overzicht van alle geplande shiften.</p>
              <table style="width:100%; border-collapse:collapse; font-family:sans-serif; font-size:14px; margin-top:15px;">
                <thead>
                  <tr style="background-color:#f1f5f9; text-align:left; border-bottom:2px solid #cbd5e1;">
                    <th style="padding:10px; border:1px solid #e2e8f0;">Datum</th>
                    <th style="padding:10px; border:1px solid #e2e8f0;">Dienstnaam</th>
                    <th style="padding:10px; border:1px solid #e2e8f0;">Tijd</th>
                    <th style="padding:10px; border:1px solid #e2e8f0;">Toegewezen aan</th>
                  </tr>
                </thead>
                <tbody>
                  ${overviewRows || `<tr><td colspan="4" style="padding:10px; border:1px solid #e2e8f0;">Geen shiften ingepland voor deze maand.</td></tr>`}
                </tbody>
              </table>
              <p style="margin-top:25px; font-size:12px; color:#64748b; line-height:1.5; border-top:1px solid #e2e8f0; padding-top:15px;">
                U kunt het platform direct openen via de link onderaan deze e-mail.
              </p>
              <p style="font-weight:bold; margin-top:20px;">Met vriendelijke groet,<br/>Het Verband Ternat Planner</p>
            </div>
          `;

          await sendEmailNotification(user.email, `Maandplanning ${yearMonth}`, emailBody, {
            platformUrl: getPublicBaseUrl(req),
            ctaLabel: "Open de maandplanning",
          });
          emailsSentCount++;
          continue;
        }

        if (myAssignments.length === 0) {
          // Send an email stating there are no scheduled shifts for this month
          const emailBody = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155;">
              <h2 style="color: #2563eb; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Dienstregeling - ${yearMonth}</h2>
              <p>Beste <strong>${user.name}</strong>,</p>
              <p>De planning voor de maand <strong>${yearMonth}</strong> is zojuist gepubliceerd door de beheerder.</p>
              <p>U bent voor deze maand niet ingepland op actieve shifts.</p>
              <br/>
              <p style="font-weight: bold; margin-top: 20px;">Met vriendelijke groet,<br/>Het Verband Ternat Planner</p>
            </div>
          `;
          await sendEmailNotification(user.email, `Uw planning voor ${yearMonth}`, emailBody, {
            platformUrl: getPublicBaseUrl(req),
            ctaLabel: "Open uw planning",
          });
          emailsSentCount++;
          continue;
        }

        // Build list of shifts
        let shiftsHtml = `
          <table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 14px; margin-top: 15px;">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: left; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 10px; border: 1px solid #e2e8f0;">Datum</th>
                <th style="padding: 10px; border: 1px solid #e2e8f0;">Dienstnaam</th>
                <th style="padding: 10px; border: 1px solid #e2e8f0;">Starttijd</th>
                <th style="padding: 10px; border: 1px solid #e2e8f0;">Eindtijd</th>
                <th style="padding: 10px; border: 1px solid #e2e8f0;">Notities</th>
              </tr>
            </thead>
            <tbody>
        `;

        for (const shift of myAssignments) {
          const dateParts = shift.date.split("-");
          const formattedDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : shift.date;

          shiftsHtml += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">${formattedDate}</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0;"><span style="background-color: ${shift.color}20; color: ${shift.color}; padding: 3px 8px; border-radius: 4px; font-weight: bold;">${shift.name}</span></td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace;">${shift.startTime}</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace;">${shift.endTime}</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; color: #64748b; font-style: italic;">${shift.notes || "-"}</td>
            </tr>
          `;
        }

        shiftsHtml += `
            </tbody>
          </table>
        `;

        const emailBody = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155;">
            <h2 style="color: #2563eb; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Persoonlijke Dienstregeling - ${yearMonth}</h2>
            <p>Beste <strong>${user.name}</strong>,</p>
            <p>De planning voor de maand <strong>${yearMonth}</strong> is zojuist definitief vastgesteld en gepubliceerd door de beheerder.</p>
            <p>Hieronder vindt u uw persoonlijke dienstrooster voor deze maand:</p>
            
            ${shiftsHtml}
            
            <p style="margin-top: 25px; font-size: 12px; color: #64748b; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 15px;">
              U kunt tevens inloggen op het online beheerplatform om diensten te ruilen, verlofaanvragen in te dienen of uw wekelijkse beschikbaarheid aan te passen.
            </p>
            <p style="font-weight: bold; margin-top: 20px;">Met vriendelijke groet,<br/>Het Verband Ternat Planner</p>
          </div>
        `;

        await sendEmailNotification(user.email, `Uw persoonlijke dienstrooster voor ${yearMonth}`, emailBody, {
          platformUrl: getPublicBaseUrl(req),
          ctaLabel: "Open uw rooster",
        });
        emailsSentCount++;
      }

      await logAction(req.user.id, "SHIFT_SEND_MONTHLY_EMAIL", `Sent monthly schedule emails for ${yearMonth} to ${emailsSentCount} recipients`);
      return res.json({ success: true, count: emailsSentCount });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // SHIFT PRESETS ENDPOINTS
  // Admin-configurable quick-planning slots (replaces the old hardcoded
  // "Voormiddag"/"Namiddag" list). Any authenticated user can read them
  // (needed to render the planning UI); only admins can manage them.
  // ----------------------------------------------------

  app.get("/api/shift-presets", authenticate, async (req, res) => {
    try {
      const presets = await prisma.shiftPreset.findMany({
        orderBy: { order: "asc" },
      });
      return res.json(presets);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/shift-presets", authenticate, requireAdmin, async (req: any, res) => {
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
  });

  app.put("/api/shift-presets/:id", authenticate, requireAdmin, async (req: any, res) => {
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
  });

  app.delete("/api/shift-presets/:id", authenticate, requireAdmin, async (req: any, res) => {
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
  });

  // ----------------------------------------------------
  // SHIFT TEMPLATES & RECURRING PATTERNS
  // A ShiftTemplate stores a reusable shift definition plus a recurrence rule
  // (days of week + WEEKLY/BIWEEKLY cadence, within an optional date range).
  // /generate walks that rule across a requested window and materializes real
  // Shift rows, skipping dates that already have a shift from this template so
  // it is safe to re-run (e.g. to extend the window further into the future).
  // ----------------------------------------------------

  const MAX_TEMPLATE_GENERATE_DAYS = 366;

  const parseDaysOfWeek = (raw: string): number[] => {
    try {
      const parsed = JSON.parse(raw || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((d: any) => Number.isInteger(d) && d >= 0 && d <= 6);
    } catch {
      return [];
    }
  };

  app.get("/api/shift-templates", authenticate, async (req, res) => {
    try {
      const templates = await prisma.shiftTemplate.findMany({
        orderBy: { createdAt: "asc" },
      });
      return res.json(templates);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/shift-templates", authenticate, requireAdmin, async (req: any, res) => {
    const {
      name, startTime, endTime, color, requiredEmployees, notes,
      daysOfWeek, recurrencePattern, startDate, endDate, defaultEmployeeId,
    } = req.body;

    if (!name || !startTime || !endTime || !startDate) {
      return res.status(400).json({ error: "Naam, tijden en startdatum zijn verplicht." });
    }
    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
      return res.status(400).json({ error: "Selecteer minstens één dag van de week." });
    }
    const validDays = daysOfWeek.filter((d: any) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (validDays.length === 0) {
      return res.status(400).json({ error: "Ongeldige dagen van de week." });
    }

    try {
      const template = await prisma.shiftTemplate.create({
        data: {
          name,
          startTime,
          endTime,
          color: color || "#8b5cf6",
          requiredEmployees: requiredEmployees !== undefined ? Number(requiredEmployees) : 1,
          notes,
          daysOfWeek: JSON.stringify(validDays),
          recurrencePattern: recurrencePattern === "BIWEEKLY" ? "BIWEEKLY" : "WEEKLY",
          startDate,
          endDate: endDate || null,
          defaultEmployeeId: defaultEmployeeId || null,
        },
      });
      await logAction(req.user.id, "SHIFT_TEMPLATE_CREATE", `Created shift template: ${name}`);
      return res.status(201).json(template);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/shift-templates/:id", authenticate, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    const {
      name, startTime, endTime, color, requiredEmployees, notes,
      daysOfWeek, recurrencePattern, startDate, endDate, defaultEmployeeId, isActive,
    } = req.body;

    try {
      const existing = await prisma.shiftTemplate.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Sjabloon niet gevonden." });

      let daysOfWeekJson = existing.daysOfWeek;
      if (daysOfWeek !== undefined) {
        if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) {
          return res.status(400).json({ error: "Selecteer minstens één dag van de week." });
        }
        const validDays = daysOfWeek.filter((d: any) => Number.isInteger(d) && d >= 0 && d <= 6);
        if (validDays.length === 0) {
          return res.status(400).json({ error: "Ongeldige dagen van de week." });
        }
        daysOfWeekJson = JSON.stringify(validDays);
      }

      const updated = await prisma.shiftTemplate.update({
        where: { id },
        data: {
          name: name !== undefined ? name : existing.name,
          startTime: startTime !== undefined ? startTime : existing.startTime,
          endTime: endTime !== undefined ? endTime : existing.endTime,
          color: color !== undefined ? color : existing.color,
          requiredEmployees: requiredEmployees !== undefined ? Number(requiredEmployees) : existing.requiredEmployees,
          notes: notes !== undefined ? notes : existing.notes,
          daysOfWeek: daysOfWeekJson,
          recurrencePattern: recurrencePattern !== undefined
            ? (recurrencePattern === "BIWEEKLY" ? "BIWEEKLY" : "WEEKLY")
            : existing.recurrencePattern,
          startDate: startDate !== undefined ? startDate : existing.startDate,
          endDate: endDate !== undefined ? (endDate || null) : existing.endDate,
          defaultEmployeeId: defaultEmployeeId !== undefined ? (defaultEmployeeId || null) : existing.defaultEmployeeId,
          isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
        },
      });
      await logAction(req.user.id, "SHIFT_TEMPLATE_UPDATE", `Updated shift template ${id}`, existing, updated);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/shift-templates/:id", authenticate, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    const { deleteGeneratedShifts } = req.query;
    try {
      const existing = await prisma.shiftTemplate.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: "Sjabloon niet gevonden." });

      if (deleteGeneratedShifts === "true") {
        const generated = await prisma.shift.findMany({ where: { templateId: id } });
        const generatedIds = generated.map((s) => s.id);
        if (generatedIds.length > 0) {
          await prisma.shiftChangeRequest.deleteMany({ where: { assignment: { shiftId: { in: generatedIds } } } });
          await prisma.shiftAssignment.deleteMany({ where: { shiftId: { in: generatedIds } } });
          await prisma.swapRequest.deleteMany({
            where: { OR: [{ shiftId: { in: generatedIds } }, { targetShiftId: { in: generatedIds } }] },
          });
          await prisma.shift.deleteMany({ where: { id: { in: generatedIds } } });
        }
      } else {
        // Keep already-generated shifts as standalone shifts; just detach them from the template.
        await prisma.shift.updateMany({ where: { templateId: id }, data: { templateId: null } });
      }

      await prisma.shiftTemplate.delete({ where: { id } });
      await logAction(req.user.id, "SHIFT_TEMPLATE_DELETE", `Deleted shift template: ${existing.name} (removed generated shifts: ${deleteGeneratedShifts === "true"})`);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/shift-templates/:id/generate", authenticate, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    const { rangeStart, rangeEnd, assignEmployee } = req.body;
    if (!rangeStart || !rangeEnd) {
      return res.status(400).json({ error: "Geef een start- en einddatum op voor de generatie." });
    }

    try {
      const template = await prisma.shiftTemplate.findUnique({ where: { id } });
      if (!template) return res.status(404).json({ error: "Sjabloon niet gevonden." });
      if (!template.isActive) return res.status(400).json({ error: "Dit sjabloon is niet actief." });

      const genStart = new Date(rangeStart);
      const genEnd = new Date(rangeEnd);
      const dayCount = Math.round((genEnd.getTime() - genStart.getTime()) / (1000 * 60 * 60 * 24));
      if (dayCount < 0) {
        return res.status(400).json({ error: "Einddatum moet na de startdatum liggen." });
      }
      if (dayCount > MAX_TEMPLATE_GENERATE_DAYS) {
        return res.status(400).json({ error: `Periode mag maximaal ${MAX_TEMPLATE_GENERATE_DAYS} dagen zijn.` });
      }

      const templateStart = new Date(template.startDate);
      const templateEnd = template.endDate ? new Date(template.endDate) : null;
      const effectiveStart = genStart > templateStart ? genStart : templateStart;
      const effectiveEnd = templateEnd && templateEnd < genEnd ? templateEnd : genEnd;

      const activeDays = parseDaysOfWeek(template.daysOfWeek);
      const shouldUseAlternateWeek = template.recurrencePattern === "BIWEEKLY";

      // Existing shifts from this template in the window, to avoid re-creating duplicates on re-run.
      const existingGenerated = await prisma.shift.findMany({
        where: {
          templateId: id,
          date: { gte: rangeStart, lte: rangeEnd },
        },
        select: { date: true },
      });
      const existingDates = new Set(existingGenerated.map((s) => s.date));

      let totalCreated = 0;
      let skippedExisting = 0;
      let skippedConflicts = 0;
      const conflicts: { date: string }[] = [];

      const cursor = new Date(effectiveStart);
      let weekIndex = 0;
      let lastWeekStart: Date | null = null;

      while (cursor <= effectiveEnd) {
        const dow = cursor.getDay();

        // Track ISO-ish week boundaries (Monday start) to know odd/even week for BIWEEKLY.
        const weekStart = new Date(cursor);
        const mondayOffset = (weekStart.getDay() + 6) % 7;
        weekStart.setDate(weekStart.getDate() - mondayOffset);
        if (!lastWeekStart || weekStart.getTime() !== lastWeekStart.getTime()) {
          if (lastWeekStart) weekIndex++;
          lastWeekStart = weekStart;
        }

        const isEligibleWeek = !shouldUseAlternateWeek || weekIndex % 2 === 0;

        if (activeDays.includes(dow) && isEligibleWeek) {
          const dateStr = cursor.toISOString().split("T")[0];

          if (existingDates.has(dateStr)) {
            skippedExisting++;
          } else {
            let hasConflict = false;
            if (assignEmployee && template.defaultEmployeeId) {
              const conflict = await findBookingConflict(template.defaultEmployeeId, {
                date: dateStr,
                startTime: template.startTime,
                endTime: template.endTime,
              });
              if (conflict) hasConflict = true;
            }

            if (hasConflict) {
              skippedConflicts++;
              conflicts.push({ date: dateStr });
            } else {
              const newShift = await prisma.shift.create({
                data: {
                  name: template.name,
                  startTime: template.startTime,
                  endTime: template.endTime,
                  date: dateStr,
                  color: template.color,
                  requiredEmployees: template.requiredEmployees,
                  notes: template.notes,
                  templateId: template.id,
                  isRecurring: true,
                  recurrencePattern: template.recurrencePattern,
                },
              });
              totalCreated++;

              if (assignEmployee && template.defaultEmployeeId) {
                await prisma.shiftAssignment.create({
                  data: {
                    shiftId: newShift.id,
                    employeeId: template.defaultEmployeeId,
                    status: "ASSIGNED",
                  },
                });
              }
            }
          }
        }

        cursor.setDate(cursor.getDate() + 1);
      }

      await logAction(
        req.user.id,
        "SHIFT_TEMPLATE_GENERATE",
        `Generated ${totalCreated} shift(en) from template "${template.name}" for ${rangeStart} to ${rangeEnd} (skipped existing: ${skippedExisting}, skipped conflicts: ${skippedConflicts})`
      );
      return res.json({ success: true, count: totalCreated, skippedExisting, skippedConflicts, conflicts });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // LEAVE REQUESTS ENDPOINTS
  // ----------------------------------------------------

  app.get("/api/leave-requests", authenticate, async (req: any, res) => {
    try {
      const { all } = req.query;
      const whereClause: any = {};
      
      if (req.user.role === "EMPLOYEE" && all !== "true") {
        const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
        if (emp) {
          whereClause.employeeId = emp.id;
        }
      } else if (req.user.role === "EMPLOYEE" && all === "true") {
        // Employees requesting all leave requests can only see APPROVED leaves for privacy
        whereClause.status = "APPROVED";
      }

      const list = await prisma.leaveRequest.findMany({
        where: whereClause,
        include: {
          employee: {
            include: { user: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/leave-requests", authenticate, async (req: any, res) => {
    const { type, startDate, endDate, reason } = req.body;
    if (!type || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: "Missing leave details" });
    }

    try {
      const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
      if (!emp) {
        return res.status(400).json({ error: "Employee profile required to request leave" });
      }

      const request = await prisma.leaveRequest.create({
        data: {
          employeeId: emp.id,
          type,
          startDate,
          endDate,
          reason,
          status: "PENDING",
        },
      });

      // Notify Administrators
      const admins = await prisma.user.findMany({ where: { role: "ADMINISTRATOR" } });
      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            title: "Nieuwe verlofaanvraag",
            message: `${req.user.name} vroeg verlof aan (${type}) van ${startDate} tot ${endDate}`,
            link: "/admin/leave",
          },
        });

        // Send email notification to Admin
        try {
          await sendEmailNotification(
            admin.email,
            `Nieuwe verlofaanvraag van ${req.user.name}`,
            `<h3>Nieuwe verlofaanvraag ontvangen</h3>
             <p>Medewerker <strong>${req.user.name}</strong> heeft verlof aangevraagd:</p>
             <ul>
               <li><strong>Type:</strong> ${type}</li>
               <li><strong>Periode:</strong> ${startDate} tot ${endDate}</li>
               <li><strong>Reden:</strong> ${reason}</li>
             </ul>
             <p>U kunt deze aanvraag goedkeuren of weigeren in het beheercentrum.</p>
               <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
              { platformUrl: getPublicBaseUrl(req), ctaLabel: "Open beheercentrum" }
          );
        } catch (mailErr) {
          console.error("Failed to send leave admin mail:", mailErr);
        }
      }

      await logAction(req.user.id, "LEAVE_REQUEST", `Leave request created from ${startDate} to ${endDate}`);
      return res.status(201).json(request);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/leave-requests/:id/approve", authenticate, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    const { comment } = req.body;

    try {
      const leave = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { employee: true },
      });
      if (!leave) return res.status(404).json({ error: "Leave request not found" });


      // A beheerder cannot approve their own leave request
      if (leave.employee.userId === req.user.id) {
        return res.status(403).json({ error: "U kunt uw eigen verlofaanvraag niet goedkeuren. Vraag een andere beheerder om dit te doen." });
      }
      // Only one administrator needs to approve a leave request. If another
      // administrator already resolved it (approved, rejected or cancelled),
      // don't let a second approval silently overwrite that decision.
      if (leave.status !== "PENDING") {
        return res.status(409).json({
          error: `Deze verlofaanvraag is al ${leave.status === "APPROVED" ? "goedgekeurd" : leave.status === "REJECTED" ? "geweigerd" : "verwerkt"} door een andere beheerder.`,
        });
      }

      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          comment,
          approvalHistory: JSON.stringify([
            { action: "APPROVED", actor: req.user.name, date: new Date().toISOString(), comment },
          ]),
        },
      });

      // Notify the employee
      await prisma.notification.create({
        data: {
          userId: leave.employee.userId,
          title: "Verlofaanvraag goedgekeurd",
          message: `Uw verlofaanvraag van ${leave.startDate} tot ${leave.endDate} is goedgekeurd door ${req.user.name}.`,
          link: "/schedule",
        },
      });

      // Send email to Employee
      try {
        const empUser = await prisma.user.findUnique({ where: { id: leave.employee.userId } });
        if (empUser && empUser.email) {
          await sendEmailNotification(
            empUser.email,
            "Verlofaanvraag goedgekeurd - Het Verband Ternat",
            `<h3>Beste ${empUser.name},</h3>
             <p>Uw verlofaanvraag voor de periode <strong>${leave.startDate} tot ${leave.endDate}</strong> is <strong>GOEDGEKEURD</strong> door ${req.user.name}.</p>
             ${comment ? `<p><strong>Opmerking beheerder:</strong> ${comment}</p>` : ""}
             <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
            { platformUrl: getPublicBaseUrl(req), ctaLabel: "Bekijk uw planning" }
          );
        }
      } catch (mailErr) {
        console.error("Failed to send leave approve mail:", mailErr);
      }

      await logAction(req.user.id, "LEAVE_APPROVE", `Approved leave request ${id} for employee ${leave.employeeId}`);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/leave-requests/:id/reject", authenticate, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    const { comment } = req.body;

    try {
      const leave = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { employee: true },
      });
      if (!leave) return res.status(404).json({ error: "Leave request not found" });


      // A beheerder cannot reject their own leave request
      if (leave.employee.userId === req.user.id) {
        return res.status(403).json({ error: "U kunt uw eigen verlofaanvraag niet weigeren. Vraag een andere beheerder om dit te doen." });
      }
      // Only one administrator needs to decide on a leave request. If another
      // administrator already resolved it, don't silently overwrite that.
      if (leave.status !== "PENDING") {
        return res.status(409).json({
          error: `Deze verlofaanvraag is al ${leave.status === "APPROVED" ? "goedgekeurd" : leave.status === "REJECTED" ? "geweigerd" : "verwerkt"} door een andere beheerder.`,
        });
      }

      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          comment,
          approvalHistory: JSON.stringify([
            { action: "REJECTED", actor: req.user.name, date: new Date().toISOString(), comment },
          ]),
        },
      });

      // Notify Employee
      await prisma.notification.create({
        data: {
          userId: leave.employee.userId,
          title: "Verlofaanvraag geweigerd",
          message: `Uw verlofaanvraag van ${leave.startDate} tot ${leave.endDate} is geweigerd door ${req.user.name}.`,
          link: "/schedule",
        },
      });

      // Send email to Employee
      try {
        const empUser = await prisma.user.findUnique({ where: { id: leave.employee.userId } });
        if (empUser && empUser.email) {
          await sendEmailNotification(
            empUser.email,
            "Verlofaanvraag geweigerd - Het Verband Ternat",
            `<h3>Beste ${empUser.name},</h3>
             <p>Uw verlofaanvraag voor de periode <strong>${leave.startDate} tot ${leave.endDate}</strong> is helaas <strong>GEWEIGERD</strong> door ${req.user.name}.</p>
             ${comment ? `<p><strong>Opmerking beheerder:</strong> ${comment}</p>` : ""}
             <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
            { platformUrl: getPublicBaseUrl(req), ctaLabel: "Bekijk uw planning" }
          );
        }
      } catch (mailErr) {
        console.error("Failed to send leave reject mail:", mailErr);
      }

      await logAction(req.user.id, "LEAVE_REJECT", `Rejected leave request ${id}`);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/leave-requests/:id/cancel", authenticate, async (req: any, res) => {
    const { id } = req.params;

    try {
      const leave = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { employee: true },
      });
      if (!leave) return res.status(404).json({ error: "Leave request not found" });

      const isOwner = leave.employee.userId === req.user.id;
      const isAdmin = req.user.role === "ADMINISTRATOR";
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "U kunt enkel uw eigen verlofaanvragen annuleren" });
      }

      if (leave.status === "CANCELLED") {
        return res.status(400).json({ error: "Deze verlofaanvraag is al geannuleerd" });
      }
      if (leave.status === "REJECTED") {
        return res.status(400).json({ error: "Een geweigerde verlofaanvraag kan niet geannuleerd worden" });
      }

      let existingHistory: any[] = [];
      try {
        existingHistory = JSON.parse(leave.approvalHistory || "[]");
      } catch {
        existingHistory = [];
      }

      const updated = await prisma.leaveRequest.update({
        where: { id },
        data: {
          status: "CANCELLED",
          approvalHistory: JSON.stringify([
            ...existingHistory,
            { action: "CANCELLED", actor: req.user.name, date: new Date().toISOString() },
          ]),
        },
      });

      // Notify the other party
      if (isOwner) {
        // Employee cancelled their own request -> notify administrators
        const admins = await prisma.user.findMany({ where: { role: "ADMINISTRATOR" } });
        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              title: "Verlofaanvraag geannuleerd",
              message: `${req.user.name} heeft de verlofaanvraag van ${leave.startDate} tot ${leave.endDate} geannuleerd.`,
              link: "/admin/leave",
            },
          });
        }
      } else {
        // Admin cancelled the employee's request -> notify the employee
        await prisma.notification.create({
          data: {
            userId: leave.employee.userId,
            title: "Verlofaanvraag geannuleerd",
            message: `Uw verlofaanvraag van ${leave.startDate} tot ${leave.endDate} is geannuleerd door ${req.user.name}.`,
            link: "/schedule",
          },
        });

        // Send email to Employee
        try {
          const empUser = await prisma.user.findUnique({ where: { id: leave.employee.userId } });
          if (empUser && empUser.email) {
            await sendEmailNotification(
              empUser.email,
              "Verlofaanvraag geannuleerd - Het Verband Ternat",
              `<h3>Beste ${empUser.name},</h3>
               <p>Uw verlofaanvraag voor de periode <strong>${leave.startDate} tot ${leave.endDate}</strong> is geannuleerd door ${req.user.name}.</p>
               <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
              { platformUrl: getPublicBaseUrl(req), ctaLabel: "Bekijk uw planning" }
            );
          }
        } catch (mailErr) {
          console.error("Failed to send leave cancel mail:", mailErr);
        }
      }

      await logAction(req.user.id, "LEAVE_CANCEL", `Cancelled leave request ${id}`);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // CHANGE REQUESTS ENDPOINTS
  // ----------------------------------------------------

  app.get("/api/change-requests", authenticate, async (req: any, res) => {
    try {
      const whereClause: any = {};
      if (req.user.role === "EMPLOYEE") {
        const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
        if (emp) {
          whereClause.employeeId = emp.id;
        }
      }

      const list = await prisma.shiftChangeRequest.findMany({
        where: whereClause,
        include: {
          assignment: {
            include: { shift: true },
          },
          employee: {
            include: { user: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/change-requests", authenticate, async (req: any, res) => {
    const { assignmentId, type, requestedStartTime, requestedEndTime, reason, comment } = req.body;
    if (!assignmentId || !type || !reason) {
      return res.status(400).json({ error: "Missing required details" });
    }

    try {
      const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
      if (!emp) return res.status(400).json({ error: "Employee profile required" });

      const request = await prisma.shiftChangeRequest.create({
        data: {
          assignmentId,
          employeeId: emp.id,
          type,
          requestedStartTime,
          requestedEndTime,
          reason,
          comment,
          status: "PENDING",
        },
      });

      // Notify Administrators
      const admins = await prisma.user.findMany({ where: { role: "ADMINISTRATOR" } });
      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            title: "Nieuwe dienstwisselaanvraag",
            message: `${req.user.name} vroeg een dienstwissel aan (${type})`,
            link: "/admin/requests",
          },
        });

        // Send email to Admin
        try {
          await sendEmailNotification(
            admin.email,
            `Nieuwe dienstwissel aanvraag van ${req.user.name}`,
            `<h3>Nieuwe dienstwissel aanvraag ontvangen</h3>
             <p>Medewerker <strong>${req.user.name}</strong> heeft een dienstwijziging aangevraagd:</p>
             <ul>
               <li><strong>Type:</strong> ${type}</li>
               <li><strong>Reden:</strong> ${reason}</li>
               ${requestedStartTime ? `<li><strong>Gewenste Tijd:</strong> ${requestedStartTime} - ${requestedEndTime}</li>` : ""}
               ${comment ? `<li><strong>Toelichting:</strong> ${comment}</li>` : ""}
             </ul>
             <p>Beoordeel deze aanvraag in het beheercentrum.</p>
             <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`
          );
        } catch (mailErr) {
          console.error("Failed to send shift change admin mail:", mailErr);
        }
      }

      await logAction(req.user.id, "SHIFT_CHANGE_REQUEST_CREATE", `Submitted shift change request: ${type}`);
      return res.status(201).json(request);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/change-requests/:id/resolve", authenticate, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    const { status, comment } = req.body; // status must be "APPROVED" or "REJECTED"

    if (status !== "APPROVED" && status !== "REJECTED") {
      return res.status(400).json({ error: "Status must be APPROVED or REJECTED" });
    }

    try {
      const reqDetails = await prisma.shiftChangeRequest.findUnique({
        where: { id },
        include: {
          assignment: {
            include: { shift: true },
          },
          employee: true,
        },
      });

      if (!reqDetails) return res.status(404).json({ error: "Request not found" });

      // If approving a time change, make sure the new time doesn't create a
      // double-booking against another shift this employee already has.
      if (status === "APPROVED" && reqDetails.type === "TIME_CHANGE" && reqDetails.requestedStartTime && reqDetails.requestedEndTime) {
        const conflict = await findBookingConflict(
          reqDetails.employeeId,
          {
            date: reqDetails.assignment.shift.date,
            startTime: reqDetails.requestedStartTime,
            endTime: reqDetails.requestedEndTime,
          },
          [reqDetails.assignment.shiftId]
        );
        if (conflict) {
          return res.status(409).json({ error: conflictMessage(conflict) });
        }
      }

      const updated = await prisma.shiftChangeRequest.update({
        where: { id },
        data: {
          status,
          comment,
          approvalHistory: JSON.stringify([
            { action: status, actor: req.user.name, date: new Date().toISOString(), comment },
          ]),
        },
      });

      // If approved and type is TIME_CHANGE, we can update the shift or keep as metadata
      if (status === "APPROVED" && reqDetails.type === "TIME_CHANGE" && reqDetails.requestedStartTime && reqDetails.requestedEndTime) {
        // Update shift time
        await prisma.shift.update({
          where: { id: reqDetails.assignment.shiftId },
          data: {
            startTime: reqDetails.requestedStartTime,
            endTime: reqDetails.requestedEndTime,
          },
        });
      } else if (status === "APPROVED" && reqDetails.type === "ABSENCE") {
        // Remove assignment
        await prisma.shiftAssignment.delete({ where: { id: reqDetails.assignmentId } });
      }

      // Notify employee
      await prisma.notification.create({
        data: {
          userId: reqDetails.employee.userId,
          title: `Dienstwissel ${status === "APPROVED" ? "goedgekeurd" : "geweigerd"}`,
          message: `Uw dienstwisselaanvraag is ${status === "APPROVED" ? "goedgekeurd" : "geweigerd"} door ${req.user.name}.`,
          link: "/schedule",
        },
      });

      // Send email to Employee
      try {
        const empUser = await prisma.user.findUnique({ where: { id: reqDetails.employee.userId } });
        if (empUser && empUser.email) {
          const vertaaldStatus = status === "APPROVED" ? "GOEDGEKEURD" : "GEWEIGERD";
          await sendEmailNotification(
            empUser.email,
            `Dienstwissel aanvraag ${vertaaldStatus.toLowerCase()} - Het Verband Ternat`,
            `<h3>Beste ${empUser.name},</h3>
             <p>Uw aanvraag voor een dienstwijziging is <strong>${vertaaldStatus}</strong> door beheerder ${req.user.name}.</p>
             ${comment ? `<p><strong>Opmerking beheerder:</strong> ${comment}</p>` : ""}
             <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
            { platformUrl: getPublicBaseUrl(req), ctaLabel: "Bekijk uw planning" }
          );
        }
      } catch (mailErr) {
        console.error("Failed to send shift change resolve mail:", mailErr);
      }

      await logAction(req.user.id, "SHIFT_CHANGE_REQUEST_RESOLVE", `Resolved shift change request ${id} as ${status}`);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // SWAP REQUESTS ENDPOINTS
  // ----------------------------------------------------

  app.get("/api/swaps", authenticate, async (req: any, res) => {
    try {
      let whereClause: any = {};
      if (req.user.role === "EMPLOYEE") {
        const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
        if (emp) {
          whereClause = {
            OR: [
              { requesterId: emp.id },
              { targetId: emp.id },
            ],
          };
        }
      }

      const list = await prisma.swapRequest.findMany({
        where: whereClause,
        include: {
          shift: true,
          targetShift: true,
          requester: { include: { user: true } },
          target: { include: { user: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/swaps", authenticate, async (req: any, res) => {
    const { shiftId, targetId, targetShiftId, reason, comment } = req.body;
    if (!shiftId || !targetId || !reason) {
      return res.status(400).json({ error: "Missing shift, target colleague, or reason" });
    }

    try {
      const requesterEmp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
      if (!requesterEmp) return res.status(400).json({ error: "Employee profile required" });

      if (requesterEmp.id === targetId) {
        return res.status(400).json({ error: "Cannot swap with yourself" });
      }

      const targetEmployee = await prisma.employee.findUnique({
        where: { id: targetId },
        include: { user: true },
      });

      if (!targetEmployee) {
        return res.status(404).json({ error: "Target colleague not found" });
      }

      const requesterShift = await prisma.shift.findUnique({ where: { id: shiftId } });
      if (!requesterShift) {
        return res.status(404).json({ error: "Shift not found" });
      }

      const existingPending = await prisma.swapRequest.findFirst({
        where: {
          shiftId,
          requesterId: requesterEmp.id,
          targetId,
          status: { in: ["PENDING_TARGET", "ACCEPTED_TARGET"] },
        },
      });

      if (existingPending) {
        return res.status(400).json({ error: "An active swap request already exists for this colleague and shift" });
      }

      // The colleague being asked to take over `requesterShift` must not
      // already be working at that moment. Their own shift being offered
      // back (targetShiftId, if any) is excluded since it's the one being
      // vacated as part of this very swap.
      const targetConflict = await findBookingConflict(
        targetId,
        requesterShift,
        targetShiftId ? [targetShiftId] : []
      );
      if (targetConflict) {
        return res.status(409).json({
          error: `Kan geen ruil voorstellen: ${targetEmployee.user.name} is ${describeConflict(targetConflict)}.`,
        });
      }

      const swap = await prisma.swapRequest.create({
        data: {
          shiftId,
          requesterId: requesterEmp.id,
          targetId,
          targetShiftId: targetShiftId || null,
          status: "PENDING_TARGET",
          reason,
          comment,
        },
        include: {
          shift: true,
          requester: { include: { user: true } },
          target: { include: { user: true } },
        },
      });

      // Notify Target Colleague
      await prisma.notification.create({
        data: {
          userId: swap.target.userId,
          title: "Binnenkomend ruilvoorstel",
          message: `${req.user.name} stelt voor om de shift ${swap.shift.name} op ${swap.shift.date} met u te ruilen.`,
          link: "/swaps",
        },
      });

      // Send email to Target Colleague
      try {
        if (swap.target.user.email) {
          const baseUrl = getPublicBaseUrl(req);
          const acceptToken = generateEmailActionToken({ swapId: swap.id, targetUserId: swap.target.userId, response: "ACCEPT" });
          const declineToken = generateEmailActionToken({ swapId: swap.id, targetUserId: swap.target.userId, response: "DECLINE" });
          await sendEmailNotification(
            swap.target.user.email,
            `Ruilvoorstel: ${swap.shift.name} op ${swap.shift.date}`,
            `<h3>Beste ${swap.target.user.name},</h3>
             <p>Uw collega <strong>${req.user.name}</strong> vraagt om de volgende shift te ruilen:</p>
             ${buildSwapDetailsHtml({ ...swap, reason })}
             <p><strong>Actie in de app:</strong> Als u akkoord gaat, klikt u op de knop hieronder. U kunt ook weigeren via de andere knop.</p>
             ${buildSwapActionButtons(baseUrl, `/api/swaps/email-action?token=${encodeURIComponent(acceptToken)}`, `/api/swaps/email-action?token=${encodeURIComponent(declineToken)}`)}
             <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
            { platformUrl: baseUrl, ctaLabel: "Open ruilvoorstel" }
          );
        }
      } catch (mailErr) {
        console.error("Failed to send swap proposal mail:", mailErr);
      }

      await logAction(req.user.id, "SWAP_REQUEST_CREATE", `Proposed shift swap with colleague ${targetId}`);
      return res.status(201).json(swap);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/swaps/:id/respond", authenticate, async (req: any, res) => {
    const { id } = req.params;
    const { response, comment } = req.body; // response must be "ACCEPT" or "DECLINE"

    if (response !== "ACCEPT" && response !== "DECLINE") {
      return res.status(400).json({ error: "Response must be ACCEPT or DECLINE" });
    }

    try {
      const swap = await prisma.swapRequest.findUnique({
        where: { id },
        include: {
          shift: true,
          requester: { include: { user: true } },
          target: true,
        },
      });

      if (!swap) return res.status(404).json({ error: "Swap request not found" });

      if (swap.target.userId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden: You are not the target of this swap" });
      }

      // Re-check for a scheduling conflict at accept time: the colleague may
      // have been assigned a new shift after the swap was proposed, so the
      // check at proposal time is not sufficient on its own.
      if (response === "ACCEPT") {
        const conflict = await findBookingConflict(
          swap.targetId,
          swap.shift,
          swap.targetShiftId ? [swap.targetShiftId] : []
        );
        if (conflict) {
          return res.status(409).json({
            error: `U kunt deze ruil niet accepteren: u bent ${describeConflict(conflict)}.`,
          });
        }
      }

      const nextStatus = response === "ACCEPT" ? "ACCEPTED_TARGET" : "REJECTED_TARGET";

      const updated = await prisma.swapRequest.update({
        where: { id },
        data: {
          status: nextStatus,
          comment: comment || swap.comment,
        },
      });

      // Notify Requester
      await prisma.notification.create({
        data: {
          userId: swap.requester.userId,
              title: "Collega reageerde op ruilvoorstel",
              message: `${req.user.name} heeft uw ruilvoorstel voor ${swap.shift.name} op ${swap.shift.date} ${response === "ACCEPT" ? "geaccepteerd" : "geweigerd"}.`,
          link: "/swaps",
        },
      });

      // Send email to Requester
      try {
        if (swap.requester.user.email) {
          const vertaaldResponse = response === "ACCEPT" ? "geaccepteerd" : "geweigerd";
          await sendEmailNotification(
            swap.requester.user.email,
            `Collega heeft gereageerd op uw ruilvoorstel`,
            `<h3>Beste ${swap.requester.user.name},</h3>
             <p>Uw collega <strong>${req.user.name}</strong> heeft uw voorstel om de onderstaande shift te ruilen <strong>${vertaaldResponse}</strong>:</p>
             ${buildSwapDetailsHtml(swap)}
             ${response === "ACCEPT" ? "<p>De aanvraag ligt nu bij de beheerder voor definitieve goedkeuring.</p>" : ""}
             <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
            { platformUrl: getPublicBaseUrl(req), ctaLabel: "Open uw ruilverzoeken" }
          );
        }
      } catch (mailErr) {
        console.error("Failed to send swap response mail:", mailErr);
      }

      if (response === "ACCEPT") {
        // Notify Admins for final approval
        const admins = await prisma.user.findMany({ where: { role: "ADMINISTRATOR" } });
        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
                title: "Ruilvoorstel klaar voor goedkeuring",
                message: `Het ruilvoorstel tussen ${swap.requester.user.name} en ${req.user.name} is geaccepteerd en wacht op beheerdergoedkeuring.`,
              link: "/admin/swaps",
            },
          });

          // Send email to Admin
          try {
            const baseUrl = getPublicBaseUrl(req);
            const approveToken = generateAdminEmailActionToken({ swapId: swap.id, adminUserId: admin.id, response: "APPROVED_ADMIN" });
            const rejectToken = generateAdminEmailActionToken({ swapId: swap.id, adminUserId: admin.id, response: "REJECTED_ADMIN" });
            await sendEmailNotification(
              admin.email,
              `Dienstruil gereed voor goedkeuring`,
              `<h3>Dienstruil wacht op goedkeuring</h3>
               <p>De ruildienst tussen <strong>${swap.requester.user.name}</strong> en <strong>${req.user.name}</strong> is onderling geaccepteerd en vereist uw goedkeuring als beheerder.</p>
               ${buildSwapDetailsHtml(swap)}
               <p><strong>Actie in de app:</strong> U kunt deze ruil direct goedkeuren of weigeren via onderstaande knoppen.</p>
               ${buildSwapActionButtons(baseUrl, `/api/swaps/email-admin-action?token=${encodeURIComponent(approveToken)}`, `/api/swaps/email-admin-action?token=${encodeURIComponent(rejectToken)}`)}
               <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
              { platformUrl: baseUrl, ctaLabel: "Open beheercentrum" }
            );
          } catch (mailErr) {
            console.error("Failed to send swap admin notification mail:", mailErr);
          }
        }
      }

      await logAction(req.user.id, "SWAP_REQUEST_RESPONSE", `Responded ${response} to swap request ${id}`);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/swaps/:id/approve", authenticate, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    const { status } = req.body; // "APPROVED_ADMIN" or "REJECTED_ADMIN"

    if (status !== "APPROVED_ADMIN" && status !== "REJECTED_ADMIN") {
      return res.status(400).json({ error: "Status must be APPROVED_ADMIN or REJECTED_ADMIN" });
    }

    try {
      const swap = await prisma.swapRequest.findUnique({
        where: { id },
        include: {
          shift: true,
          targetShift: true,
          requester: { include: { user: true } },
          target: { include: { user: true } },
        },
      });

      if (!swap) return res.status(404).json({ error: "Swap request not found" });

      // Only one administrator needs to approve or reject a swap. If another
      // administrator already resolved it, don't let a second admin silently
      // overwrite that decision (or double-apply the shift swap).
      if (swap.status === "APPROVED_ADMIN" || swap.status === "REJECTED_ADMIN") {
        return res.status(409).json({
          error: `Deze ruil is al ${swap.status === "APPROVED_ADMIN" ? "goedgekeurd" : "geweigerd"} door een andere beheerder.`,
        });
      }

      // A beheerder cannot approve or reject their own swap request
      if (swap.requester.userId === req.user.id || swap.target.userId === req.user.id) {
        return res.status(403).json({ error: "U kunt een ruilaanvraag waarbij u betrokken bent niet zelf goedkeuren of weigeren. Vraag een andere beheerder om dit te doen." });
      }

      if (status === "APPROVED_ADMIN" && swap.status !== "ACCEPTED_TARGET") {
        return res.status(400).json({ error: "Swap can only be approved after the colleague has accepted it" });
      }

      if (status === "APPROVED_ADMIN") {
        // Check both parties for conflicts BEFORE making any changes, excluding
        // the shifts involved in this swap itself (they're being vacated as
        // part of this very operation, so they shouldn't count as a conflict).
        const involvedShiftIds = [swap.shiftId, ...(swap.targetShiftId ? [swap.targetShiftId] : [])];

        const targetConflict = await findBookingConflict(swap.targetId, swap.shift, involvedShiftIds);
        if (targetConflict) {
          return res.status(409).json({
            error: `Ruil kan niet worden goedgekeurd: ${swap.target.user.name} is ${describeConflict(targetConflict)}.`,
          });
        }

        if (swap.targetShiftId && swap.targetShift) {
          const requesterConflict = await findBookingConflict(swap.requesterId, swap.targetShift, involvedShiftIds);
          if (requesterConflict) {
            return res.status(409).json({
              error: `Ruil kan niet worden goedgekeurd: ${swap.requester.user.name} is ${describeConflict(requesterConflict)}.`,
            });
          }
        }
      }

      const updated = await prisma.swapRequest.update({
        where: { id },
        data: { status },
      });

      if (status === "APPROVED_ADMIN") {
        // Swap Assignments in Database!
        // 1. Remove requester from requester shift and assign target
        await prisma.shiftAssignment.deleteMany({
          where: { shiftId: swap.shiftId, employeeId: swap.requesterId },
        });
        await prisma.shiftAssignment.create({
          data: { shiftId: swap.shiftId, employeeId: swap.targetId, status: "ASSIGNED" },
        });

        // 2. If there's a target shift, swap that too
        if (swap.targetShiftId) {
          await prisma.shiftAssignment.deleteMany({
            where: { shiftId: swap.targetShiftId, employeeId: swap.targetId },
          });
          await prisma.shiftAssignment.create({
            data: { shiftId: swap.targetShiftId, employeeId: swap.requesterId, status: "ASSIGNED" },
          });
        }
      }

      // Notify both participants
      await prisma.notification.create({
        data: {
          userId: swap.requester.userId,
          title: `Ruilvoorstel ${status === "APPROVED_ADMIN" ? "goedgekeurd" : "geweigerd"}`,
          message: `Uw ruilvoorstel is ${status === "APPROVED_ADMIN" ? "goedgekeurd" : "geweigerd"} door beheerder ${req.user.name}.`,
          link: "/schedule",
        },
      });

      await prisma.notification.create({
        data: {
          userId: swap.target.userId,
          title: `Ruilvoorstel ${status === "APPROVED_ADMIN" ? "goedgekeurd" : "geweigerd"}`,
          message: `Het ruilvoorstel met ${swap.requester.user.name} is ${status === "APPROVED_ADMIN" ? "goedgekeurd" : "geweigerd"} door beheerder ${req.user.name}.`,
          link: "/schedule",
        },
      });

      // Send email to Requester & Target
      try {
        const vertaaldStatus = status === "APPROVED_ADMIN" ? "GOEDGEKEURD" : "GEWEIGERD";
        const emailBody = `<h3>Beste collega,</h3>
          <p>De ruildienst tussen <strong>${swap.requester.user.name}</strong> en <strong>${swap.target.user.name}</strong> is <strong>${vertaaldStatus}</strong> door beheerder ${req.user.name}.</p>
          ${buildSwapDetailsHtml(swap)}
          <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`;

        if (swap.requester.user.email) {
          await sendEmailNotification(swap.requester.user.email, `Dienstruil ${vertaaldStatus.toLowerCase()} door beheerder`, emailBody, {
            platformUrl: getPublicBaseUrl(req),
            ctaLabel: "Open uw planning",
          });
        }
        if (swap.target.user.email) {
          await sendEmailNotification(swap.target.user.email, `Dienstruil ${vertaaldStatus.toLowerCase()} door beheerder`, emailBody, {
            platformUrl: getPublicBaseUrl(req),
            ctaLabel: "Open uw planning",
          });
        }
      } catch (mailErr) {
        console.error("Failed to send swap resolve emails:", mailErr);
      }

      await logAction(req.user.id, "SWAP_REQUEST_ADMIN_RESOLVE", `Admin resolved swap request ${id} as ${status}`);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/swaps/email-action", async (req, res) => {
    const token = String(req.query.token || "");
    const payload = verifyEmailActionToken(token);

    if (!payload) {
      return res.status(400).send("Deze link is ongeldig of verlopen.");
    }

    try {
      const swap = await prisma.swapRequest.findUnique({
        where: { id: payload.swapId },
        include: {
          shift: true,
          targetShift: true,
          requester: { include: { user: true } },
          target: { include: { user: true } },
        },
      });

      if (!swap) {
        return res.status(404).send("Ruilverzoek niet gevonden.");
      }

      if (swap.target.userId !== payload.targetUserId) {
        return res.status(403).send("Deze link hoort niet bij uw account.");
      }

      if (payload.response === "ACCEPT") {
        if (swap.status === "PENDING_TARGET") {
          await prisma.swapRequest.update({ where: { id: swap.id }, data: { status: "ACCEPTED_TARGET" } });

          await prisma.notification.create({
            data: {
              userId: swap.requester.userId,
              title: "Collega reageerde op ruilvoorstel",
              message: `${swap.target.user.name} heeft uw ruilvoorstel voor ${swap.shift.name} op ${swap.shift.date} via de e-mail geaccepteerd.`,
              link: "/swaps",
            },
          });

          try {
            if (swap.requester.user.email) {
              await sendEmailNotification(
                swap.requester.user.email,
                `Collega heeft uw ruilvoorstel geaccepteerd`,
                `<h3>Beste ${swap.requester.user.name},</h3>
                 <p>Uw collega <strong>${swap.target.user.name}</strong> heeft uw ruilvoorstel via de e-mail geaccepteerd.</p>
                 ${buildSwapDetailsHtml(swap)}
                 <p>De aanvraag ligt nu bij de beheerder voor definitieve goedkeuring.</p>
                 <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
                { platformUrl: getPublicBaseUrl(req), ctaLabel: "Open uw ruilverzoeken" }
              );
            }
          } catch (mailErr) {
            console.error("Failed to send requester email after email accept:", mailErr);
          }

          const admins = await prisma.user.findMany({ where: { role: "ADMINISTRATOR" } });
          for (const admin of admins) {
            await prisma.notification.create({
              data: {
                userId: admin.id,
                title: "Ruilvoorstel klaar voor goedkeuring",
                message: `Het ruilvoorstel tussen ${swap.requester.user.name} en ${swap.target.user.name} is via de e-mail geaccepteerd en wacht op beheerdergoedkeuring.`,
                link: "/admin/swaps",
              },
            });
          }
        }

        return res.send("Bedankt. De ruilaanvraag is geaccepteerd en wacht nu op beheerdergoedkeuring.");
      }

      if (payload.response === "DECLINE") {
        if (swap.status === "PENDING_TARGET") {
          await prisma.swapRequest.update({ where: { id: swap.id }, data: { status: "REJECTED_TARGET" } });

          await prisma.notification.create({
            data: {
              userId: swap.requester.userId,
              title: "Collega reageerde op ruilvoorstel",
              message: `${swap.target.user.name} heeft uw ruilvoorstel voor ${swap.shift.name} op ${swap.shift.date} via de e-mail geweigerd.`,
              link: "/swaps",
            },
          });

          try {
            if (swap.requester.user.email) {
              await sendEmailNotification(
                swap.requester.user.email,
                `Collega heeft uw ruilvoorstel geweigerd`,
                `<h3>Beste ${swap.requester.user.name},</h3>
                 <p>Uw collega <strong>${swap.target.user.name}</strong> heeft uw ruilvoorstel via de e-mail geweigerd.</p>
                 ${buildSwapDetailsHtml(swap)}
                 <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
                { platformUrl: getPublicBaseUrl(req), ctaLabel: "Open uw ruilverzoeken" }
              );
            }
          } catch (mailErr) {
            console.error("Failed to send requester email after email decline:", mailErr);
          }
        }
        return res.send("De ruilaanvraag is geweigerd.");
      }

      return res.status(400).send("Ongeldige actie.");
    } catch (error: any) {
      return res.status(500).send(error.message);
    }
  });

  app.get("/api/swaps/email-admin-action", async (req, res) => {
    const token = String(req.query.token || "");
    const payload = verifyAdminEmailActionToken(token);

    if (!payload) {
      return res.status(400).send("Deze link is ongeldig of verlopen.");
    }

    try {
      const swap = await prisma.swapRequest.findUnique({
        where: { id: payload.swapId },
        include: {
          shift: true,
          targetShift: true,
          requester: { include: { user: true } },
          target: { include: { user: true } },
        },
      });

      if (!swap) {
        return res.status(404).send("Ruilverzoek niet gevonden.");
      }

      const admin = await prisma.user.findUnique({ where: { id: payload.adminUserId } });
      if (!admin || admin.role !== "ADMINISTRATOR") {
        return res.status(403).send("Deze link hoort niet bij een beheerder.");
      }

      // Only one administrator needs to approve or reject a swap. If another
      // administrator already resolved it via the app or another email link,
      // don't let this click silently overwrite that decision.
      if (swap.status === "APPROVED_ADMIN" || swap.status === "REJECTED_ADMIN") {
        return res.status(409).send(
          `Deze ruil is al ${swap.status === "APPROVED_ADMIN" ? "goedgekeurd" : "geweigerd"} door een andere beheerder.`
        );
      }

      if (payload.response === "APPROVED_ADMIN" && swap.status !== "ACCEPTED_TARGET") {
        return res.status(400).send("Deze ruil kan pas worden goedgekeurd nadat de collega akkoord heeft gegeven.");
      }

      if (payload.response === "APPROVED_ADMIN") {
        const involvedShiftIds = [swap.shiftId, ...(swap.targetShiftId ? [swap.targetShiftId] : [])];

        const targetConflict = await findBookingConflict(swap.targetId, swap.shift, involvedShiftIds);
        if (targetConflict) {
          return res.status(409).send(
            `Ruil kan niet worden goedgekeurd: ${swap.target.user.name} is ${describeConflict(targetConflict)}.`
          );
        }

        if (swap.targetShiftId && swap.targetShift) {
          const requesterConflict = await findBookingConflict(swap.requesterId, swap.targetShift, involvedShiftIds);
          if (requesterConflict) {
            return res.status(409).send(
              `Ruil kan niet worden goedgekeurd: ${swap.requester.user.name} is ${describeConflict(requesterConflict)}.`
            );
          }
        }
      }

      const updated = await prisma.swapRequest.update({
        where: { id: swap.id },
        data: { status: payload.response },
      });

      if (payload.response === "APPROVED_ADMIN") {
        await prisma.shiftAssignment.deleteMany({ where: { shiftId: swap.shiftId, employeeId: swap.requesterId } });
        await prisma.shiftAssignment.create({ data: { shiftId: swap.shiftId, employeeId: swap.targetId, status: "ASSIGNED" } });

        if (swap.targetShiftId) {
          await prisma.shiftAssignment.deleteMany({ where: { shiftId: swap.targetShiftId, employeeId: swap.targetId } });
          await prisma.shiftAssignment.create({ data: { shiftId: swap.targetShiftId, employeeId: swap.requesterId, status: "ASSIGNED" } });
        }
      }

      const responseLabel = payload.response === "APPROVED_ADMIN" ? "goedgekeurd" : "geweigerd";
      await prisma.notification.create({
        data: {
          userId: swap.requester.userId,
          title: `Ruilvoorstel ${payload.response === "APPROVED_ADMIN" ? "goedgekeurd" : "geweigerd"}`,
          message: `Uw ruilvoorstel is door beheerder ${admin.name} ${responseLabel}.`,
          link: "/swaps",
        },
      });

      await prisma.notification.create({
        data: {
          userId: swap.target.userId,
          title: `Ruilvoorstel ${payload.response === "APPROVED_ADMIN" ? "goedgekeurd" : "geweigerd"}`,
          message: `De ruil met ${swap.requester.user.name} is door beheerder ${admin.name} ${responseLabel}.`,
          link: "/swaps",
        },
      });

      return res.send(payload.response === "APPROVED_ADMIN" ? "De ruil is goedgekeurd." : "De ruil is geweigerd.");
    } catch (error: any) {
      return res.status(500).send(error.message);
    }
  });

  // ----------------------------------------------------
  // AVAILABILITY ENDPOINTS
  // ----------------------------------------------------

  // Administrators only: fetch every employee's submitted availability in one
  // call, so the shift planner can warn when assigning someone who indicated
  // they're not available at that time.
  app.get("/api/availabilities", authenticate, requireAdmin, async (req, res) => {
    try {
      const list = await prisma.availability.findMany();
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/availabilities/:employeeId", authenticate, async (req, res) => {
    const { employeeId } = req.params;
    try {
      const list = await prisma.availability.findMany({
        where: { employeeId },
      });
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/availabilities", authenticate, async (req: any, res) => {
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
  });

  // ----------------------------------------------------
  // ANNOUNCEMENTS ENDPOINTS
  // ----------------------------------------------------

  app.get("/api/announcements", authenticate, async (req, res) => {
    try {
      const list = await prisma.announcement.findMany({
        where: { isArchived: false },
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/announcements", authenticate, requireAdmin, async (req: any, res) => {
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
  });

  app.put("/api/announcements/:id/archive", authenticate, requireAdmin, async (req: any, res) => {
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
  });

  app.delete("/api/announcements/:id", authenticate, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    try {
      await prisma.announcement.delete({ where: { id } });
      await logAction(req.user.id, "ANNOUNCEMENT_DELETE", `Deleted announcement ${id}`);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // NOTIFICATIONS ENDPOINTS
  // ----------------------------------------------------

  app.get("/api/notifications", authenticate, async (req: any, res) => {
    try {
      const list = await prisma.notification.findMany({
        where: { userId: req.user.id, isArchived: false },
        orderBy: { createdAt: "desc" },
      });
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/notifications/:id/read", authenticate, async (req: any, res) => {
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
  });

  app.put("/api/notifications/:id/archive", authenticate, async (req: any, res) => {
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
  });

  app.delete("/api/notifications/:id", authenticate, async (req: any, res) => {
    const { id } = req.params;
    try {
      const deleted = await prisma.notification.deleteMany({
        where: { id, userId: req.user.id },
      });
      return res.json({ success: true, count: deleted.count });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // REPORTS ENDPOINTS
  // ----------------------------------------------------

  // ----------------------------------------------------
  // FEEDBACK (bug reports & feature requests)
  // Any authenticated user can report a bug or suggest a feature for the
  // page they are currently on. The report is emailed straight to the
  // maintainer via the existing email dispatch pipeline (Resend/SMTP/
  // simulation, whichever is configured) and is not stored in the DB.
  // ----------------------------------------------------
  const FEEDBACK_RECIPIENT = process.env.FEEDBACK_EMAIL || "dematthi@hotmail.be";

  app.post("/api/feedback", authenticate, async (req: any, res) => {
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
  });

  app.get("/api/reports/summary", authenticate, requireAdmin, async (req, res) => {
    try {
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
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // AUDIT LOGS ENDPOINTS
  // ----------------------------------------------------

  app.get("/api/audit-logs", authenticate, requireAdmin, async (req, res) => {
    try {
      const logs = await prisma.auditLog.findMany({
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return res.json(logs);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // EMAILS ENDPOINTS
  // ----------------------------------------------------

  app.get("/api/emails", authenticate, requireAdmin, async (req, res) => {
    try {
      const list = getSentEmails();
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // ADMIN STAFF MANAGEMENT ENDPOINTS
  // ----------------------------------------------------

  app.get("/api/admin/employees", authenticate, requireAdmin, async (req, res) => {
    try {
      const list = await prisma.user.findMany({
        include: { employee: true },
        orderBy: { name: "asc" },
      });
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/employees", authenticate, requireAdmin, async (req: any, res) => {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "E-mail, naam en wachtwoord zijn verplicht." });
    }

    try {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: "Er bestaat al een account met dit e-mailadres." });
      }

      const passwordHash = hashPassword(password);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: role || "EMPLOYEE",
        },
      });

      // Every user gets an Employee profile, regardless of role, so that
      // administrators can also be assigned to shifts (not just employees).
      const employee = await prisma.employee.create({
        data: {
          userId: user.id,
          preferredShifts: "[]",
          preferredColleagues: "[]",
        },
      });

      await logAction(req.user.id, "ADMIN_CREATE_USER", `Beheerder heeft gebruiker ${user.email} aangemaakt met de rol ${user.role}`);
      return res.status(201).json({ user: { id: user.id, email: user.email, role: user.role, name: user.name, employee } });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/employees/:id", authenticate, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ error: "U kunt uw eigen account niet verwijderen." });
    }

    try {
      const targetUser = await prisma.user.findUnique({
        where: { id },
        include: { employee: true },
      });

      if (!targetUser) {
        return res.status(404).json({ error: "Gebruiker niet gevonden." });
      }

      // If they are an employee, delete related records first to prevent SQLite FK constraint errors
      if (targetUser.employee) {
        const empId = targetUser.employee.id;
        await prisma.shiftAssignment.deleteMany({ where: { employeeId: empId } });
        await prisma.availability.deleteMany({ where: { employeeId: empId } });
        await prisma.leaveRequest.deleteMany({ where: { employeeId: empId } });
        await prisma.shiftChangeRequest.deleteMany({ where: { employeeId: empId } });
        await prisma.swapRequest.deleteMany({
          where: {
            OR: [
              { requesterId: empId },
              { targetId: empId }
            ]
          }
        });
        await prisma.employee.delete({ where: { id: empId } });
      }

      await prisma.notification.deleteMany({ where: { userId: id } });
      await prisma.announcement.deleteMany({ where: { authorId: id } });
      await prisma.user.delete({ where: { id } });

      await logAction(req.user.id, "ADMIN_DELETE_USER", `Beheerder heeft account ${targetUser.email} verwijderd`);
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/admin/employees/:id", authenticate, requireAdmin, async (req: any, res) => {
    const { id } = req.params;
    const { name, email, role, password } = req.body;

    try {
      const userToUpdate = await prisma.user.findUnique({
        where: { id },
        include: { employee: true },
      });

      if (!userToUpdate) {
        return res.status(404).json({ error: "Gebruiker niet gevonden." });
      }

      // Check email collision
      if (email && email !== userToUpdate.email) {
        const collision = await prisma.user.findUnique({ where: { email } });
        if (collision) {
          return res.status(400).json({ error: "Er bestaat al een account met dit e-mailadres." });
        }
      }

      const updateData: any = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (role) updateData.role = role;
      if (password) {
        updateData.passwordHash = hashPassword(password);
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
      });

      // Every user needs an Employee profile, regardless of role, so that
      // administrators can also be assigned to shifts. Back-fill it here for
      // any pre-existing account (e.g. an administrator created before this
      // change) that doesn't have one yet.
      if (!userToUpdate.employee) {
        await prisma.employee.create({
          data: {
            userId: updatedUser.id,
            preferredShifts: "[]",
            preferredColleagues: "[]",
          },
        });
      }

      await logAction(req.user.id, "ADMIN_UPDATE_USER", `Beheerder heeft account van ${updatedUser.email} bijgewerkt`);
      return res.json({ success: true, user: { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name, role: updatedUser.role } });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // ADMIN SETTINGS ENDPOINTS
  // ----------------------------------------------------

  app.get("/api/admin/settings", authenticate, requireAdmin, async (req, res) => {
    try {
      const list = await prisma.setting.findMany({});
      return res.json(list);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/admin/settings", authenticate, requireAdmin, async (req: any, res) => {
    const settingsObj = req.body;
    try {
      for (const [key, value] of Object.entries(settingsObj)) {
        await prisma.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value), description: `${key} instelling` },
        });
      }
      await logAction(req.user.id, "ADMIN_UPDATE_SETTINGS", "Beheerder heeft e-mail- of systeeminstellingen bijgewerkt");
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/users", authenticate, requireAdmin, async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });
      return res.json(users);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/test-email", authenticate, requireAdmin, async (req: any, res) => {
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ error: "Ontvanger e-mailadres is verplicht." });
    }

    try {
      await sendEmailNotification(
        to,
        "Test E-mail - Het Verband Ternat Planner",
        `<h3>Test succesvol!</h3>
         <p>Beste beheerder,</p>
         <p>Dit is een test e-mail om te bevestigen dat uw e-mailnotificatie-instellingen van Het Verband Ternat correct zijn geconfigureerd.</p>
         <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`
      );
      return res.json({ success: true, message: "Test e-mail verzonden!" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/reset-db", authenticate, requireAdmin, async (req: any, res) => {
    try {
      // Clean up all tables in reverse dependency order
      await prisma.shiftChangeRequest.deleteMany({});
      await prisma.swapRequest.deleteMany({});
      await prisma.shiftAssignment.deleteMany({});
      await prisma.availability.deleteMany({});
      await prisma.leaveRequest.deleteMany({});
      await prisma.shift.deleteMany({});
      await prisma.announcement.deleteMany({});
      await prisma.setting.deleteMany({});
      await prisma.notification.deleteMany({});
      await prisma.auditLog.deleteMany({});
      await prisma.employee.deleteMany({});
      await prisma.user.deleteMany({});

      const { seedDatabase } = await import("./server/seed.js");
      await seedDatabase();

      await logAction(null, "DB_RESET", "Database is succesvol gereset naar de standaard Nederlandse seeddata");
      return res.json({ success: true, message: "Database is succesvol gereset!" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // VITE & STATIC FILES SERVING
  // ----------------------------------------------------

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    // Vite fingerprints every file under dist/assets with a content hash
    // (e.g. assets/index-a1b2c3.js), so those are safe to cache aggressively -
    // a new deploy produces new filenames. index.html is NOT fingerprinted and
    // references those hashed filenames, so it must never be cached; otherwise
    // browsers can keep serving a stale index.html that points at
    // JS/CSS bundles which no longer exist after the next build, causing a
    // blank page until the user manually clears their cache.
    app.use(
      express.static(distPath, {
        index: false, // never let express.static implicitly serve/cache index.html
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          } else {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      })
    );
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Shift Planner server running on http://localhost:${PORT}`);
  });
}

startServer();
