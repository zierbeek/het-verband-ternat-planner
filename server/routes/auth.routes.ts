import express from "express";
import { asyncHandler } from "../middleware/error.middleware.js";
import { prisma } from "../db.js";
import { hashPassword, comparePassword, generateToken } from "../auth.js";
import { logAction } from "../services/audit.service.js";
import { authenticate } from "../middleware/auth.middleware.js";

export const authRouter = express.Router();

authRouter.post("/api/auth/register", asyncHandler(async (req, res) => {
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
  }));

authRouter.post("/api/auth/login", asyncHandler(async (req, res) => {
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
  }));

authRouter.get("/api/auth/me", authenticate, asyncHandler(async (req: any, res) => {
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
    }));

authRouter.post("/api/auth/complete-first-time-guide", authenticate, asyncHandler(async (req: any, res) => {
      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: { hasCompletedFirstTimeGuide: true },
      });
      return res.json({ success: true, hasCompletedFirstTimeGuide: user.hasCompletedFirstTimeGuide });
    }));
