import { prisma } from "../db.js";

// Audit Log Helper
export async function logAction(
  userId: string | null,
  action: string,
  details: string,
  oldValue?: any,
  newValue?: any,
  ip?: string
) {
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
