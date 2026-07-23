import express from "express";
import { asyncHandler } from "../middleware/error.middleware.js";
import { prisma } from "../db.js";
import { dateStr } from "../services/shift.service.js";

export const calendarRouter = express.Router();

calendarRouter.get("/api/calendar/sync/:userId/feed.ics", asyncHandler(async (req, res) => {
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
  }));
