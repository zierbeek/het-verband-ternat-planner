import { verifyToken } from "../auth.js";

// Auth Middleware
export const authenticate = async (req: any, res: any, next: any) => {
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

export const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user || req.user.role !== "ADMINISTRATOR") {
    return res.status(403).json({ error: "Forbidden: Administrator access required" });
  }
  next();
};
