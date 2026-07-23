import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async Express handler so that a rejected promise (e.g. an
 * un-caught `await prisma...` failure) is forwarded to `next(err)` instead of
 * crashing the request or requiring every handler to repeat its own
 * try/catch. Route files that still have their own try/catch keep working
 * exactly as before - this is just a safety net for anything that isn't
 * already handled locally.
 */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Returned for any /api/* request that didn't match a route. Without this,
 * unmatched API paths fall through to the SPA's catch-all and get back an
 * HTML index.html document instead of a JSON 404 - which is confusing to
 * debug from the frontend (fetch().json() fails on HTML).
 */
export function apiNotFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
}

/**
 * Final error-handling middleware. Must be registered last, after every
 * route and after apiNotFoundHandler, and must keep all four parameters
 * (that's how Express recognizes error middleware).
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(err);
  }
  console.error(`[UNHANDLED ERROR] ${req.method} ${req.originalUrl}:`, err);
  const status = typeof err?.status === "number" ? err.status : 500;
  res.status(status).json({ error: err?.message || "Internal server error" });
}
