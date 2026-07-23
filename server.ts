import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { seedDatabase } from "./server/seed.js";

import { authRouter } from "./server/routes/auth.routes.js";
import { calendarRouter } from "./server/routes/calendar.routes.js";
import { employeesRouter } from "./server/routes/employees.routes.js";
import { shiftsRouter } from "./server/routes/shifts.routes.js";
import { shiftsBulkRouter } from "./server/routes/shifts-bulk.routes.js";
import { shiftPresetsRouter } from "./server/routes/shift-presets.routes.js";
import { shiftTemplatesRouter } from "./server/routes/shift-templates.routes.js";
import { leaveRequestsRouter } from "./server/routes/leave-requests.routes.js";
import { changeRequestsRouter } from "./server/routes/change-requests.routes.js";
import { swapsRouter } from "./server/routes/swaps.routes.js";
import { availabilitiesRouter } from "./server/routes/availabilities.routes.js";
import { announcementsRouter } from "./server/routes/announcements.routes.js";
import { notificationsRouter } from "./server/routes/notifications.routes.js";
import { feedbackRouter } from "./server/routes/feedback.routes.js";
import { reportsRouter } from "./server/routes/reports.routes.js";
import { auditLogsRouter } from "./server/routes/audit-logs.routes.js";
import { emailsRouter } from "./server/routes/emails.routes.js";
import { adminRouter } from "./server/routes/admin.routes.js";
import { apiNotFoundHandler, errorHandler } from "./server/middleware/error.middleware.js";

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

  // ----------------------------------------------------
  // API ROUTES
  // Each router owns one resource area and is fully self-contained (its own
  // imports of prisma/services/middleware) - see server/routes/*.ts.
  // ----------------------------------------------------
  app.use(authRouter);
  app.use(calendarRouter);
  app.use(employeesRouter);
  app.use(shiftsRouter);
  app.use(shiftsBulkRouter);
  app.use(shiftPresetsRouter);
  app.use(shiftTemplatesRouter);
  app.use(leaveRequestsRouter);
  app.use(changeRequestsRouter);
  app.use(swapsRouter);
  app.use(availabilitiesRouter);
  app.use(announcementsRouter);
  app.use(notificationsRouter);
  app.use(feedbackRouter);
  app.use(reportsRouter);
  app.use(auditLogsRouter);
  app.use(emailsRouter);
  app.use(adminRouter);

  // Any /api/* request that didn't match a router above gets a JSON 404
  // instead of falling through to the SPA's HTML catch-all further down.
  app.use("/api", apiNotFoundHandler);

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

  // Must be registered last: catches anything an asyncHandler-wrapped route
  // passed to next(err), or any error thrown by the Vite/static middleware.
  app.use(errorHandler);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Shift Planner server running on http://localhost:${PORT}`);
  });
}

startServer();
